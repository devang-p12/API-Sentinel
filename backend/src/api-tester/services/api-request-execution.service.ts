import { Injectable, Logger } from '@nestjs/common';
import * as dns from 'dns/promises';
import {
  ApiRequestConfig,
  ApiExecutionResult,
  AssertionResult,
  ApiAssertion,
  TimingBreakdown,
} from '../interfaces/api-request-config.interface';

const BLOCKED_HOSTS = new Set([
  '169.254.169.254',
  '169.254.169.250',
  'metadata.google.internal',
  'metadata',
]);

@Injectable()
export class ApiRequestExecutionService {
  private readonly logger = new Logger(ApiRequestExecutionService.name);

  private readonly maxTimeoutMs = parseInt(
    process.env.API_TEST_MAX_TIMEOUT_MS || '30000',
    10,
  );
  private readonly maxResponseSizeBytes = parseInt(
    process.env.API_TEST_MAX_RESPONSE_SIZE || '10485760', // 10MB default
    10,
  );
  private readonly allowPrivateIps =
    process.env.API_TESTER_ALLOW_PRIVATE_IPS === 'true' ||
    process.env.NODE_ENV === 'test' ||
    process.env.NODE_ENV === 'development';

  /**
   * Main entry point to execute an API request safely.
   */
  async execute(config: ApiRequestConfig): Promise<ApiExecutionResult> {
    const startTime = performance.now();
    const variables = config.variables || {};

    // 1. Resolve variables in URL, headers, queryParams, body, and auth
    const resolvedUrl = this.resolveVariables(config.url || '', variables);
    const resolvedHeaders: Record<string, string> = {};
    if (config.headers) {
      for (const [k, v] of Object.entries(config.headers)) {
        if (k && v !== undefined && v !== null) {
          resolvedHeaders[this.resolveVariables(k, variables)] =
            this.resolveVariables(String(v), variables);
        }
      }
    }

    const resolvedQueryParams: Record<string, string> = {};
    if (config.queryParams) {
      for (const [k, v] of Object.entries(config.queryParams)) {
        if (k && v !== undefined && v !== null) {
          resolvedQueryParams[this.resolveVariables(k, variables)] =
            this.resolveVariables(String(v), variables);
        }
      }
    }

    let resolvedBody = config.body;
    if (resolvedBody && typeof resolvedBody === 'string') {
      resolvedBody = this.resolveVariables(resolvedBody, variables);
    }

    const resolvedAuth = config.auth ? { ...config.auth } : undefined;
    if (resolvedAuth) {
      if (resolvedAuth.token) {
        resolvedAuth.token = this.resolveVariables(resolvedAuth.token, variables);
      }
      if (resolvedAuth.username) {
        resolvedAuth.username = this.resolveVariables(resolvedAuth.username, variables);
      }
      if (resolvedAuth.password) {
        resolvedAuth.password = this.resolveVariables(resolvedAuth.password, variables);
      }
      if (resolvedAuth.apiKeyName) {
        resolvedAuth.apiKeyName = this.resolveVariables(resolvedAuth.apiKeyName, variables);
      }
      if (resolvedAuth.apiKeyValue) {
        resolvedAuth.apiKeyValue = this.resolveVariables(resolvedAuth.apiKeyValue, variables);
      }
    }

    // 2. Validate URL and apply query params
    let currentUrl: string;
    try {
      const urlObj = new URL(resolvedUrl);
      for (const [k, v] of Object.entries(resolvedQueryParams)) {
        urlObj.searchParams.set(k, v);
      }
      currentUrl = urlObj.toString();
    } catch (err: any) {
      return this.createErrorResult(
        null,
        `Invalid URL: ${err.message}`,
        resolvedUrl,
        performance.now() - startTime,
      );
    }

    // 3. SSRF Check for initial URL
    const ssrfCheck = await this.validateUrlSafety(currentUrl);
    if (!ssrfCheck.safe) {
      return this.createErrorResult(
        400,
        `Security Error (SSRF Protection): ${ssrfCheck.reason}`,
        currentUrl,
        performance.now() - startTime,
      );
    }

    // 4. Apply Authentication to headers / queryParams
    if (resolvedAuth) {
      if (resolvedAuth.type === 'bearer' && resolvedAuth.token) {
        resolvedHeaders['Authorization'] = `Bearer ${resolvedAuth.token}`;
      } else if (
        resolvedAuth.type === 'basic' &&
        (resolvedAuth.username || resolvedAuth.password)
      ) {
        const credentials = `${resolvedAuth.username || ''}:${resolvedAuth.password || ''}`;
        resolvedHeaders['Authorization'] = `Basic ${Buffer.from(credentials).toString('base64')}`;
      } else if (resolvedAuth.type === 'apiKey' && resolvedAuth.apiKeyName && resolvedAuth.apiKeyValue) {
        if (resolvedAuth.apiKeyPlacement === 'query') {
          const urlObj = new URL(currentUrl);
          urlObj.searchParams.set(resolvedAuth.apiKeyName, resolvedAuth.apiKeyValue);
          currentUrl = urlObj.toString();
        } else {
          resolvedHeaders[resolvedAuth.apiKeyName] = resolvedAuth.apiKeyValue;
        }
      }
    }

    // 5. Ensure appropriate Content-Type header if body is provided
    if (['POST', 'PUT', 'PATCH'].includes(config.method) && resolvedBody) {
      if (!resolvedHeaders['Content-Type'] && !resolvedHeaders['content-type']) {
        if (config.bodyType === 'json' || this.looksLikeJson(resolvedBody)) {
          resolvedHeaders['Content-Type'] = 'application/json';
        } else if (config.bodyType === 'x-www-form-urlencoded') {
          resolvedHeaders['Content-Type'] = 'application/x-www-form-urlencoded';
        } else {
          resolvedHeaders['Content-Type'] = 'text/plain';
        }
      }
    }

    // Default User-Agent if not set
    if (!resolvedHeaders['User-Agent'] && !resolvedHeaders['user-agent']) {
      resolvedHeaders['User-Agent'] = 'API-Sentinel/1.0 (+https://github.com/api-sentinel)';
    }

    // 6. Timeout and Cancellation
    const effectiveTimeout = Math.min(
      Math.max(config.timeout || 10000, 500),
      this.maxTimeoutMs,
    );
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, effectiveTimeout);

    // 7. Request execution with safe manual redirect handling (up to 5 hops)
    const maxRedirects = 5;
    let redirectCount = 0;
    let finalUrl = currentUrl;
    let lastResponse: Response | null = null;
    let ttfbMs: number | undefined;

    try {
      while (redirectCount <= maxRedirects) {
        const fetchOptions: RequestInit = {
          method: redirectCount === 0 ? config.method : 'GET',
          headers: resolvedHeaders,
          signal: controller.signal,
          redirect: 'manual',
        };

        if (
          redirectCount === 0 &&
          ['POST', 'PUT', 'PATCH'].includes(config.method) &&
          resolvedBody
        ) {
          fetchOptions.body = resolvedBody;
        }

        const ttfbStart = performance.now();
        const response = await fetch(finalUrl, fetchOptions);
        if (!ttfbMs) {
          ttfbMs = Math.round(performance.now() - ttfbStart);
        }

        // Check if redirect
        if ([301, 302, 303, 307, 308].includes(response.status)) {
          const location = response.headers.get('location');
          if (!location) {
            lastResponse = response;
            break;
          }

          redirectCount++;
          if (redirectCount > maxRedirects) {
            clearTimeout(timeoutId);
            return this.createErrorResult(
              508,
              `Exceeded maximum redirect limit (${maxRedirects} hops)`,
              finalUrl,
              performance.now() - startTime,
            );
          }

          // Resolve relative redirect against current URL
          const nextUrl = new URL(location, finalUrl).toString();

          // SSRF validate destination URL
          const redirectSsrf = await this.validateUrlSafety(nextUrl);
          if (!redirectSsrf.safe) {
            clearTimeout(timeoutId);
            return this.createErrorResult(
              400,
              `Security Error on redirect: ${redirectSsrf.reason}`,
              nextUrl,
              performance.now() - startTime,
            );
          }

          finalUrl = nextUrl;
          continue;
        }

        lastResponse = response;
        break;
      }

      clearTimeout(timeoutId);

      if (!lastResponse) {
        return this.createErrorResult(
          null,
          'No response received from target host',
          finalUrl,
          performance.now() - startTime,
        );
      }

      // Check Content-Length before downloading if present
      const reportedLength = lastResponse.headers.get('content-length');
      if (reportedLength) {
        const parsedLen = parseInt(reportedLength, 10);
        if (!isNaN(parsedLen) && parsedLen > this.maxResponseSizeBytes) {
          return this.createErrorResult(
            413,
            `Response Content-Length (${(parsedLen / 1024 / 1024).toFixed(1)} MB) exceeds maximum allowed size of ${(this.maxResponseSizeBytes / 1024 / 1024).toFixed(0)} MB.`,
            finalUrl,
            performance.now() - startTime,
          );
        }
      }

      // Read response body with size limit enforcement
      const rawText = await lastResponse.text();
      const bodyBytes = Buffer.byteLength(rawText, 'utf8');

      if (bodyBytes > this.maxResponseSizeBytes) {
        return this.createErrorResult(
          413,
          `Response payload (${(bodyBytes / 1024 / 1024).toFixed(1)} MB) exceeds maximum allowed size of ${(this.maxResponseSizeBytes / 1024 / 1024).toFixed(0)} MB.`,
          finalUrl,
          performance.now() - startTime,
        );
      }

      const totalDurationMs = Math.round(performance.now() - startTime);

      // Extract headers
      const responseHeaders: Record<string, string> = {};
      const setCookies: string[] = [];
      lastResponse.headers.forEach((value, key) => {
        responseHeaders[key.toLowerCase()] = value;
        if (key.toLowerCase() === 'set-cookie') {
          setCookies.push(value);
        }
      });

      // Parse cookies
      const cookies = this.parseCookies(setCookies);

      // Parse body if JSON
      const contentType = responseHeaders['content-type'] || 'text/plain';
      let parsedBody: any = rawText;
      if (contentType.includes('json') || this.looksLikeJson(rawText)) {
        try {
          parsedBody = JSON.parse(rawText);
        } catch {
          parsedBody = rawText;
        }
      }

      // Evaluate tests / assertions
      const testResults = this.evaluateAssertions(
        config.tests || [],
        lastResponse.status,
        totalDurationMs,
        rawText,
        parsedBody,
      );

      const passedCount = testResults.filter((r) => r.passed).length;
      const failedCount = testResults.length - passedCount;

      const timing: TimingBreakdown = {
        totalMs: totalDurationMs,
        ttfbMs: ttfbMs || Math.min(totalDurationMs, 50),
        downloadMs: Math.max(0, totalDurationMs - (ttfbMs || 0)),
      };

      // Log execution without sensitive credentials
      this.logSanitizedExecution({
        method: config.method,
        url: finalUrl,
        status: lastResponse.status,
        durationMs: totalDurationMs,
        sizeBytes: bodyBytes,
        projectId: config.projectId,
      });

      return {
        status: lastResponse.status,
        statusText: lastResponse.statusText || this.getDefaultStatusText(lastResponse.status),
        headers: responseHeaders,
        cookies,
        body: parsedBody,
        rawBody: rawText,
        contentType,
        size: bodyBytes,
        durationMs: totalDurationMs,
        timing,
        testResults,
        testsSummary: {
          total: testResults.length,
          passed: passedCount,
          failed: failedCount,
        },
        finalUrl,
      };
    } catch (err: any) {
      clearTimeout(timeoutId);
      const durationMs = Math.round(performance.now() - startTime);

      if (err.name === 'AbortError' || controller.signal.aborted) {
        return this.createErrorResult(
          504,
          `Gateway Timeout: Request exceeded the configured timeout of ${(effectiveTimeout / 1000).toFixed(1)} seconds.`,
          finalUrl,
          durationMs,
        );
      }

      let errorMsg = err.message || 'Unknown network error';
      if (err.code === 'ENOTFOUND') {
        errorMsg = `DNS resolution failed: Host could not be found (${finalUrl})`;
      } else if (err.code === 'ECONNREFUSED') {
        errorMsg = `Connection refused: Target host actively rejected the connection`;
      } else if (err.code === 'ECONNRESET') {
        errorMsg = `Connection reset by peer`;
      } else if (err.code === 'CERT_HAS_EXPIRED' || err.message?.includes('certificate')) {
        errorMsg = `TLS/SSL Certificate Error: ${err.message}`;
      }

      return this.createErrorResult(null, errorMsg, finalUrl, durationMs);
    }
  }

  /**
   * SSRF Protection Validator.
   * Blocks local loopback, cloud metadata endpoints, and private IPv4/IPv6 networks.
   */
  async validateUrlSafety(rawUrl: string): Promise<{ safe: boolean; reason?: string }> {
    let parsed: URL;
    try {
      parsed = new URL(rawUrl);
    } catch {
      return { safe: false, reason: 'Malformed URL' };
    }

    // Only allow http and https
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return {
        safe: false,
        reason: `Unsupported URL protocol "${parsed.protocol}". Only HTTP and HTTPS are permitted.`,
      };
    }

    const hostname = parsed.hostname.toLowerCase();

    // Check blocked known cloud metadata / internal hostnames
    if (BLOCKED_HOSTS.has(hostname) || hostname.endsWith('.metadata.google.internal')) {
      return {
        safe: false,
        reason: `Access to cloud metadata endpoints (${hostname}) is strictly prohibited.`,
      };
    }

    // If private IPs are allowed in this environment (e.g. dev testing), skip subnet blocks
    if (this.allowPrivateIps) {
      return { safe: true };
    }

    // Check direct loopback strings
    if (
      hostname === 'localhost' ||
      hostname.endsWith('.localhost') ||
      hostname === '0.0.0.0' ||
      hostname === '127.0.0.1' ||
      hostname === '::1' ||
      hostname === '[::1]'
    ) {
      return {
        safe: false,
        reason: `Access to local loopback addresses (${hostname}) is prohibited.`,
      };
    }

    // Check IP address format or resolve DNS to check target IPs
    try {
      const records = await dns.lookup(hostname, { all: true });
      for (const rec of records) {
        if (this.isPrivateOrRestrictedIp(rec.address)) {
          return {
            safe: false,
            reason: `Resolved IP address ${rec.address} belongs to a private, loopback, or reserved network range.`,
          };
        }
      }
    } catch {
      // If DNS resolution fails, allow fetch to handle the ENOTFOUND error naturally
    }

    return { safe: true };
  }

  /**
   * Checks if an IPv4 or IPv6 address belongs to private or restricted network ranges.
   */
  private isPrivateOrRestrictedIp(ip: string): boolean {
    // IPv6 loopback / unique local
    if (
      ip === '::1' ||
      ip === '::' ||
      ip.startsWith('fe80:') ||
      ip.startsWith('fc00:') ||
      ip.startsWith('fd00:')
    ) {
      return true;
    }

    // IPv4 check
    const parts = ip.split('.').map((p) => parseInt(p, 10));
    if (parts.length === 4 && parts.every((p) => !isNaN(p) && p >= 0 && p <= 255)) {
      const [a, b] = parts;
      // 127.0.0.0/8 (Loopback)
      if (a === 127) return true;
      // 0.0.0.0/8
      if (a === 0) return true;
      // 10.0.0.0/8 (Private)
      if (a === 10) return true;
      // 172.16.0.0/12 (Private)
      if (a === 172 && b >= 16 && b <= 31) return true;
      // 192.168.0.0/16 (Private)
      if (a === 192 && b === 168) return true;
      // 169.254.0.0/16 (Link Local / Metadata)
      if (a === 169 && b === 254) return true;
      // 100.64.0.0/10 (Carrier-grade NAT)
      if (a === 100 && b >= 64 && b <= 127) return true;
    }

    return false;
  }

  /**
   * Evaluates post-execution assertions / tests.
   */
  private evaluateAssertions(
    assertions: ApiAssertion[],
    statusCode: number,
    durationMs: number,
    rawBody: string,
    parsedJson: any,
  ): AssertionResult[] {
    const results: AssertionResult[] = [];

    for (const test of assertions) {
      if (test.enabled === false) continue;

      const name =
        test.name || `${test.type} ${test.target || ''} ${test.expected !== undefined ? test.expected : ''}`.trim();

      switch (test.type) {
        case 'status_code_equals': {
          const expected = parseInt(String(test.expected), 10);
          const passed = statusCode === expected;
          results.push({
            name,
            passed,
            type: test.type,
            expected,
            actual: statusCode,
          });
          break;
        }
        case 'response_time_less_than': {
          const expected = parseFloat(String(test.expected));
          const passed = durationMs < expected;
          results.push({
            name,
            passed,
            type: test.type,
            expected: `< ${expected}ms`,
            actual: `${durationMs}ms`,
          });
          break;
        }
        case 'response_contains_text': {
          const expected = String(test.expected || '');
          const passed = rawBody.includes(expected);
          results.push({
            name,
            passed,
            type: test.type,
            expected: `contains "${expected}"`,
            actual: passed ? 'Found' : 'Not found in body',
          });
          break;
        }
        case 'json_property_exists': {
          const target = test.target || '';
          const value = this.getNestedProperty(parsedJson, target);
          const passed = value !== undefined && value !== null;
          results.push({
            name,
            passed,
            type: test.type,
            expected: `Property "${target}" exists`,
            actual: passed ? 'Exists' : 'Undefined',
          });
          break;
        }
        case 'json_property_equals': {
          const target = test.target || '';
          const value = this.getNestedProperty(parsedJson, target);
          let passed = false;
          if (value !== undefined) {
            passed = String(value) === String(test.expected);
          }
          results.push({
            name,
            passed,
            type: test.type,
            expected: test.expected,
            actual: value !== undefined ? value : 'undefined',
          });
          break;
        }
        default:
          break;
      }
    }

    return results;
  }

  /**
   * Safely gets a nested property from a JSON object using dot/bracket notation.
   */
  private getNestedProperty(obj: any, path: string): any {
    if (!obj || typeof obj !== 'object' || !path) return undefined;
    const parts = path
      .replace(/\[(\w+)\]/g, '.$1')
      .replace(/^\./, '')
      .split('.');

    let current = obj;
    for (const part of parts) {
      if (current === null || current === undefined) return undefined;
      current = current[part];
    }
    return current;
  }

  /**
   * Resolves template variables formatted as {{variableName}}.
   */
  public resolveVariables(
    template: string,
    variables: Record<string, string>,
  ): string {
    if (!template || typeof template !== 'string') return template || '';
    return template.replace(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g, (match, key) => {
      if (key in variables && variables[key] !== undefined && variables[key] !== null) {
        return String(variables[key]);
      }
      return match;
    });
  }

  /**
   * Parses Set-Cookie header strings into structured cookie objects.
   */
  private parseCookies(
    cookieHeaders: string[],
  ): Array<{ name: string; value: string; [key: string]: any }> {
    const cookies: Array<{ name: string; value: string; [key: string]: any }> = [];
    for (const header of cookieHeaders) {
      const parts = header.split(';').map((p) => p.trim());
      if (parts.length === 0) continue;
      const [firstPart, ...attributes] = parts;
      const eqIdx = firstPart.indexOf('=');
      if (eqIdx === -1) continue;

      const name = firstPart.slice(0, eqIdx);
      const value = firstPart.slice(eqIdx + 1);
      const cookieObj: any = { name, value };

      for (const attr of attributes) {
        const [k, v] = attr.split('=').map((s) => s.trim());
        const lowerKey = k.toLowerCase();
        if (lowerKey === 'path') cookieObj.path = v;
        else if (lowerKey === 'domain') cookieObj.domain = v;
        else if (lowerKey === 'expires') cookieObj.expires = v;
        else if (lowerKey === 'httponly') cookieObj.httpOnly = true;
        else if (lowerKey === 'secure') cookieObj.secure = true;
        else if (lowerKey === 'samesite') cookieObj.sameSite = v;
      }

      cookies.push(cookieObj);
    }
    return cookies;
  }

  private looksLikeJson(str: string): boolean {
    const trimmed = str.trim();
    return (
      (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
      (trimmed.startsWith('[') && trimmed.endsWith(']'))
    );
  }

  private getDefaultStatusText(status: number): string {
    const statusMap: Record<number, string> = {
      200: 'OK',
      201: 'Created',
      202: 'Accepted',
      204: 'No Content',
      301: 'Moved Permanently',
      302: 'Found',
      304: 'Not Modified',
      400: 'Bad Request',
      401: 'Unauthorized',
      403: 'Forbidden',
      404: 'Not Found',
      405: 'Method Not Allowed',
      409: 'Conflict',
      413: 'Payload Too Large',
      422: 'Unprocessable Entity',
      429: 'Too Many Requests',
      500: 'Internal Server Error',
      502: 'Bad Gateway',
      503: 'Service Unavailable',
      504: 'Gateway Timeout',
    };
    return statusMap[status] || 'Unknown';
  }

  private createErrorResult(
    status: number | null,
    errorMessage: string,
    url: string,
    durationMs: number,
  ): ApiExecutionResult {
    return {
      status,
      statusText: status ? this.getDefaultStatusText(status) : 'Error',
      headers: {},
      cookies: [],
      body: null,
      rawBody: '',
      contentType: 'text/plain',
      size: 0,
      durationMs: Math.round(durationMs),
      timing: { totalMs: Math.round(durationMs) },
      testResults: [],
      testsSummary: { total: 0, passed: 0, failed: 0 },
      error: errorMessage,
      finalUrl: url,
    };
  }

  /**
   * Logs execution without revealing credentials or secret tokens.
   */
  private logSanitizedExecution(params: {
    method: string;
    url: string;
    status: number | null;
    durationMs: number;
    sizeBytes: number;
    projectId?: string;
  }) {
    // Redact sensitive query parameters if present (e.g. token, key, secret, password)
    let safeUrl = params.url;
    try {
      const u = new URL(params.url);
      const sensitiveKeys = ['token', 'key', 'secret', 'password', 'apikey', 'auth'];
      for (const [k] of u.searchParams.entries()) {
        if (sensitiveKeys.some((s) => k.toLowerCase().includes(s))) {
          u.searchParams.set(k, '***REDACTED***');
        }
      }
      safeUrl = u.toString();
    } catch {}

    this.logger.log(
      `[ApiTester] ${params.method} ${safeUrl} -> status=${params.status || 'ERR'} duration=${params.durationMs}ms size=${params.sizeBytes}B project=${params.projectId || 'none'}`,
    );
  }
}

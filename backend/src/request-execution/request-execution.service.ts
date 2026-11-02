import { Injectable, Logger } from '@nestjs/common';
import * as dns from 'dns/promises';
import {
  HttpRequestOptions,
  HttpResponseResult,
  TimingBreakdown,
} from './interfaces/request-execution.interface';

const BLOCKED_HOSTS = new Set([
  '169.254.169.254',
  '169.254.169.250',
  'metadata.google.internal',
  'metadata',
]);

@Injectable()
export class RequestExecutionService {
  private readonly logger = new Logger(RequestExecutionService.name);

  // Global defaults configurable via environment variables
  private readonly defaultTimeoutMs = parseInt(
    process.env.API_REQUEST_DEFAULT_TIMEOUT_MS || '10000',
    10,
  );
  private readonly defaultMaxTimeoutMs = parseInt(
    process.env.API_REQUEST_MAX_TIMEOUT_MS || '30000',
    10,
  );
  private readonly defaultMaxResponseSizeBytes = parseInt(
    process.env.API_REQUEST_MAX_RESPONSE_SIZE || '10485760', // 10MB default
    10,
  );
  private readonly allowPrivateIps =
    process.env.API_TESTER_ALLOW_PRIVATE_IPS === 'true' ||
    process.env.API_REQUEST_ALLOW_PRIVATE_IPS === 'true' ||
    process.env.NODE_ENV === 'test' ||
    process.env.NODE_ENV === 'development';

  /**
   * Universal HTTP Request Executor used by API Tester and Monitoring Workers.
   */
  async execute(options: HttpRequestOptions): Promise<HttpResponseResult> {
    const startTime = performance.now();
    const rawMethod = (options.method || 'GET').toUpperCase();
    const method = rawMethod;

    // 1. Validate & Parse URL (Malformed URL Handling)
    let parsedUrl: URL;
    try {
      if (!options.url || typeof options.url !== 'string') {
        return this.createMalformedUrlResult(
          options.url,
          'URL must be a non-empty string',
          startTime,
        );
      }

      parsedUrl = new URL(options.url.trim());
      if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
        return this.createMalformedUrlResult(
          options.url,
          `Invalid protocol "${parsedUrl.protocol}". Only "http:" and "https:" are allowed`,
          startTime,
        );
      }
    } catch (err: any) {
      return this.createMalformedUrlResult(
        options.url,
        `Malformed URL: ${err.message}`,
        startTime,
      );
    }

    // 2. Append / Merge Query Parameters
    if (options.queryParams && typeof options.queryParams === 'object') {
      for (const [key, value] of Object.entries(options.queryParams)) {
        if (key && value !== undefined && value !== null) {
          parsedUrl.searchParams.set(key, String(value));
        }
      }
    }
    let currentUrl = parsedUrl.toString();

    // 3. Security & SSRF Validation
    const allowPrivate = options.allowPrivateIps ?? this.allowPrivateIps;
    const ssrfCheck = await this.validateUrlSafety(currentUrl, allowPrivate);
    if (!ssrfCheck.safe) {
      return this.createErrorResult({
        statusCode: 400,
        statusText: 'Bad Request',
        error: `Security Error (SSRF Protection): ${ssrfCheck.reason}`,
        url: currentUrl,
        startTime,
        isNetworkError: false,
        isTimeout: false,
        isMalformedUrl: false,
      });
    }

    // 4. Headers & Authentication Setup
    const headers: Record<string, string> = {
      'User-Agent': 'API-Sentinel/1.0 (+https://github.com/api-sentinel)',
      ...(options.headers || {}),
    };

    // Apply Authentication
    if (options.auth) {
      const auth = options.auth;
      if (auth.type === 'bearer' && auth.token) {
        headers['Authorization'] = `Bearer ${auth.token}`;
      } else if (auth.type === 'basic' && (auth.username || auth.password)) {
        const credentials = `${auth.username || ''}:${auth.password || ''}`;
        headers['Authorization'] = `Basic ${Buffer.from(credentials).toString('base64')}`;
      } else if (auth.type === 'apiKey' && auth.apiKeyName && auth.apiKeyValue) {
        if (auth.apiKeyPlacement === 'query') {
          const urlObj = new URL(currentUrl);
          urlObj.searchParams.set(auth.apiKeyName, auth.apiKeyValue);
          currentUrl = urlObj.toString();
        } else {
          headers[auth.apiKeyName] = auth.apiKeyValue;
        }
      }
    }

    // 5. Body & Content-Type Setup
    let requestBody: any = undefined;
    const allowsBody = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);

    if (allowsBody && options.body !== undefined && options.body !== null) {
      if (typeof options.body === 'object' && !(options.body instanceof Buffer)) {
        requestBody = JSON.stringify(options.body);
        if (!this.getHeaderCaseInsensitive(headers, 'Content-Type')) {
          headers['Content-Type'] = 'application/json';
        }
      } else if (typeof options.body === 'string') {
        requestBody = options.body;
        if (!this.getHeaderCaseInsensitive(headers, 'Content-Type')) {
          if (options.bodyType === 'json' || this.looksLikeJson(options.body)) {
            headers['Content-Type'] = 'application/json';
          } else if (options.bodyType === 'x-www-form-urlencoded') {
            headers['Content-Type'] = 'application/x-www-form-urlencoded';
          } else {
            headers['Content-Type'] = 'text/plain';
          }
        }
      } else {
        requestBody = options.body;
      }
    }

    // 6. Timeout Limits & Handling
    const maxTimeout = options.maxTimeoutMs || this.defaultMaxTimeoutMs;
    const requestedTimeout = options.timeoutMs || this.defaultTimeoutMs;
    // Clamp timeout between 50ms and maxTimeout (Request Timeout Limits)
    const effectiveTimeoutMs = Math.min(Math.max(requestedTimeout, 50), maxTimeout);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, effectiveTimeoutMs);

    // 7. Response-Size Limits Setup
    const maxResponseSizeBytes =
      options.maxResponseSizeBytes || this.defaultMaxResponseSizeBytes;

    // 8. Redirect Handling & Execution Loop
    const maxRedirects = options.followRedirects === false ? 0 : options.maxRedirects || 5;
    let redirectCount = 0;
    let finalUrl = currentUrl;
    let lastResponse: Response | null = null;
    let ttfbMs: number | undefined;

    try {
      while (redirectCount <= maxRedirects) {
        const fetchOptions: RequestInit = {
          method: redirectCount === 0 ? method : 'GET',
          headers,
          signal: controller.signal,
          redirect: 'manual',
        };

        if (redirectCount === 0 && allowsBody && requestBody !== undefined) {
          fetchOptions.body = requestBody;
        }

        const ttfbStart = performance.now();
        const response = await fetch(finalUrl, fetchOptions);
        if (!ttfbMs) {
          ttfbMs = Math.round(performance.now() - ttfbStart);
        }

        // Check for HTTP Redirects
        if ([301, 302, 303, 307, 308].includes(response.status)) {
          const location = response.headers.get('location');
          if (!location || options.followRedirects === false) {
            lastResponse = response;
            break;
          }

          redirectCount++;
          if (redirectCount > maxRedirects) {
            clearTimeout(timeoutId);
            return this.createErrorResult({
              statusCode: 508,
              statusText: 'Loop Detected',
              error: `Exceeded maximum redirect limit (${maxRedirects} hops)`,
              url: finalUrl,
              startTime,
              isNetworkError: false,
              isTimeout: false,
              isMalformedUrl: false,
            });
          }

          const nextUrl = new URL(location, finalUrl).toString();
          const redirectSsrf = await this.validateUrlSafety(nextUrl, allowPrivate);
          if (!redirectSsrf.safe) {
            clearTimeout(timeoutId);
            return this.createErrorResult({
              statusCode: 400,
              statusText: 'Bad Request',
              error: `Security Error on redirect: ${redirectSsrf.reason}`,
              url: nextUrl,
              startTime,
              isNetworkError: false,
              isTimeout: false,
              isMalformedUrl: false,
            });
          }

          finalUrl = nextUrl;
          continue;
        }

        lastResponse = response;
        break;
      }

      clearTimeout(timeoutId);

      if (!lastResponse) {
        return this.createErrorResult({
          statusCode: null,
          statusText: null,
          error: 'No response received from target host',
          url: finalUrl,
          startTime,
          isNetworkError: true,
          isTimeout: false,
          isMalformedUrl: false,
        });
      }

      // Check Content-Length Header for Response Size Limit
      const reportedLength = lastResponse.headers.get('content-length');
      if (reportedLength) {
        const parsedLen = parseInt(reportedLength, 10);
        if (!isNaN(parsedLen) && parsedLen > maxResponseSizeBytes) {
          return this.createErrorResult({
            statusCode: 413,
            statusText: 'Payload Too Large',
            error: `Response Content-Length (${(parsedLen / 1024 / 1024).toFixed(1)} MB) exceeds maximum allowed size of ${(maxResponseSizeBytes / 1024 / 1024).toFixed(0)} MB.`,
            url: finalUrl,
            startTime,
            isNetworkError: false,
            isTimeout: false,
            isMalformedUrl: false,
          });
        }
      }

      // Read Response Body with Size Limit Enforcement
      const rawText = await lastResponse.text();
      const bodyBytes = Buffer.byteLength(rawText, 'utf8');

      if (bodyBytes > maxResponseSizeBytes) {
        return this.createErrorResult({
          statusCode: 413,
          statusText: 'Payload Too Large',
          error: `Response payload (${(bodyBytes / 1024 / 1024).toFixed(1)} MB) exceeds maximum allowed size of ${(maxResponseSizeBytes / 1024 / 1024).toFixed(0)} MB.`,
          url: finalUrl,
          startTime,
          isNetworkError: false,
          isTimeout: false,
          isMalformedUrl: false,
        });
      }

      const totalDurationMs = Math.round(performance.now() - startTime);

      // Extract & Sanitize Headers
      const responseHeaders: Record<string, string> = {};
      const setCookies: string[] = [];
      lastResponse.headers.forEach((value, key) => {
        const lowerKey = key.toLowerCase();
        responseHeaders[lowerKey] = value;
        if (lowerKey === 'set-cookie') {
          setCookies.push(value);
        }
      });

      // Parse Cookies
      const cookies = this.parseCookies(setCookies);

      // Parse JSON body if appropriate
      const contentType = responseHeaders['content-type'] || 'text/plain';
      let parsedBody: any = rawText;
      if (contentType.includes('json') || this.looksLikeJson(rawText)) {
        try {
          parsedBody = JSON.parse(rawText);
        } catch {
          parsedBody = rawText;
        }
      }

      const timing: TimingBreakdown = {
        totalMs: totalDurationMs,
        ttfbMs: ttfbMs || Math.min(totalDurationMs, 50),
        downloadMs: Math.max(0, totalDurationMs - (ttfbMs || 0)),
      };

      return {
        success: lastResponse.status >= 200 && lastResponse.status < 400,
        statusCode: lastResponse.status,
        statusText: lastResponse.statusText || this.getDefaultStatusText(lastResponse.status),
        headers: responseHeaders,
        cookies,
        body: parsedBody,
        rawBody: rawText,
        contentType,
        sizeBytes: bodyBytes,
        durationMs: totalDurationMs,
        timing,
        finalUrl,
        error: null,
        isTimeout: false,
        isNetworkError: false,
        isMalformedUrl: false,
      };
    } catch (err: any) {
      clearTimeout(timeoutId);
      const durationMs = Math.round(performance.now() - startTime);

      // Timeout Error
      if (err.name === 'AbortError' || controller.signal.aborted) {
        return {
          success: false,
          statusCode: 504,
          statusText: 'Gateway Timeout',
          headers: {},
          cookies: [],
          body: null,
          rawBody: '',
          contentType: null,
          sizeBytes: 0,
          durationMs,
          timing: { totalMs: durationMs, ttfbMs: durationMs, downloadMs: 0 },
          finalUrl,
          error: `Request timed out after ${effectiveTimeoutMs}ms`,
          isTimeout: true,
          isNetworkError: false,
          isMalformedUrl: false,
        };
      }

      // Network / DNS / SSL Error
      const code = err.code || err.cause?.code;
      const causeMsg = err.cause?.message || '';
      let errorMsg = err.message || 'Unknown network error';

      if (code === 'ENOTFOUND' || causeMsg.includes('getaddrinfo ENOTFOUND') || err.message?.includes('ENOTFOUND')) {
        errorMsg = `DNS resolution failed: Host could not be found (${finalUrl})`;
      } else if (code === 'ECONNREFUSED' || causeMsg.includes('ECONNREFUSED')) {
        errorMsg = `Connection refused: Target host actively rejected the connection`;
      } else if (code === 'ECONNRESET' || causeMsg.includes('ECONNRESET')) {
        errorMsg = `Connection reset by peer`;
      } else if (code === 'CERT_HAS_EXPIRED' || err.message?.includes('certificate') || causeMsg.includes('certificate')) {
        errorMsg = `TLS/SSL Certificate Error: ${err.message || causeMsg}`;
      } else if (causeMsg) {
        errorMsg = `${errorMsg}: ${causeMsg}`;
      }

      return {
        success: false,
        statusCode: null,
        statusText: null,
        headers: {},
        cookies: [],
        body: null,
        rawBody: '',
        contentType: null,
        sizeBytes: 0,
        durationMs,
        timing: { totalMs: durationMs, ttfbMs: durationMs, downloadMs: 0 },
        finalUrl,
        error: errorMsg,
        isTimeout: false,
        isNetworkError: true,
        isMalformedUrl: false,
      };
    }
  }

  /**
   * SSRF Protection & URL safety check.
   */
  async validateUrlSafety(
    rawUrl: string,
    allowPrivate: boolean,
  ): Promise<{ safe: boolean; reason?: string }> {
    try {
      const parsed = new URL(rawUrl);
      const hostname = parsed.hostname.toLowerCase();

      // Block metadata service endpoints
      if (BLOCKED_HOSTS.has(hostname)) {
        return { safe: false, reason: 'Access to cloud metadata endpoints is strictly blocked' };
      }

      // If private IPs allowed (test/dev environment), permit localhost
      if (allowPrivate) {
        return { safe: true };
      }

      // Block localhost, link-local, loopback
      if (
        hostname === 'localhost' ||
        hostname.endsWith('.localhost') ||
        hostname === '127.0.0.1' ||
        hostname === '::1'
      ) {
        return { safe: false, reason: 'Access to loopback/localhost is restricted in production' };
      }

      // Resolve DNS to verify IP range
      try {
        const addresses = await dns.lookup(hostname, { all: true });
        for (const addr of addresses) {
          if (this.isPrivateIp(addr.address)) {
            return {
              safe: false,
              reason: `Host resolves to restricted private network IP: ${addr.address}`,
            };
          }
        }
      } catch {
        // DNS failure will be caught during fetch
      }

      return { safe: true };
    } catch (err: any) {
      return { safe: false, reason: `Invalid URL: ${err.message}` };
    }
  }

  private isPrivateIp(ip: string): boolean {
    if (BLOCKED_HOSTS.has(ip)) return true;
    if (ip.startsWith('127.') || ip === '::1') return true;
    if (ip.startsWith('10.')) return true;
    if (ip.startsWith('192.168.')) return true;
    if (ip.startsWith('169.254.')) return true;
    const parts = ip.split('.').map((p) => parseInt(p, 10));
    if (parts.length === 4 && parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) {
      return true;
    }
    return false;
  }

  private createMalformedUrlResult(
    url: any,
    reason: string,
    startTime: number,
  ): HttpResponseResult {
    const durationMs = Math.round(performance.now() - startTime);
    return {
      success: false,
      statusCode: null,
      statusText: null,
      headers: {},
      cookies: [],
      body: null,
      rawBody: '',
      contentType: null,
      sizeBytes: 0,
      durationMs,
      timing: { totalMs: durationMs, ttfbMs: 0, downloadMs: 0 },
      finalUrl: String(url || ''),
      error: `Malformed URL: ${reason}`,
      isTimeout: false,
      isNetworkError: false,
      isMalformedUrl: true,
    };
  }

  private createErrorResult(opts: {
    statusCode: number | null;
    statusText: string | null;
    error: string;
    url: string;
    startTime: number;
    isNetworkError: boolean;
    isTimeout: boolean;
    isMalformedUrl: boolean;
  }): HttpResponseResult {
    const durationMs = Math.round(performance.now() - opts.startTime);
    return {
      success: false,
      statusCode: opts.statusCode,
      statusText: opts.statusText,
      headers: {},
      cookies: [],
      body: null,
      rawBody: '',
      contentType: null,
      sizeBytes: 0,
      durationMs,
      timing: { totalMs: durationMs, ttfbMs: durationMs, downloadMs: 0 },
      finalUrl: opts.url,
      error: opts.error,
      isTimeout: opts.isTimeout,
      isNetworkError: opts.isNetworkError,
      isMalformedUrl: opts.isMalformedUrl,
    };
  }

  private getHeaderCaseInsensitive(headers: Record<string, string>, target: string): string | undefined {
    const targetLower = target.toLowerCase();
    for (const [key, val] of Object.entries(headers)) {
      if (key.toLowerCase() === targetLower) {
        return val;
      }
    }
    return undefined;
  }

  private looksLikeJson(str: string): boolean {
    const trimmed = str.trim();
    return (
      (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
      (trimmed.startsWith('[') && trimmed.endsWith(']'))
    );
  }

  private parseCookies(cookieHeaders: string[]): Array<{ name: string; value: string }> {
    const cookies: Array<{ name: string; value: string }> = [];
    for (const header of cookieHeaders) {
      const parts = header.split(';')[0]?.trim();
      if (parts) {
        const eqIdx = parts.indexOf('=');
        if (eqIdx !== -1) {
          cookies.push({
            name: parts.slice(0, eqIdx).trim(),
            value: parts.slice(eqIdx + 1).trim(),
          });
        }
      }
    }
    return cookies;
  }

  private getDefaultStatusText(status: number): string {
    const map: Record<number, string> = {
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
    return map[status] || 'Unknown';
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { RequestExecutionService } from '../../request-execution/request-execution.service';
import {
  ApiRequestConfig,
  ApiExecutionResult,
  AssertionResult,
  ApiAssertion,
  TimingBreakdown,
} from '../interfaces/api-request-config.interface';

@Injectable()
export class ApiRequestExecutionService {
  private readonly logger = new Logger(ApiRequestExecutionService.name);

  constructor(
    private readonly requestExecutionService: RequestExecutionService,
  ) {}

  /**
   * Main entry point to execute an API request safely using the shared RequestExecutionService.
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

    // 2. Delegate HTTP execution to the shared RequestExecutionService
    const httpRes = await this.requestExecutionService.execute({
      method: config.method,
      url: resolvedUrl,
      queryParams: resolvedQueryParams,
      headers: resolvedHeaders,
      auth: resolvedAuth,
      body: resolvedBody,
      bodyType: config.bodyType,
      timeoutMs: config.timeout,
    });

    // 3. Handle network, timeout, or malformed URL errors
    if (!httpRes.success && (httpRes.isNetworkError || httpRes.isTimeout || httpRes.isMalformedUrl || httpRes.statusCode === null)) {
      return this.createErrorResult(
        httpRes.statusCode,
        httpRes.error || 'Execution failed',
        httpRes.finalUrl || resolvedUrl,
        httpRes.durationMs,
      );
    }

    // 4. Evaluate assertions / tests against the response
    const testResults = this.evaluateAssertions(
      config.tests || [],
      httpRes.statusCode || 0,
      httpRes.durationMs,
      httpRes.rawBody,
      httpRes.body,
    );

    const passedCount = testResults.filter((r) => r.passed).length;
    const failedCount = testResults.length - passedCount;

    // 5. Log execution without revealing sensitive credentials
    this.logSanitizedExecution({
      method: config.method,
      url: httpRes.finalUrl,
      status: httpRes.statusCode,
      durationMs: httpRes.durationMs,
      sizeBytes: httpRes.sizeBytes,
      projectId: config.projectId,
    });

    return {
      status: httpRes.statusCode,
      statusText: httpRes.statusText || this.getDefaultStatusText(httpRes.statusCode || 200),
      headers: httpRes.headers,
      cookies: httpRes.cookies,
      body: httpRes.body,
      rawBody: httpRes.rawBody,
      contentType: httpRes.contentType || 'text/plain',
      size: httpRes.sizeBytes,
      durationMs: httpRes.durationMs,
      timing: {
        totalMs: httpRes.timing.totalMs,
        ttfbMs: httpRes.timing.ttfbMs,
        downloadMs: httpRes.timing.downloadMs,
      },
      testResults,
      testsSummary: {
        total: testResults.length,
        passed: passedCount,
        failed: failedCount,
      },
      finalUrl: httpRes.finalUrl,
      error: httpRes.error,
    };
  }


  /**
   * SSRF Protection Validator.
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

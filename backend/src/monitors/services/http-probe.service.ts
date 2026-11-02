import { Injectable, Logger } from '@nestjs/common';
import { ExecutionStatus, HttpMethod } from '@prisma/client';
import { RequestExecutionService } from '../../request-execution/request-execution.service';

export interface ProbeTarget {
  method: HttpMethod;
  url: string;
  queryParams?: Record<string, string | number>;
  headers?: Record<string, string>;
  body?: string;
  timeoutMs: number;
  expectedStatusCode?: number;
  assertions?: any[];
}

export interface ProbeResult {
  status: ExecutionStatus;
  statusCode: number | null;
  responseTimeMs: number;
  responseSize: number | null;
  responseHeaders: Record<string, string> | null;
  responseBody?: any;
  errorMessage: string | null;
  assertionResults: any;
  isTimeout: boolean;
  isNetworkError: boolean;
  errorType: string | null;
  schemaValid: boolean | null;
}

@Injectable()
export class HttpProbeService {
  private readonly logger = new Logger(HttpProbeService.name);

  constructor(
    private readonly requestExecutionService: RequestExecutionService,
  ) {}

  async probe(target: ProbeTarget): Promise<ProbeResult> {
    const res = await this.requestExecutionService.execute({
      method: target.method,
      url: target.url,
      queryParams: target.queryParams,
      headers: target.headers,
      body: target.body,
      timeoutMs: target.timeoutMs,
      // Probes typically only need up to 64KB for health checking
      maxResponseSizeBytes: 65536,
    });

    // 1. Handle Timeout
    if (res.isTimeout) {
      this.logger.warn(`Probe to ${target.url} timed out after ${target.timeoutMs}ms`);
      return {
        status: ExecutionStatus.TIMEOUT,
        statusCode: null,
        responseTimeMs: res.durationMs,
        responseSize: null,
        responseHeaders: null,
        errorMessage: res.error || `Request timed out after ${target.timeoutMs}ms`,
        assertionResults: [
          {
            type: 'timeout',
            timeoutMs: target.timeoutMs,
            passed: false,
          },
        ],
        isTimeout: true,
        isNetworkError: false,
        errorType: 'TIMEOUT',
        schemaValid: null,
      };
    }

    // 2. Handle Network or Malformed URL Errors
    if (res.isNetworkError || res.isMalformedUrl || res.statusCode === null) {
      this.logger.warn(`Probe to ${target.url} failed with error: ${res.error}`);
      return {
        status: ExecutionStatus.ERROR,
        statusCode: null,
        responseTimeMs: res.durationMs,
        responseSize: null,
        responseHeaders: null,
        errorMessage: res.error || 'Network error during probe execution',
        assertionResults: [
          {
            type: 'connectivity',
            passed: false,
            error: res.error,
          },
        ],
        isTimeout: false,
        isNetworkError: true,
        errorType: 'NETWORK_ERROR',
        schemaValid: null,
      };
    }

    // 3. Process Successful or HTTP-Level Error Response
    const responseHeaders: Record<string, string> = {};
    for (const [key, value] of Object.entries(res.headers)) {
      if (['set-cookie', 'authorization'].includes(key.toLowerCase())) {
        responseHeaders[key] = '***REDACTED***';
      } else {
        responseHeaders[key] = value;
      }
    }

    const expectedStatus = target.expectedStatusCode || 200;
    const statusMatched = res.statusCode === expectedStatus;

    const assertionResults: any = [
      {
        type: 'statusCode',
        expected: expectedStatus,
        actual: res.statusCode,
        passed: statusMatched,
      },
    ];

    let isSuccess = statusMatched;
    let errorMessage: string | null = null;
    let errorType: string | null = null;

    if (!statusMatched) {
      isSuccess = false;
      errorMessage = `Expected HTTP status ${expectedStatus}, received ${res.statusCode}`;
      if (res.statusCode >= 500) {
        errorType = 'HTTP_5XX';
      } else if (res.statusCode >= 400) {
        errorType = 'HTTP_4XX';
      } else {
        errorType = 'HTTP_STATUS_MISMATCH';
      }
    }

    // Evaluate Schema Assertions
    let schemaValid: boolean | null = null;
    const schemaAssertion = (target.assertions || []).find(
      (a: any) => a && (a.type === 'schema' || a.type === 'json_schema'),
    );
    if (schemaAssertion) {
      let parsedBody: any = res.body;
      schemaValid = true;
      const schemaErrors: string[] = [];

      if (!parsedBody || typeof parsedBody !== 'object') {
        try {
          parsedBody = JSON.parse(res.rawBody);
        } catch {
          schemaValid = false;
          schemaErrors.push('Response body is not valid JSON');
        }
      }

      if (parsedBody && typeof parsedBody === 'object') {
        if (Array.isArray(schemaAssertion.requiredKeys)) {
          for (const key of schemaAssertion.requiredKeys) {
            if (parsedBody[key] === undefined) {
              schemaValid = false;
              schemaErrors.push(`Missing required field: "${key}"`);
            }
          }
        }

        if (
          schemaAssertion.propertyTypes &&
          typeof schemaAssertion.propertyTypes === 'object'
        ) {
          for (const [field, expectedType] of Object.entries(
            schemaAssertion.propertyTypes,
          )) {
            if (parsedBody[field] !== undefined) {
              const actualType = Array.isArray(parsedBody[field])
                ? 'array'
                : typeof parsedBody[field];
              if (actualType !== expectedType) {
                schemaValid = false;
                schemaErrors.push(
                  `Field "${field}" expected type ${expectedType}, found ${actualType}`,
                );
              }
            }
          }
        }
      }

      assertionResults.push({
        type: 'schema',
        passed: schemaValid,
        errors: schemaErrors,
      });

      if (!schemaValid) {
        isSuccess = false;
        errorType = 'SCHEMA_ERROR';
        const schemaMsg = `Schema contract violation: ${schemaErrors.join('; ')}`;
        errorMessage = errorMessage ? `${errorMessage} | ${schemaMsg}` : schemaMsg;
      }
    }

    let responseBody = res.body;
    if (responseBody === undefined && res.rawBody) {
      try {
        responseBody = JSON.parse(res.rawBody);
      } catch {
        responseBody = res.rawBody;
      }
    }

    return {
      status: isSuccess ? ExecutionStatus.SUCCESS : ExecutionStatus.FAILED,
      statusCode: res.statusCode,
      responseTimeMs: res.durationMs,
      responseSize: res.sizeBytes,
      responseHeaders,
      responseBody,
      errorMessage,
      assertionResults,
      isTimeout: false,
      isNetworkError: false,
      errorType: isSuccess ? null : errorType,
      schemaValid,
    };
  }
}

export { HttpProbeService as HttpMonitorClient };

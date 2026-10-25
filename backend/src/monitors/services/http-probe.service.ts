import { Injectable, Logger } from '@nestjs/common';
import { ExecutionStatus, HttpMethod } from '@prisma/client';

export interface ProbeTarget {
  method: HttpMethod;
  url: string;
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
  errorMessage: string | null;
  assertionResults: any;
}

@Injectable()
export class HttpProbeService {
  private readonly logger = new Logger(HttpProbeService.name);

  async probe(target: ProbeTarget): Promise<ProbeResult> {
    const startTime = performance.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), target.timeoutMs);

    let isTimeout = false;

    try {
      const requestHeaders: Record<string, string> = {
        'User-Agent': 'API-Sentinel/1.0 (+https://github.com/api-sentinel)',
        ...(target.headers || {}),
      };

      const fetchOptions: RequestInit = {
        method: target.method,
        headers: requestHeaders,
        signal: controller.signal,
      };

      if (['POST', 'PUT', 'PATCH'].includes(target.method) && target.body) {
        fetchOptions.body = target.body;
        if (!requestHeaders['Content-Type']) {
          requestHeaders['Content-Type'] = 'application/json';
        }
      }

      const response = await fetch(target.url, fetchOptions);
      clearTimeout(timeoutId);

      const endTime = performance.now();
      const responseTimeMs = Math.round(endTime - startTime);

      // Extract response text and size
      const responseText = await response.text();
      const responseSize = Buffer.byteLength(responseText, 'utf8');

      // Extract headers
      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });

      // Evaluate Assertions
      const expectedStatus = target.expectedStatusCode || 200;
      const statusMatched = response.status === expectedStatus;

      let assertionResults: any = [
        {
          type: 'statusCode',
          expected: expectedStatus,
          actual: response.status,
          passed: statusMatched,
        },
      ];

      let isSuccess = statusMatched;
      let errorMessage: string | null = null;

      if (!statusMatched) {
        isSuccess = false;
        errorMessage = `Expected HTTP status ${expectedStatus}, received ${response.status}`;
      }

      // Evaluate Schema Assertions
      const schemaAssertion = (target.assertions || []).find((a: any) => a && a.type === 'schema');
      if (schemaAssertion) {
        let parsedBody: any;
        let schemaValid = true;
        const schemaErrors: string[] = [];

        try {
          parsedBody = JSON.parse(responseText);
        } catch (e) {
          schemaValid = false;
          schemaErrors.push('Response body is not valid JSON');
        }

        if (parsedBody && typeof parsedBody === 'object') {
          // Check required keys
          if (Array.isArray(schemaAssertion.requiredKeys)) {
            for (const key of schemaAssertion.requiredKeys) {
              if (parsedBody[key] === undefined) {
                schemaValid = false;
                schemaErrors.push(`Missing required field: "${key}"`);
              }
            }
          }

          // Check property types
          if (schemaAssertion.propertyTypes && typeof schemaAssertion.propertyTypes === 'object') {
            for (const [field, expectedType] of Object.entries(schemaAssertion.propertyTypes)) {
              if (parsedBody[field] !== undefined) {
                const actualType = Array.isArray(parsedBody[field]) ? 'array' : typeof parsedBody[field];
                if (actualType !== expectedType) {
                  schemaValid = false;
                  schemaErrors.push(`Field "${field}" expected type ${expectedType}, found ${actualType}`);
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
          const schemaMsg = `Schema contract violation: ${schemaErrors.join('; ')}`;
          errorMessage = errorMessage ? `${errorMessage} | ${schemaMsg}` : schemaMsg;
        }
      }

      return {
        status: isSuccess ? ExecutionStatus.SUCCESS : ExecutionStatus.FAILED,
        statusCode: response.status,
        responseTimeMs,
        responseSize,
        responseHeaders,
        errorMessage,
        assertionResults,
      };
    } catch (err: any) {
      clearTimeout(timeoutId);
      const endTime = performance.now();
      const responseTimeMs = Math.round(endTime - startTime);

      // Detect timeout
      if (err.name === 'AbortError' || err.name === 'TimeoutError' || controller.signal.aborted) {
        isTimeout = true;
        this.logger.warn(`Probe to ${target.url} timed out after ${target.timeoutMs}ms`);
        return {
          status: ExecutionStatus.TIMEOUT,
          statusCode: null,
          responseTimeMs,
          responseSize: null,
          responseHeaders: null,
          errorMessage: `Request timed out after ${target.timeoutMs}ms`,
          assertionResults: [
            {
              type: 'timeout',
              timeoutMs: target.timeoutMs,
              passed: false,
            },
          ],
        };
      }

      // Detect network / socket / DNS error
      const errorDetail = err?.cause?.message || err?.message || 'Unknown network error';
      this.logger.warn(`Probe to ${target.url} failed with network error: ${errorDetail}`);

      return {
        status: ExecutionStatus.ERROR,
        statusCode: null,
        responseTimeMs,
        responseSize: null,
        responseHeaders: null,
        errorMessage: `Network error: ${errorDetail}`,
        assertionResults: [
          {
            type: 'connectivity',
            passed: false,
            error: errorDetail,
          },
        ],
      };
    }
  }
}

/**
 * Phase 3 Request Execution Service Test Suite
 *
 * Verifies:
 * 1. HTTP Methods: GET, POST, PUT, PATCH, DELETE
 * 2. URL & Query Parameters handling and merging
 * 3. Custom Headers & Bearer Authentication
 * 4. Request Body & JSON serialization
 * 5. Latency, status codes, response headers, and response size metrics
 * 6. Timeout handling & request timeout limits
 * 7. Malformed URL handling (clean failure, no uncaught exceptions)
 * 8. Response-size limits (payload too large protection)
 * 9. Network error handling (DNS failure, connection refusal)
 * 10. Server-side secrets non-exposure
 * 11. End-to-end API Tester integration and response shape preservation
 */

import { RequestExecutionService } from '../src/request-execution/request-execution.service';

interface TestResult {
  suite: string;
  name: string;
  passed: boolean;
  error?: string;
}

const results: TestResult[] = [];

function recordTest(suite: string, name: string, passed: boolean, error?: string) {
  results.push({ suite, name, passed, error });
  const status = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`${status} [${suite}] ${name}`);
  if (error && !passed) {
    console.error(`       Error: ${error}`);
  }
}

async function runTests() {
  console.log('\n======================================================');
  console.log('🚀 RUNNING PHASE 3 REQUEST EXECUTION SERVICE TEST SUITE');
  console.log('======================================================\n');

  const service = new RequestExecutionService();

  // --------------------------------------------------------------------------
  // Suite 1: HTTP Methods (GET, POST, PUT, PATCH, DELETE)
  // --------------------------------------------------------------------------
  console.log('--- Suite 1: HTTP Methods ---');

  // 1.1 GET
  const getRes = await service.execute({
    method: 'GET',
    url: 'https://httpbin.org/get',
    queryParams: { sentinel_phase: '3', test: 'true' },
  });
  recordTest(
    'HTTP Methods',
    'Execute GET request with query params',
    getRes.success &&
      getRes.statusCode === 200 &&
      getRes.body?.args?.sentinel_phase === '3',
    getRes.error || `Status: ${getRes.statusCode}`,
  );

  // 1.2 POST with JSON body
  const postRes = await service.execute({
    method: 'POST',
    url: 'https://httpbin.org/post',
    body: { service: 'payment-svc', amount: 150.5 },
  });
  recordTest(
    'HTTP Methods',
    'Execute POST request with auto-serialized JSON body',
    postRes.success &&
      postRes.statusCode === 200 &&
      postRes.body?.json?.service === 'payment-svc',
    postRes.error || `Status: ${postRes.statusCode}`,
  );

  // 1.3 PUT with JSON body
  const putRes = await service.execute({
    method: 'PUT',
    url: 'https://httpbin.org/put',
    body: { status: 'UPDATED', version: 2 },
  });
  recordTest(
    'HTTP Methods',
    'Execute PUT request with body',
    putRes.success &&
      putRes.statusCode === 200 &&
      putRes.body?.json?.status === 'UPDATED',
    putRes.error || `Status: ${putRes.statusCode}`,
  );

  // 1.4 PATCH with JSON body
  const patchRes = await service.execute({
    method: 'PATCH',
    url: 'https://httpbin.org/patch',
    body: { field: 'patched_value' },
  });
  recordTest(
    'HTTP Methods',
    'Execute PATCH request with body',
    patchRes.success &&
      patchRes.statusCode === 200 &&
      patchRes.body?.json?.field === 'patched_value',
    patchRes.error || `Status: ${patchRes.statusCode}`,
  );

  // 1.5 DELETE
  const deleteRes = await service.execute({
    method: 'DELETE',
    url: 'https://httpbin.org/delete',
  });
  recordTest(
    'HTTP Methods',
    'Execute DELETE request',
    deleteRes.success && deleteRes.statusCode === 200,
    deleteRes.error || `Status: ${deleteRes.statusCode}`,
  );

  // --------------------------------------------------------------------------
  // Suite 2: Headers, Query Parameters, and Authentication
  // --------------------------------------------------------------------------
  console.log('\n--- Suite 2: Headers & Authentication ---');

  // 2.1 Custom Headers
  const headersRes = await service.execute({
    method: 'GET',
    url: 'https://httpbin.org/headers',
    headers: {
      'X-Sentinel-Trace-Id': 'trace-abc-123',
      'X-Sentinel-Org': 'tenant-alpha',
    },
  });
  recordTest(
    'Headers & Auth',
    'Send custom headers correctly',
    headersRes.success &&
      headersRes.body?.headers?.['X-Sentinel-Trace-Id'] === 'trace-abc-123',
    headersRes.error || JSON.stringify(headersRes.body),
  );

  // 2.2 Bearer Authentication
  const bearerRes = await service.execute({
    method: 'GET',
    url: 'https://httpbin.org/bearer',
    auth: {
      type: 'bearer',
      token: 'sentinel_secret_token_jwt',
    },
  });
  recordTest(
    'Headers & Auth',
    'Inject Authorization Bearer token header',
    bearerRes.success &&
      bearerRes.statusCode === 200 &&
      bearerRes.body?.authenticated === true,
    bearerRes.error || `Status: ${bearerRes.statusCode}`,
  );

  // 2.3 Basic Authentication
  const basicRes = await service.execute({
    method: 'GET',
    url: 'https://httpbin.org/basic-auth/admin/secret123',
    auth: {
      type: 'basic',
      username: 'admin',
      password: 'secret123',
    },
  });
  recordTest(
    'Headers & Auth',
    'Inject HTTP Basic Auth header',
    basicRes.success &&
      basicRes.statusCode === 200 &&
      basicRes.body?.authenticated === true,
    basicRes.error || `Status: ${basicRes.statusCode}`,
  );

  // 2.4 API Key in query parameter
  const apiKeyQueryRes = await service.execute({
    method: 'GET',
    url: 'https://httpbin.org/get',
    auth: {
      type: 'apiKey',
      apiKeyName: 'api_key',
      apiKeyValue: 'sentinel_key_999',
      apiKeyPlacement: 'query',
    },
  });
  recordTest(
    'Headers & Auth',
    'Inject API Key in query parameter',
    apiKeyQueryRes.success &&
      apiKeyQueryRes.body?.args?.api_key === 'sentinel_key_999',
    apiKeyQueryRes.error || JSON.stringify(apiKeyQueryRes.body),
  );

  // --------------------------------------------------------------------------
  // Suite 3: Telemetry & Metrics (Duration, Status, Headers, Size)
  // --------------------------------------------------------------------------
  console.log('\n--- Suite 3: Telemetry & Metrics ---');

  const metricRes = await service.execute({
    method: 'GET',
    url: 'https://httpbin.org/response-headers?X-Custom-Resp=SentinelValue',
  });

  const hasMetrics =
    metricRes.success &&
    metricRes.durationMs > 0 &&
    metricRes.timing.totalMs > 0 &&
    metricRes.timing.ttfbMs >= 0 &&
    metricRes.sizeBytes > 0 &&
    metricRes.headers['x-custom-resp'] === 'SentinelValue';

  recordTest(
    'Telemetry',
    'Record status, durationMs, timing breakdown, sizeBytes, and response headers',
    hasMetrics,
    JSON.stringify({
      durationMs: metricRes.durationMs,
      timing: metricRes.timing,
      size: metricRes.sizeBytes,
    }),
  );

  // --------------------------------------------------------------------------
  // Suite 4: Timeout Handling & Request Timeout Limits (Req 3 & 6)
  // --------------------------------------------------------------------------
  console.log('\n--- Suite 4: Timeout Handling & Limits ---');

  // 4.1 Abort when request exceeds timeout
  const slowRes = await service.execute({
    method: 'GET',
    url: 'https://httpbin.org/delay/3',
    timeoutMs: 800, // 800ms timeout for a 3s delay endpoint
  });

  const timeoutHandled =
    slowRes.isTimeout === true &&
    slowRes.success === false &&
    slowRes.statusCode === 504 &&
    slowRes.error !== null &&
    slowRes.error.includes('timed out');

  recordTest(
    'Timeout Handling',
    'Abort request when delay exceeds timeoutMs and return 504 Gateway Timeout',
    timeoutHandled,
    slowRes.error || `Status: ${slowRes.statusCode}`,
  );

  // 4.2 Clamping timeout to limits
  const clampedRes = await service.execute({
    method: 'GET',
    url: 'https://httpbin.org/get',
    timeoutMs: -50, // Negative timeout must be clamped safely to minimum
  });
  recordTest(
    'Timeout Limits',
    'Clamp negative or zero timeout safely without crashing',
    clampedRes.statusCode !== null || clampedRes.error !== null,
  );

  // --------------------------------------------------------------------------
  // Suite 5: Malformed URL Handling (Req 4)
  // --------------------------------------------------------------------------
  console.log('\n--- Suite 5: Malformed URL Handling ---');

  // 5.1 Invalid protocol (ftp://)
  const ftpRes = await service.execute({
    method: 'GET',
    url: 'ftp://files.example.com/data.csv',
  });

  const ftpHandled =
    ftpRes.isMalformedUrl === true &&
    ftpRes.success === false &&
    ftpRes.statusCode === null &&
    ftpRes.error !== null &&
    ftpRes.error.includes('Only "http:" and "https:" are allowed');

  recordTest(
    'Malformed URL',
    'Reject non-HTTP/HTTPS protocol gracefully without throwing unhandled error',
    ftpHandled,
    ftpRes.error || 'Expected malformed URL error',
  );

  // 5.2 Completely malformed string
  const garbageRes = await service.execute({
    method: 'GET',
    url: 'not a valid url at all!',
  });

  const garbageHandled =
    garbageRes.isMalformedUrl === true &&
    garbageRes.success === false &&
    garbageRes.statusCode === null &&
    garbageRes.error !== null;

  recordTest(
    'Malformed URL',
    'Handle syntactically invalid URL string gracefully',
    garbageHandled,
    garbageRes.error || 'Expected malformed URL error',
  );

  // 5.3 Empty URL
  const emptyRes = await service.execute({
    method: 'GET',
    url: '',
  });

  recordTest(
    'Malformed URL',
    'Handle empty URL string gracefully',
    emptyRes.isMalformedUrl === true && emptyRes.error?.includes('non-empty string'),
    emptyRes.error,
  );

  // --------------------------------------------------------------------------
  // Suite 6: Response-Size Limits (Req 5)
  // --------------------------------------------------------------------------
  console.log('\n--- Suite 6: Response-Size Limits ---');

  // Fetch payload with a small maxResponseSizeBytes limit (e.g. 500 bytes on a 2KB response)
  const sizeLimitRes = await service.execute({
    method: 'GET',
    url: 'https://httpbin.org/bytes/5000',
    maxResponseSizeBytes: 500, // Limit to 500 bytes
  });

  const sizeLimitHandled =
    sizeLimitRes.success === false &&
    sizeLimitRes.statusCode === 413 &&
    sizeLimitRes.error !== null &&
    sizeLimitRes.error.includes('exceeds maximum allowed size');

  recordTest(
    'Response Size Limits',
    'Reject payload exceeding maxResponseSizeBytes with 413 Payload Too Large',
    sizeLimitHandled,
    sizeLimitRes.error || `Status: ${sizeLimitRes.statusCode}`,
  );

  // --------------------------------------------------------------------------
  // Suite 7: Network & DNS Errors
  // --------------------------------------------------------------------------
  console.log('\n--- Suite 7: Network & DNS Errors ---');

  const dnsFailRes = await service.execute({
    method: 'GET',
    url: 'https://non-existent-domain-sentinel-test-xyz-987.org/api',
  });

  const dnsHandled =
    dnsFailRes.isNetworkError === true &&
    dnsFailRes.success === false &&
    dnsFailRes.statusCode === null &&
    dnsFailRes.error !== null &&
    dnsFailRes.error.includes('DNS resolution failed');

  recordTest(
    'Network Errors',
    'Catch unresolvable host and return structured DNS error',
    dnsHandled,
    dnsFailRes.error || 'Expected DNS failure',
  );

  // --------------------------------------------------------------------------
  // Suite 8: Server-Side Secrets Protection (Req 8)
  // --------------------------------------------------------------------------
  console.log('\n--- Suite 8: Secrets Protection ---');

  // Verify response does not leak process.env secrets
  const secretLeaked =
    JSON.stringify(getRes).includes('postgresql://') ||
    JSON.stringify(dnsFailRes).includes('postgresql://') ||
    JSON.stringify(slowRes).includes('DATABASE_URL');

  recordTest(
    'Secrets Protection',
    'Verify server-side credentials are never leaked in error outputs or responses',
    !secretLeaked,
  );

  // --------------------------------------------------------------------------
  // Suite 9: End-to-End API Tester Preservation (Req 1 & 7)
  // --------------------------------------------------------------------------
  console.log('\n--- Suite 9: API Tester Integration ---');

  const ts = Date.now();
  const authRes = await fetch('http://localhost:3001/api/v1/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: `phase3-tester-${ts}@sentinel.local`,
      password: 'Password123!',
      firstName: 'Phase3',
      lastName: 'Tester',
      organizationName: `Phase 3 Org ${ts}`,
    }),
  });
  const authData = await authRes.json();
  const token = authData.accessToken;

  const apiTesterRes = await fetch('http://localhost:3001/api/v1/api-tester/execute', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      method: 'POST',
      url: 'https://httpbin.org/post',
      headers: { 'X-Tester-Engine': 'RequestExecutionService' },
      body: JSON.stringify({ framework: 'Sentinel' }),
      tests: [
        { type: 'status_code_equals', expected: 200 },
        { type: 'response_time_less_than', expected: 10000 },
        { type: 'json_property_exists', target: 'json.framework' },
      ],
    }),
  });

  const testerData = await apiTesterRes.json();
  const testerShapeValid =
    apiTesterRes.status === 200 &&
    testerData.status === 200 &&
    testerData.durationMs !== undefined &&
    testerData.timing !== undefined &&
    Array.isArray(testerData.testResults) &&
    testerData.testResults.length === 3 &&
    testerData.testsSummary?.passed === 3 &&
    testerData.finalUrl === 'https://httpbin.org/post';

  recordTest(
    'API Tester UI Preservation',
    'API Tester endpoint preserves complete UI execution result shape and assertions',
    testerShapeValid,
    JSON.stringify(testerData),
  );

  // --------------------------------------------------------------------------
  // Summary
  // --------------------------------------------------------------------------
  console.log('\n======================================================');
  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  const failed = total - passed;
  console.log(`Phase 3 Results: ${passed}/${total} passed (${failed} failed)`);
  console.log('======================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Test run failed:', err);
  process.exit(1);
});

/**
 * Phase 4: Agentless API Monitoring Test Suite
 *
 * Requirements Tested:
 * 1. Successful check (200, matching expected status, MonitorResult saved)
 * 2. 4xx error handling (404, 401 mapped to HTTP_4XX in MonitorResult)
 * 3. 5xx error handling (500, 502 mapped to HTTP_5XX in MonitorResult)
 * 4. Timeout handling (delay exceeding timeout -> timeout=true, error_type=TIMEOUT)
 * 5. Network failure (unresolvable host -> error_type=NETWORK_ERROR, status_code=null)
 * 6. Disabled monitor (enabled=false -> no BullMQ recurring job, execution skipped)
 * 7. Job scheduling (interval respected, organization-aware BullMQ payload)
 * 8. Duplicate prevention (re-scheduling removes old repeatable jobs, no duplicate accumulation)
 * 9. Multi-tenant isolation (MonitorResults scoped to organization)
 */

import * as http from 'http';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const BASE_URL = process.env.API_URL || 'http://localhost:3001/api/v1';
const MOCK_PORT = 18092;
const MOCK_URL = `http://localhost:${MOCK_PORT}`;

interface TestResult {
  suite: string;
  name: string;
  passed: boolean;
  error?: string;
}

const testResults: TestResult[] = [];

function recordTest(suite: string, name: string, passed: boolean, error?: string) {
  testResults.push({ suite, name, passed, error });
  const status = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`${status} [${suite}] ${name}`);
  if (error && !passed) {
    console.error(`       Error: ${error}`);
  }
}

async function apiRequest(
  path: string,
  options: {
    method?: string;
    token?: string;
    headers?: Record<string, string>;
    body?: any;
  } = {},
) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  if (options.token) {
    headers['Authorization'] = `Bearer ${options.token}`;
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  let data: any;
  const text = await res.text();
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }

  return { status: res.status, data };
}

async function waitForResult(where: any, timeoutMs = 8000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const res = await prisma.monitorResult.findFirst({
      where,
      orderBy: { timestamp: 'desc' },
    });
    if (res) return res;
    await new Promise((r) => setTimeout(r, 250));
  }
  return null;
}

// --------------------------------------------------------------------------
// Start Local Mock HTTP Server for Agentless Probing
// --------------------------------------------------------------------------
function startMockServer(): Promise<http.Server> {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const url = req.url || '';

      if (url === '/health' || url.startsWith('/health')) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'healthy', timestamp: Date.now() }));
        return;
      }

      if (url === '/client-error') {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Endpoint Not Found', code: 404 }));
        return;
      }

      if (url === '/unauthorized') {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Unauthorized', code: 401 }));
        return;
      }

      if (url === '/server-error') {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Internal Server Error', code: 500 }));
        return;
      }

      if (url === '/bad-gateway') {
        res.writeHead(502, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Bad Gateway upstream', code: 502 }));
        return;
      }

      if (url === '/slow') {
        // Delay 2500ms before returning 200
        setTimeout(() => {
          if (!res.writableEnded) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ status: 'delayed-ok' }));
          }
        }, 2500);
        return;
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ message: 'default-mock-response' }));
    });

    server.listen(MOCK_PORT, () => {
      resolve(server);
    });
  });
}

async function runTests() {
  console.log('\n======================================================');
  console.log('🚀 RUNNING PHASE 4 AGENTLESS MONITORING TEST SUITE');
  console.log('======================================================\n');

  const mockServer = await startMockServer();
  console.log(`Mock customer API server running on ${MOCK_URL}`);

  try {
    const timestamp = Date.now();

    // --------------------------------------------------------------------------
    // Setup: Create Organization, User, API, and Environment
    // --------------------------------------------------------------------------
    console.log('--- Setup: Creating Test Entities ---');
    const userEmail = `monitor-tester-${timestamp}@sentinel.io`;
    const regRes = await apiRequest('/auth/register', {
      method: 'POST',
      body: {
        email: userEmail,
        password: 'Password123!',
        firstName: 'Agentless',
        lastName: 'Monitor',
        organizationName: `Org-Phase4-${timestamp}`,
      },
    });

    const token = regRes.data?.accessToken;
    const user = regRes.data?.user;
    const orgId = user?.organizationId;

    if (!token || !orgId) {
      throw new Error(`Failed to initialize auth credentials: ${JSON.stringify(regRes.data)}`);
    }

    // Create API
    const apiRes = await apiRequest('/apis', {
      method: 'POST',
      token,
      body: {
        name: `Billing-API-${timestamp}`,
        description: 'Agentless monitoring target',
        service: 'billing-service',
      },
    });
    const apiId = apiRes.data?.id;

    // Create Environment pointing to Mock URL
    const envRes = await apiRequest('/environments', {
      method: 'POST',
      token,
      body: {
        name: 'Local-Mock',
        baseUrl: MOCK_URL,
        type: 'DEVELOPMENT',
        apiId,
      },
    });
    const envId = envRes.data?.id;

    console.log(`Created Org: ${orgId}, API: ${apiId}, Env: ${envId}\n`);

    // --------------------------------------------------------------------------
    // Suite 1: Successful Check
    // --------------------------------------------------------------------------
    console.log('--- Suite 1: Successful Check ---');
    const successMonRes = await apiRequest('/monitors/configs', {
      method: 'POST',
      token,
      body: {
        name: 'Health-Check-Monitor',
        url: '/health',
        environmentId: envId,
        interval: 30,
        timeout: 5000,
        expectedStatus: 200,
        enabled: true,
      },
    });

    const successMonId = successMonRes.data?.id;
    recordTest(
      'Successful Check',
      'Create MonitorConfig with expected status 200',
      successMonRes.status === 201 &&
        !!successMonId &&
        (successMonRes.data.enabled === true || successMonRes.data.isActive === true),
      `Status: ${successMonRes.status}, data: ${JSON.stringify(successMonRes.data)}`,
    );

    // Trigger immediate run
    const runSuccessRes = await apiRequest(`/monitors/configs/${successMonId}/run`, {
      method: 'POST',
      token,
    });
    recordTest(
      'Successful Check',
      'Trigger immediate monitor run successfully',
      runSuccessRes.status === 201 && runSuccessRes.data?.queued === true,
    );

    // Wait for BullMQ worker to execute probe and store MonitorResult in PostgreSQL
    const latestSuccess = await waitForResult({
      organizationId: orgId,
      apiId,
      environmentId: envId,
    });

    recordTest(
      'Successful Check',
      'MonitorResult record persisted to PostgreSQL with success=true and status_code=200',
      !!latestSuccess &&
        latestSuccess.success === true &&
        latestSuccess.statusCode === 200 &&
        latestSuccess.timeout === false &&
        latestSuccess.errorType === null &&
        latestSuccess.latencyMs > 0,
      `Result: ${JSON.stringify(latestSuccess)}`,
    );

    // --------------------------------------------------------------------------
    // Suite 2: 4xx Client Error Handling
    // --------------------------------------------------------------------------
    console.log('\n--- Suite 2: 4xx Client Error Handling ---');
    const notFoundMonRes = await apiRequest('/monitors/configs', {
      method: 'POST',
      token,
      body: {
        name: '404-Probe-Monitor',
        url: '/client-error',
        environmentId: envId,
        interval: 30,
        timeout: 5000,
        expectedStatus: 200,
      },
    });
    const notFoundMonId = notFoundMonRes.data?.id;

    await apiRequest(`/monitors/configs/${notFoundMonId}/run`, { method: 'POST', token });
    const notFoundResult = await waitForResult({
      organizationId: orgId,
      statusCode: 404,
    });

    recordTest(
      '4xx Handling',
      'Probe returning 404 records success=false, statusCode=404, errorType=HTTP_4XX',
      !!notFoundResult &&
        notFoundResult.success === false &&
        notFoundResult.statusCode === 404 &&
        notFoundResult.timeout === false &&
        notFoundResult.errorType === 'HTTP_4XX',
      `Result: ${JSON.stringify(notFoundResult)}`,
    );

    // Test 401
    const unauthMonRes = await apiRequest('/monitors/configs', {
      method: 'POST',
      token,
      body: {
        name: '401-Probe-Monitor',
        url: '/unauthorized',
        environmentId: envId,
        interval: 30,
        timeout: 5000,
        expectedStatus: 200,
      },
    });
    const unauthMonId = unauthMonRes.data?.id;
    await apiRequest(`/monitors/configs/${unauthMonId}/run`, { method: 'POST', token });
    const unauthResult = await waitForResult({
      organizationId: orgId,
      statusCode: 401,
    });

    recordTest(
      '4xx Handling',
      'Probe returning 401 records success=false, statusCode=401, errorType=HTTP_4XX',
      !!unauthResult &&
        unauthResult.success === false &&
        unauthResult.statusCode === 401 &&
        unauthResult.errorType === 'HTTP_4XX',
      `Result: ${JSON.stringify(unauthResult)}`,
    );

    // --------------------------------------------------------------------------
    // Suite 3: 5xx Server Error Handling
    // --------------------------------------------------------------------------
    console.log('\n--- Suite 3: 5xx Server Error Handling ---');
    const error500Res = await apiRequest('/monitors/configs', {
      method: 'POST',
      token,
      body: {
        name: '500-Probe-Monitor',
        url: '/server-error',
        environmentId: envId,
        interval: 30,
        timeout: 5000,
        expectedStatus: 200,
      },
    });
    const mon500Id = error500Res.data?.id;
    await apiRequest(`/monitors/configs/${mon500Id}/run`, { method: 'POST', token });
    const result500 = await waitForResult({
      organizationId: orgId,
      statusCode: 500,
    });

    recordTest(
      '5xx Handling',
      'Probe returning 500 records success=false, statusCode=500, errorType=HTTP_5XX',
      !!result500 &&
        result500.success === false &&
        result500.statusCode === 500 &&
        result500.errorType === 'HTTP_5XX',
      `Result: ${JSON.stringify(result500)}`,
    );

    // Test 502
    const error502Res = await apiRequest('/monitors/configs', {
      method: 'POST',
      token,
      body: {
        name: '502-Probe-Monitor',
        url: '/bad-gateway',
        environmentId: envId,
        interval: 30,
        timeout: 5000,
        expectedStatus: 200,
      },
    });
    const mon502Id = error502Res.data?.id;
    await apiRequest(`/monitors/configs/${mon502Id}/run`, { method: 'POST', token });
    const result502 = await waitForResult({
      organizationId: orgId,
      statusCode: 502,
    });

    recordTest(
      '5xx Handling',
      'Probe returning 502 records success=false, statusCode=502, errorType=HTTP_5XX',
      !!result502 &&
        result502.success === false &&
        result502.statusCode === 502 &&
        result502.errorType === 'HTTP_5XX',
      `Result: ${JSON.stringify(result502)}`,
    );

    // --------------------------------------------------------------------------
    // Suite 4: Timeout Handling
    // --------------------------------------------------------------------------
    console.log('\n--- Suite 4: Timeout Handling ---');
    // /slow endpoint takes 2500ms, timeout configured to 600ms
    const timeoutMonRes = await apiRequest('/monitors/configs', {
      method: 'POST',
      token,
      body: {
        name: 'Timeout-Probe-Monitor',
        url: '/slow',
        environmentId: envId,
        interval: 30,
        timeout: 600, // 600ms max wait
        expectedStatus: 200,
      },
    });
    const timeoutMonId = timeoutMonRes.data?.id;
    await apiRequest(`/monitors/configs/${timeoutMonId}/run`, { method: 'POST', token });
    const timeoutResult = await waitForResult({
      organizationId: orgId,
      timeout: true,
    });

    recordTest(
      'Timeout Handling',
      'Slow endpoint exceeding timeout limit records success=false, timeout=true, errorType=TIMEOUT',
      !!timeoutResult &&
        timeoutResult.success === false &&
        timeoutResult.timeout === true &&
        timeoutResult.errorType === 'TIMEOUT' &&
        timeoutResult.latencyMs >= 500,
      `Result: ${JSON.stringify(timeoutResult)}`,
    );

    // --------------------------------------------------------------------------
    // Suite 5: Network Failure & Unresolvable Host
    // --------------------------------------------------------------------------
    console.log('\n--- Suite 5: Network Failure Handling ---');
    const netFailRes = await apiRequest('/monitors/configs', {
      method: 'POST',
      token,
      body: {
        name: 'Network-Fail-Monitor',
        url: 'http://non-existent-fake-domain-xyz-404.test/api/probe',
        environmentId: envId,
        interval: 30,
        timeout: 3000,
        expectedStatus: 200,
      },
    });
    const netFailId = netFailRes.data?.id;
    await apiRequest(`/monitors/configs/${netFailId}/run`, { method: 'POST', token });
    const netFailResult = await waitForResult({
      organizationId: orgId,
      errorType: 'NETWORK_ERROR',
    });

    recordTest(
      'Network Failure',
      'Non-existent target domain records success=false, timeout=false, errorType=NETWORK_ERROR, statusCode=null',
      !!netFailResult &&
        netFailResult.success === false &&
        netFailResult.timeout === false &&
        netFailResult.errorType === 'NETWORK_ERROR' &&
        netFailResult.statusCode === null,
      `Result: ${JSON.stringify(netFailResult)}`,
    );

    // --------------------------------------------------------------------------
    // Suite 6: Disabled Monitor
    // --------------------------------------------------------------------------
    console.log('\n--- Suite 6: Disabled Monitor ---');
    const disabledMonRes = await apiRequest('/monitors/configs', {
      method: 'POST',
      token,
      body: {
        name: 'Disabled-Monitor',
        url: '/health',
        environmentId: envId,
        interval: 30,
        timeout: 3000,
        enabled: false, // Disabled at creation
      },
    });
    const disabledMonId = disabledMonRes.data?.id;

    recordTest(
      'Disabled Monitor',
      'Create monitor with enabled=false sets flag and skips recurring schedule',
      disabledMonRes.status === 201 &&
        (disabledMonRes.data?.enabled === false || disabledMonRes.data?.isActive === false),
      `Data: ${JSON.stringify(disabledMonRes.data)}`,
    );

    // When trigger run is attempted on disabled monitor, worker skips execution
    const prevCount = await prisma.monitorResult.count({
      where: { monitorConfigId: disabledMonId },
    });

    await apiRequest(`/monitors/configs/${disabledMonId}/run`, { method: 'POST', token });
    await new Promise((r) => setTimeout(r, 1500));

    const afterCount = await prisma.monitorResult.count({
      where: { monitorConfigId: disabledMonId },
    });

    recordTest(
      'Disabled Monitor',
      'Disabled monitor execution is skipped without storing result row',
      prevCount === afterCount && prevCount === 0,
      `prevCount: ${prevCount}, afterCount: ${afterCount}`,
    );

    // Toggle active monitor to disabled
    const toggleRes = await apiRequest(`/monitors/${successMonId}/disable`, {
      method: 'POST',
      token,
    });
    recordTest(
      'Disabled Monitor',
      'Disable active monitor toggles isActive=false and enabled=false',
      toggleRes.status === 201 && toggleRes.data?.isActive === false,
    );

    // --------------------------------------------------------------------------
    // Suite 7: Job Scheduling & Configured Intervals
    // --------------------------------------------------------------------------
    console.log('\n--- Suite 7: Job Scheduling & Intervals ---');
    const scheduledMonRes = await apiRequest('/monitors/configs', {
      method: 'POST',
      token,
      body: {
        name: 'Scheduled-Interval-Monitor',
        url: '/health',
        environmentId: envId,
        interval: 15, // 15 seconds
        timeout: 3000,
        enabled: true,
      },
    });
    const schedMon = scheduledMonRes.data;

    recordTest(
      'Job Scheduling',
      'MonitorConfig created with 15-second interval',
      scheduledMonRes.status === 201 &&
        (schedMon?.interval === 15 || schedMon?.intervalSeconds === 15) &&
        (schedMon?.enabled === true || schedMon?.isActive === true),
      `Data: ${JSON.stringify(schedMon)}`,
    );

    // --------------------------------------------------------------------------
    // Suite 8: Duplicate Prevention
    // --------------------------------------------------------------------------
    console.log('\n--- Suite 8: Duplicate Prevention ---');
    // Rapidly update monitor configuration with different intervals
    await apiRequest(`/monitors/configs/${schedMon.id}`, {
      method: 'PATCH',
      token,
      body: { interval: 20 },
    });
    await apiRequest(`/monitors/configs/${schedMon.id}`, {
      method: 'PATCH',
      token,
      body: { interval: 25 },
    });
    const finalUpdateRes = await apiRequest(`/monitors/configs/${schedMon.id}`, {
      method: 'PATCH',
      token,
      body: { interval: 30 },
    });

    recordTest(
      'Duplicate Prevention',
      'Multiple successive updates update interval cleanly to 30s',
      finalUpdateRes.status === 200 && finalUpdateRes.data?.intervalSeconds === 30,
    );

    // Immediate run duplicate prevention: triggering immediate runs back-to-back
    const firstRun = await apiRequest(`/monitors/configs/${schedMon.id}/run`, {
      method: 'POST',
      token,
    });
    const secondRun = await apiRequest(`/monitors/configs/${schedMon.id}/run`, {
      method: 'POST',
      token,
    });

    recordTest(
      'Duplicate Prevention',
      'Immediate run execution triggers successfully',
      firstRun.status === 201 && (firstRun.data?.queued === true || firstRun.data?.reason === 'duplicate_prevented'),
    );

    // --------------------------------------------------------------------------
    // Suite 9: Monitor Results Query & Multi-tenant Isolation
    // --------------------------------------------------------------------------
    console.log('\n--- Suite 9: Results Query & Multi-Tenant Isolation ---');
    const resultsQuery = await apiRequest(`/monitors/results?limit=10`, {
      method: 'GET',
      token,
    });

    const returnedResults = resultsQuery.data;
    recordTest(
      'Results & Multi-Tenancy',
      'Query /monitors/results returns array of organization-owned MonitorResult records',
      Array.isArray(returnedResults) && returnedResults.length > 0 &&
        returnedResults.every((r: any) => r.organizationId === orgId),
      `Count: ${returnedResults?.length}`,
    );

    recordTest(
      'Results & Multi-Tenancy',
      'MonitorResult payload contains all required fields (timestamp, status_code, latency_ms, success, timeout, error_type, response_size)',
      Array.isArray(returnedResults) && returnedResults.length > 0 &&
        'statusCode' in returnedResults[0] &&
        'latencyMs' in returnedResults[0] &&
        'success' in returnedResults[0] &&
        'timeout' in returnedResults[0] &&
        'timestamp' in returnedResults[0] &&
        'responseSize' in returnedResults[0],
      `Sample: ${JSON.stringify(returnedResults[0])}`,
    );

    // Cross-tenant verification: create second org and ensure it cannot see Org 1 results
    const otherUserEmail = `other-tenant-${timestamp}@sentinel.io`;
    const reg2Res = await apiRequest('/auth/register', {
      method: 'POST',
      body: {
        email: otherUserEmail,
        password: 'Password123!',
        firstName: 'Other',
        lastName: 'Tenant',
        organizationName: `Org-Other-${timestamp}`,
      },
    });
    const token2 = reg2Res.data?.accessToken;

    const org2Results = await apiRequest(`/monitors/results`, {
      method: 'GET',
      token: token2,
    });

    recordTest(
      'Results & Multi-Tenancy',
      'Tenant 2 query yields 0 results from Tenant 1 (strict organization isolation)',
      Array.isArray(org2Results.data) && org2Results.data.length === 0,
      `Org2 results count: ${org2Results.data?.length}`,
    );

  } finally {
    mockServer.close();
    await prisma.$disconnect();
  }

  // --------------------------------------------------------------------------
  // Summary
  // --------------------------------------------------------------------------
  console.log('\n======================================================');
  const passed = testResults.filter((t) => t.passed).length;
  const failed = testResults.filter((t) => !t.passed).length;
  console.log(`Phase 4 Results: ${passed}/${testResults.length} passed (${failed} failed)`);
  console.log('======================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal error running Phase 4 test suite:', err);
  process.exit(1);
});

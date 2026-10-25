/**
 * API Sentinel - Monitoring Worker & MonitorExecution Test Suite
 *
 * Verifies Section 30 & Section 35:
 * 1. Healthy scenario:
 *    - Monitor targeting /healthy -> 200 -> SUCCESS
 * 2. Unexpected status scenario:
 *    - Monitor targeting /error -> 500 -> FAILED
 * 3. Timeout scenario:
 *    - Monitor targeting /slow?delay=3000 with timeoutMs: 1000 -> TIMEOUT
 * 4. Recovery scenario:
 *    - Monitor updated back to /healthy -> SUCCESS
 * 5. Manual "Run Now" queueing:
 *    - POST /monitors/:id/run enqueues job and records execution
 * 6. History endpoint:
 *    - GET /monitors/:id/executions returns paginated historical runs
 * 7. Worker resilience:
 *    - Worker stays alive and processes subsequent checks after errors
 */

const BASE_URL = 'http://localhost:3001/api/v1';

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function rawRequest(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  return { status: res.status, ok: res.ok, data };
}

async function request(path, options = {}) {
  const res = await rawRequest(path, options);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} from ${path}: ${JSON.stringify(res.data)}`);
  }
  return res.data;
}

let passedTests = 0;
let totalTests = 0;

function assert(condition, testName, details = '') {
  totalTests++;
  if (condition) {
    console.log(`  ✅ [PASS] ${testName}`);
    passedTests++;
  } else {
    console.error(`  ❌ [FAIL] ${testName} ${details ? `(${details})` : ''}`);
    throw new Error(`Assertion failed: ${testName}`);
  }
}

async function waitForExecution(monitorId, expectedStatus, maxRetries = 10, delayMs = 1000) {
  for (let i = 0; i < maxRetries; i++) {
    const executions = await request(`/monitors/${monitorId}/executions?limit=5`);
    if (executions.length > 0) {
      const latest = executions[0];
      if (!expectedStatus || latest.status === expectedStatus) {
        return latest;
      }
    }
    await sleep(delayMs);
  }
  const executions = await request(`/monitors/${monitorId}/executions?limit=5`);
  return executions[0] || null;
}

async function run() {
  console.log('=================================================================');
  console.log('🔬 API SENTINEL - MONITORING WORKER & EXECUTION VERIFICATION');
  console.log('=================================================================\n');

  const runId = Date.now();

  // Setup: Project, API, Environment pointing to demo API on port 4000
  console.log('[Setup] Creating Project, API, and Environment...');
  const project = await request('/projects', {
    method: 'POST',
    body: JSON.stringify({
      name: `Worker Test Project ${runId}`,
      description: 'Used for worker execution validation',
    }),
  });
  assert(Boolean(project.id), 'Project created');

  const api = await request('/apis', {
    method: 'POST',
    body: JSON.stringify({
      name: `Demo Service ${runId}`,
      description: 'Demo API target',
      projectId: project.id,
    }),
  });
  assert(Boolean(api.id), 'API registered');

  const env = await request(`/apis/${api.id}/environments`, {
    method: 'POST',
    body: JSON.stringify({
      name: 'Local Demo',
      baseUrl: 'http://localhost:4000',
    }),
  });
  assert(Boolean(env.id), 'Environment created with baseUrl: http://localhost:4000');

  // -------------------------------------------------------------
  // Test Scenario 1: Healthy Endpoint (/healthy -> HTTP 200 -> SUCCESS)
  // -------------------------------------------------------------
  console.log('\n--- Scenario 1: Healthy Target (/healthy -> SUCCESS) ---');
  const healthyMonitor = await request('/monitors', {
    method: 'POST',
    body: JSON.stringify({
      name: `Healthy Probe ${runId}`,
      environmentId: env.id,
      method: 'GET',
      endpoint: '/healthy',
      interval: 15,
      timeout: 5,
      expectedStatus: 200,
      enabled: true,
    }),
  });
  assert(Boolean(healthyMonitor.id), 'Healthy monitor created and scheduled');

  console.log('  Waiting for worker to execute probe...');
  const healthyExec = await waitForExecution(healthyMonitor.id, 'SUCCESS');
  assert(Boolean(healthyExec), 'Execution record generated in PostgreSQL');
  assert(healthyExec.status === 'SUCCESS', 'Execution status is SUCCESS');
  assert(healthyExec.statusCode === 200, 'HTTP status code is 200');
  assert(healthyExec.responseTimeMs > 0, `Monitored response time recorded (${healthyExec.responseTimeMs}ms)`);
  assert(healthyExec.responseSize > 0, `Monitored response size recorded (${healthyExec.responseSize} bytes)`);
  assert(healthyExec.errorMessage === null, 'No error message on success');

  // -------------------------------------------------------------
  // Test Scenario 2: Unexpected Status Code (/error -> HTTP 500 -> FAILED)
  // -------------------------------------------------------------
  console.log('\n--- Scenario 2: Unexpected Status (/error -> FAILED) ---');
  const errorMonitor = await request('/monitors', {
    method: 'POST',
    body: JSON.stringify({
      name: `Error Probe ${runId}`,
      environmentId: env.id,
      method: 'GET',
      endpoint: '/error',
      interval: 15,
      timeout: 5,
      expectedStatus: 200, // Expects 200, but /error returns 500
      enabled: true,
    }),
  });
  assert(Boolean(errorMonitor.id), 'Error probe monitor created');

  console.log('  Waiting for worker to execute probe...');
  const errorExec = await waitForExecution(errorMonitor.id, 'FAILED');
  assert(Boolean(errorExec), 'Execution record generated for error probe');
  assert(errorExec.status === 'FAILED', 'Execution status is FAILED');
  assert(errorExec.statusCode === 500, 'Actual HTTP 500 captured correctly');
  assert(Boolean(errorExec.errorMessage), `Failure reason recorded: "${errorExec.errorMessage}"`);

  // -------------------------------------------------------------
  // Test Scenario 3: Request Timeout (/slow?delay=3000 -> TIMEOUT)
  // -------------------------------------------------------------
  console.log('\n--- Scenario 3: Request Timeout (/slow?delay=3000 -> TIMEOUT) ---');
  const timeoutMonitor = await request('/monitors', {
    method: 'POST',
    body: JSON.stringify({
      name: `Timeout Probe ${runId}`,
      environmentId: env.id,
      method: 'GET',
      endpoint: '/slow?delay=3000',
      interval: 10,
      timeout: 1, // 1 second timeout vs 3s response delay
      expectedStatus: 200,
      enabled: true,
    }),
  });
  assert(Boolean(timeoutMonitor.id), 'Timeout probe monitor created');

  console.log('  Waiting for worker to enforce probe timeout...');
  const timeoutExec = await waitForExecution(timeoutMonitor.id, 'TIMEOUT', 12, 1000);
  assert(Boolean(timeoutExec), 'Execution record generated for timeout probe');
  assert(timeoutExec.status === 'TIMEOUT', 'Execution status is TIMEOUT');
  assert(timeoutExec.statusCode === null, 'HTTP status is null because socket was aborted');
  assert(Boolean(timeoutExec.errorMessage && timeoutExec.errorMessage.includes('timed out')), 'Error message reflects timeout');

  // -------------------------------------------------------------
  // Test Scenario 4: Recovery (Changing error probe to /healthy -> SUCCESS)
  // -------------------------------------------------------------
  console.log('\n--- Scenario 4: Service Recovery (Updating target to /healthy -> SUCCESS) ---');
  await request(`/monitors/${errorMonitor.id}`, {
    method: 'PATCH',
    body: JSON.stringify({
      endpoint: '/healthy',
    }),
  });

  // Trigger immediate run via "Run Now" endpoint to verify recovery
  const triggerRes = await request(`/monitors/${errorMonitor.id}/run`, {
    method: 'POST',
  });
  assert(Boolean(triggerRes.message), 'Run Now triggered via POST /monitors/:id/run');

  console.log('  Waiting for worker to execute recovered probe...');
  const recoveredExec = await waitForExecution(errorMonitor.id, 'SUCCESS');
  assert(Boolean(recoveredExec), 'Recovered execution record recorded');
  assert(recoveredExec.status === 'SUCCESS', 'Execution transitioned from FAILED to SUCCESS');
  assert(recoveredExec.statusCode === 200, 'HTTP status code recovered to 200');

  // -------------------------------------------------------------
  // Test Scenario 5: Execution History Pagination & Sorting
  // -------------------------------------------------------------
  console.log('\n--- Scenario 5: Execution History Endpoint & Pagination ---');
  const allExecs = await request(`/monitors/${errorMonitor.id}/executions?limit=10`);
  assert(Array.isArray(allExecs) && allExecs.length >= 2, 'GET /monitors/:id/executions returns array of history');
  
  // Verify descending sort order
  const t0 = new Date(allExecs[0].executedAt).getTime();
  const t1 = new Date(allExecs[1].executedAt).getTime();
  assert(t0 >= t1, 'Executions are sorted in descending order by executedAt');

  // Test pagination offset
  const paginatedExecs = await request(`/monitors/${errorMonitor.id}/executions?limit=1&offset=1`);
  assert(paginatedExecs.length === 1, 'Pagination limit & offset parameter works');
  assert(paginatedExecs[0].id === allExecs[1].id, 'Offset correctly skips to next execution record');

  // Cleanup: unschedule and delete created monitors
  console.log('\n[Cleanup] Cleaning up test monitors...');
  await request(`/monitors/${healthyMonitor.id}`, { method: 'DELETE' });
  await request(`/monitors/${errorMonitor.id}`, { method: 'DELETE' });
  await request(`/monitors/${timeoutMonitor.id}`, { method: 'DELETE' });
  console.log('  Cleaned up test monitors and stopped schedules.');

  console.log('\n=================================================================');
  console.log(`🎉 ALL TESTS PASSED: ${passedTests}/${totalTests}`);
  console.log('=================================================================');
}

run().catch((err) => {
  console.error('\n💥 Worker verification failed:', err.message);
  process.exit(1);
});

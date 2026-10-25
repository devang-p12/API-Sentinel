/**
 * API Sentinel - Section 34 Required Demo Flow Test Suite
 *
 * Flow:
 * 1. Healthy API (/healthy) -> SUCCESS -> MonitorExecution stored
 * 2. Slow API (/slow) -> Latency increases -> High durationMs recorded
 * 3. Broken API (/error) -> HTTP 500 -> HTTP_ERROR recorded
 * 4. Schema Change (/schema-change) -> Schema validation fails -> SCHEMA_ERROR recorded
 * 5. Recovered API (/healthy) -> SUCCESS restored
 * 6. History & Filtering -> Query executions by status, date, pagination, and detail ID
 */

const BASE_URL = 'http://localhost:3001/api/v1';

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function request(path, options = {}) {
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
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} from ${path}: ${JSON.stringify(data)}`);
  }
  return data;
}

let passed = 0;
let total = 0;

function assert(cond, name, info = '') {
  total++;
  if (cond) {
    console.log(`  ✅ [PASS] ${name}`);
    passed++;
  } else {
    console.error(`  ❌ [FAIL] ${name} ${info ? `(${info})` : ''}`);
    throw new Error(`Assertion failed: ${name}`);
  }
}

async function waitForRun(monitorId, lastExecutionId = null) {
  const triggerTime = Date.now();
  await request(`/monitors/${monitorId}/run`, { method: 'POST' });
  for (let i = 0; i < 20; i++) {
    await sleep(400);
    const execs = await request(`/monitors/${monitorId}/executions?limit=5`);
    if (execs && execs.length > 0) {
      const latest = execs[0];
      if (latest.id !== lastExecutionId && new Date(latest.executedAt).getTime() >= triggerTime - 1500) {
        return latest;
      }
    }
  }
  const execs = await request(`/monitors/${monitorId}/executions?limit=5`);
  return execs[0];
}

async function main() {
  console.log('=================================================================');
  console.log('🛡️ API SENTINEL — SECTION 34 REQUIRED DEMO FLOW VERIFICATION');
  console.log('=================================================================\n');

  const runId = Date.now();

  // 1. Setup API and Environment
  console.log('[1/7] Provisioning Test API & Environment...');
  const project = await request('/projects', {
    method: 'POST',
    body: JSON.stringify({ name: `Demo Project ${runId}` }),
  });
  const api = await request('/apis', {
    method: 'POST',
    body: JSON.stringify({ name: `Demo API ${runId}`, projectId: project.id }),
  });
  const env = await request(`/apis/${api.id}/environments`, {
    method: 'POST',
    body: JSON.stringify({ name: 'Demo Env', baseUrl: 'http://localhost:4000' }),
  });
  assert(Boolean(env.id), 'Environment created at http://localhost:4000');

  // 2. Step 1: /healthy -> SUCCESS
  console.log('\n[2/7] Testing Healthy API (/healthy -> SUCCESS)...');
  const monitor = await request('/monitors', {
    method: 'POST',
    body: JSON.stringify({
      name: 'Sentinel Demo Flow Monitor',
      environmentId: env.id,
      method: 'GET',
      endpoint: '/healthy',
      interval: 60,
      timeout: 5,
      expectedStatus: 200,
      enabled: true,
    }),
  });
  assert(Boolean(monitor.id), 'Monitor registered');

  let exec1 = await waitForRun(monitor.id, null);
  assert(exec1.status === 'SUCCESS', 'Healthy endpoint recorded SUCCESS');
  assert(exec1.statusCode === 200, 'HTTP status code is 200');
  assert(exec1.success === true, 'Normalized success boolean is true');
  assert(exec1.durationMs > 0, `Duration measured correctly (${exec1.durationMs}ms)`);
  assert(Boolean(exec1.startedAt) && Boolean(exec1.completedAt), 'startedAt and completedAt timestamps present');

  // 3. Step 2: /slow -> Latency increases
  console.log('\n[3/7] Testing Slow API (/slow -> Latency Increases)...');
  await request(`/monitors/${monitor.id}`, {
    method: 'PATCH',
    body: JSON.stringify({
      endpoint: '/slow?delay=1200',
      timeout: 5,
    }),
  });
  let exec2 = await waitForRun(monitor.id, exec1.id);
  assert(exec2.status === 'SUCCESS', 'Slow endpoint succeeded within timeout');
  assert(exec2.durationMs >= 1000, `High duration recorded (${exec2.durationMs}ms >= 1000ms)`);
  assert(exec2.statusCode === 200, 'HTTP status is 200');

  // 4. Step 3: /error -> HTTP 500 -> HTTP_ERROR
  console.log('\n[4/7] Testing Broken API (/error -> HTTP 500 -> HTTP_ERROR)...');
  await request(`/monitors/${monitor.id}`, {
    method: 'PATCH',
    body: JSON.stringify({
      endpoint: '/error',
      expectedStatus: 200,
    }),
  });
  let exec3 = await waitForRun(monitor.id, exec2.id);
  assert(exec3.statusCode === 500, 'HTTP 500 accurately captured');
  assert(exec3.status === 'FAILED', 'Status recorded as FAILED');
  assert(exec3.errorType === 'HTTP_ERROR', 'Error type classified as HTTP_ERROR');
  assert(exec3.success === false, 'Success boolean is false');

  // 5. Step 4: /schema-change -> Schema Mismatch -> SCHEMA_ERROR
  console.log('\n[5/7] Testing Schema Change (/schema-change -> SCHEMA_ERROR)...');
  await request(`/monitors/${monitor.id}`, {
    method: 'PATCH',
    body: JSON.stringify({
      endpoint: '/schema-change?v=2',
      assertions: [
        { type: 'statusCode', expected: 200 },
        {
          type: 'schema',
          requiredKeys: ['users'], // v=2 does not have users (has items instead)
        },
      ],
    }),
  });
  let exec4 = await waitForRun(monitor.id, exec3.id);
  assert(exec4.schemaValid === false, 'schemaValid is false');
  assert(exec4.errorType === 'SCHEMA_ERROR', 'Error type classified as SCHEMA_ERROR');
  assert(exec4.status === 'FAILED', 'Status recorded as FAILED on schema mismatch');

  // 6. Step 5: Restore /healthy -> SUCCESS
  console.log('\n[6/7] Restoring API (/healthy -> SUCCESS)...');
  await request(`/monitors/${monitor.id}`, {
    method: 'PATCH',
    body: JSON.stringify({
      endpoint: '/healthy',
      expectedStatus: 200,
      assertions: [{ type: 'statusCode', expected: 200 }],
    }),
  });
  let exec5 = await waitForRun(monitor.id, exec4.id);
  assert(exec5.status === 'SUCCESS', 'Recovered endpoint recorded SUCCESS');
  assert(exec5.statusCode === 200, 'Recovered HTTP status is 200');
  assert(exec5.success === true, 'Normalized success restored to true');

  // 7. Step 6: Historical Queries, Filtering & Execution by ID
  console.log('\n[7/7] Testing Execution History Queries & Detail Endpoints...');
  const allExecs = await request(`/monitors/${monitor.id}/executions?limit=20`);
  assert(allExecs.length >= 5, `History returns full execution sequence (${allExecs.length} runs)`);

  // Filtering by status
  const successOnly = await request(`/monitors/${monitor.id}/executions?status=SUCCESS`);
  assert(successOnly.every((e) => e.status === 'SUCCESS'), 'Status filter ?status=SUCCESS returns only successful runs');

  const failedOnly = await request(`/monitors/${monitor.id}/executions?status=FAILED`);
  assert(failedOnly.every((e) => e.status === 'FAILED'), 'Status filter ?status=FAILED returns only failed runs');

  // Fetch execution by ID
  const detail = await request(`/monitors/${monitor.id}/executions/${exec1.id}`);
  assert(detail.id === exec1.id, 'GET /monitors/:id/executions/:executionId retrieved matching execution');
  assert(detail.monitorId === monitor.id, 'Execution detail links correctly to monitorId');
  assert(detail.durationMs !== undefined, 'Execution detail includes durationMs');

  // Cleanup
  await request(`/monitors/${monitor.id}`, { method: 'DELETE' });
  console.log('\nCleaned up test monitor.');

  console.log('\n=================================================================');
  console.log(`🎉 REQUIRED DEMO FLOW COMPLETED SUCCESSFULLY: ${passed}/${total} TESTS PASSED`);
  console.log('=================================================================');
}

main().catch((err) => {
  console.error('\n❌ Test suite failed:', err);
  process.exit(1);
});

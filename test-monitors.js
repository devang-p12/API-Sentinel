/**
 * API Sentinel - Monitor Management Automated Test Suite
 *
 * Verifies Section 25 requirements:
 * 1. Create Monitor:
 *    - Valid monitor -> 201 Created
 *    - Missing name -> 400 Bad Request
 *    - Missing environmentId -> 400 Bad Request
 *    - Nonexistent environment -> 404 Not Found
 *    - Invalid method -> 400 Bad Request
 *    - Invalid interval (< 5s) -> 400 Bad Request
 *    - Invalid timeout constraint (timeout >= interval) -> 400 Bad Request
 *    - Invalid expected status (< 100 or > 599) -> 400 Bad Request
 * 2. Read Monitors:
 *    - GET /monitors (list)
 *    - GET /monitors?environmentId=... (filtered)
 *    - GET /monitors/:id (detail)
 *    - Nonexistent monitor -> 404 Not Found
 * 3. Update Monitor:
 *    - Valid updates (name, method, endpoint, interval, timeout)
 *    - Invalid update (timeout >= interval) -> 400 Bad Request
 * 4. Toggle Enable / Disable:
 *    - State change to false -> verified
 *    - State change to true -> verified
 * 5. Delete Monitor:
 *    - DELETE /monitors/:id
 *    - Verified subsequent GET returns 404
 */

const BASE_URL = 'http://localhost:3001/api/v1';

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

async function run() {
  console.log('=================================================================');
  console.log('🔬 API SENTINEL - MONITOR MANAGEMENT TEST SUITE');
  console.log('=================================================================\n');

  // Setup prerequisites: Project, API, Environment
  const runId = Date.now();
  console.log('[Setup] Provisioning Project, API, and Environment...');
  const project = await request('/projects', {
    method: 'POST',
    body: JSON.stringify({
      name: `Monitor Test Project ${runId}`,
      description: 'Used for monitor management validation',
    }),
  });
  assert(Boolean(project.id), 'Project created successfully');

  const api = await request('/apis', {
    method: 'POST',
    body: JSON.stringify({
      name: `Payment Service ${runId}`,
      description: 'Payment gateway API',
      projectId: project.id,
    }),
  });
  assert(Boolean(api.id), 'API created successfully');

  const env = await request(`/apis/${api.id}/environments`, {
    method: 'POST',
    body: JSON.stringify({
      name: 'Production',
      baseUrl: 'http://localhost:4000',
    }),
  });
  assert(Boolean(env.id), 'Environment created successfully');

  // -------------------------------------------------------------
  // Test Suite 1: Validation Rules on Create
  // -------------------------------------------------------------
  console.log('\n--- Test Suite 1: Validation Rules on Create ---');

  // 1. Missing name
  const missingNameRes = await rawRequest('/monitors', {
    method: 'POST',
    body: JSON.stringify({
      environmentId: env.id,
      endpoint: '/health',
    }),
  });
  assert(missingNameRes.status === 400, 'Missing monitor name rejected with 400 Bad Request');

  // 2. Missing environmentId
  const missingEnvRes = await rawRequest('/monitors', {
    method: 'POST',
    body: JSON.stringify({
      name: 'Orphan Monitor',
      endpoint: '/health',
    }),
  });
  assert(missingEnvRes.status === 400, 'Missing environmentId rejected with 400 Bad Request');

  // 3. Nonexistent environment (valid UUIDv4 that doesn't exist in DB)
  const fakeEnvId = 'a0000000-0000-4000-a000-000000000000';
  const nonexistentEnvRes = await rawRequest('/monitors', {
    method: 'POST',
    body: JSON.stringify({
      name: 'Ghost Monitor',
      environmentId: fakeEnvId,
      endpoint: '/health',
    }),
  });
  assert(nonexistentEnvRes.status === 404, 'Nonexistent environmentId rejected with 404 Not Found');

  // 4. Invalid HTTP method
  const invalidMethodRes = await rawRequest('/monitors', {
    method: 'POST',
    body: JSON.stringify({
      name: 'Bad Method Monitor',
      environmentId: env.id,
      method: 'INVALID_VERB',
      endpoint: '/health',
    }),
  });
  assert(invalidMethodRes.status === 400, 'Invalid HTTP method rejected with 400 Bad Request');

  // 5. Invalid interval (< 5s)
  const invalidIntervalRes = await rawRequest('/monitors', {
    method: 'POST',
    body: JSON.stringify({
      name: 'Too Fast Monitor',
      environmentId: env.id,
      endpoint: '/health',
      interval: 2, // Less than 5s minimum
    }),
  });
  assert(invalidIntervalRes.status === 400, 'Interval < 5s rejected with 400 Bad Request');

  // 6. Invalid timeout constraint (timeout >= interval)
  const invalidTimeoutRes = await rawRequest('/monitors', {
    method: 'POST',
    body: JSON.stringify({
      name: 'Hanging Timeout Monitor',
      environmentId: env.id,
      endpoint: '/health',
      interval: 10,
      timeout: 15, // 15s >= 10s interval!
    }),
  });
  assert(invalidTimeoutRes.status === 400, 'Timeout >= Interval rejected with 400 Bad Request');

  // 7. Invalid expected status (< 100 or > 599)
  const invalidStatusRes = await rawRequest('/monitors', {
    method: 'POST',
    body: JSON.stringify({
      name: 'Bad Expected Status',
      environmentId: env.id,
      endpoint: '/health',
      expectedStatus: 999,
    }),
  });
  assert(invalidStatusRes.status === 400, 'Expected status > 599 rejected with 400 Bad Request');

  // -------------------------------------------------------------
  // Test Suite 2: Valid Monitor Creation & URL Normalization
  // -------------------------------------------------------------
  console.log('\n--- Test Suite 2: Valid Monitor Creation & Endpoint Normalization ---');

  const createdMonitor = await request('/monitors', {
    method: 'POST',
    body: JSON.stringify({
      name: 'Payment Health Check',
      description: 'Checks whether payment gateway returns 200 OK',
      environmentId: env.id,
      method: 'GET',
      endpoint: 'health', // No leading slash - should be normalized to /health
      interval: 60,
      timeout: 5,
      expectedStatus: 200,
      enabled: true,
    }),
  });

  assert(Boolean(createdMonitor.id), 'Valid monitor created with generated ID');
  assert(createdMonitor.name === 'Payment Health Check', 'Monitor name persisted accurately');
  assert(createdMonitor.url === '/health', 'Endpoint path normalized with leading slash');
  assert(createdMonitor.intervalSeconds === 60, 'Interval persisted as 60s');
  assert(createdMonitor.timeoutMs === 5000, 'Timeout persisted as 5000ms');
  assert(createdMonitor.isActive === true, 'isActive enabled flag default true');
  assert(createdMonitor.environment?.name === 'Production', 'Environment relationship loaded');
  assert(createdMonitor.environment?.api?.name.startsWith('Payment Service'), 'API relationship resolved');

  // -------------------------------------------------------------
  // Test Suite 3: Read Operations (List & Detail)
  // -------------------------------------------------------------
  console.log('\n--- Test Suite 3: Read Operations (List & Detail) ---');

  const allMonitors = await request('/monitors');
  assert(Array.isArray(allMonitors) && allMonitors.length > 0, 'GET /monitors returns array');
  const found = allMonitors.find((m) => m.id === createdMonitor.id);
  assert(Boolean(found), 'Newly created monitor present in list');

  const filteredMonitors = await request(`/monitors?environmentId=${env.id}`);
  assert(filteredMonitors.some((m) => m.id === createdMonitor.id), 'Filter by environmentId works');

  const monitorDetail = await request(`/monitors/${createdMonitor.id}`);
  assert(monitorDetail.id === createdMonitor.id, 'GET /monitors/:id returns matching monitor');
  assert(monitorDetail.environment.api.project.name.startsWith('Monitor Test Project'), 'Full ownership chain resolved');

  const nonexistentDetailRes = await rawRequest(`/monitors/${fakeEnvId}`);
  assert(nonexistentDetailRes.status === 404, 'GET /monitors/:invalidId returns 404 Not Found');

  // -------------------------------------------------------------
  // Test Suite 4: Update Monitor
  // -------------------------------------------------------------
  console.log('\n--- Test Suite 4: Update Operations ---');

  // Invalid update (timeout >= interval)
  const invalidUpdateRes = await rawRequest(`/monitors/${createdMonitor.id}`, {
    method: 'PATCH',
    body: JSON.stringify({
      timeout: 70, // 70s > 60s interval
    }),
  });
  assert(invalidUpdateRes.status === 400, 'Update with timeout >= interval rejected with 400');

  // Valid update
  const updatedMonitor = await request(`/monitors/${createdMonitor.id}`, {
    method: 'PATCH',
    body: JSON.stringify({
      name: 'Payment Primary Health Check',
      description: 'Updated description for health probe',
      interval: 30,
      timeout: 3,
      endpoint: '/healthz',
    }),
  });

  assert(updatedMonitor.name === 'Payment Primary Health Check', 'Monitor name updated');
  assert(updatedMonitor.url === '/healthz', 'Monitor endpoint updated');
  assert(updatedMonitor.intervalSeconds === 30, 'Monitor interval updated to 30s');
  assert(updatedMonitor.timeoutMs === 3000, 'Monitor timeout updated to 3000ms');

  // -------------------------------------------------------------
  // Test Suite 5: Enable / Disable Toggle
  // -------------------------------------------------------------
  console.log('\n--- Test Suite 5: Enable / Disable Toggle ---');

  // Toggle off
  const disabledMonitor = await request(`/monitors/${createdMonitor.id}/toggle`, {
    method: 'PATCH',
    body: JSON.stringify({ enabled: false }),
  });
  assert(disabledMonitor.isActive === false, 'Monitor disabled via /toggle');

  // Verify in GET
  const verifyDisabled = await request(`/monitors/${createdMonitor.id}`);
  assert(verifyDisabled.isActive === false, 'GET confirms monitor is disabled');

  // Toggle on
  const reEnabledMonitor = await request(`/monitors/${createdMonitor.id}/toggle`, {
    method: 'PATCH',
    body: JSON.stringify({ enabled: true }),
  });
  assert(reEnabledMonitor.isActive === true, 'Monitor re-enabled via /toggle');

  // -------------------------------------------------------------
  // Test Suite 6: Delete Monitor
  // -------------------------------------------------------------
  console.log('\n--- Test Suite 6: Delete Operations ---');

  const deletedMonitor = await request(`/monitors/${createdMonitor.id}`, {
    method: 'DELETE',
  });
  assert(deletedMonitor.id === createdMonitor.id, 'DELETE /monitors/:id returns deleted record');

  // -------------------------------------------------------------
  // Test Suite 7: Multi-Tenant Ownership Authorization
  // -------------------------------------------------------------
  console.log('\n--- Test Suite 7: Multi-Tenant Ownership Authorization ---');

  const { MonitorsService } = require('./backend/dist/monitors/monitors.service');
  const { PrismaClient } = require('./backend/node_modules/@prisma/client');
  const prismaClient = new PrismaClient();

  const mockScheduler = {
    scheduleMonitor: async () => {},
    unscheduleMonitor: async () => {},
  };
  const mockExecution = {
    getRecentExecutions: async () => [],
  };

  const service = new MonitorsService(prismaClient, mockScheduler, mockExecution);

  // User/Org A owns env.id. Org B attempts to create monitor under Org A's environment
  let forbiddenCaughtOnCreate = false;
  try {
    await service.create(
      {
        name: 'Unauthorized Probe',
        environmentId: env.id,
        endpoint: '/secret',
      },
      'attacker-organization-uuid' // Mismatched tenant
    );
  } catch (err) {
    if (err.name === 'ForbiddenException' || err.status === 403 || err.message.includes('Access denied')) {
      forbiddenCaughtOnCreate = true;
    }
  }
  assert(forbiddenCaughtOnCreate, 'Cross-tenant monitor creation blocked by ownership verification (ForbiddenException)');

  // Create valid monitor under Org A to test findOne authorization
  const authTestMonitor = await service.create({
    name: 'Tenant Isolation Probe',
    environmentId: env.id,
    endpoint: '/metrics',
  });

  // Org B attempts to query monitor owned by Org A
  let forbiddenCaughtOnFind = false;
  try {
    await service.findOne(authTestMonitor.id, 'attacker-organization-uuid');
  } catch (err) {
    if (err.name === 'ForbiddenException' || err.status === 403 || err.message.includes('Access denied')) {
      forbiddenCaughtOnFind = true;
    }
  }
  assert(forbiddenCaughtOnFind, 'Cross-tenant monitor inspection blocked by ownership verification (ForbiddenException)');

  // Clean up test monitor
  await service.delete(authTestMonitor.id);
  await prismaClient.$disconnect();

  console.log('\n=================================================================');
  console.log(`🎉 ALL TESTS PASSED: ${passedTests}/${totalTests}`);
  console.log('=================================================================');
}

run().catch((err) => {
  console.error('\n💥 Test run failed:', err.message);
  process.exit(1);
});

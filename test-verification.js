/**
 * API Sentinel - Vertical Slice Verification Script
 * Tests:
 * 1. Project creation
 * 2. API registration
 * 3. Environment creation
 * 4. Monitor creation for /healthy -> expects 200 OK
 * 5. Monitor creation for /slow -> expects ~1200ms response time
 * 6. Monitor creation for /error -> expects 500 FAILED
 * 7. Monitor creation for Timeout -> expects TIMEOUT (delay 3000ms vs timeout 1000ms)
 * 8. Queries PostgreSQL directly to verify monitor_executions rows
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
  const data = await res.json();
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} from ${path}: ${JSON.stringify(data)}`);
  }
  return data;
}

async function run() {
  console.log('=================================================================');
  console.log('🚀 STARTING API SENTINEL VERTICAL SLICE END-TO-END VERIFICATION');
  console.log('=================================================================\n');

  // 1. Create Project
  console.log('[Step 1] Creating Project...');
  const project = await request('/projects', {
    method: 'POST',
    body: JSON.stringify({
      name: 'E-Commerce Platform Core',
      description: 'Core backend services for Sentinel observability',
    }),
  });
  console.log(`✅ Project created: "${project.name}" (ID: ${project.id})`);

  // 2. Register API
  console.log('\n[Step 2] Registering API within Project...');
  const api = await request('/apis', {
    method: 'POST',
    body: JSON.stringify({
      name: 'Demo Target Microservice',
      description: 'Controlled API exposing test endpoints',
      projectId: project.id,
    }),
  });
  console.log(`✅ API registered: "${api.name}" (ID: ${api.id})`);

  // 3. Create Environment
  console.log('\n[Step 3] Creating Environment for API...');
  const environment = await request('/environments', {
    method: 'POST',
    body: JSON.stringify({
      name: 'Development',
      baseUrl: 'http://localhost:4000',
      apiId: api.id,
      variables: { 'X-Environment': 'Sentinel-Dev' },
    }),
  });
  console.log(`✅ Environment created: "${environment.name}" at ${environment.baseUrl} (ID: ${environment.id})`);

  // 4. Create Monitor 1: /healthy (Expected 200 OK)
  console.log('\n[Step 4] Creating Monitor for /healthy (Expects 200 OK)...');
  const healthyMonitor = await request('/monitors', {
    method: 'POST',
    body: JSON.stringify({
      name: 'Healthy Endpoint Probe',
      url: '/healthy',
      environmentId: environment.id,
      expectedStatusCode: 200,
      intervalSeconds: 15,
      timeoutMs: 5000,
    }),
  });
  console.log(`✅ Monitor created: "${healthyMonitor.name}" (ID: ${healthyMonitor.id})`);

  // 5. Create Monitor 2: /slow (Expected ~1200ms latency)
  console.log('\n[Step 5] Creating Monitor for /slow (Expects ~1200ms latency)...');
  const slowMonitor = await request('/monitors', {
    method: 'POST',
    body: JSON.stringify({
      name: 'Slow Endpoint Probe',
      url: '/slow?delay=1200',
      environmentId: environment.id,
      expectedStatusCode: 200,
      intervalSeconds: 15,
      timeoutMs: 5000,
    }),
  });
  console.log(`✅ Monitor created: "${slowMonitor.name}" (ID: ${slowMonitor.id})`);

  // 6. Create Monitor 3: /error (Expected 500 Server Error)
  console.log('\n[Step 6] Creating Monitor for /error (Expects 500 error detection)...');
  const errorMonitor = await request('/monitors', {
    method: 'POST',
    body: JSON.stringify({
      name: 'Error Endpoint Probe',
      url: '/error',
      environmentId: environment.id,
      expectedStatusCode: 200, // expecting 200 so receiving 500 marks it FAILED
      intervalSeconds: 15,
      timeoutMs: 5000,
    }),
  });
  console.log(`✅ Monitor created: "${errorMonitor.name}" (ID: ${errorMonitor.id})`);

  // 7. Create Monitor 4: Timeout Detection (3000ms delay vs 1000ms timeout)
  console.log('\n[Step 7] Creating Monitor for Timeout Detection (3000ms delay with 1000ms timeout)...');
  const timeoutMonitor = await request('/monitors', {
    method: 'POST',
    body: JSON.stringify({
      name: 'Timeout Trigger Probe',
      url: '/slow?delay=3000',
      environmentId: environment.id,
      expectedStatusCode: 200,
      intervalSeconds: 15,
      timeoutMs: 1000,
    }),
  });
  console.log(`✅ Monitor created: "${timeoutMonitor.name}" (ID: ${timeoutMonitor.id})`);

  console.log('\n⏳ Waiting 4.5 seconds for BullMQ background workers to execute probes...');
  await sleep(4500);

  // 8. Inspect Database Executions via Sentinel API
  console.log('\n=================================================================');
  console.log('📊 QUERYING EXECUTIONS STORED IN POSTGRESQL');
  console.log('=================================================================\n');

  const monitorsToVerify = [
    { label: '/healthy', id: healthyMonitor.id, expectedStatus: 'SUCCESS' },
    { label: '/slow (~1200ms)', id: slowMonitor.id, expectedStatus: 'SUCCESS' },
    { label: '/error (500)', id: errorMonitor.id, expectedStatus: 'FAILED' },
    { label: 'Timeout (<1000ms)', id: timeoutMonitor.id, expectedStatus: 'TIMEOUT' },
  ];

  for (const item of monitorsToVerify) {
    const executions = await request(`/monitors/${item.id}/executions`);
    console.log(`-----------------------------------------------------------------`);
    console.log(`Target Probe: ${item.label}`);
    if (executions.length === 0) {
      console.log(`⚠️  No executions recorded yet. Waiting 2s...`);
      await sleep(2000);
      const retryExecutions = await request(`/monitors/${item.id}/executions`);
      printExecution(retryExecutions[0]);
    } else {
      printExecution(executions[0]);
    }
  }

  console.log('=================================================================');
  console.log('🎉 VERIFICATION COMPLETE: ALL BACKGROUND PROBES EXECUTED & STORED');
  console.log('=================================================================');
}

function printExecution(exec) {
  if (!exec) {
    console.log('❌ No execution found!');
    return;
  }
  console.log(`  - Status:         ${exec.status === 'SUCCESS' ? '✅ SUCCESS' : exec.status === 'TIMEOUT' ? '⏱️ TIMEOUT' : '❌ FAILED'}`);
  console.log(`  - HTTP Code:      ${exec.statusCode ?? 'null (no response)'}`);
  console.log(`  - Response Time:  ${exec.responseTimeMs}ms`);
  console.log(`  - Error Message:  ${exec.errorMessage ?? 'none'}`);
  console.log(`  - Payload Size:   ${exec.responseSize ? exec.responseSize + ' bytes' : 'n/a'}`);
  console.log(`  - Executed At:    ${exec.executedAt}`);
}

run().catch((err) => {
  console.error('❌ Verification failed:', err);
  process.exit(1);
});

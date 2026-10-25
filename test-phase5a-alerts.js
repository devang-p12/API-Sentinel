/**
 * Sentinel Phase 5A - Alert Engine Automated Verification Script
 */

const http = require('http');

const API_BASE = 'http://localhost:3001/api/v1';

function request(path, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path.startsWith('http') ? path : `${API_BASE}${path}`);
    const reqOptions = {
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    };

    const req = http.request(url, reqOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const parsed = data ? JSON.parse(data) : {};
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });

    req.on('error', reject);
    if (options.body) {
      req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
    }
    req.end();
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForAlertStatus(ruleId, expectedStatus, timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const res = await request(`/alerts?alertRuleId=${ruleId}`);
    if (res.data?.items?.length > 0) {
      const match = res.data.items.find((i) => i.status === expectedStatus);
      if (match) return match;
    }
    await sleep(500);
  }
  const fallback = await request(`/alerts?alertRuleId=${ruleId}`);
  throw new Error(
    `Timed out waiting for alert status "${expectedStatus}". Latest: ${JSON.stringify(fallback.data)}`,
  );
}

async function run() {
  console.log('====================================================');
  console.log('🔔 SENTINEL PHASE 5A: ALERT ENGINE TEST SUITE');
  console.log('====================================================\n');

  // 1. Setup Project, API, Environment, Monitor
  console.log('--- 1. Setting Up Telemetry Test Environment ---');
  const apisRes = await request('/apis');
  const testApi = apisRes.data[0];
  const envsRes = await request(`/environments?apiId=${testApi.id}`);
  const testEnv = envsRes.data[0];

  const monitorRes = await request('/monitors', {
    method: 'POST',
    body: {
      name: `Alert Test Monitor ${Date.now()}`,
      environmentId: testEnv.id,
      method: 'GET',
      endpoint: '/healthy',
      intervalSeconds: 60,
      timeoutMs: 5000,
      expectedStatusCode: 200,
      isActive: true,
    },
  });
  const monitor = monitorRes.data;
  console.log(`✓ Test Monitor created: ${monitor.name} (${monitor.id})\n`);

  // 2. Create Alert Rule
  console.log('--- 2. Creating Alert Rule (duration: 2s for testing) ---');
  const ruleRes = await request('/alert-rules', {
    method: 'POST',
    body: {
      name: 'High Latency Alert Test',
      description: 'Trigger when p95 latency exceeds 500ms for 2 seconds',
      projectId: testApi.projectId,
      apiId: testApi.id,
      environmentId: testEnv.id,
      monitorId: monitor.id,
      metric: 'average_latency',
      condition: 'GREATER_THAN',
      threshold: 500,
      duration: 2, // 2 seconds for test verification
      evaluationInterval: 30,
      severity: 'WARNING',
      labels: { team: 'sre', service: 'test-api' },
      enabled: true,
    },
  });
  if (ruleRes.status !== 201) {
    throw new Error(`Failed to create alert rule: ${JSON.stringify(ruleRes.data)}`);
  }
  const rule = ruleRes.data;
  console.log(`✓ Alert Rule created: "${rule.name}" (ID: ${rule.id})\n`);

  // 3. Test Rule Dry-Run Endpoint (Section 21)
  console.log('--- 3. Testing POST /alert-rules/:id/test (Dry-Run) ---');
  const testDryRun = await request(`/alert-rules/${rule.id}/test`, { method: 'POST' });
  if (testDryRun.status !== 200) {
    throw new Error(`Dry run failed: status ${testDryRun.status}`);
  }
  console.log('✓ Dry run result:', JSON.stringify(testDryRun.data));
  if (testDryRun.data.metric !== 'average_latency') {
    throw new Error('Dry run returned unexpected metric');
  }

  // 4. Initial Condition: Healthy (Metric <= 500ms -> NORMAL)
  console.log('\n--- 4. Executing /healthy Probe (Normal Condition) ---');
  await request(`/monitors/${monitor.id}/run`, { method: 'POST' });
  await sleep(1500);

  let alertsRes = await request(`/alerts?alertRuleId=${rule.id}`);
  console.log(`✓ Alerts count while normal: ${alertsRes.data.items.length}`);
  if (alertsRes.data.items.length !== 0) {
    throw new Error('No alert instance should exist while normal');
  }

  // 5. Trigger Condition Violation: Switch monitor to /slow (latency > 1000ms)
  console.log('\n--- 5. Switching Target to /slow (Latencies ~1200ms > 500ms) ---');
  await request(`/monitors/${monitor.id}`, {
    method: 'PATCH',
    body: { endpoint: '/slow?delay=1200' },
  });
  await request(`/monitors/${monitor.id}/run`, { method: 'POST' });

  // Wait for PENDING (or FIRING)
  const pendingInstance = await waitForAlertStatus(rule.id, 'PENDING', 10000).catch(async () => {
    return waitForAlertStatus(rule.id, 'FIRING', 5000);
  });
  console.log(`✓ Alert instance observed: Status = ${pendingInstance.status}, Value = ${pendingInstance.currentValue}ms`);

  // 6. Wait for duration (2s) to pass and trigger evaluation again -> Transition to FIRING
  console.log('\n--- 6. Waiting for FOR Duration (2s) and Re-Evaluating ---');
  await sleep(2500);
  await request(`/monitors/${monitor.id}/run`, { method: 'POST' });

  const firingInstance = await waitForAlertStatus(rule.id, 'FIRING', 12000);
  console.log(`✓ Alert instance state after duration: Status = ${firingInstance.status}, StartedAt = ${firingInstance.startedAt}`);
  if (!firingInstance.startedAt) {
    throw new Error('FIRING instance must have startedAt timestamp populated');
  }

  // 7. Verify Deduplication: Multiple evaluations while firing do NOT create duplicate instances
  console.log('\n--- 7. Verifying Deduplication (No Duplicate Instances) ---');
  await request(`/monitors/${monitor.id}/run`, { method: 'POST' });
  await sleep(2000);
  const activeAlertsRes = await request(`/alerts?alertRuleId=${rule.id}&status=FIRING`);
  console.log(`✓ Active alert instances count: ${activeAlertsRes.data.items.length}`);
  if (activeAlertsRes.data.items.length !== 1) {
    throw new Error(`Deduplication failed! Expected 1 firing instance, found ${activeAlertsRes.data.items.length}`);
  }

  // 8. Recovery: Switch monitor back to /healthy
  console.log('\n--- 8. Recovering Target API back to /healthy ---');
  await request(`/monitors/${monitor.id}`, {
    method: 'PATCH',
    body: { endpoint: '/healthy' },
  });
  // Run healthy check multiple times so average latency drops below 500ms
  for (let i = 0; i < 4; i++) {
    await request(`/monitors/${monitor.id}/run`, { method: 'POST' });
    await sleep(800);
  }

  const resolvedInstance = await waitForAlertStatus(rule.id, 'RESOLVED', 15000);
  console.log(`✓ Alert instance state after recovery: Status = ${resolvedInstance.status}, ResolvedAt = ${resolvedInstance.resolvedAt}`);
  if (!resolvedInstance.resolvedAt) {
    throw new Error('RESOLVED instance must have resolvedAt timestamp populated');
  }

  // 9. Verify Evaluations History (Section 11)
  console.log('\n--- 9. Verifying Evaluation History for Instance ---');
  const evalsRes = await request(`/alerts/${resolvedInstance.id}/evaluations`);
  if (evalsRes.status !== 200) {
    throw new Error(`Failed to fetch evaluations: ${evalsRes.status}`);
  }
  console.log(`✓ Historical evaluations recorded: ${evalsRes.data.length}`);
  if (evalsRes.data.length === 0) {
    throw new Error('Expected evaluation history to be populated');
  }
  const statesRecorded = evalsRes.data.map((e) => `${e.stateBefore}->${e.stateAfter}`);
  console.log('  State transitions observed in history:', statesRecorded);

  // 10. Verify Summary Counters (Section 28)
  console.log('\n--- 10. Verifying GET /alerts/summary ---');
  const summaryRes = await request('/alerts/summary');
  console.log('✓ Alert summary:', JSON.stringify(summaryRes.data));
  if (summaryRes.data.resolved < 1) {
    throw new Error('Summary counter for resolved alerts must be >= 1');
  }

  // 11. Cleanup test monitor & rule
  console.log('\n--- 11. Cleaning Up Test Resources ---');
  await request(`/alert-rules/${rule.id}`, { method: 'DELETE' });
  await request(`/monitors/${monitor.id}`, { method: 'DELETE' });
  console.log('✓ Cleaned up test resources');

  console.log('\n====================================================');
  console.log('🎉 ALL ALERT ENGINE PHASE 5A TESTS PASSED PERFECTLY!');
  console.log('====================================================');
}

run().catch((err) => {
  console.error('\n❌ TEST FAILED:', err.message);
  if (err.stack) console.error(err.stack);
  process.exit(1);
});

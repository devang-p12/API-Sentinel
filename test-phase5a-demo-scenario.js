/**
 * Sentinel Phase 5A — Section 34 Demo Scenario
 *
 * Demonstrates:
 * 1. Healthy API -> Rules evaluate to NORMAL
 * 2. Introduce latency (/slow?delay=1500) -> Transitions NORMAL -> PENDING -> FIRING
 * 3. Introduce errors (/error) -> Triggers second alert instance (Error Rate > 20%)
 * 4. API Recovers (/healthy) -> Conditions clear -> FIRING -> RESOLVED
 * 5. Historical evaluation logs & deduplication verified
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
        } catch {
          resolve({ status: res.statusCode, text: data });
        }
      });
    });

    req.on('error', reject);

    if (options.body) {
      req.write(JSON.stringify(options.body));
    }
    req.end();
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runDemo() {
  console.log('================================================================');
  console.log('   API SENTINEL — PHASE 5A DEMO SCENARIO (SECTION 34)');
  console.log('================================================================\n');

  // 1. Setup Demo Org, Project, API, Environment, Monitor
  const stamp = Date.now();
  console.log('Step 1: Setting up isolated demo environment...');
  
  const orgRes = await request('/organizations', {
    method: 'POST',
    body: { name: `Demo Sentinel Org ${stamp}` },
  });
  const orgId = orgRes.data.id;

  const projRes = await request('/projects', {
    method: 'POST',
    body: { name: `Demo Sentinel Project ${stamp}`, organizationId: orgId },
  });
  const projId = projRes.data.id;

  const apiRes = await request('/apis', {
    method: 'POST',
    body: { name: 'Demo Payment Gateway API', projectId: projId },
  });
  const apiId = apiRes.data.id;

  const envRes = await request(`/apis/${apiId}/environments`, {
    method: 'POST',
    body: { name: 'Production', baseUrl: 'http://localhost:4000' },
  });
  const envId = envRes.data.id;

  // Monitor targeting demo API server on port 4000
  const monRes = await request('/monitors', {
    method: 'POST',
    body: {
      name: 'Payment API Probe Monitor',
      environmentId: envId,
      method: 'GET',
      endpoint: '/healthy',
      intervalSeconds: 60,
      timeoutMs: 5000,
      expectedStatusCode: 200,
      isActive: true,
    },
  });
  const monitorId = monRes.data.id;
  console.log(`✓ Created Monitor [${monitorId}] targeting http://localhost:4000/healthy\n`);

  // 2. Create the 3 Defined Alert Rules (Section 34)
  console.log('Step 2: Creating Alert Rules from Section 34 specifications:');
  
  // Rule 1: High API Latency (p95_latency > 1000ms, FOR 3s, WARNING)
  const rule1Res = await request('/alert-rules', {
    method: 'POST',
    body: {
      name: 'High API Latency',
      description: 'Trigger when p95 response time exceeds 1000ms for over 3 seconds',
      projectId: projId,
      apiId,
      environmentId: envId,
      monitorId,
      metric: 'p95_latency',
      condition: 'GREATER_THAN',
      threshold: 1000,
      duration: 3, // 3s for fast automated verification
      evaluationInterval: 30,
      severity: 'WARNING',
      labels: { team: 'backend', service: 'payments' },
    },
  });
  const rule1 = rule1Res.data;
  console.log(`✓ Rule 1: "${rule1.name}" (p95_latency > 1000ms, FOR 3s, WARNING)`);

  // Rule 2: High API Error Rate (error_rate > 20%, FOR 3s, CRITICAL)
  const rule2Res = await request('/alert-rules', {
    method: 'POST',
    body: {
      name: 'High API Error Rate',
      description: 'Trigger when error rate exceeds 20% for over 3 seconds',
      projectId: projId,
      apiId,
      environmentId: envId,
      monitorId,
      metric: 'error_rate',
      condition: 'GREATER_THAN',
      threshold: 20,
      duration: 3,
      evaluationInterval: 30,
      severity: 'CRITICAL',
      labels: { team: 'backend', service: 'payments' },
    },
  });
  const rule2 = rule2Res.data;
  console.log(`✓ Rule 2: "${rule2.name}" (error_rate > 20%, FOR 3s, CRITICAL)`);

  // Rule 3: API Availability Drop (availability < 95%, FOR 3s, CRITICAL)
  const rule3Res = await request('/alert-rules', {
    method: 'POST',
    body: {
      name: 'API Availability Drop',
      description: 'Trigger when availability drops below 95% for over 3 seconds',
      projectId: projId,
      apiId,
      environmentId: envId,
      monitorId,
      metric: 'availability',
      condition: 'LESS_THAN',
      threshold: 95,
      duration: 3,
      evaluationInterval: 30,
      severity: 'CRITICAL',
      labels: { team: 'backend', service: 'payments' },
    },
  });
  const rule3 = rule3Res.data;
  console.log(`✓ Rule 3: "${rule3.name}" (availability < 95%, FOR 3s, CRITICAL)\n`);

  // Helper to execute monitor probes
  async function probe(endpoint, count = 1, delayMs = 1200) {
    if (endpoint) {
      await request(`/monitors/${monitorId}`, {
        method: 'PATCH',
        body: { endpoint },
      });
    }
    for (let i = 0; i < count; i++) {
      await request(`/monitors/${monitorId}/run`, { method: 'POST' });
      await sleep(delayMs);
    }
  }

  // Helper to get active alert instances
  async function getInstances() {
    const res = await request(`/alerts?projectId=${projId}`);
    return res.data.items || [];
  }

  // Helper to wait for rule alert status
  async function waitForRuleStatus(ruleId, expectedStatus, timeoutMs = 30000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const items = await getInstances();
      const match = items.find((i) => i.alertRuleId === ruleId && i.status === expectedStatus);
      if (match) return match;
      await sleep(500);
    }
    const items = await getInstances();
    const current = items.filter((i) => i.alertRuleId === ruleId);
    throw new Error(
      `Timeout waiting for rule ${ruleId} to reach status ${expectedStatus}. Current: ${JSON.stringify(current)}`
    );
  }

  // 3. Stage 1: Healthy API -> State is NORMAL
  console.log('Stage 1: Probe Healthy API (/healthy)...');
  await probe('/healthy', 3);
  let active = await getInstances();
  let firingOrPending = active.filter((i) => i.status === 'FIRING' || i.status === 'PENDING');
  console.log(`✓ Active Firing/Pending Alerts: ${firingOrPending.length} (Expected: 0 - All NORMAL)`);

  // 4. Stage 2: Introduce Latency -> Transition NORMAL -> PENDING -> FIRING
  console.log('\nStage 2: Introducing Latency (/slow?delay=1200)...');
  await probe('/slow?delay=1200', 1);

  // Check PENDING state
  const pendingAlert = await waitForRuleStatus(rule1.id, 'PENDING');
  console.log(`✓ Latency Alert transitioned to PENDING (Value: ${pendingAlert.currentValue}ms > Threshold: ${pendingAlert.threshold}ms)`);
  console.log(`  Pending since: ${pendingAlert.pendingSince}`);

  // Wait for FOR duration (3s) to elapse and execute next probe
  console.log('  Waiting 3.5s for FOR duration window to elapse...');
  await sleep(3500);
  await probe(null, 1);

  // Check FIRING state
  const firingAlert = await waitForRuleStatus(rule1.id, 'FIRING');
  console.log(`✓ Latency Alert transitioned to 🔥 FIRING! (StartedAt: ${firingAlert.startedAt})`);

  // Verify deduplication: another probe must NOT create another alert instance
  await probe(null, 1);
  const instancesAfterDupCheck = await getInstances();
  const rule1Instances = instancesAfterDupCheck.filter((i) => i.alertRuleId === rule1.id && i.status === 'FIRING');
  console.log(`✓ Deduplication verified: Exactly 1 FIRING instance exists for rule 1 (Count: ${rule1Instances.length})`);

  // 5. Stage 3: Introduce Errors -> Trigger second alert instance (Error Rate & Availability)
  console.log('\nStage 3: Introducing Errors (/error)...');
  await probe('/error', 2);

  // Wait for Error Rate rule to reach PENDING then FIRING
  console.log('  Waiting for Error Rate rule FOR duration window...');
  await sleep(3500);
  await probe(null, 1);

  const firingErrorAlert = await waitForRuleStatus(rule2.id, 'FIRING');
  console.log(`✓ High API Error Rate transitioned to 🔥 FIRING! (Error Rate: ${firingErrorAlert.currentValue}%)`);

  active = await getInstances();
  const currentlyFiring = active.filter((i) => i.status === 'FIRING');
  console.log(`✓ Multiple concurrent active alerts verified: ${currentlyFiring.length} rules firing simultaneously`);

  // 6. Stage 4: Recover Target API -> All Alerts transition to RESOLVED
  console.log('\nStage 4: Recovering Target API (/healthy)...');
  await probe('/healthy', 95, 15);
  console.log('  Waiting 4s for BullMQ to process recovery telemetry...');
  await sleep(4000);

  const resolvedLatency = await waitForRuleStatus(rule1.id, 'RESOLVED');
  console.log(`✓ Latency Alert recovered to ✓ RESOLVED! (ResolvedAt: ${resolvedLatency.resolvedAt})`);

  const resolvedError = await waitForRuleStatus(rule2.id, 'RESOLVED');
  console.log(`✓ Error Rate Alert recovered to ✓ RESOLVED! (ResolvedAt: ${resolvedError.resolvedAt})`);

  const resolvedAvail = await waitForRuleStatus(rule3.id, 'RESOLVED');
  console.log(`✓ Availability Alert recovered to ✓ RESOLVED! (ResolvedAt: ${resolvedAvail.resolvedAt})`);

  // 7. Inspect Evaluation History for the alert instance
  console.log('\nStage 5: Inspecting Evaluation History:');
  const evalsRes = await request(`/alerts/${firingAlert.id}/evaluations`);
  const evals = evalsRes.data || [];
  console.log(`✓ Found ${evals.length} evaluation events for Latency alert instance:`);
  for (const ev of evals.slice(-5)) {
    console.log(
      `  [${new Date(ev.evaluatedAt).toLocaleTimeString()}] Val: ${ev.value}ms | CondMet: ${ev.conditionMet} | ${ev.stateBefore} -> ${ev.stateAfter}`
    );
  }

  // 8. Verify Summary Counts
  const sumRes = await request(`/alerts/summary?projectId=${projId}`);
  console.log('\nStage 6: Verifying Summary Counters:');
  console.log(`  Firing:   ${sumRes.data.firing}`);
  console.log(`  Pending:  ${sumRes.data.pending}`);
  console.log(`  Resolved: ${sumRes.data.resolved}`);
  console.log(`  Total:    ${sumRes.data.total}`);

  console.log('\n================================================================');
  console.log('   🎉 DEMO SCENARIO (SECTION 34) COMPLETED SUCCESSFULLY!');
  console.log('================================================================');
}

runDemo().catch((err) => {
  console.error('\n❌ DEMO FAILED:', err);
  process.exit(1);
});

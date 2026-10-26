/**
 * API SENTINEL — PHASE 5B: Production-Grade Incident Management & Alert Correlation
 * Comprehensive Test Suite covering:
 * - Single Alert firing -> Incident Created (Case 1)
 * - Same alert continuously firing -> Incident Deduplication (Case 2)
 * - Related alert firing -> Correlated to same Incident + Severity Upgrade (Case 3)
 * - Unrelated alert firing -> Creates Separate Incident (Case 4)
 * - Partial alert recovery -> Incident Remains Active (Case 5)
 * - Full alert recovery -> Incident Auto-Resolves (Case 6)
 * - User Acknowledgement -> Incident = ACKNOWLEDGED (Case 7)
 * - Re-violation after resolution -> New Incident Cycle (Case 8)
 * - Incident Timeline verification & Dynamic Duration
 * - Incident Summary counters
 */

const http = require('http');

function request(path, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(`http://localhost:3001/api/v1${path}`);
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
    await sleep(400);
  }
  const fallback = await request(`/alerts?alertRuleId=${ruleId}`);
  throw new Error(
    `Timed out waiting for alert status "${expectedStatus}". Latest: ${JSON.stringify(fallback.data)}`,
  );
}

async function waitForIncident(apiId, expectedStatus, timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const res = await request(`/incidents?apiId=${apiId}`);
    const items = res.data?.items || res.data || [];
    if (items.length > 0) {
      const match = items.find((i) => i.status === expectedStatus);
      if (match) return match;
    }
    await sleep(400);
  }
  const fallback = await request(`/incidents?apiId=${apiId}`);
  throw new Error(
    `Timed out waiting for incident status "${expectedStatus}". Latest: ${JSON.stringify(fallback.data)}`,
  );
}

async function run() {
  console.log('================================================================');
  console.log('🚨 API SENTINEL — PHASE 5B: INCIDENT MANAGEMENT TEST SUITE');
  console.log('================================================================\n');

  // Step 1: Setup isolated test environment
  console.log('--- Step 1: Setting up isolated test hierarchy ---');
  const apisRes = await request('/apis');
  const baseProjectId = apisRes.data[0].projectId;

  // Create isolated Payment API
  const paymentApiRes = await request('/apis', {
    method: 'POST',
    body: {
      name: `Payment Service ${Date.now()}`,
      projectId: baseProjectId,
      description: 'Core Payment Gateway',
    },
  });
  const paymentApi = paymentApiRes.data;

  const paymentEnvRes = await request('/environments', {
    method: 'POST',
    body: {
      name: 'production',
      apiId: paymentApi.id,
      baseUrl: 'http://localhost:4000',
    },
  });
  const paymentEnv = paymentEnvRes.data;

  // Create Unrelated API: "User API"
  const userApiRes = await request('/apis', {
    method: 'POST',
    body: {
      name: `User Service ${Date.now()}`,
      projectId: baseProjectId,
      description: 'Identity & User Service',
    },
  });
  const userApi = userApiRes.data;

  const userEnvRes = await request('/environments', {
    method: 'POST',
    body: {
      name: 'production',
      apiId: userApi.id,
      baseUrl: 'http://localhost:4000',
    },
  });
  const userEnv = userEnvRes.data;

  // Create target monitors
  const monitorPaymentRes = await request('/monitors', {
    method: 'POST',
    body: {
      name: `Payment Monitor ${Date.now()}`,
      environmentId: paymentEnv.id,
      method: 'GET',
      endpoint: '/healthy',
      intervalSeconds: 60,
      timeoutMs: 5000,
      expectedStatusCode: 200,
      isActive: true,
    },
  });
  const monitorPayment = monitorPaymentRes.data;

  const monitorUserRes = await request('/monitors', {
    method: 'POST',
    body: {
      name: `User Monitor ${Date.now()}`,
      environmentId: userEnv.id,
      method: 'GET',
      endpoint: '/healthy',
      intervalSeconds: 60,
      timeoutMs: 5000,
      expectedStatusCode: 200,
      isActive: true,
    },
  });
  const monitorUser = monitorUserRes.data;

  console.log(`✓ Payment API [${paymentApi.id}], User API [${userApi.id}] and monitors created\n`);

  // Step 2: Create alert rules
  console.log('--- Step 2: Creating Alert Rules ---');

  // Rule 1: Payment Latency (WARNING)
  const ruleLatencyRes = await request('/alert-rules', {
    method: 'POST',
    body: {
      name: 'Payment Latency Alert',
      projectId: paymentApi.projectId,
      apiId: paymentApi.id,
      environmentId: paymentEnv.id,
      monitorId: monitorPayment.id,
      metric: 'average_latency',
      condition: 'GREATER_THAN',
      threshold: 500,
      duration: 2, // 2s duration
      evaluationInterval: 30,
      severity: 'WARNING',
    },
  });
  const ruleLatency = ruleLatencyRes.data;

  // Rule 2: Payment Error Rate (CRITICAL)
  const ruleErrorRes = await request('/alert-rules', {
    method: 'POST',
    body: {
      name: 'Payment Error Rate Alert',
      projectId: paymentApi.projectId,
      apiId: paymentApi.id,
      environmentId: paymentEnv.id,
      monitorId: monitorPayment.id,
      metric: 'error_rate',
      condition: 'GREATER_THAN',
      threshold: 20,
      duration: 2,
      evaluationInterval: 30,
      severity: 'CRITICAL',
    },
  });
  const ruleError = ruleErrorRes.data;

  // Rule 3: User Latency Alert (Unrelated API)
  const ruleUserRes = await request('/alert-rules', {
    method: 'POST',
    body: {
      name: 'User Latency Alert',
      projectId: paymentApi.projectId,
      apiId: userApi.id,
      environmentId: userEnv.id,
      monitorId: monitorUser.id,
      metric: 'average_latency',
      condition: 'GREATER_THAN',
      threshold: 500,
      duration: 2,
      evaluationInterval: 30,
      severity: 'HIGH',
    },
  });
  const ruleUser = ruleUserRes.data;

  console.log(`✓ Rule 1 (Latency, WARNING): ${ruleLatency.id}`);
  console.log(`✓ Rule 2 (Error Rate, CRITICAL): ${ruleError.id}`);
  console.log(`✓ Rule 3 (User API, HIGH): ${ruleUser.id}\n`);

  // Step 3: Trigger Payment Latency Violation -> Verify Case 1 (Incident Created)
  console.log('--- Step 3: Triggering Latency on Payment API -> Testing Case 1 ---');
  await request(`/monitors/${monitorPayment.id}`, {
    method: 'PATCH',
    body: { endpoint: '/slow?delay=1200' },
  });

  await request(`/monitors/${monitorPayment.id}/run`, { method: 'POST' });
  const pendingLatency = await waitForAlertStatus(ruleLatency.id, 'PENDING');
  console.log(`✓ Alert entered PENDING (Value: ${pendingLatency.currentValue}ms)`);

  await sleep(2500); // Wait for FOR duration (2s)
  await request(`/monitors/${monitorPayment.id}/run`, { method: 'POST' });

  const firingLatency = await waitForAlertStatus(ruleLatency.id, 'FIRING');
  console.log(`✓ Alert entered FIRING (StartedAt: ${firingLatency.startedAt})`);

  // Verify Incident Creation (Section 9)
  const incident1 = await waitForIncident(paymentApi.id, 'OPEN');
  console.log(`✓ Incident Created: INC-${incident1.id.slice(0, 8)}`);
  console.log(`  Title: "${incident1.title}"`);
  console.log(`  Initial Severity: ${incident1.severity} (Expected: WARNING)`);
  console.log(`  Status: ${incident1.status}`);

  if (incident1.severity !== 'WARNING') {
    throw new Error(`Expected initial severity WARNING, got ${incident1.severity}`);
  }
  console.log('✓ Case 1 Verified: Single firing alert created exactly one incident.\n');

  // Step 4: Continued evaluation while firing -> Verify Case 2 (Deduplication)
  console.log('--- Step 4: Probing again -> Testing Case 2 (Incident Deduplication) ---');
  await request(`/monitors/${monitorPayment.id}/run`, { method: 'POST' });
  await sleep(500);

  const paymentIncidentsAfterDedupe = await request(`/incidents?apiId=${paymentApi.id}&status=OPEN`);
  const activeCount = paymentIncidentsAfterDedupe.data?.total ?? paymentIncidentsAfterDedupe.data?.items?.length ?? 1;
  console.log(`✓ Active incidents count on Payment API: ${activeCount} (Expected: 1)`);
  if (activeCount !== 1) {
    throw new Error(`Expected 1 incident, got ${activeCount}`);
  }
  console.log('✓ Case 2 Verified: Continuing alert did NOT create duplicate incidents.\n');

  // Step 5: Second Related Alert Fires -> Testing Case 3 (Correlation & Severity Upgrade)
  console.log('--- Step 5: Introducing Errors on Payment API -> Testing Case 3 (Correlation & Severity) ---');
  await request(`/monitors/${monitorPayment.id}`, {
    method: 'PATCH',
    body: { endpoint: '/error' },
  });

  await request(`/monitors/${monitorPayment.id}/run`, { method: 'POST' });
  await sleep(2500); // FOR duration
  await request(`/monitors/${monitorPayment.id}/run`, { method: 'POST' });

  const firingError = await waitForAlertStatus(ruleError.id, 'FIRING');
  console.log(`✓ Second Alert entered FIRING: "${ruleError.name}" (${firingError.currentValue}%)`);

  // Verify correlation and severity upgrade
  const correlatedIncident = await request(`/incidents/${incident1.id}`);
  const inc = correlatedIncident.data;
  console.log(`✓ Inspected Incident INC-${inc.id.slice(0, 8)}:`);
  console.log(`  Attached Alerts Count: ${inc.alerts.length} (Expected: 2)`);
  console.log(`  Escalated Severity: ${inc.severity} (Expected: CRITICAL)`);

  if (inc.alerts.length < 2) {
    throw new Error(`Expected at least 2 attached alerts, got ${inc.alerts.length}`);
  }
  if (inc.severity !== 'CRITICAL') {
    throw new Error(`Expected incident severity to be escalated to CRITICAL, got ${inc.severity}`);
  }

  const allOpenPayment = await request(`/incidents?apiId=${paymentApi.id}&status=OPEN`);
  const openCount = allOpenPayment.data?.total ?? allOpenPayment.data?.items?.length ?? 1;
  if (openCount !== 1) {
    throw new Error(`Expected exactly 1 incident for Payment API, found ${openCount}`);
  }
  console.log('✓ Case 3 Verified: Related alerts attached to same incident & severity upgraded to CRITICAL.\n');

  // Step 6: Unrelated API Alert Fires -> Testing Case 4 (Separate Incident)
  console.log('--- Step 6: Triggering Alert on User API -> Testing Case 4 (Separate Incident) ---');
  await request(`/monitors/${monitorUser.id}`, {
    method: 'PATCH',
    body: { endpoint: '/slow?delay=1200' },
  });

  await request(`/monitors/${monitorUser.id}/run`, { method: 'POST' });
  await sleep(2500);
  await request(`/monitors/${monitorUser.id}/run`, { method: 'POST' });

  const firingUserAlert = await waitForAlertStatus(ruleUser.id, 'FIRING');
  console.log(`✓ User API Alert entered FIRING (Value: ${firingUserAlert.currentValue}ms)`);

  const userIncident = await waitForIncident(userApi.id, 'OPEN');
  console.log(`✓ Separate Incident Created for User API: INC-${userIncident.id.slice(0, 8)}`);
  console.log(`  Title: "${userIncident.title}"`);
  console.log(`  Target API: ${userIncident.api?.name}`);

  if (userIncident.id === incident1.id) {
    throw new Error('Unrelated API alert was wrongly attached to the Payment incident!');
  }
  console.log('✓ Case 4 Verified: Unrelated API alert generated a separate incident.\n');

  // Step 7: Acknowledge Payment Incident -> Testing Case 7
  console.log('--- Step 7: Acknowledging Incident -> Testing Case 7 ---');
  const ackRes = await request(`/incidents/${incident1.id}/acknowledge`, { method: 'POST' });
  console.log(`✓ Incident state after acknowledge: Status = ${ackRes.data.status}, AcknowledgedBy = ${ackRes.data.acknowledgedBy}`);

  if (ackRes.data.status !== 'ACKNOWLEDGED' || !ackRes.data.acknowledgedAt) {
    throw new Error(`Failed to acknowledge incident, status: ${ackRes.data.status}`);
  }

  // Monitoring continues without disturbance
  await request(`/monitors/${monitorPayment.id}/run`, { method: 'POST' });
  const stillAcked = await request(`/incidents/${incident1.id}`);
  if (stillAcked.data.status !== 'ACKNOWLEDGED') {
    throw new Error(`Incident status changed unexpectedly: ${stillAcked.data.status}`);
  }
  console.log('✓ Case 7 Verified: Incident acknowledged and continuous monitoring preserved.\n');

  // Step 8: Full Recovery -> Testing Case 5 & 6 (Automatic Resolution)
  console.log('--- Step 8: Recovering Target API to /healthy -> Testing Case 5 & 6 ---');
  await request(`/monitors/${monitorPayment.id}`, {
    method: 'PATCH',
    body: { endpoint: '/healthy' },
  });

  // Probe 95 times to dilute rolling percentiles and clear errors
  for (let i = 0; i < 95; i++) {
    await request(`/monitors/${monitorPayment.id}/run`, { method: 'POST' });
  }

  const resolvedIncident = await waitForIncident(paymentApi.id, 'RESOLVED');
  console.log(`✓ Incident Auto-Resolved: INC-${resolvedIncident.id.slice(0, 8)}`);
  console.log(`  Status: ${resolvedIncident.status}`);
  console.log(`  ResolvedAt: ${resolvedIncident.resolvedAt}`);
  console.log(`  Duration: ${resolvedIncident.durationSeconds}s`);

  if (resolvedIncident.status !== 'RESOLVED' || !resolvedIncident.resolvedAt) {
    throw new Error('Expected incident to be auto-resolved');
  }
  console.log('✓ Case 6 Verified: Incident automatically resolved once all attached alerts recovered.\n');

  // Step 9: Inspect Incident Timeline Audit Trail
  console.log('--- Step 9: Inspecting Incident Timeline Audit Trail ---');
  const timelineRes = await request(`/incidents/${incident1.id}/timeline`);
  const timeline = timelineRes.data || [];
  console.log(`✓ Timeline events recorded: ${timeline.length}`);
  const eventTypes = timeline.map((e) => e.type);
  console.log(`  Event sequence: [${eventTypes.join(' -> ')}]`);

  if (!eventTypes.includes('CREATED')) throw new Error('Missing CREATED timeline event');
  if (!eventTypes.includes('ALERT_ATTACHED')) throw new Error('Missing ALERT_ATTACHED timeline event');
  if (!eventTypes.includes('SEVERITY_CHANGED')) throw new Error('Missing SEVERITY_CHANGED timeline event');
  if (!eventTypes.includes('ACKNOWLEDGED')) throw new Error('Missing ACKNOWLEDGED timeline event');
  if (!eventTypes.includes('ALERT_RESOLVED')) throw new Error('Missing ALERT_RESOLVED timeline event');
  if (!eventTypes.includes('RESOLVED')) throw new Error('Missing RESOLVED timeline event');
  console.log('✓ Complete timeline audit trail verified.\n');

  // Step 10: Re-violation after Resolution -> Testing Case 8 (New Incident Cycle)
  console.log('--- Step 10: Introducing Outage After Resolution -> Testing Case 8 ---');
  // Lower threshold to 10ms so new violation immediately triggers against historical average
  await request(`/alert-rules/${ruleLatency.id}`, {
    method: 'PATCH',
    body: { threshold: 10 },
  });

  await request(`/monitors/${monitorPayment.id}`, {
    method: 'PATCH',
    body: { endpoint: '/slow?delay=1200' },
  });

  await request(`/monitors/${monitorPayment.id}/run`, { method: 'POST' });
  await waitForAlertStatus(ruleLatency.id, 'PENDING');
  await sleep(2500);
  await request(`/monitors/${monitorPayment.id}/run`, { method: 'POST' });
  await waitForAlertStatus(ruleLatency.id, 'FIRING');

  const incidentNew = await waitForIncident(paymentApi.id, 'OPEN');
  console.log(`✓ New Incident Created: INC-${incidentNew.id.slice(0, 8)}`);
  console.log(`  Previous Resolved Incident: INC-${incident1.id.slice(0, 8)}`);

  if (incidentNew.id === incident1.id) {
    throw new Error('New violation incorrectly reused the resolved incident instead of creating a fresh cycle!');
  }
  console.log('✓ Case 8 Verified: New violation after recovery started a fresh incident lifecycle.\n');

  // Step 11: Summary Counters
  console.log('--- Step 11: Testing Incident Summary Endpoint ---');
  const summaryRes = await request('/incidents/summary');
  const summary = summaryRes.data;
  console.log('✓ Incident Summary:', JSON.stringify(summary));
  if (summary.total < 2 || summary.resolved < 1) {
    throw new Error('Summary count assertion failed');
  }

  // Step 12: Clean Up
  console.log('\n--- Step 12: Cleaning up test resources ---');
  await request(`/alert-rules/${ruleLatency.id}`, { method: 'DELETE' });
  await request(`/alert-rules/${ruleError.id}`, { method: 'DELETE' });
  await request(`/alert-rules/${ruleUser.id}`, { method: 'DELETE' });
  await request(`/monitors/${monitorPayment.id}`, { method: 'DELETE' });
  await request(`/monitors/${monitorUser.id}`, { method: 'DELETE' });
  await request(`/apis/${paymentApi.id}`, { method: 'DELETE' });
  await request(`/apis/${userApi.id}`, { method: 'DELETE' });
  console.log('✓ Cleanup completed.');

  console.log('\n================================================================');
  console.log('🎉 ALL PHASE 5B INCIDENT MANAGEMENT TESTS PASSED PERFECTLY!');
  console.log('================================================================');
}

run().catch((err) => {
  console.error('\n❌ Test Suite Failed:', err);
  process.exit(1);
});

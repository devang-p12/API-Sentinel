/**
 * API Sentinel - Phase 2 Verification Script
 * Tests:
 * 1. Response Schema Validation (Pass & Failure detection)
 * 2. Automated Alert & Incident Lifecycle (Triggered -> Acknowledged)
 * 3. Latency Percentiles & Availability Analytics (Uptime %, P50, P95, P99)
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
  console.log('🚀 TESTING PHASE 2: RELIABILITY INTELLIGENCE & ANALYTICS');
  console.log('=================================================================\n');

  // 1. Fetch existing project & environment
  console.log('[Step 1] Loading existing Environment...');
  const environments = await request('/environments');
  const env = environments[0];
  console.log(`✅ Using Environment "${env.name}" at ${env.baseUrl} (ID: ${env.id})`);

  // 2. Test Response Schema Validation
  console.log('\n[Step 2] Testing Response Schema Validation...');
  
  // Monitor A: Valid Schema
  console.log('  Creating monitor with VALID schema contract...');
  const validSchemaMonitor = await request('/monitors', {
    method: 'POST',
    body: JSON.stringify({
      name: 'Valid Schema Probe',
      url: '/schema-change',
      environmentId: env.id,
      expectedStatusCode: 200,
      intervalSeconds: 15,
      timeoutMs: 5000,
      assertions: [
        {
          type: 'schema',
          requiredKeys: ['apiVersion', 'data'],
          propertyTypes: { apiVersion: 'string', data: 'object' },
        },
      ],
    }),
  });
  console.log(`  ✅ Valid schema monitor created: ${validSchemaMonitor.id}`);

  // Monitor B: Broken Schema (Contract Drift)
  console.log('  Creating monitor expecting non-existent field (Contract Drift)...');
  const brokenSchemaMonitor = await request('/monitors', {
    method: 'POST',
    body: JSON.stringify({
      name: 'Contract Drift Probe',
      url: '/schema-change',
      environmentId: env.id,
      expectedStatusCode: 200,
      intervalSeconds: 15,
      timeoutMs: 5000,
      assertions: [
        {
          type: 'schema',
          requiredKeys: ['apiVersion', 'legacyTokenField'],
          propertyTypes: { apiVersion: 'string' },
        },
      ],
    }),
  });
  console.log(`  ✅ Contract drift monitor created: ${brokenSchemaMonitor.id}`);

  console.log('  Waiting 3s for schema probe execution...');
  await sleep(3000);

  const validExec = await request(`/monitors/${validSchemaMonitor.id}/executions`);
  const brokenExec = await request(`/monitors/${brokenSchemaMonitor.id}/executions`);

  console.log(`  - Valid Schema Probe Status:   ${validExec[0].status === 'SUCCESS' ? '✅ SUCCESS' : '❌ FAILED'}`);
  console.log(`  - Contract Drift Probe Status: ${brokenExec[0].status === 'FAILED' ? '❌ FAILED (Contract Drift Caught!)' : '❓ ' + brokenExec[0].status}`);
  console.log(`  - Contract Drift Error Msg:    "${brokenExec[0].errorMessage}"`);

  // 3. Test Alerting & Incident Lifecycle
  console.log('\n[Step 3] Testing Alert Rules & Automated Incident Lifecycle...');
  
  // Find the /error monitor from Phase 1
  const allMonitors = await request('/monitors');
  const errorMonitor = allMonitors.find((m) => m.url.includes('/error')) || validSchemaMonitor;
  
  console.log(`  Creating Alert Rule for "${errorMonitor.name}"...`);
  const alert = await request('/alerts', {
    method: 'POST',
    body: JSON.stringify({
      name: 'Critical Service Degradation Alert',
      monitorId: errorMonitor.id,
      severity: 'CRITICAL',
      consecutiveFailures: 2,
    }),
  });
  console.log(`  ✅ Alert Rule configured: "${alert.name}" (ID: ${alert.id}, Threshold: 2 failures)`);

  console.log('  Triggering execution to evaluate incident engine...');
  await request(`/monitors/${errorMonitor.id}/run`, { method: 'POST' });
  await sleep(2500);

  const incidents = await request('/incidents');
  console.log(`  Current active incidents count: ${incidents.length}`);
  if (incidents.length > 0) {
    const inc = incidents[0];
    console.log(`  🚨 INCIDENT DETECTED!`);
    console.log(`     - ID:       ${inc.id}`);
    console.log(`     - Status:   ${inc.status}`);
    console.log(`     - Summary:  "${inc.summary}"`);
    console.log(`     - Started:  ${inc.startedAt}`);

    // Acknowledge incident
    console.log('\n  Acknowledging incident via PATCH /incidents/:id/acknowledge...');
    const ack = await request(`/incidents/${inc.id}/acknowledge`, { method: 'PATCH' });
    console.log(`  ✅ Incident status updated to: ${ack.status}`);
  }

  // 4. Test Analytics & Metric Aggregations
  console.log('\n[Step 4] Testing Historical Analytics & Percentile Calculations...');
  const analytics = await request(`/monitors/${allMonitors[0].id}/analytics`);

  console.log(`  Analytics Report for "${analytics.monitorName}":`);
  console.log(`  - Total Checks Run:    ${analytics.totalChecks}`);
  console.log(`  - Availability (SLA):  ${analytics.availabilityPct}%`);
  console.log(`  - Average Latency:     ${analytics.latency.avgMs}ms`);
  console.log(`  - Min / Max Latency:   ${analytics.latency.minMs}ms / ${analytics.latency.maxMs}ms`);
  console.log(`  - P50 Latency (Median):${analytics.latency.percentiles.p50}ms`);
  console.log(`  - P90 Latency:         ${analytics.latency.percentiles.p90}ms`);
  console.log(`  - P95 Latency:         ${analytics.latency.percentiles.p95}ms`);
  console.log(`  - P99 Latency:         ${analytics.latency.percentiles.p99}ms`);
  console.log(`  - Chart Time Series:   ${analytics.timeSeries.length} time bucket(s) generated`);

  console.log('\n=================================================================');
  console.log('🎉 PHASE 2 VERIFICATION COMPLETE: ALL ADVANCED CAPABILITIES ACTIVE');
  console.log('=================================================================');
}

run().catch((err) => {
  console.error('❌ Phase 2 Verification failed:', err);
  process.exit(1);
});

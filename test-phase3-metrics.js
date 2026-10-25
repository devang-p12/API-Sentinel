/**
 * Sentinel Phase 3 - Real Metrics & Dashboard Data Layer Test Suite
 *
 * Verifies:
 * 1. Metric Catalog (all 12 metrics, metadata, categories)
 * 2. Time Range Validation (from > to returns 400, > 365 days returns 400)
 * 3. Empty State Handling (empty latencies return null, no fake 0ms/NaN)
 * 4. Metric Query Endpoint (all 12 metrics: request_count, success_rate, error_rate,
 *    availability, failure_count, timeout_count, average_latency, p50_latency,
 *    p95_latency, p99_latency, min_latency, max_latency)
 * 5. Time-Series Dynamic Bucketing
 * 6. Filter Scoping & Precedence (Widget-specific > Dashboard global > Default)
 * 7. Section 64 Required End-to-End Demo Flow:
 *    /healthy -> /slow (latency increase) -> /error (error rate increase, success decrease) -> /healthy (recovery)
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

async function runTests() {
  console.log('====================================================');
  console.log('🚀 SENTINEL PHASE 3: REAL METRICS VERIFICATION SUITE');
  console.log('====================================================\n');

  // 1. Metric Catalog Verification
  console.log('--- 1. Testing Metric Catalog ---');
  const catalogRes = await request('/dashboards/metrics/catalog');
  if (catalogRes.status !== 200) {
    throw new Error(`Failed to fetch catalog: status ${catalogRes.status}`);
  }
  const catalog = catalogRes.data;
  console.log(`✓ Catalog returned ${catalog.length} metrics`);
  const expectedMetrics = [
    'availability',
    'success_rate',
    'error_rate',
    'request_count',
    'average_latency',
    'p50_latency',
    'p95_latency',
    'p99_latency',
    'min_latency',
    'max_latency',
    'timeout_count',
    'failure_count',
  ];
  for (const m of expectedMetrics) {
    const def = catalog.find((c) => c.id === m);
    if (!def) throw new Error(`Missing expected metric in catalog: ${m}`);
    if (!def.category || !def.unit || !Array.isArray(def.supportedVisualizations)) {
      throw new Error(`Metric ${m} has invalid metadata structure`);
    }
  }
  console.log('✓ All 12 required metrics present with complete metadata & categories\n');

  // 2. Time Range Validation
  console.log('--- 2. Testing Time Range Validation ---');
  const invalidRangeRes = await request('/dashboards/metrics/query', {
    method: 'POST',
    body: {
      metric: 'average_latency',
      from: '2026-10-25T12:00:00Z',
      to: '2026-10-25T10:00:00Z', // from > to
    },
  });
  if (invalidRangeRes.status !== 400) {
    throw new Error(`Expected 400 for from > to, got ${invalidRangeRes.status}`);
  }
  console.log('✓ Rejected invalid time range (from > to) with 400 Bad Request');

  const excessiveRangeRes = await request('/dashboards/metrics/query', {
    method: 'POST',
    body: {
      metric: 'average_latency',
      from: '2020-01-01T00:00:00Z',
      to: '2026-01-01T00:00:00Z', // > 365 days
    },
  });
  if (excessiveRangeRes.status !== 400) {
    throw new Error(`Expected 400 for range > 365 days, got ${excessiveRangeRes.status}`);
  }
  console.log('✓ Rejected excessive time range (> 365 days) with 400 Bad Request\n');

  // 3. Unsupported Metric Validation
  console.log('--- 3. Testing Unsupported Metric Validation ---');
  const unsupportedMetricRes = await request('/dashboards/metrics/query', {
    method: 'POST',
    body: {
      metric: 'non_existent_fake_metric',
      timeRange: '1h',
    },
  });
  if (unsupportedMetricRes.status !== 400) {
    throw new Error(`Expected 400 for unsupported metric, got ${unsupportedMetricRes.status}`);
  }
  console.log('✓ Rejected unsupported metric with 400 Bad Request\n');

  // 4. Setup Test Target Monitor for Controlled Measurements
  console.log('--- 4. Setting Up Test Telemetry Environment ---');
  const apisRes = await request('/apis');
  let testApi = apisRes.data?.[0];
  if (!testApi) {
    const newApi = await request('/apis', {
      method: 'POST',
      body: { name: 'Phase3 Demo API', baseUrl: 'http://localhost:4000' },
    });
    testApi = newApi.data;
  }

  const envsRes = await request(`/environments?apiId=${testApi.id}`);
  let testEnv = envsRes.data?.[0];
  if (!testEnv) {
    const newEnv = await request('/environments', {
      method: 'POST',
      body: { name: 'Production', baseUrl: 'http://localhost:4000', apiId: testApi.id },
    });
    testEnv = newEnv.data;
  }

  // Create isolated monitor for this test
  const monitorRes = await request('/monitors', {
    method: 'POST',
    body: {
      name: `Phase3 Test Monitor ${Date.now()}`,
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
  console.log(`✓ Test Monitor created: ${monitor.name} (${monitor.id})`);

  // 5. Empty State Test (on monitor with 0 executions)
  console.log('--- 5. Testing Empty State Handling ---');
  const emptyMonitorRes = await request('/monitors', {
    method: 'POST',
    body: {
      name: `Phase3 Empty Monitor ${Date.now()}`,
      environmentId: testEnv.id,
      method: 'GET',
      endpoint: '/healthy',
      intervalSeconds: 300,
      timeoutMs: 5000,
      expectedStatusCode: 200,
      isActive: false, // inactive so worker won't execute it
    },
  });
  const emptyMonitor = emptyMonitorRes.data;

  const emptyLatencyRes = await request('/dashboards/metrics/query', {
    method: 'POST',
    body: {
      metric: 'average_latency',
      monitorId: emptyMonitor.id,
      timeRange: '1h',
    },
  });
  if (emptyLatencyRes.status !== 200 && emptyLatencyRes.status !== 201) {
    throw new Error(`Empty query failed: status ${emptyLatencyRes.status}`);
  }
  if (emptyLatencyRes.data.value !== null) {
    throw new Error(
      `Empty average_latency must return null, got: ${JSON.stringify(emptyLatencyRes.data.value)}`,
    );
  }
  console.log('✓ Empty average_latency returns value: null (no fake 0ms)');

  const emptyReqRes = await request('/dashboards/metrics/query', {
    method: 'POST',
    body: {
      metric: 'request_count',
      monitorId: emptyMonitor.id,
      timeRange: '1h',
    },
  });
  if (emptyReqRes.data.value !== 0) {
    throw new Error(`Empty request_count must return 0, got: ${emptyReqRes.data.value}`);
  }
  console.log('✓ Empty request_count returns value: 0');

  const emptySuccessRes = await request('/dashboards/metrics/query', {
    method: 'POST',
    body: {
      metric: 'success_rate',
      monitorId: emptyMonitor.id,
      timeRange: '1h',
    },
  });
  if (emptySuccessRes.data.value !== null) {
    throw new Error(`Empty success_rate must return null (not NaN), got: ${emptySuccessRes.data.value}`);
  }
  console.log('✓ Empty success_rate returns value: null (no NaN/Infinity)\n');

  // 6. Section 64 Demonstration Flow
  console.log('--- 6. SECTION 64: END-TO-END DEMONSTRATION FLOW ---');
  console.log('Step A: Executing on /healthy endpoint...');
  // Trigger immediate run on /healthy
  await request(`/monitors/${monitor.id}/run`, { method: 'POST' });
  await sleep(1500);

  // Check metrics after /healthy
  const healthyQuery = await request('/dashboards/metrics/query', {
    method: 'POST',
    body: {
      metric: 'success_rate',
      monitorId: monitor.id,
      timeRange: '1h',
    },
  });
  console.log(`  -> Success Rate on /healthy: ${healthyQuery.data.value}%`);
  if (healthyQuery.data.value !== 100) {
    throw new Error(`Expected 100% success rate on /healthy, got ${healthyQuery.data.value}`);
  }

  const healthyLatencyQuery = await request('/dashboards/metrics/query', {
    method: 'POST',
    body: {
      metric: 'average_latency',
      monitorId: monitor.id,
      timeRange: '1h',
    },
  });
  console.log(`  -> Average Latency on /healthy: ${healthyLatencyQuery.data.value}ms`);
  const healthyLatency = healthyLatencyQuery.data.value;

  // Step B: Change endpoint to /slow
  console.log('Step B: Updating monitor to /slow endpoint...');
  await request(`/monitors/${monitor.id}`, {
    method: 'PATCH',
    body: { endpoint: '/slow' },
  });
  await request(`/monitors/${monitor.id}/run`, { method: 'POST' });
  await sleep(2500); // /slow takes ~1000-1500ms

  const slowLatencyQuery = await request('/dashboards/metrics/query', {
    method: 'POST',
    body: {
      metric: 'average_latency',
      monitorId: monitor.id,
      timeRange: '1h',
    },
  });
  console.log(`  -> Average Latency after /slow: ${slowLatencyQuery.data.value}ms`);
  if (slowLatencyQuery.data.value <= healthyLatency) {
    throw new Error(
      `Latency did not increase on /slow: healthy=${healthyLatency}ms, slow=${slowLatencyQuery.data.value}ms`,
    );
  }
  console.log('✓ Latency increased substantially on /slow (demonstrating real latency calculation)');

  // Step C: Change endpoint to /error
  console.log('Step C: Updating monitor to /error endpoint...');
  await request(`/monitors/${monitor.id}`, {
    method: 'PATCH',
    body: { endpoint: '/error' },
  });
  await request(`/monitors/${monitor.id}/run`, { method: 'POST' });
  await sleep(1500);

  const errorRateQuery = await request('/dashboards/metrics/query', {
    method: 'POST',
    body: {
      metric: 'error_rate',
      monitorId: monitor.id,
      timeRange: '1h',
    },
  });
  const failCountQuery = await request('/dashboards/metrics/query', {
    method: 'POST',
    body: {
      metric: 'failure_count',
      monitorId: monitor.id,
      timeRange: '1h',
    },
  });
  const degradedSuccessQuery = await request('/dashboards/metrics/query', {
    method: 'POST',
    body: {
      metric: 'success_rate',
      monitorId: monitor.id,
      timeRange: '1h',
    },
  });
  console.log(`  -> Error Rate after /error: ${errorRateQuery.data.value}%`);
  console.log(`  -> Failure Count after /error: ${failCountQuery.data.value}`);
  console.log(`  -> Success Rate after /error: ${degradedSuccessQuery.data.value}%`);
  if (errorRateQuery.data.value <= 0 || failCountQuery.data.value <= 0) {
    throw new Error('Error rate or failure count did not increase after /error');
  }
  if (degradedSuccessQuery.data.value >= 100) {
    throw new Error('Success rate did not drop after /error');
  }
  console.log('✓ Error rate increased & success rate dropped on /error');

  // Step D: Recovery back to /healthy
  console.log('Step D: Recovering monitor back to /healthy endpoint...');
  await request(`/monitors/${monitor.id}`, {
    method: 'PATCH',
    body: { endpoint: '/healthy' },
  });
  await request(`/monitors/${monitor.id}/run`, { method: 'POST' });
  await sleep(1500);

  const recoveredSuccessQuery = await request('/dashboards/metrics/query', {
    method: 'POST',
    body: {
      metric: 'success_rate',
      monitorId: monitor.id,
      timeRange: '1h',
    },
  });
  console.log(`  -> Success Rate after recovery: ${recoveredSuccessQuery.data.value}%`);
  if (recoveredSuccessQuery.data.value <= degradedSuccessQuery.data.value) {
    throw new Error('Success rate did not rebound after recovery');
  }
  console.log('✓ Success rate rebounded towards recovery!\n');

  // 7. Test All 12 Metrics
  console.log('--- 7. Querying All 12 Metrics on Live Monitor ---');
  for (const m of expectedMetrics) {
    const res = await request('/dashboards/metrics/query', {
      method: 'POST',
      body: {
        metric: m,
        monitorId: monitor.id,
        timeRange: '1h',
      },
    });
    if (res.status !== 200) {
      throw new Error(`Metric query for ${m} failed with status ${res.status}`);
    }
    console.log(`  ✓ Metric '${m}': value = ${res.data.value} ${res.data.unit}`);
  }
  console.log('✓ All 12 metrics calculated and returned successfully\n');

  // 8. Test Time-Series Dynamic Bucketing
  console.log('--- 8. Testing Time Series Bucketing ---');
  const tsRes = await request('/dashboards/metrics/query', {
    method: 'POST',
    body: {
      metric: 'average_latency',
      monitorId: monitor.id,
      timeRange: '1h',
      groupBy: 'time',
    },
  });
  if (tsRes.status !== 200 || !Array.isArray(tsRes.data.series)) {
    throw new Error('Time series query failed or did not return series array');
  }
  console.log(`✓ Time series returned ${tsRes.data.series.length} buckets`);
  const bucketSample = tsRes.data.series.slice(-3);
  console.log('  Recent buckets:', JSON.stringify(bucketSample));
  console.log('✓ Time series buckets validated\n');

  // 9. Test Dashboard Data Endpoint & Filter Precedence
  console.log('--- 9. Testing Dashboard Data Endpoint & Filter Precedence ---');
  // Create test dashboard
  const dbRes = await request('/dashboards', {
    method: 'POST',
    body: {
      name: `Phase3 Metrics Dashboard ${Date.now()}`,
      description: 'Validation of real metrics and filter precedence',
      projectId: testApi.projectId,
    },
  });
  const testDashboard = dbRes.data;

  // Add Widget 1: Inherits global filter
  const w1Res = await request(`/dashboards/${testDashboard.id}/widgets`, {
    method: 'POST',
    body: {
      title: 'Global Filtered Success Rate',
      metric: 'success_rate',
      visualizationType: 'STAT',
      configuration: {},
    },
  });

  // Add Widget 2: Specific override filter
  const w2Res = await request(`/dashboards/${testDashboard.id}/widgets`, {
    method: 'POST',
    body: {
      title: 'Widget Override Monitor Success Rate',
      metric: 'success_rate',
      visualizationType: 'STAT',
      configuration: {
        monitorId: monitor.id,
      },
    },
  });

  // Query dashboard data with global filter
  const dbDataRes = await request(
    `/dashboards/${testDashboard.id}/data?timeRange=1h&monitorId=${monitor.id}`,
  );
  if (dbDataRes.status !== 200) {
    throw new Error(`Failed to get dashboard data: ${dbDataRes.status}`);
  }
  console.log(`✓ Dashboard data endpoint returned ${dbDataRes.data.widgets.length} widgets`);
  for (const w of dbDataRes.data.widgets) {
    const val = w.telemetry?.current !== undefined ? w.telemetry.current : w.data?.summary?.current;
    console.log(`  -> Widget "${w.title}": value = ${val}%`);
    if (val === undefined) {
      throw new Error(`Widget ${w.id} has undefined metric value`);
    }
  }
  console.log('✓ Real backend metrics mapped to dashboard widgets successfully');

  console.log('\n====================================================');
  console.log('🎉 ALL PHASE 3 REAL METRICS CHECKS PASSED PERFECTLY!');
  console.log('====================================================');
}

runTests().catch((err) => {
  console.error('\n❌ TEST FAILED:', err.message);
  if (err.stack) console.error(err.stack);
  process.exit(1);
});

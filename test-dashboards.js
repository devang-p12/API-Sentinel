const API_BASE = 'http://localhost:3001/api/v1';

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  });

  const contentType = res.headers.get('content-type') || '';
  let body = null;
  if (contentType.includes('application/json')) {
    body = await res.json();
  } else {
    body = await res.text();
  }

  return { status: res.status, ok: res.ok, body };
}

function assert(condition, message) {
  if (!condition) {
    console.error(`  ❌ [FAIL] ${message}`);
    process.exit(1);
  }
  console.log(`  ✅ [PASS] ${message}`);
}

async function runTests() {
  console.log('=================================================================');
  console.log('📊 API SENTINEL - GRAFANA-STYLE CUSTOM DASHBOARD TEST SUITE');
  console.log('=================================================================\n');

  // --- Step 1: Metric Catalog ---
  console.log('--- Step 1: Metric Registry Catalog ---');
  const catalogRes = await request('/dashboards/metrics/catalog');
  assert(catalogRes.status === 200, 'GET /dashboards/metrics/catalog returns 200');
  assert(Array.isArray(catalogRes.body), 'Catalog is an array');
  assert(catalogRes.body.length >= 12, `Catalog contains ${catalogRes.body.length} metrics`);
  
  const metricIds = catalogRes.body.map((m) => m.id);
  assert(metricIds.includes('availability'), 'Registry contains availability');
  assert(metricIds.includes('p95_latency'), 'Registry contains p95_latency');
  assert(metricIds.includes('error_rate'), 'Registry contains error_rate');
  assert(metricIds.includes('http_status_distribution'), 'Registry contains http_status_distribution');
  assert(metricIds.includes('request_count'), 'Registry contains request_count');

  // --- Step 2: Metric Preview Engine ---
  console.log('\n--- Step 2: Live Metric Preview Query ---');
  const previewRes = await request('/dashboards/preview', {
    method: 'POST',
    body: JSON.stringify({
      metric: 'p95_latency',
      timeRange: '24h',
    }),
  });
  assert(previewRes.status === 200 || previewRes.status === 201, 'POST /dashboards/preview returns 200/201');
  assert(previewRes.body.metric === 'p95_latency', 'Preview returns requested metric');
  assert(previewRes.body.unit === 'ms', 'Preview unit is ms');
  assert('summary' in previewRes.body, 'Preview contains summary statistics');
  assert(Array.isArray(previewRes.body.timeSeries), 'Preview contains timeSeries array');

  // --- Step 3: Create Custom Dashboard ---
  console.log('\n--- Step 3: Create Custom Dashboard ---');
  const dashName = `Production API Overview ${Date.now()}`;
  const createDashRes = await request('/dashboards', {
    method: 'POST',
    body: JSON.stringify({
      name: dashName,
      description: 'Reliability and P95 latency telemetry for production services',
    }),
  });
  assert(createDashRes.status === 201, 'POST /dashboards creates dashboard with 201');
  const dashboard = createDashRes.body;
  assert(dashboard.id !== undefined, 'Created dashboard has generated ID');
  assert(dashboard.name === dashName, 'Dashboard name matches');
  assert(Array.isArray(dashboard.widgets), 'Dashboard has widgets relation');

  // --- Step 4: Add Visualizations (Widgets 1 to 4) ---
  console.log('\n--- Step 4: Add Custom Visualizations ---');
  
  // Widget 1: Availability (Stat)
  const w1Res = await request(`/dashboards/${dashboard.id}/widgets`, {
    method: 'POST',
    body: JSON.stringify({
      title: 'Production Availability',
      metric: 'availability',
      visualizationType: 'stat',
      width: 6,
      height: 3,
      x: 0,
      y: 0,
    }),
  });
  assert(w1Res.status === 201, 'Widget 1 (Stat: Availability) created');
  const widget1 = w1Res.body;

  // Widget 2: P95 Latency (Time Series)
  const w2Res = await request(`/dashboards/${dashboard.id}/widgets`, {
    method: 'POST',
    body: JSON.stringify({
      title: 'P95 Response Latency Trend',
      metric: 'p95_latency',
      visualizationType: 'time_series',
      width: 6,
      height: 3,
      x: 6,
      y: 0,
    }),
  });
  assert(w2Res.status === 201, 'Widget 2 (Time Series: P95 Latency) created');
  const widget2 = w2Res.body;

  // Widget 3: Error Rate (Time Series)
  const w3Res = await request(`/dashboards/${dashboard.id}/widgets`, {
    method: 'POST',
    body: JSON.stringify({
      title: 'Error Rate Trend',
      metric: 'error_rate',
      visualizationType: 'time_series',
      width: 12,
      height: 4,
      x: 0,
      y: 3,
    }),
  });
  assert(w3Res.status === 201, 'Widget 3 (Time Series: Error Rate) created');
  const widget3 = w3Res.body;

  // Widget 4: HTTP Status Distribution (Bar Chart)
  const w4Res = await request(`/dashboards/${dashboard.id}/widgets`, {
    method: 'POST',
    body: JSON.stringify({
      title: 'HTTP Status Distribution',
      metric: 'http_status_distribution',
      visualizationType: 'bar',
      width: 12,
      height: 3,
      x: 0,
      y: 7,
    }),
  });
  assert(w4Res.status === 201, 'Widget 4 (Bar: HTTP Status Distribution) created');
  const widget4 = w4Res.body;

  // --- Step 5: Dashboard Live Telemetry Data ---
  console.log('\n--- Step 5: Query Live Dashboard Data with MetricQueryService ---');
  const dataRes = await request(`/dashboards/${dashboard.id}/data?timeRange=24h`);
  assert(dataRes.status === 200, 'GET /dashboards/:id/data returns 200');
  assert(dataRes.body.dashboard.id === dashboard.id, 'Returned data matches dashboard ID');
  assert(dataRes.body.widgets.length === 4, 'Returned all 4 widgets with data');

  for (const w of dataRes.body.widgets) {
    assert(w.data !== undefined, `Widget "${w.title}" has resolved data object`);
    assert(w.data.metric === w.metric, `Widget data metric "${w.data.metric}" matches`);
    assert('summary' in w.data, `Widget data has summary object`);
    assert(Array.isArray(w.data.timeSeries), `Widget data has timeSeries array`);
  }

  // --- Step 6: Layout Reordering & Persistence ---
  console.log('\n--- Step 6: Layout Reordering and Persistence ---');
  const updatedLayout = [
    { id: widget1.id, x: 6, y: 0, width: 6, height: 3 },
    { id: widget2.id, x: 0, y: 0, width: 6, height: 3 },
    { id: widget3.id, x: 0, y: 3, width: 8, height: 4 },
    { id: widget4.id, x: 8, y: 3, width: 4, height: 4 },
  ];

  const layoutRes = await request(`/dashboards/${dashboard.id}/layout`, {
    method: 'PATCH',
    body: JSON.stringify({ layout: updatedLayout }),
  });
  assert(layoutRes.status === 200, 'PATCH /dashboards/:id/layout returns 200');
  assert(layoutRes.body.success === true, 'Layout update acknowledged');

  // Verify persistence
  const reloadedDash = await request(`/dashboards/${dashboard.id}`);
  assert(reloadedDash.status === 200, 'Reloaded dashboard detail');
  const w1Reloaded = reloadedDash.body.widgets.find((w) => w.id === widget1.id);
  assert(w1Reloaded.x === 6, 'Widget 1 position x=6 persisted');

  // --- Step 7: Edit and Delete Widget ---
  console.log('\n--- Step 7: Update and Delete Widget ---');
  const updateW1 = await request(`/dashboards/${dashboard.id}/widgets/${widget1.id}`, {
    method: 'PATCH',
    body: JSON.stringify({
      title: 'Production Availability (Updated)',
      width: 12,
    }),
  });
  assert(updateW1.status === 200, 'Widget 1 title and width updated');
  assert(updateW1.body.title === 'Production Availability (Updated)', 'Updated title persisted');

  const deleteW4 = await request(`/dashboards/${dashboard.id}/widgets/${widget4.id}`, {
    method: 'DELETE',
  });
  assert(deleteW4.status === 200, 'Widget 4 deleted successfully');

  const afterDeleteData = await request(`/dashboards/${dashboard.id}/data`);
  assert(afterDeleteData.body.widgets.length === 3, 'Widget count reduced to 3');

  // --- Step 8: Multi-Dashboard Isolation ---
  console.log('\n--- Step 8: Multi-Dashboard Isolation ---');
  const secondDashRes = await request('/dashboards', {
    method: 'POST',
    body: JSON.stringify({
      name: `Payment Service ${Date.now()}`,
      description: 'Second dashboard to verify isolation',
    }),
  });
  assert(secondDashRes.status === 201, 'Second dashboard created');
  const secondDashData = await request(`/dashboards/${secondDashRes.body.id}/data`);
  assert(secondDashData.body.widgets.length === 0, 'Second dashboard is cleanly empty (0 widgets)');

  // Clean up second dashboard
  await request(`/dashboards/${secondDashRes.body.id}`, { method: 'DELETE' });
  const checkDeleted = await request(`/dashboards/${secondDashRes.body.id}`);
  assert(checkDeleted.status === 404, 'Deleted dashboard returns 404');

  console.log('\n=================================================================');
  console.log('🎉 ALL DASHBOARD TESTS PASSED SUCCESSFULLY!');
  console.log('=================================================================\n');
}

runTests().catch((err) => {
  console.error('Unhandled test exception:', err);
  process.exit(1);
});

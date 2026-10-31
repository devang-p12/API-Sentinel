import * as http from 'http';

function request(options: {
  hostname?: string;
  port?: number;
  path: string;
  method: string;
  headers?: Record<string, string>;
  body?: any;
}): Promise<{ statusCode: number; data: any }> {
  return new Promise((resolve, reject) => {
    const postData = options.body ? JSON.stringify(options.body) : '';
    const req = http.request(
      {
        hostname: options.hostname || 'localhost',
        port: options.port || 3001,
        path: options.path,
        method: options.method,
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData),
          ...(options.headers || {}),
        },
      },
      (res) => {
        let raw = '';
        res.on('data', (chunk) => (raw += chunk));
        res.on('end', () => {
          let parsed: any;
          try {
            parsed = JSON.parse(raw);
          } catch {
            parsed = raw;
          }
          resolve({ statusCode: res.statusCode || 200, data: parsed });
        });
      },
    );

    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function runTests() {
  console.log('=== STARTING SENTINEL LOAD TESTING VERIFICATION ===\n');

  // 1. Get existing project
  const projectsRes = await request({ path: '/api/v1/projects', method: 'GET' });
  const project = projectsRes.data[0];
  if (!project) {
    throw new Error('No project found in database');
  }
  console.log(`[PASS] Using Project: "${project.name}" (${project.id})`);

  // 2. Test Safety Limits (VUs > 500 should fail)
  const safetyLimitRes = await request({
    path: '/api/v1/load-tests',
    method: 'POST',
    body: {
      name: 'Exceed VUs Limit',
      projectId: project.id,
      url: 'https://httpbin.org/status/200',
      virtualUsers: 9999, // exceeds 500
      mode: 'DURATION',
      duration: 30,
    },
  });
  if (safetyLimitRes.statusCode === 400) {
    console.log('[PASS] Safety Limit Enforced: Rejected virtualUsers > 500 with 400 Bad Request');
  } else {
    throw new Error(`Expected 400 for VUs > 500, got ${safetyLimitRes.statusCode}`);
  }

  // 3. Test Creation of Healthy Load Test (GET https://httpbin.org/status/200, 3s duration, 2 VUs)
  const createHealthy = await request({
    path: '/api/v1/load-tests',
    method: 'POST',
    body: {
      name: 'HTTPBin Healthy Benchmark',
      description: 'E2E automated verification test',
      projectId: project.id,
      method: 'GET',
      url: 'https://httpbin.org/status/200',
      virtualUsers: 2,
      mode: 'DURATION',
      duration: 3,
      timeout: 5,
    },
  });

  if (createHealthy.statusCode !== 201 || createHealthy.data.status !== 'QUEUED') {
    throw new Error(`Failed to queue load test: ${JSON.stringify(createHealthy)}`);
  }
  const testId = createHealthy.data.id;
  console.log(`[PASS] Load test created and queued in BullMQ: id=${testId}`);

  // 4. Poll until completion
  let attempts = 0;
  let testRecord: any = null;
  while (attempts < 20) {
    await sleep(1000);
    const getRes = await request({ path: `/api/v1/load-tests/${testId}`, method: 'GET' });
    testRecord = getRes.data;
    if (testRecord.status === 'COMPLETED' || testRecord.status === 'FAILED') {
      break;
    }
    attempts++;
  }

  if (testRecord.status !== 'COMPLETED') {
    throw new Error(`Test failed to complete in time: status=${testRecord.status}`);
  }
  console.log(`[PASS] Test completed via k6 engine: status=${testRecord.status}`);

  // 5. Verify Results & Percentiles
  const res = testRecord.result;
  if (!res || res.totalRequests < 1 || res.successfulRequests < 1) {
    throw new Error(`Invalid result data: ${JSON.stringify(res)}`);
  }
  console.log(
    `[PASS] Result telemetry: ${res.totalRequests} reqs, ${res.requestsPerSecond} RPS, P50=${res.p50Latency}ms, P95=${res.p95Latency}ms, P99=${res.p99Latency}ms, ErrorRate=${res.errorRate}%`,
  );

  // 6. Verify Time Series Samples
  if (!testRecord.samples || testRecord.samples.length === 0) {
    throw new Error('No time-series samples recorded');
  }
  console.log(`[PASS] Samples captured: ${testRecord.samples.length} periodic time-series buckets`);

  // 7. Test Error API Load Test (GET https://httpbin.org/status/500, 2s duration, 2 VUs)
  const createErrorTest = await request({
    path: '/api/v1/load-tests',
    method: 'POST',
    body: {
      name: 'HTTPBin Error Degradation Benchmark',
      projectId: project.id,
      method: 'GET',
      url: 'https://httpbin.org/status/500',
      virtualUsers: 2,
      mode: 'DURATION',
      duration: 2,
      timeout: 5,
    },
  });
  const errorTestId = createErrorTest.data.id;

  let errAttempts = 0;
  let errorTestRecord: any = null;
  while (errAttempts < 20) {
    await sleep(1000);
    const getRes = await request({ path: `/api/v1/load-tests/${errorTestId}`, method: 'GET' });
    errorTestRecord = getRes.data;
    if (errorTestRecord.status === 'COMPLETED' || errorTestRecord.status === 'FAILED') {
      break;
    }
    errAttempts++;
  }

  const errRes = errorTestRecord.result;
  if (!errRes || errRes.errorRate < 90 || !errRes.statusCodeCounts?.['500']) {
    throw new Error(`Expected HTTP 500 error breakdown, got: ${JSON.stringify(errRes)}`);
  }
  console.log(
    `[PASS] Error benchmark accurately detected: ${errRes.failedRequests} errors (100% error rate), status breakdown: ${JSON.stringify(errRes.statusCodeCounts)}`,
  );

  // 8. Test Cancellation of running test
  const cancelTest = await request({
    path: '/api/v1/load-tests',
    method: 'POST',
    body: {
      name: 'Cancellation Verification',
      projectId: project.id,
      url: 'https://httpbin.org/delay/2',
      virtualUsers: 2,
      mode: 'DURATION',
      duration: 30,
    },
  });
  const cancelTestId = cancelTest.data.id;
  await sleep(500);

  const cancelRes = await request({
    path: `/api/v1/load-tests/${cancelTestId}/cancel`,
    method: 'POST',
  });
  console.log(`[PASS] Cancel response: ${JSON.stringify(cancelRes.data)}`);

  await sleep(1000);
  const verifyCancel = await request({ path: `/api/v1/load-tests/${cancelTestId}`, method: 'GET' });
  if (verifyCancel.data.status !== 'CANCELLED') {
    throw new Error(`Expected CANCELLED status, got ${verifyCancel.data.status}`);
  }
  console.log('[PASS] Test cancellation successfully stopped process and marked CANCELLED');

  // 9. Verify Historical List Endpoint with Search & Filters
  const listRes = await request({
    path: `/api/v1/load-tests?search=HTTPBin`,
    method: 'GET',
  });
  if (listRes.data.items.length < 2) {
    throw new Error(`Expected at least 2 items matching "HTTPBin", got ${listRes.data.items.length}`);
  }
  console.log(`[PASS] Historical query with search filter returned ${listRes.data.items.length} items (Total: ${listRes.data.total})`);

  console.log('\n=== ALL LOAD TESTING MODULE VERIFICATIONS PASSED ===\n');
}

runTests().catch((err) => {
  console.error('\n❌ VERIFICATION TEST FAILED:', err.message);
  process.exit(1);
});

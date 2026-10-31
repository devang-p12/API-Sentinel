import { HttpMethod } from '@prisma/client';

async function runApiTesterModuleTest() {
  const baseUrl = 'http://localhost:3001/api/v1';
  console.log('[TEST] Starting API Tester Module Automated Verification...');

  // 1. Fetch available project
  const projsRes = await fetch(`${baseUrl}/projects`);
  const projs = await projsRes.json();
  if (!projs || projs.length === 0) {
    throw new Error('No project found in database to test with');
  }
  const testProject = projs[0];
  console.log(`[TEST] Using project: "${testProject.name}" (ID: ${testProject.id})`);

  // 2. Test execution of GET request to httpbin.org
  console.log('[TEST] Testing GET execution...');
  const getExecRes = await fetch(`${baseUrl}/api-tester/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      method: HttpMethod.GET,
      url: 'https://httpbin.org/get',
      queryParams: { tag: 'sentinel', page: 1 },
      headers: { 'X-Custom-Sentinel': 'VerifyHeader' },
      tests: [
        { type: 'status_code_equals', expected: 200 },
        { type: 'response_time_less_than', expected: 5000 },
        { type: 'json_property_exists', target: 'headers.X-Custom-Sentinel' },
      ],
      projectId: testProject.id,
    }),
  });

  const getResult = await getExecRes.json();
  console.log('[TEST] GET Response status:', getResult.status);
  console.log('[TEST] Duration:', getResult.durationMs, 'ms');
  console.log('[TEST] Test Results:', getResult.testsSummary);

  if (getResult.status !== 200) {
    throw new Error(`Expected status 200 but got ${getResult.status}`);
  }
  if (!getResult.testsSummary || getResult.testsSummary.failed > 0) {
    throw new Error(`Assertions failed: ${JSON.stringify(getResult.testResults)}`);
  }

  // 3. Test execution of POST with JSON body and variable resolution
  console.log('[TEST] Testing POST execution with variables...');
  const postExecRes = await fetch(`${baseUrl}/api-tester/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      method: HttpMethod.POST,
      url: '{{baseUrl}}/post',
      variables: {
        baseUrl: 'https://httpbin.org',
        userName: 'SentinelTester',
      },
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '{{userName}}', role: 'admin' }),
      auth: {
        type: 'bearer',
        token: 'test-secret-token-12345',
      },
      tests: [
        { type: 'status_code_equals', expected: 200 },
        { type: 'json_property_equals', target: 'json.name', expected: 'SentinelTester' },
      ],
      projectId: testProject.id,
    }),
  });

  const postResult = await postExecRes.json();
  console.log('[TEST] POST Response status:', postResult.status);
  console.log('[TEST] Test Results:', postResult.testsSummary);

  if (postResult.status !== 200) {
    throw new Error(`Expected POST 200 but got ${postResult.status}`);
  }
  if (postResult.testsSummary.failed > 0) {
    throw new Error(`POST assertions failed: ${JSON.stringify(postResult.testResults)}`);
  }

  // 4. Test SSRF Protection against cloud metadata IP
  console.log('[TEST] Testing SSRF Protection against cloud metadata...');
  const ssrfRes = await fetch(`${baseUrl}/api-tester/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      method: HttpMethod.GET,
      url: 'http://169.254.169.254/latest/meta-data',
    }),
  });
  const ssrfResult = await ssrfRes.json();
  console.log('[TEST] SSRF rejection result error:', ssrfResult.error);
  if (!ssrfResult.error || !ssrfResult.error.includes('cloud metadata')) {
    throw new Error(`Expected SSRF error on 169.254.169.254 but got: ${JSON.stringify(ssrfResult)}`);
  }
  console.log('✓ SSRF Protection correctly blocked metadata endpoint');

  // 5. Test Collections and Saved Requests CRUD
  console.log('[TEST] Testing Collections and Saved Requests CRUD...');
  const colRes = await fetch(`${baseUrl}/api-tester/collections`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      projectId: testProject.id,
      name: 'Verification Collection',
      description: 'Created during test run',
    }),
  });
  const createdCol = await colRes.json();
  console.log('✓ Collection created:', createdCol.id, createdCol.name);

  // Save request in this collection
  const saveReqRes = await fetch(`${baseUrl}/api-tester/requests`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      projectId: testProject.id,
      collectionId: createdCol.id,
      name: 'Get Current User',
      method: HttpMethod.GET,
      url: 'https://httpbin.org/get',
      queryParams: { id: '99' },
      headers: { Accept: 'application/json' },
    }),
  });
  const savedReq = await saveReqRes.json();
  console.log('✓ Saved Request created:', savedReq.id, savedReq.name);

  // List collections
  const listColRes = await fetch(`${baseUrl}/api-tester/collections?projectId=${testProject.id}`);
  const collections = await listColRes.json();
  const foundCol = collections.find((c: any) => c.id === createdCol.id);
  if (!foundCol || !foundCol.requests || foundCol.requests.length === 0) {
    throw new Error('Failed to find created collection or its saved requests in list');
  }
  console.log('✓ Collections list returned nested requests successfully');

  // 6. Test History
  console.log('[TEST] Testing History retrieval...');
  const histRes = await fetch(`${baseUrl}/api-tester/history?projectId=${testProject.id}&limit=10`);
  const history = await histRes.json();
  console.log(`✓ History returned ${history.length} items`);
  if (history.length === 0) {
    throw new Error('Expected at least 1 history item from earlier executions');
  }

  // Clean up test collection
  await fetch(`${baseUrl}/api-tester/collections/${createdCol.id}`, { method: 'DELETE' });
  console.log('✓ Cleaned up test collection');

  console.log('====================================================');
  console.log('🎉 ALL BACKEND API TESTER TESTS PASSED SUCCESSFULLY!');
  console.log('====================================================');
}

runApiTesterModuleTest().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});

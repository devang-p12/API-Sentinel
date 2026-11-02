/**
 * Phase 2 SaaS API and Environment Model Test Suite
 *
 * Verifies:
 * 1. API CRUD (Create without project, slugified service, custom service, get, update, delete)
 * 2. Nested and standalone Environment CRUD
 * 3. Environment Types (DEVELOPMENT, UAT, STAGING, PRODUCTION, CUSTOM)
 * 4. URL Validation (accepts http/https, rejects ftp/malformed, strips trailing slashes)
 * 5. URL Masking/Sanitization (protects internal hostnames, masks credentials)
 * 6. Cross-Tenant Isolation (Tenant B cannot read, update, or create environments on Tenant A's APIs -> 404)
 * 7. API Tester Functionality Preservation (environment baseUrl integration)
 */

const BASE_URL = 'http://localhost:3001/api/v1';

interface TestResult {
  suite: string;
  name: string;
  passed: boolean;
  error?: string;
}

const results: TestResult[] = [];

function recordTest(suite: string, name: string, passed: boolean, error?: string) {
  results.push({ suite, name, passed, error });
  const status = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`${status} [${suite}] ${name}`);
  if (error && !passed) {
    console.error(`       Error: ${error}`);
  }
}

async function apiRequest(
  path: string,
  options: {
    method?: string;
    token?: string;
    headers?: Record<string, string>;
    body?: any;
  } = {},
) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  if (options.token) {
    headers['Authorization'] = `Bearer ${options.token}`;
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  let data: any;
  const text = await res.text();
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }

  return { status: res.status, data };
}

async function runTests() {
  console.log('\n======================================================');
  console.log('🚀 RUNNING PHASE 2 APIS & ENVIRONMENTS TEST SUITE');
  console.log('======================================================\n');

  const ts = Date.now();
  let tenantAToken = '';
  let tenantAOrgId = '';
  let tenantBToken = '';
  let tenantBOrgId = '';

  // --------------------------------------------------------------------------
  // Setup Tenants A and B
  // --------------------------------------------------------------------------
  const regA = await apiRequest('/auth/register', {
    method: 'POST',
    body: {
      email: `phase2-owner-a-${ts}@sentinel.local`,
      password: 'Password123!',
      firstName: 'Owner',
      lastName: 'TenantA',
      organizationName: `SaaS Org A ${ts}`,
    },
  });

  if (regA.status === 201 && regA.data.accessToken) {
    tenantAToken = regA.data.accessToken;
    tenantAOrgId = regA.data.user.organizationId;
    recordTest('Setup', 'Register Tenant A Owner and Org', true);
  } else {
    recordTest('Setup', 'Register Tenant A Owner and Org', false, JSON.stringify(regA.data));
    return;
  }

  const regB = await apiRequest('/auth/register', {
    method: 'POST',
    body: {
      email: `phase2-owner-b-${ts}@sentinel.local`,
      password: 'Password123!',
      firstName: 'Owner',
      lastName: 'TenantB',
      organizationName: `SaaS Org B ${ts}`,
    },
  });

  if (regB.status === 201 && regB.data.accessToken) {
    tenantBToken = regB.data.accessToken;
    tenantBOrgId = regB.data.user.organizationId;
    recordTest('Setup', 'Register Tenant B Owner and Org', true);
  } else {
    recordTest('Setup', 'Register Tenant B Owner and Org', false, JSON.stringify(regB.data));
    return;
  }

  // --------------------------------------------------------------------------
  // Suite 1: API Registration & Model Refactoring
  // --------------------------------------------------------------------------
  let apiA1Id = '';
  let apiA2Id = '';

  // 1.1 Create pure SaaS API without projectId
  const createA1 = await apiRequest('/apis', {
    method: 'POST',
    token: tenantAToken,
    body: {
      name: 'Payment Processing Service',
      description: 'Handles credit card and ACH transactions',
      service: 'payment-svc',
    },
  });

  if (
    createA1.status === 201 &&
    createA1.data.id &&
    createA1.data.service === 'payment-svc' &&
    createA1.data.organizationId === tenantAOrgId &&
    createA1.data.projectId === null
  ) {
    apiA1Id = createA1.data.id;
    recordTest(
      'API Model',
      'Create pure SaaS API with service tag and organization_id',
      true,
    );
  } else {
    recordTest(
      'API Model',
      'Create pure SaaS API with service tag and organization_id',
      false,
      JSON.stringify(createA1.data),
    );
  }

  // 1.2 Create API with auto-generated service slug
  const createA2 = await apiRequest('/apis', {
    method: 'POST',
    token: tenantAToken,
    body: {
      name: 'User Identity & Auth Engine',
      description: 'OAuth2 and session management',
    },
  });

  if (
    createA2.status === 201 &&
    createA2.data.id &&
    createA2.data.service === 'user-identity-auth-engine'
  ) {
    apiA2Id = createA2.data.id;
    recordTest(
      'API Model',
      'Auto-generate service slug when not explicitly provided',
      true,
    );
  } else {
    recordTest(
      'API Model',
      'Auto-generate service slug when not explicitly provided',
      false,
      JSON.stringify(createA2.data),
    );
  }

  // 1.3 Validation: Reject empty name
  const emptyName = await apiRequest('/apis', {
    method: 'POST',
    token: tenantAToken,
    body: {
      name: '   ',
      service: 'empty-service',
    },
  });
  recordTest(
    'API Validation',
    'Reject API with blank name (400)',
    emptyName.status === 400,
    JSON.stringify(emptyName.data),
  );

  // 1.4 Create API with nested environments
  const createWithEnvs = await apiRequest('/apis', {
    method: 'POST',
    token: tenantAToken,
    body: {
      name: 'Order Fulfillment API',
      service: 'order-svc',
      environments: [
        {
          name: 'Development',
          baseUrl: 'https://dev-orders.internal.example.com/',
          type: 'DEVELOPMENT',
        },
        {
          name: 'Staging',
          baseUrl: 'https://stg-orders.internal.example.com',
          type: 'STAGING',
        },
      ],
    },
  });

  const hasNestedEnvs =
    createWithEnvs.status === 201 &&
    Array.isArray(createWithEnvs.data.environments) &&
    createWithEnvs.data.environments.length === 2 &&
    createWithEnvs.data.environments.some((e: any) => e.type === 'DEVELOPMENT') &&
    createWithEnvs.data.environments.some((e: any) => e.type === 'STAGING');

  recordTest(
    'API Model',
    'Create API with initial nested environments',
    hasNestedEnvs,
    JSON.stringify(createWithEnvs.data),
  );

  // --------------------------------------------------------------------------
  // Suite 2: API CRUD Endpoints
  // --------------------------------------------------------------------------

  // 2.1 List APIs
  const listApis = await apiRequest('/apis', {
    method: 'GET',
    token: tenantAToken,
  });

  const listPass =
    listApis.status === 200 &&
    Array.isArray(listApis.data) &&
    listApis.data.length >= 3 &&
    listApis.data.every((a: any) => a.organizationId === tenantAOrgId);

  recordTest('API CRUD', 'List APIs scoped to tenant organization', listPass);

  // 2.2 Search & filter APIs
  const searchApis = await apiRequest('/apis?search=Payment', {
    method: 'GET',
    token: tenantAToken,
  });

  const searchPass =
    searchApis.status === 200 &&
    searchApis.data.some((a: any) => a.id === apiA1Id) &&
    !searchApis.data.some((a: any) => a.id === apiA2Id);

  recordTest('API CRUD', 'Filter APIs by search query', searchPass);

  // 2.3 Get API details
  const getDetail = await apiRequest(`/apis/${apiA1Id}`, {
    method: 'GET',
    token: tenantAToken,
  });

  const detailPass =
    getDetail.status === 200 &&
    getDetail.data.id === apiA1Id &&
    getDetail.data.service === 'payment-svc';

  recordTest('API CRUD', 'Get API details with environment breakdown', detailPass);

  // 2.4 Update API
  const updateApi = await apiRequest(`/apis/${apiA1Id}`, {
    method: 'PATCH',
    token: tenantAToken,
    body: {
      name: 'Global Payment Processing Gateway',
      service: 'global-payment-gateway',
    },
  });

  const updatePass =
    updateApi.status === 200 &&
    updateApi.data.name === 'Global Payment Processing Gateway' &&
    updateApi.data.service === 'global-payment-gateway';

  recordTest('API CRUD', 'Update API name and service tag', updatePass);

  // --------------------------------------------------------------------------
  // Suite 3: Environment Management & Types
  // --------------------------------------------------------------------------
  let devEnvId = '';
  let prodEnvId = '';

  // 3.1 Register DEVELOPMENT environment
  const createDevEnv = await apiRequest(`/apis/${apiA1Id}/environments`, {
    method: 'POST',
    token: tenantAToken,
    body: {
      name: 'Development Sandbox',
      baseUrl: 'http://localhost:4000/',
      type: 'DEVELOPMENT',
      variables: { apiKey: 'dev-secret-123' },
    },
  });

  if (
    createDevEnv.status === 201 &&
    createDevEnv.data.id &&
    createDevEnv.data.type === 'DEVELOPMENT' &&
    createDevEnv.data.baseUrl === 'http://localhost:4000' // normalized trailing slash
  ) {
    devEnvId = createDevEnv.data.id;
    recordTest(
      'Environments',
      'Create DEVELOPMENT environment with normalized trailing slash',
      true,
    );
  } else {
    recordTest(
      'Environments',
      'Create DEVELOPMENT environment with normalized trailing slash',
      false,
      JSON.stringify(createDevEnv.data),
    );
  }

  // 3.2 Register all other types: UAT, STAGING, PRODUCTION, CUSTOM
  const typesToTest = ['UAT', 'STAGING', 'PRODUCTION', 'CUSTOM'] as const;
  for (const envType of typesToTest) {
    const res = await apiRequest('/environments', {
      method: 'POST',
      token: tenantAToken,
      body: {
        apiId: apiA1Id,
        name: `${envType} Cluster`,
        baseUrl: `https://${envType.toLowerCase()}.internal-api.example.com`,
        type: envType,
      },
    });

    if (res.status === 201 && res.data.type === envType) {
      if (envType === 'PRODUCTION') prodEnvId = res.data.id;
      recordTest('Environments', `Create environment of type ${envType}`, true);
    } else {
      recordTest(
        'Environments',
        `Create environment of type ${envType}`,
        false,
        JSON.stringify(res.data),
      );
    }
  }

  // 3.3 Reject invalid environment type
  const badType = await apiRequest('/environments', {
    method: 'POST',
    token: tenantAToken,
    body: {
      apiId: apiA1Id,
      name: 'Invalid Type Env',
      baseUrl: 'https://example.com',
      type: 'SUPER_DEV',
    },
  });

  recordTest(
    'Environments',
    'Reject invalid environment type enum (400)',
    badType.status === 400,
    JSON.stringify(badType.data),
  );

  // 3.4 Reject duplicate environment name for same API
  const duplicateEnv = await apiRequest('/environments', {
    method: 'POST',
    token: tenantAToken,
    body: {
      apiId: apiA1Id,
      name: 'Development Sandbox',
      baseUrl: 'http://localhost:4001',
      type: 'DEVELOPMENT',
    },
  });

  recordTest(
    'Environments',
    'Reject duplicate environment name within same API (409)',
    duplicateEnv.status === 409,
    JSON.stringify(duplicateEnv.data),
  );

  // 3.5 Update Environment
  const updateEnv = await apiRequest(`/environments/${devEnvId}`, {
    method: 'PATCH',
    token: tenantAToken,
    body: {
      baseUrl: 'https://dev-cluster.service.internal:8443/',
      type: 'CUSTOM',
    },
  });

  const updateEnvPass =
    updateEnv.status === 200 &&
    updateEnv.data.type === 'CUSTOM' &&
    updateEnv.data.baseUrl === 'https://dev-cluster.service.internal:8443';

  recordTest('Environments', 'Update environment baseUrl and type', updateEnvPass);

  // --------------------------------------------------------------------------
  // Suite 4: URL Validation and Masking (Req 3 & 4)
  // --------------------------------------------------------------------------

  // 4.1 Reject non-http/https protocol (e.g. ftp://)
  const ftpUrl = await apiRequest('/environments', {
    method: 'POST',
    token: tenantAToken,
    body: {
      apiId: apiA1Id,
      name: 'FTP Service',
      baseUrl: 'ftp://files.example.com',
      type: 'CUSTOM',
    },
  });

  recordTest(
    'URL Validation',
    'Reject non-HTTP/HTTPS protocol (ftp://) (400)',
    ftpUrl.status === 400,
    JSON.stringify(ftpUrl.data),
  );

  // 4.2 Reject malformed URL string
  const malformedUrl = await apiRequest('/environments', {
    method: 'POST',
    token: tenantAToken,
    body: {
      apiId: apiA1Id,
      name: 'Bad URL Env',
      baseUrl: 'not-a-valid-domain',
      type: 'CUSTOM',
    },
  });

  recordTest(
    'URL Validation',
    'Reject malformed URL string (400)',
    malformedUrl.status === 400,
    JSON.stringify(malformedUrl.data),
  );

  // 4.3 Verify URL masking on environment list & details
  const getEnvList = await apiRequest(`/apis/${apiA1Id}/environments`, {
    method: 'GET',
    token: tenantAToken,
  });

  const envs = getEnvList.data;
  const hasMaskedUrls =
    Array.isArray(envs) &&
    envs.some(
      (e: any) =>
        e.maskedBaseUrl &&
        e.maskedBaseUrl.includes('***') &&
        e.maskedBaseUrl.startsWith('https://'),
    );

  recordTest(
    'URL Security',
    'Environment listings provide maskedBaseUrl protecting internal hosts',
    hasMaskedUrls,
  );

  // --------------------------------------------------------------------------
  // Suite 5: Cross-Organization Security (Req 1 & 5)
  // --------------------------------------------------------------------------

  // 5.1 Tenant B cannot get Tenant A's API
  const crossGetApi = await apiRequest(`/apis/${apiA1Id}`, {
    method: 'GET',
    token: tenantBToken,
  });
  recordTest(
    'Cross-Tenant Isolation',
    "Tenant B cannot view Tenant A's API (404)",
    crossGetApi.status === 404,
  );

  // 5.2 Tenant B cannot update Tenant A's API
  const crossUpdateApi = await apiRequest(`/apis/${apiA1Id}`, {
    method: 'PATCH',
    token: tenantBToken,
    body: { name: 'Hacked by Tenant B' },
  });
  recordTest(
    'Cross-Tenant Isolation',
    "Tenant B cannot update Tenant A's API (404)",
    crossUpdateApi.status === 404,
  );

  // 5.3 Tenant B cannot delete Tenant A's API
  const crossDeleteApi = await apiRequest(`/apis/${apiA1Id}`, {
    method: 'DELETE',
    token: tenantBToken,
  });
  recordTest(
    'Cross-Tenant Isolation',
    "Tenant B cannot delete Tenant A's API (404)",
    crossDeleteApi.status === 404,
  );

  // 5.4 Tenant B cannot add environment to Tenant A's API
  const crossCreateEnv = await apiRequest(`/apis/${apiA1Id}/environments`, {
    method: 'POST',
    token: tenantBToken,
    body: {
      name: 'Tenant B Injection',
      baseUrl: 'https://evil.com',
      type: 'CUSTOM',
    },
  });
  recordTest(
    'Cross-Tenant Isolation',
    "Tenant B cannot create environment under Tenant A's API (404)",
    crossCreateEnv.status === 404,
  );

  // 5.5 Tenant B cannot read or mutate Tenant A's environment
  const crossGetEnv = await apiRequest(`/environments/${devEnvId}`, {
    method: 'GET',
    token: tenantBToken,
  });
  recordTest(
    'Cross-Tenant Isolation',
    "Tenant B cannot view Tenant A's Environment (404)",
    crossGetEnv.status === 404,
  );

  const crossPatchEnv = await apiRequest(`/environments/${devEnvId}`, {
    method: 'PATCH',
    token: tenantBToken,
    body: { baseUrl: 'https://attacker.com' },
  });
  recordTest(
    'Cross-Tenant Isolation',
    "Tenant B cannot update Tenant A's Environment (404)",
    crossPatchEnv.status === 404,
  );

  // --------------------------------------------------------------------------
  // Suite 6: API Tester Functionality Preservation (Req 7)
  // --------------------------------------------------------------------------
  const apiTesterExec = await apiRequest('/api-tester/execute', {
    method: 'POST',
    token: tenantAToken,
    body: {
      method: 'GET',
      url: 'https://httpbin.org/get',
      headers: { 'X-Custom-Header': 'SentinelTest' },
      environmentId: devEnvId,
    },
  });

  const apiTesterPass =
    apiTesterExec.status === 200 &&
    apiTesterExec.data.status !== undefined &&
    apiTesterExec.data.durationMs !== undefined;

  recordTest(
    'API Tester',
    'Execute test request via API Tester preserving full functionality',
    apiTesterPass,
    JSON.stringify(apiTesterExec.data),
  );

  // --------------------------------------------------------------------------
  // Suite 7: Deletion Cleanup
  // --------------------------------------------------------------------------
  const deleteDevEnv = await apiRequest(`/environments/${devEnvId}`, {
    method: 'DELETE',
    token: tenantAToken,
  });
  recordTest(
    'Cleanup',
    'Delete environment successfully',
    deleteDevEnv.status === 200,
  );

  const deleteApiA = await apiRequest(`/apis/${apiA1Id}`, {
    method: 'DELETE',
    token: tenantAToken,
  });
  recordTest('Cleanup', 'Delete API successfully', deleteApiA.status === 200);

  // Verify deleted API is gone
  const getDeleted = await apiRequest(`/apis/${apiA1Id}`, {
    method: 'GET',
    token: tenantAToken,
  });
  recordTest(
    'Cleanup',
    'Deleted API returns 404 on subsequent lookups',
    getDeleted.status === 404,
  );

  // --------------------------------------------------------------------------
  // Summary
  // --------------------------------------------------------------------------
  console.log('\n======================================================');
  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  const failed = total - passed;
  console.log(`Phase 2 Results: ${passed}/${total} passed (${failed} failed)`);
  console.log('======================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});

/**
 * Phase 1 Multi-Tenant Organization Architecture Test Suite
 *
 * Verifies:
 * 1. Authentication (401 on missing/bad tokens, login, register, duplicate email prevention)
 * 2. Organization & Membership (org details, listing members, adding member, updating role, removing member)
 * 3. Role Authorization / RBAC (VIEWER blocked with 403 on mutations, MEMBER allowed creation, ADMIN allowed deletion)
 * 4. Cross-Tenant Access Prevention (404 on foreign tenant resources, spoofed organizationId ignored, tenant data isolation)
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
  if (error) {
    console.error(`       Error: ${error}`);
  }
}

async function apiRequest(path: string, options: {
  method?: string;
  token?: string;
  headers?: Record<string, string>;
  body?: any;
} = {}) {
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
  console.log('🚀 RUNNING PHASE 1 MULTI-TENANT TEST SUITE');
  console.log('======================================================\n');

  const timestamp = Date.now();
  let tenantAToken = '';
  let tenantAOrgId = '';
  let tenantBToken = '';
  let tenantBOrgId = '';
  let viewerToken = '';
  let memberToken = '';
  let projectAId = '';
  let monitorAId = '';
  let createdMemberUserId = '';

  // ==============================================================
  // 1. AUTHENTICATION TESTS
  // ==============================================================
  const authSuite = 'Authentication & Error Handling';

  try {
    // 1.1 Unauthenticated request returns 401
    const unauthRes = await apiRequest('/projects');
    recordTest(
      authSuite,
      'Missing token returns 401 Unauthorized',
      unauthRes.status === 401,
      unauthRes.status !== 401 ? `Expected 401, got ${unauthRes.status}` : undefined,
    );

    // 1.2 Invalid Bearer token returns 401
    const invalidTokenRes = await apiRequest('/projects', { token: 'invalid-garbage-jwt-token' });
    recordTest(
      authSuite,
      'Invalid Bearer token returns 401 Unauthorized',
      invalidTokenRes.status === 401,
      invalidTokenRes.status !== 401 ? `Expected 401, got ${invalidTokenRes.status}` : undefined,
    );

    // 1.3 Login with existing default admin returns 200 with active organization & role
    const adminLoginRes = await apiRequest('/auth/login', {
      method: 'POST',
      body: { email: 'admin@sentinel.local', password: 'sentinel123' },
    });
    const adminLoginSuccess =
      adminLoginRes.status === 200 &&
      !!adminLoginRes.data.accessToken &&
      adminLoginRes.data.user.role === 'OWNER' &&
      !!adminLoginRes.data.user.organizationId;
    recordTest(
      authSuite,
      'Default admin login succeeds with active organization and OWNER role',
      adminLoginSuccess,
      !adminLoginSuccess ? `Status: ${adminLoginRes.status}, Body: ${JSON.stringify(adminLoginRes.data)}` : undefined,
    );

    // 1.4 Login with invalid password returns 401
    const badLoginRes = await apiRequest('/auth/login', {
      method: 'POST',
      body: { email: 'admin@sentinel.local', password: 'wrong-password-999' },
    });
    recordTest(
      authSuite,
      'Login with incorrect password returns 401 Unauthorized',
      badLoginRes.status === 401,
      badLoginRes.status !== 401 ? `Expected 401, got ${badLoginRes.status}` : undefined,
    );

    // 1.5 Register Tenant A user
    const tenantAEmail = `tenant-a-${timestamp}@test.local`;
    const regTenantARes = await apiRequest('/auth/register', {
      method: 'POST',
      body: {
        email: tenantAEmail,
        password: 'Password123!',
        firstName: 'Alice',
        lastName: 'Owner',
        organizationName: `Acme Corp ${timestamp}`,
      },
    });

    const tenantASuccess =
      regTenantARes.status === 201 &&
      !!regTenantARes.data.accessToken &&
      regTenantARes.data.user.role === 'OWNER' &&
      !!regTenantARes.data.user.organizationId;

    if (tenantASuccess) {
      tenantAToken = regTenantARes.data.accessToken;
      tenantAOrgId = regTenantARes.data.user.organizationId;
    }

    recordTest(
      authSuite,
      'Register new Tenant A creates Organization, User, and OWNER Membership',
      tenantASuccess,
      !tenantASuccess ? `Status: ${regTenantARes.status}, Body: ${JSON.stringify(regTenantARes.data)}` : undefined,
    );

    // 1.6 Duplicate email registration returns 409 Conflict
    const dupRegRes = await apiRequest('/auth/register', {
      method: 'POST',
      body: {
        email: tenantAEmail,
        password: 'Password123!',
        firstName: 'Duplicate',
        lastName: 'User',
      },
    });
    recordTest(
      authSuite,
      'Duplicate email registration returns 409 Conflict',
      dupRegRes.status === 409,
      dupRegRes.status !== 409 ? `Expected 409, got ${dupRegRes.status}` : undefined,
    );

    // 1.7 Register Tenant B user (separate organization)
    const tenantBEmail = `tenant-b-${timestamp}@test.local`;
    const regTenantBRes = await apiRequest('/auth/register', {
      method: 'POST',
      body: {
        email: tenantBEmail,
        password: 'Password123!',
        firstName: 'Bob',
        lastName: 'Owner',
        organizationName: `Beta Labs ${timestamp}`,
      },
    });

    const tenantBSuccess =
      regTenantBRes.status === 201 &&
      !!regTenantBRes.data.accessToken &&
      regTenantBRes.data.user.role === 'OWNER' &&
      !!regTenantBRes.data.user.organizationId;

    if (tenantBSuccess) {
      tenantBToken = regTenantBRes.data.accessToken;
      tenantBOrgId = regTenantBRes.data.user.organizationId;
    }

    recordTest(
      authSuite,
      'Register new Tenant B creates distinct Organization and OWNER Membership',
      tenantBSuccess && tenantAOrgId !== tenantBOrgId,
      !tenantBSuccess ? `Status: ${regTenantBRes.status}` : undefined,
    );
  } catch (err: any) {
    recordTest(authSuite, 'Auth suite encountered unexpected exception', false, err.message);
  }

  // ==============================================================
  // 2. ORGANIZATION & MEMBERSHIP MANAGEMENT TESTS
  // ==============================================================
  const orgSuite = 'Organization & Membership Management';

  try {
    // 2.1 Get current organization
    const orgRes = await apiRequest('/organizations/me', { token: tenantAToken });
    const orgOk = orgRes.status === 200 && orgRes.data.id === tenantAOrgId;
    recordTest(
      orgSuite,
      'GET /organizations/me returns authenticated user organization details',
      orgOk,
      !orgOk ? `Status: ${orgRes.status}, Data: ${JSON.stringify(orgRes.data)}` : undefined,
    );

    // 2.2 Get members list
    const membersRes = await apiRequest('/organizations/me/members', { token: tenantAToken });
    const membersOk =
      membersRes.status === 200 &&
      Array.isArray(membersRes.data) &&
      membersRes.data.some((m: any) => m.role === 'OWNER');
    recordTest(
      orgSuite,
      'GET /organizations/me/members lists organization members',
      membersOk,
      !membersOk ? `Status: ${membersRes.status}` : undefined,
    );

    // 2.3 Add member with VIEWER role
    const viewerEmail = `viewer-${timestamp}@test.local`;
    const addViewerRes = await apiRequest('/organizations/me/members', {
      method: 'POST',
      token: tenantAToken,
      body: {
        email: viewerEmail,
        role: 'VIEWER',
        firstName: 'Victor',
        lastName: 'Viewer',
      },
    });

    const addViewerOk =
      addViewerRes.status === 201 &&
      addViewerRes.data.role === 'VIEWER' &&
      addViewerRes.data.user.email === viewerEmail;

    if (addViewerOk) {
      createdMemberUserId = addViewerRes.data.userId;
    }

    recordTest(
      orgSuite,
      'POST /organizations/me/members adds new member with VIEWER role',
      addViewerOk,
      !addViewerOk ? `Status: ${addViewerRes.status}, Body: ${JSON.stringify(addViewerRes.data)}` : undefined,
    );

    // 2.4 Update member role from VIEWER to ADMIN
    const updateRoleRes = await apiRequest(`/organizations/me/members/${createdMemberUserId}`, {
      method: 'PATCH',
      token: tenantAToken,
      body: { role: 'ADMIN' },
    });
    const updateRoleOk = updateRoleRes.status === 200 && updateRoleRes.data.role === 'ADMIN';
    recordTest(
      orgSuite,
      'PATCH /organizations/me/members/:id updates member role to ADMIN',
      updateRoleOk,
      !updateRoleOk ? `Status: ${updateRoleRes.status}, Body: ${JSON.stringify(updateRoleRes.data)}` : undefined,
    );

    // 2.5 Remove member
    const removeRes = await apiRequest(`/organizations/me/members/${createdMemberUserId}`, {
      method: 'DELETE',
      token: tenantAToken,
    });
    const removeOk = removeRes.status === 200 && removeRes.data.success === true;
    recordTest(
      orgSuite,
      'DELETE /organizations/me/members/:id removes member from organization',
      removeOk,
      !removeOk ? `Status: ${removeRes.status}` : undefined,
    );
  } catch (err: any) {
    recordTest(orgSuite, 'Org suite encountered unexpected exception', false, err.message);
  }

  // ==============================================================
  // 3. ROLE AUTHORIZATION (RBAC) TESTS
  // ==============================================================
  const rbacSuite = 'Role Authorization (RBAC)';

  try {
    // Set up dedicated test users for roles
    // 3.1 Register a VIEWER user
    const viewerEmail = `rbac-viewer-${timestamp}@test.local`;
    const addViewerRes = await apiRequest('/organizations/me/members', {
      method: 'POST',
      token: tenantAToken,
      body: {
        email: viewerEmail,
        role: 'VIEWER',
        firstName: 'Valerie',
        lastName: 'Viewer',
      },
    });

    // We can login or generate a token for the viewer user using JwtService via login
    // Or set a known password for viewer
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    const bcrypt = require('bcryptjs');
    await prisma.user.update({
      where: { email: viewerEmail },
      data: { passwordHash: bcrypt.hashSync('ViewerPass123!', 10) },
    });

    const viewerLoginRes = await apiRequest('/auth/login', {
      method: 'POST',
      body: { email: viewerEmail, password: 'ViewerPass123!' },
    });
    viewerToken = viewerLoginRes.data.accessToken;

    // 3.2 Register a MEMBER user in Tenant A
    const memberEmail = `rbac-member-${timestamp}@test.local`;
    await apiRequest('/organizations/me/members', {
      method: 'POST',
      token: tenantAToken,
      body: {
        email: memberEmail,
        role: 'MEMBER',
        firstName: 'Mike',
        lastName: 'Member',
      },
    });
    await prisma.user.update({
      where: { email: memberEmail },
      data: { passwordHash: bcrypt.hashSync('MemberPass123!', 10) },
    });
    const memberLoginRes = await apiRequest('/auth/login', {
      method: 'POST',
      body: { email: memberEmail, password: 'MemberPass123!' },
    });
    memberToken = memberLoginRes.data.accessToken;

    await prisma.$disconnect();

    // 3.3 VIEWER can read projects (GET 200)
    const viewerReadRes = await apiRequest('/projects', { token: viewerToken });
    recordTest(
      rbacSuite,
      'VIEWER role can read projects (GET 200 OK)',
      viewerReadRes.status === 200,
      viewerReadRes.status !== 200 ? `Status: ${viewerReadRes.status}` : undefined,
    );

    // 3.4 VIEWER is blocked from creating project (POST 403 Forbidden)
    const viewerCreateProjectRes = await apiRequest('/projects', {
      method: 'POST',
      token: viewerToken,
      body: { name: `Viewer Forbidden Project ${timestamp}` },
    });
    recordTest(
      rbacSuite,
      'VIEWER role blocked from creating project (403 Forbidden)',
      viewerCreateProjectRes.status === 403,
      viewerCreateProjectRes.status !== 403 ? `Expected 403, got ${viewerCreateProjectRes.status}` : undefined,
    );

    // 3.5 VIEWER is blocked from creating monitor (POST 403 Forbidden)
    const viewerCreateMonitorRes = await apiRequest('/monitors', {
      method: 'POST',
      token: viewerToken,
      body: { name: 'Forbidden Monitor', environmentId: 'fake-id' },
    });
    recordTest(
      rbacSuite,
      'VIEWER role blocked from creating monitor (403 Forbidden)',
      viewerCreateMonitorRes.status === 403,
      viewerCreateMonitorRes.status !== 403 ? `Expected 403, got ${viewerCreateMonitorRes.status}` : undefined,
    );

    // 3.6 VIEWER is blocked from adding members (POST 403 Forbidden)
    const viewerAddMemberRes = await apiRequest('/organizations/me/members', {
      method: 'POST',
      token: viewerToken,
      body: { email: 'another@test.local', role: 'VIEWER' },
    });
    recordTest(
      rbacSuite,
      'VIEWER role blocked from inviting members (403 Forbidden)',
      viewerAddMemberRes.status === 403,
      viewerAddMemberRes.status !== 403 ? `Expected 403, got ${viewerAddMemberRes.status}` : undefined,
    );

    // 3.7 MEMBER role CAN create project (POST 201 Created)
    const memberCreateProjectRes = await apiRequest('/projects', {
      method: 'POST',
      token: memberToken,
      body: { name: `Member Project ${timestamp}` },
    });
    const memberProjectOk =
      memberCreateProjectRes.status === 201 && !!memberCreateProjectRes.data.id;
    const memberCreatedProjectId = memberCreateProjectRes.data?.id;
    recordTest(
      rbacSuite,
      'MEMBER role is allowed to create project (201 Created)',
      memberProjectOk,
      !memberProjectOk ? `Status: ${memberCreateProjectRes.status}` : undefined,
    );

    // 3.8 MEMBER role is BLOCKED from deleting project (DELETE 403 Forbidden)
    const memberDeleteProjectRes = await apiRequest(`/projects/${memberCreatedProjectId}`, {
      method: 'DELETE',
      token: memberToken,
    });
    recordTest(
      rbacSuite,
      'MEMBER role is blocked from deleting project (403 Forbidden)',
      memberDeleteProjectRes.status === 403,
      memberDeleteProjectRes.status !== 403 ? `Expected 403, got ${memberDeleteProjectRes.status}` : undefined,
    );

    // 3.9 MEMBER role is BLOCKED from adding members (POST 403 Forbidden)
    const memberAddMemberRes = await apiRequest('/organizations/me/members', {
      method: 'POST',
      token: memberToken,
      body: { email: 'member-attempt@test.local', role: 'MEMBER' },
    });
    recordTest(
      rbacSuite,
      'MEMBER role is blocked from inviting members (403 Forbidden)',
      memberAddMemberRes.status === 403,
      memberAddMemberRes.status !== 403 ? `Expected 403, got ${memberAddMemberRes.status}` : undefined,
    );

    // 3.10 OWNER CAN delete project (DELETE 200 OK)
    const ownerDeleteProjectRes = await apiRequest(`/projects/${memberCreatedProjectId}`, {
      method: 'DELETE',
      token: tenantAToken,
    });
    recordTest(
      rbacSuite,
      'OWNER role is allowed to delete project (200 OK)',
      ownerDeleteProjectRes.status === 200,
      ownerDeleteProjectRes.status !== 200 ? `Status: ${ownerDeleteProjectRes.status}` : undefined,
    );
  } catch (err: any) {
    recordTest(rbacSuite, 'RBAC suite encountered unexpected exception', false, err.message);
  }

  // ==============================================================
  // 4. CROSS-TENANT ISOLATION TESTS
  // ==============================================================
  const isolationSuite = 'Cross-Tenant Access Prevention';

  try {
    // 4.1 Tenant A creates a Project
    const createProjectARes = await apiRequest('/projects', {
      method: 'POST',
      token: tenantAToken,
      body: {
        name: `Tenant A Exclusive Project ${timestamp}`,
        description: 'Classified Tenant A project',
      },
    });
    projectAId = createProjectARes.data.id;
    recordTest(
      isolationSuite,
      'Tenant A creates organization-owned project',
      createProjectARes.status === 201 && !!projectAId,
      createProjectARes.status !== 201 ? `Status: ${createProjectARes.status}` : undefined,
    );

    // 4.2 Tenant A creates API, Environment, and Monitor
    const createApiARes = await apiRequest('/apis', {
      method: 'POST',
      token: tenantAToken,
      body: {
        name: `Tenant A Core API ${timestamp}`,
        projectId: projectAId,
      },
    });
    const apiAId = createApiARes.data.id;

    const createEnvARes = await apiRequest(`/apis/${apiAId}/environments`, {
      method: 'POST',
      token: tenantAToken,
      body: {
        name: 'production',
        baseUrl: 'https://api.sentinel.local',
      },
    });
    const envAId = createEnvARes.data.id;

    const createMonitorARes = await apiRequest('/monitors', {
      method: 'POST',
      token: tenantAToken,
      body: {
        name: 'Tenant A Primary Health Check',
        environmentId: envAId,
        url: '/health',
        intervalSeconds: 60,
      },
    });
    monitorAId = createMonitorARes.data.id;
    recordTest(
      isolationSuite,
      'Tenant A creates API, Environment, and Monitor successfully',
      !!monitorAId,
      !monitorAId ? `Failed to create hierarchy` : undefined,
    );

    // 4.3 Tenant B attempts to read Tenant A's Project by ID -> MUST return 404
    const tenantBReadProjectARes = await apiRequest(`/projects/${projectAId}`, {
      token: tenantBToken,
    });
    recordTest(
      isolationSuite,
      'Tenant B cannot view Tenant A project by ID (Returns 404 Not Found)',
      tenantBReadProjectARes.status === 404,
      tenantBReadProjectARes.status !== 404
        ? `Expected 404, got ${tenantBReadProjectARes.status}: ${JSON.stringify(tenantBReadProjectARes.data)}`
        : undefined,
    );

    // 4.4 Tenant B attempts to read Tenant A's Monitor by ID -> MUST return 404
    const tenantBReadMonitorARes = await apiRequest(`/monitors/${monitorAId}`, {
      token: tenantBToken,
    });
    recordTest(
      isolationSuite,
      'Tenant B cannot view Tenant A monitor by ID (Returns 404 Not Found)',
      tenantBReadMonitorARes.status === 404,
      tenantBReadMonitorARes.status !== 404
        ? `Expected 404, got ${tenantBReadMonitorARes.status}`
        : undefined,
    );

    // 4.5 Tenant B attempts to delete Tenant A's Project by ID -> MUST return 404
    const tenantBDeleteProjectARes = await apiRequest(`/projects/${projectAId}`, {
      method: 'DELETE',
      token: tenantBToken,
    });
    recordTest(
      isolationSuite,
      'Tenant B cannot delete Tenant A project (Returns 404 Not Found)',
      tenantBDeleteProjectARes.status === 404,
      tenantBDeleteProjectARes.status !== 404
        ? `Expected 404, got ${tenantBDeleteProjectARes.status}`
        : undefined,
    );

    // 4.6 Tenant B attempts to create an API targeting Tenant A's projectId -> MUST return 404
    const tenantBTargetingProjectARes = await apiRequest('/apis', {
      method: 'POST',
      token: tenantBToken,
      body: {
        name: 'Injected API',
        projectId: projectAId,
      },
    });
    recordTest(
      isolationSuite,
      'Tenant B cannot attach API to Tenant A project (Returns 404 Not Found)',
      tenantBTargetingProjectARes.status === 404,
      tenantBTargetingProjectARes.status !== 404
        ? `Expected 404, got ${tenantBTargetingProjectARes.status}`
        : undefined,
    );

    // 4.7 Backend NEVER trusts organization_id supplied by frontend:
    // Tenant B attempts to forge organizationId to Tenant A's orgId
    const forgedProjectRes = await apiRequest('/projects', {
      method: 'POST',
      token: tenantBToken,
      body: {
        name: `Tenant B Forged Project ${timestamp}`,
        organizationId: tenantAOrgId, // MALICIOUS SPOOF ATTEMPT
      },
    });

    const forgedProject = forgedProjectRes.data;
    const forgedProjectScopedToTenantB =
      forgedProjectRes.status === 201 &&
      forgedProject.organizationId === tenantBOrgId &&
      forgedProject.organizationId !== tenantAOrgId;

    recordTest(
      isolationSuite,
      'Backend ignores frontend organization_id and enforces authenticated membership orgId',
      forgedProjectScopedToTenantB,
      !forgedProjectScopedToTenantB
        ? `Project orgId was ${forgedProject?.organizationId}, expected ${tenantBOrgId}`
        : undefined,
    );

    // 4.8 Tenant B listing projects does not include Tenant A's projects
    const tenantBProjectsListRes = await apiRequest('/projects', { token: tenantBToken });
    const tenantBProjects = tenantBProjectsListRes.data;
    const hasTenantAProject = Array.isArray(tenantBProjects) && tenantBProjects.some((p: any) => p.id === projectAId);
    recordTest(
      isolationSuite,
      'Tenant B project list is strictly scoped and does not contain Tenant A projects',
      tenantBProjectsListRes.status === 200 && !hasTenantAProject,
      hasTenantAProject ? `Tenant A project ${projectAId} leaked into Tenant B listing` : undefined,
    );

    // 4.9 Tenant B listing monitors does not include Tenant A's monitors
    const tenantBMonitorsListRes = await apiRequest('/monitors', { token: tenantBToken });
    const tenantBMonitors = tenantBMonitorsListRes.data;
    const hasTenantAMonitor = Array.isArray(tenantBMonitors) && tenantBMonitors.some((m: any) => m.id === monitorAId);
    recordTest(
      isolationSuite,
      'Tenant B monitor list is strictly scoped and does not contain Tenant A monitors',
      tenantBMonitorsListRes.status === 200 && !hasTenantAMonitor,
      hasTenantAMonitor ? `Tenant A monitor ${monitorAId} leaked into Tenant B listing` : undefined,
    );

  } catch (err: any) {
    recordTest(isolationSuite, 'Isolation suite encountered unexpected exception', false, err.message);
  }

  // ==============================================================
  // 5. API TESTER & EXISTING FUNCTIONALITY PRESERVATION TESTS
  // ==============================================================
  const testerSuite = 'API Tester Functionality Preservation';

  try {
    // 5.1 Execute arbitrary API test request
    const execRes = await apiRequest('/api-tester/execute', {
      method: 'POST',
      token: tenantAToken,
      body: {
        method: 'GET',
        url: 'https://httpbin.org/get',
        timeout: 5000,
        tests: [
          { type: 'statusCode', operator: 'equals', value: 200 },
        ],
      },
    });

    const execOk = execRes.status === 200 && execRes.data.status === 200;
    recordTest(
      testerSuite,
      'API Tester executes HTTP request and returns execution results with assertions',
      execOk,
      !execOk ? `Status: ${execRes.status}, Data: ${JSON.stringify(execRes.data)}` : undefined,
    );

    // 5.2 API Tester saves collection scoped to organization
    const createColRes = await apiRequest('/api-tester/collections', {
      method: 'POST',
      token: tenantAToken,
      body: {
        projectId: projectAId,
        name: `Core Payments API Suite ${timestamp}`,
      },
    });
    const colOk = createColRes.status === 201 && createColRes.data.organizationId === tenantAOrgId;
    recordTest(
      testerSuite,
      'API Tester saves collection scoped to active organization',
      colOk,
      !colOk ? `Status: ${createColRes.status}, Body: ${JSON.stringify(createColRes.data)}` : undefined,
    );

    // 5.3 Tenant B cannot access Tenant A collection
    if (createColRes.data?.id) {
      const tenantBColRes = await apiRequest(`/api-tester/collections?projectId=${projectAId}`, {
        token: tenantBToken,
      });
      const leaked = Array.isArray(tenantBColRes.data) && tenantBColRes.data.length > 0;
      recordTest(
        testerSuite,
        'Tenant B cannot view Tenant A collections',
        !leaked,
        leaked ? `Collections leaked to foreign tenant` : undefined,
      );
    }
  } catch (err: any) {
    recordTest(testerSuite, 'API Tester suite encountered unexpected exception', false, err.message);
  }

  // ==============================================================
  // SUMMARY
  // ==============================================================
  console.log('\n======================================================');
  console.log('📊 TEST SUMMARY RESULTS');
  console.log('======================================================');

  const passedCount = results.filter((r) => r.passed).length;
  const failedCount = results.filter((r) => !r.passed).length;
  const totalCount = results.length;

  console.log(`Total Tests Run:  ${totalCount}`);
  console.log(`Passed:           ${passedCount}`);
  console.log(`Failed:           ${failedCount}`);

  if (failedCount > 0) {
    console.log('\n❌ FAILED TESTS:');
    results
      .filter((r) => !r.passed)
      .forEach((r, idx) => {
        console.log(`  ${idx + 1}. [${r.suite}] ${r.name}`);
        if (r.error) console.log(`     Details: ${r.error}`);
      });
    process.exit(1);
  } else {
    console.log('\n🎉 ALL TESTS PASSED SUCCESSFULLY! No regressions detected.');
    process.exit(0);
  }
}

runTests().catch((err) => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});

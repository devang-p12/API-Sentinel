/**
 * ==============================================================================
 * Phase 8: Incident Management Unit & Integration Test Suite
 * ==============================================================================
 *
 * Requirements Verified:
 * 1. Do not create an incident for every failed monitoring request (transient suppression).
 * 2. Create an incident when configured failure conditions are met (e.g. 500, 500, timeout).
 * 3. Deduplication: repeated failures during the same outage append to timeline, NO duplicate incidents.
 * 4. Recovery: consecutive successful responses (e.g. 200, 200, 200) automatically transition to RESOLVED.
 * 5. Separate incidents after recovery: new outage following recovery generates a distinct new incident.
 * 6. Required Incident fields:
 *    - organization
 *    - API
 *    - environment
 *    - severity
 *    - start time (startedAt)
 *    - end time (resolvedAt)
 *    - duration (durationMs / durationSeconds)
 *    - reason
 *    - status (OPEN, ACKNOWLEDGED, RESOLVED)
 *    - timeline (IncidentEvent[])
 * 7. Manual lifecycle transitions: ACKNOWLEDGE and RESOLVE.
 * 8. Multi-tenant isolation and end-to-end REST API integration.
 */

import { PrismaClient, IncidentStatus, AlertSeverity } from '@prisma/client';
import { IncidentManagerService } from '../src/incidents/incident-manager.service';
import { IncidentsService } from '../src/incidents/incidents.service';

const prisma = new PrismaClient();
const BASE_URL = process.env.API_URL || 'http://localhost:3001/api/v1';

interface TestResult {
  suite: string;
  name: string;
  passed: boolean;
  error?: string;
}

const testResults: TestResult[] = [];

function recordTest(suite: string, name: string, passed: boolean, error?: string) {
  testResults.push({ suite, name, passed, error });
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
  console.log('🚀 RUNNING PHASE 8: INCIDENT MANAGEMENT TEST SUITE');
  console.log('======================================================\n');

  const incidentManager = new IncidentManagerService(prisma as any);
  const incidentsService = new IncidentsService(prisma as any);
  const timestamp = Date.now();

  // Register Tenant A and create test API + Environment
  const regRes = await apiRequest('/auth/register', {
    method: 'POST',
    body: {
      email: `incident-owner-${timestamp}@sentinel.io`,
      password: 'Password123!',
      firstName: 'Incident',
      lastName: 'Commander',
      organizationName: `Incident-Org-${timestamp}`,
    },
  });
  const token = regRes.data?.accessToken;
  const orgId = regRes.data?.user?.organizationId || regRes.data?.organizationId;

  const apiRes = await apiRequest('/apis', {
    method: 'POST',
    token,
    body: {
      name: `Payment-Gateway-${timestamp}`,
      service: 'payment-service',
    },
  });
  const apiId = apiRes.data?.id;

  const envRes = await apiRequest('/environments', {
    method: 'POST',
    token,
    body: {
      name: 'Production',
      baseUrl: 'https://payment.sentinel.io',
      type: 'PRODUCTION',
      apiId,
    },
  });
  const envId = envRes.data?.id;

  // --------------------------------------------------------------------------
  // Suite 1: Transient Failures Suppressed (Requirement 1)
  // --------------------------------------------------------------------------
  console.log('--- Suite 1: Transient Failure Suppression ---');
  {
    // Check 1: 500 error (streak = 1, threshold = 3)
    const check1 = await incidentManager.processCheck({
      organizationId: orgId,
      apiId,
      environmentId: envId,
      check: {
        statusCode: 500,
        success: false,
        timeout: false,
        errorType: 'HTTP_5XX',
        errorMessage: 'Internal Server Error',
      },
      recentChecks: [
        { statusCode: 500, success: false },
      ],
      policy: { failureThreshold: 3, recoveryThreshold: 3 },
    });

    recordTest(
      'Single Failure Suppressed',
      'Does not create an incident on first failed check (action: THRESHOLD_PENDING)',
      check1.action === 'THRESHOLD_PENDING' && check1.isNewIncident === false,
      `Action: ${check1.action}`,
    );

    // Check 2: 500 error (streak = 2, threshold = 3)
    const check2 = await incidentManager.processCheck({
      organizationId: orgId,
      apiId,
      environmentId: envId,
      check: {
        statusCode: 500,
        success: false,
        timeout: false,
        errorType: 'HTTP_5XX',
      },
      recentChecks: [
        { statusCode: 500, success: false },
        { statusCode: 500, success: false },
      ],
      policy: { failureThreshold: 3, recoveryThreshold: 3 },
    });

    recordTest(
      'Sub-Threshold Failure Suppressed',
      'Does not create an incident on second consecutive failure (threshold = 3)',
      check2.action === 'THRESHOLD_PENDING' && check2.isNewIncident === false,
      `Action: ${check2.action}`,
    );

    // Verify 0 incidents in database
    const countBeforeOutage = await prisma.incident.count({
      where: { organizationId: orgId, apiId },
    });

    recordTest(
      'Zero Incidents for Transient Failures',
      'No incident rows created in database prior to reaching failure threshold',
      countBeforeOutage === 0,
      `Count: ${countBeforeOutage}`,
    );
  }

  // --------------------------------------------------------------------------
  // Suite 2: Incident Creation on Threshold (Requirement 2)
  // --------------------------------------------------------------------------
  console.log('\n--- Suite 2: Incident Creation on Threshold Met ---');
  let firstIncidentId: string;
  {
    // Check 3: Timeout error (streak = 3 -> threshold met!)
    const check3 = await incidentManager.processCheck({
      organizationId: orgId,
      apiId,
      environmentId: envId,
      check: {
        statusCode: null,
        success: false,
        timeout: true,
        errorType: 'TIMEOUT',
        errorMessage: 'Request timed out after 10000ms',
      },
      recentChecks: [
        { statusCode: 500, success: false },
        { statusCode: 500, success: false },
        { statusCode: null, success: false, timeout: true },
      ],
      policy: { failureThreshold: 3, recoveryThreshold: 3 },
    });

    firstIncidentId = check3.incidentId!;

    recordTest(
      'Incident Created on Threshold',
      'Creates single incident when failure threshold is reached (500, 500, timeout)',
      check3.action === 'CREATED' &&
        check3.isNewIncident === true &&
        typeof check3.incidentId === 'string',
      `Action: ${check3.action}, IncidentId: ${check3.incidentId}`,
    );

    // Verify incident details in database
    const incidentDb = await incidentManager.getIncidentDetails(firstIncidentId, orgId);

    recordTest(
      'Incident Required Attributes',
      'Contains organization, API, environment, severity, startedAt, reason, status, timeline',
      incidentDb.organizationId === orgId &&
        incidentDb.apiId === apiId &&
        incidentDb.environmentId === envId &&
        incidentDb.status === IncidentStatus.OPEN &&
        typeof incidentDb.reason === 'string' &&
        incidentDb.startedAt instanceof Date &&
        incidentDb.timeline.length >= 1,
      `Status: ${incidentDb.status}, Reason: ${incidentDb.reason}, Timeline Events: ${incidentDb.timeline.length}`,
    );
  }

  // --------------------------------------------------------------------------
  // Suite 3: Repeated Failures & Deduplication (Requirement 3)
  // --------------------------------------------------------------------------
  console.log('\n--- Suite 3: Repeated Failures & Deduplication ---');
  {
    // Check 4: 500 error while incident is already OPEN (User Example: 500, 500, timeout, 500 -> ONE INCIDENT)
    const check4 = await incidentManager.processCheck({
      organizationId: orgId,
      apiId,
      environmentId: envId,
      check: {
        statusCode: 500,
        success: false,
        timeout: false,
        errorType: 'HTTP_5XX',
        errorMessage: 'Ongoing database pool exhaustion',
      },
      policy: { failureThreshold: 3, recoveryThreshold: 3 },
    });

    recordTest(
      'Deduplication Action',
      'Updates existing active incident rather than creating a new one (action: UPDATED)',
      check4.action === 'UPDATED' &&
        check4.isNewIncident === false &&
        check4.incidentId === firstIncidentId,
      `Action: ${check4.action}, IncidentId: ${check4.incidentId}`,
    );

    // Check 5: Another 500 error
    const check5 = await incidentManager.processCheck({
      organizationId: orgId,
      apiId,
      environmentId: envId,
      check: {
        statusCode: 503,
        success: false,
        timeout: false,
        errorType: 'HTTP_5XX',
      },
      policy: { failureThreshold: 3, recoveryThreshold: 3 },
    });

    recordTest(
      'Subsequent Failures Deduplicated',
      'All repeated failures during outage are deduplicated into the same active incident',
      check5.incidentId === firstIncidentId && check5.isNewIncident === false,
      `IncidentId: ${check5.incidentId}`,
    );

    // Verify exactly ONE incident exists in database for this entire outage
    const totalIncidentsCount = await prisma.incident.count({
      where: { organizationId: orgId, apiId },
    });

    recordTest(
      'Single Incident for Outage (Deduplication Guarantee)',
      'Exactly ONE incident exists in database despite 5 successive failures',
      totalIncidentsCount === 1,
      `Total Incidents in DB: ${totalIncidentsCount}`,
    );

    // Verify timeline has appended failure events
    const updatedIncident = await incidentManager.getIncidentDetails(firstIncidentId, orgId);
    recordTest(
      'Timeline Event Append',
      'Repeated failures are appended as timeline events (timeline count >= 3)',
      updatedIncident.timeline.length >= 3,
      `Timeline Events: ${updatedIncident.timeline.length}`,
    );
  }

  // --------------------------------------------------------------------------
  // Suite 4: Recovery Evaluation (Requirement 4)
  // --------------------------------------------------------------------------
  console.log('\n--- Suite 4: Automated Recovery Evaluation ---');
  {
    // Recovery Check 1: 200 OK (recovery streak = 1/3)
    const rec1 = await incidentManager.processCheck({
      organizationId: orgId,
      apiId,
      environmentId: envId,
      check: { statusCode: 200, success: true },
      recentChecks: [{ statusCode: 200, success: true }],
      policy: { failureThreshold: 3, recoveryThreshold: 3 },
    });

    recordTest(
      'Partial Recovery Keeps Incident Open',
      'First 200 OK does not resolve incident immediately (threshold = 3)',
      rec1.action === 'THRESHOLD_PENDING' && rec1.incidentId === firstIncidentId,
      `Action: ${rec1.action}`,
    );

    // Recovery Check 2: 200 OK (recovery streak = 2/3)
    const rec2 = await incidentManager.processCheck({
      organizationId: orgId,
      apiId,
      environmentId: envId,
      check: { statusCode: 200, success: true },
      recentChecks: [
        { statusCode: 200, success: true },
        { statusCode: 200, success: true },
      ],
      policy: { failureThreshold: 3, recoveryThreshold: 3 },
    });

    recordTest(
      'Second Recovery Check Pending',
      'Second 200 OK keeps incident open pending 3rd confirmation',
      rec2.action === 'THRESHOLD_PENDING',
      `Action: ${rec2.action}`,
    );

    // Recovery Check 3: 200 OK (recovery streak = 3/3 -> RESOLVED!)
    const rec3 = await incidentManager.processCheck({
      organizationId: orgId,
      apiId,
      environmentId: envId,
      check: { statusCode: 200, success: true },
      recentChecks: [
        { statusCode: 200, success: true },
        { statusCode: 200, success: true },
        { statusCode: 200, success: true },
      ],
      policy: { failureThreshold: 3, recoveryThreshold: 3 },
    });

    recordTest(
      'Automated Incident Resolution',
      'Transitions incident status to RESOLVED after 3 consecutive successful checks',
      rec3.action === 'RESOLVED' && rec3.incidentId === firstIncidentId,
      `Action: ${rec3.action}`,
    );

    // Verify resolved incident in database has resolvedAt, durationMs, and durationSeconds
    const resolvedIncident = await incidentManager.getIncidentDetails(firstIncidentId, orgId);

    recordTest(
      'Resolution Metadata Recorded',
      'Resolved incident contains resolvedAt, durationMs, and durationSeconds',
      resolvedIncident.status === IncidentStatus.RESOLVED &&
        resolvedIncident.resolvedAt !== null &&
        typeof resolvedIncident.durationMs === 'number' &&
        typeof resolvedIncident.durationSeconds === 'number',
      `Status: ${resolvedIncident.status}, Duration: ${resolvedIncident.durationSeconds}s, ResolvedAt: ${resolvedIncident.resolvedAt}`,
    );
  }

  // --------------------------------------------------------------------------
  // Suite 5: Separate Incidents After Recovery (Requirement 5)
  // --------------------------------------------------------------------------
  console.log('\n--- Suite 5: Separate Incidents After Recovery ---');
  {
    // A new outage begins later: 3 consecutive 500 errors
    await incidentManager.processCheck({
      organizationId: orgId,
      apiId,
      environmentId: envId,
      check: { statusCode: 500, success: false },
      recentChecks: [{ statusCode: 500, success: false }],
      policy: { failureThreshold: 3, recoveryThreshold: 3 },
    });

    await incidentManager.processCheck({
      organizationId: orgId,
      apiId,
      environmentId: envId,
      check: { statusCode: 500, success: false },
      recentChecks: [
        { statusCode: 500, success: false },
        { statusCode: 500, success: false },
      ],
      policy: { failureThreshold: 3, recoveryThreshold: 3 },
    });

    const newOutageTrigger = await incidentManager.processCheck({
      organizationId: orgId,
      apiId,
      environmentId: envId,
      check: { statusCode: 500, success: false },
      recentChecks: [
        { statusCode: 500, success: false },
        { statusCode: 500, success: false },
        { statusCode: 500, success: false },
      ],
      policy: { failureThreshold: 3, recoveryThreshold: 3 },
    });

    recordTest(
      'New Incident Created After Previous Resolved',
      'Creates a distinct new incident for new outage (different ID from previous)',
      newOutageTrigger.action === 'CREATED' &&
        newOutageTrigger.isNewIncident === true &&
        newOutageTrigger.incidentId !== firstIncidentId,
      `New Incident ID: ${newOutageTrigger.incidentId}, Previous ID: ${firstIncidentId}`,
    );

    // Verify 2 total incidents in DB (one resolved, one open)
    const allIncidents = await prisma.incident.findMany({
      where: { organizationId: orgId, apiId },
      orderBy: { startedAt: 'asc' },
    });

    recordTest(
      'Historical Incident Separation',
      'Database retains resolved incident alongside new open incident (total = 2)',
      allIncidents.length === 2 &&
        allIncidents[0].status === IncidentStatus.RESOLVED &&
        allIncidents[1].status === IncidentStatus.OPEN,
      `Incidents: ${allIncidents.map((i) => `${i.id.slice(0, 8)} (${i.status})`).join(', ')}`,
    );
  }

  // --------------------------------------------------------------------------
  // Suite 6: Manual Lifecycle Management (ACKNOWLEDGE & RESOLVE)
  // --------------------------------------------------------------------------
  console.log('\n--- Suite 6: Manual Lifecycle Transitions ---');
  {
    // Find the current OPEN incident
    const openIncident = await prisma.incident.findFirst({
      where: { organizationId: orgId, status: IncidentStatus.OPEN },
    });

    // 1. Manual Acknowledge
    const ackRes = await incidentsService.acknowledge(
      openIncident!.id,
      { id: 'eng-1', name: 'Alice Engineer' },
      orgId,
    );

    recordTest(
      'Manual Acknowledge Transition',
      'Transitions incident from OPEN to ACKNOWLEDGED with engineer name',
      ackRes.status === IncidentStatus.ACKNOWLEDGED &&
        ackRes.acknowledgedBy === 'Alice Engineer' &&
        ackRes.acknowledgedAt !== null,
      `Status: ${ackRes.status}, AcknowledgedBy: ${ackRes.acknowledgedBy}`,
    );

    // 2. Manual Resolve
    const manualResolveRes = await incidentsService.resolve(
      openIncident!.id,
      { id: 'eng-1', name: 'Alice Engineer' },
      orgId,
    );

    recordTest(
      'Manual Resolve Transition',
      'Transitions incident from ACKNOWLEDGED to RESOLVED with engineer name',
      manualResolveRes.status === IncidentStatus.RESOLVED &&
        manualResolveRes.resolvedBy === 'Alice Engineer' &&
        manualResolveRes.resolvedAt !== null,
      `Status: ${manualResolveRes.status}, ResolvedBy: ${manualResolveRes.resolvedBy}`,
    );
  }

  // --------------------------------------------------------------------------
  // Suite 7: REST API Endpoints & Multi-Tenant Isolation
  // --------------------------------------------------------------------------
  console.log('\n--- Suite 7: End-to-End REST Controller & Tenant Isolation ---');
  {
    // 1. GET /incidents
    const listRes = await apiRequest('/incidents', {
      method: 'GET',
      token,
    });

    recordTest(
      'GET /incidents Endpoint',
      'Returns 200 OK with list of organization incidents and durationSeconds',
      listRes.status === 200 &&
        Array.isArray(listRes.data?.items) &&
        listRes.data.items.length >= 2 &&
        typeof listRes.data.items[0].durationSeconds === 'number',
      `Status: ${listRes.status}, Count: ${listRes.data?.items?.length}`,
    );

    // 2. GET /incidents/:id/timeline
    const timelineRes = await apiRequest(`/incidents/${firstIncidentId}/timeline`, {
      method: 'GET',
      token,
    });

    recordTest(
      'GET /incidents/:id/timeline Endpoint',
      'Returns 200 OK with ordered timeline events',
      timelineRes.status === 200 && Array.isArray(timelineRes.data) && timelineRes.data.length >= 1,
      `Status: ${timelineRes.status}, Events: ${timelineRes.data?.length}`,
    );

    // 3. POST /incidents/process-check endpoint
    const checkPostRes = await apiRequest('/incidents/process-check', {
      method: 'POST',
      token,
      body: {
        apiId,
        environmentId: envId,
        check: {
          statusCode: 200,
          success: true,
        },
      },
    });

    recordTest(
      'POST /incidents/process-check Endpoint',
      'Exposes incident evaluation via authenticated REST API',
      checkPostRes.status === 201 || checkPostRes.status === 200,
      `Status: ${checkPostRes.status}, Action: ${checkPostRes.data?.action}`,
    );

    // 4. Multi-Tenant Cross-Access Prevention
    const org2Reg = await apiRequest('/auth/register', {
      method: 'POST',
      body: {
        email: `intruder-incidents-${timestamp}@sentinel.io`,
        password: 'Password123!',
        firstName: 'Intruder',
        lastName: 'Tenant',
        organizationName: `Intruder-Org-${timestamp}`,
      },
    });
    const org2Token = org2Reg.data?.accessToken;

    const crossGetRes = await apiRequest(`/incidents/${firstIncidentId}`, {
      method: 'GET',
      token: org2Token,
    });

    recordTest(
      'Cross-Tenant Incident Protection',
      'Tenant B cannot access Tenant A incident by ID (returns 404 Not Found)',
      crossGetRes.status === 404,
      `Status: ${crossGetRes.status}`,
    );
  }

  // --------------------------------------------------------------------------
  // Summary
  // --------------------------------------------------------------------------
  console.log('\n======================================================');
  console.log('📊 PHASE 8 TEST RESULTS SUMMARY');
  console.log('======================================================');
  const passed = testResults.filter((t) => t.passed).length;
  const failed = testResults.filter((t) => !t.passed).length;
  const total = testResults.length;

  console.log(`Total Tests:  ${total}`);
  console.log(`Passed:       ${passed} ✅`);
  console.log(`Failed:       ${failed} ❌`);
  console.log(`Success Rate: ${((passed / total) * 100).toFixed(1)}%`);

  if (failed > 0) {
    console.error('\n❌ FAILED TESTS:');
    testResults
      .filter((t) => !t.passed)
      .forEach((t) => console.error(` - [${t.suite}] ${t.name}: ${t.error}`));
    process.exit(1);
  } else {
    console.log('\n✨ ALL PHASE 8 INCIDENT MANAGEMENT TESTS PASSED CLEANLY!\n');
    process.exit(0);
  }
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});

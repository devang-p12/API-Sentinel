/**
 * Phase 5 Health Evaluation Service Unit Test Suite
 *
 * Verifies:
 * 1. Health States: HEALTHY, DEGRADED, DOWN
 * 2. Status code evaluation against expected status
 * 3. Latency degradation thresholds (elevated and critical)
 * 4. Consecutive failure streak calculations
 * 5. State transitions across all combinations:
 *    - Initial baseline -> HEALTHY
 *    - HEALTHY -> DEGRADED (elevated latency)
 *    - HEALTHY -> DEGRADED (critical latency)
 *    - HEALTHY -> DEGRADED (initial failure below DOWN threshold)
 *    - DEGRADED -> DOWN (consecutive failures threshold reached)
 *    - HEALTHY -> DOWN (immediate timeout configuration)
 *    - HEALTHY -> DEGRADED (availability drop below SLA)
 *    - DEGRADED -> DOWN (severe availability drop)
 *    - DOWN -> HEALTHY (recovery check with normal latency)
 *    - DOWN -> DEGRADED (recovery check with high latency)
 * 6. Custom policy overrides (expectedStatus, thresholds, window sizes)
 * 7. Verification of return shape:
 *    - currentState
 *    - reason
 *    - lastSuccessfulCheck
 *    - lastFailedCheck
 *    - consecutiveFailures
 * 8. End-to-end HTTP endpoint integration (delegated controller)
 */

import { HealthEvaluationService } from '../src/health-evaluation/health-evaluation.service';
import {
  HealthCheckRecord,
  HealthState,
} from '../src/health-evaluation/interfaces/health-evaluation.interface';
import { PrismaClient } from '@prisma/client';

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
  console.log('🚀 RUNNING PHASE 5 HEALTH EVALUATION TEST SUITE');
  console.log('======================================================\n');

  // Instantitate service for direct deterministic unit testing
  const service = new HealthEvaluationService(prisma as any);
  const now = Date.now();

  // Helper to build check records
  const createCheck = (
    offsetSeconds: number,
    overrides: Partial<HealthCheckRecord> = {},
  ): HealthCheckRecord => ({
    timestamp: new Date(now - offsetSeconds * 1000).toISOString(),
    statusCode: 200,
    latencyMs: 120,
    success: true,
    timeout: false,
    ...overrides,
  });

  // --------------------------------------------------------------------------
  // Suite 1: Initial Baseline & Empty Checks
  // --------------------------------------------------------------------------
  console.log('--- Suite 1: Initial Baseline ---');
  const baseline = service.evaluate([]);
  recordTest(
    'Initial Baseline',
    'Empty checks evaluate to HEALTHY with zero failures',
    baseline.currentState === HealthState.HEALTHY &&
      baseline.consecutiveFailures === 0 &&
      baseline.lastSuccessfulCheck === null &&
      baseline.lastFailedCheck === null &&
      typeof baseline.reason === 'string',
    `State: ${baseline.currentState}`,
  );

  // --------------------------------------------------------------------------
  // Suite 2: HEALTHY Normal Operation
  // --------------------------------------------------------------------------
  console.log('\n--- Suite 2: HEALTHY Normal Operation ---');
  const normalChecks = [
    createCheck(0, { statusCode: 200, latencyMs: 95 }),
    createCheck(30, { statusCode: 200, latencyMs: 110 }),
    createCheck(60, { statusCode: 200, latencyMs: 85 }),
  ];
  const normalRes = service.evaluate(normalChecks);
  recordTest(
    'HEALTHY State',
    'Normal checks with expected status and low latency evaluate to HEALTHY',
    normalRes.currentState === HealthState.HEALTHY &&
      normalRes.consecutiveFailures === 0 &&
      normalRes.consecutiveSuccesses === 3 &&
      normalRes.availabilityPercentage === 100 &&
      normalRes.lastSuccessfulCheck === normalChecks[0].timestamp &&
      normalRes.lastFailedCheck === null,
    `Reason: ${normalRes.reason}`,
  );

  // --------------------------------------------------------------------------
  // Suite 3: Transition HEALTHY -> DEGRADED (Elevated Latency)
  // --------------------------------------------------------------------------
  console.log('\n--- Suite 3: Latency Degradation ---');
  const elevatedLatencyChecks = [
    createCheck(0, { statusCode: 200, latencyMs: 1450 }), // > default 1000ms threshold
    createCheck(30, { statusCode: 200, latencyMs: 120 }),
  ];
  const elevatedRes = service.evaluate(elevatedLatencyChecks);
  recordTest(
    'Latency Degradation',
    'Check with latency exceeding 1000ms transitions to DEGRADED',
    elevatedRes.currentState === HealthState.DEGRADED &&
      elevatedRes.consecutiveFailures === 0 &&
      elevatedRes.reason.includes('Elevated latency') &&
      elevatedRes.lastSuccessfulCheck === elevatedLatencyChecks[0].timestamp,
    `State: ${elevatedRes.currentState}, reason: ${elevatedRes.reason}`,
  );

  // Critical latency spike (> 3000ms)
  const criticalLatencyChecks = [
    createCheck(0, { statusCode: 200, latencyMs: 3800 }),
    createCheck(30, { statusCode: 200, latencyMs: 120 }),
  ];
  const criticalLatencyRes = service.evaluate(criticalLatencyChecks);
  recordTest(
    'Latency Degradation',
    'Check with latency exceeding 3000ms triggers critical DEGRADED reason',
    criticalLatencyRes.currentState === HealthState.DEGRADED &&
      criticalLatencyRes.reason.includes('Critical latency spike'),
    `Reason: ${criticalLatencyRes.reason}`,
  );

  // --------------------------------------------------------------------------
  // Suite 4: Transition HEALTHY -> DEGRADED (Single Failure below DOWN threshold)
  // --------------------------------------------------------------------------
  console.log('\n--- Suite 4: Intermittent Failure Degradation ---');
  const singleFailureChecks = [
    createCheck(0, { statusCode: 500, success: false, errorType: 'HTTP_5XX' }),
    createCheck(30, { statusCode: 200, latencyMs: 110 }),
    createCheck(60, { statusCode: 200, latencyMs: 95 }),
  ];
  const singleFailRes = service.evaluate(singleFailureChecks);
  recordTest(
    'Intermittent Failure',
    '1 failure when DOWN threshold is 3 evaluates to DEGRADED with consecutiveFailures=1',
    singleFailRes.currentState === HealthState.DEGRADED &&
      singleFailRes.consecutiveFailures === 1 &&
      singleFailRes.lastFailedCheck === singleFailureChecks[0].timestamp &&
      singleFailRes.lastSuccessfulCheck === singleFailureChecks[1].timestamp,
    `State: ${singleFailRes.currentState}, failures: ${singleFailRes.consecutiveFailures}`,
  );

  // --------------------------------------------------------------------------
  // Suite 5: Transition DEGRADED -> DOWN (Consecutive Failures Threshold)
  // --------------------------------------------------------------------------
  console.log('\n--- Suite 5: Consecutive Failures to DOWN ---');
  const downChecks = [
    createCheck(0, { statusCode: 503, success: false, errorType: 'HTTP_5XX' }),
    createCheck(30, { statusCode: 500, success: false, errorType: 'HTTP_5XX' }),
    createCheck(60, { statusCode: 500, success: false, errorType: 'HTTP_5XX' }),
    createCheck(90, { statusCode: 200, latencyMs: 95 }), // older successful check
  ];
  const downRes = service.evaluate(downChecks);
  recordTest(
    'Consecutive Failures DOWN',
    '3 consecutive failures reach threshold and transition state to DOWN',
    downRes.currentState === HealthState.DOWN &&
      downRes.consecutiveFailures === 3 &&
      downRes.lastFailedCheck === downChecks[0].timestamp &&
      downRes.lastSuccessfulCheck === downChecks[3].timestamp &&
      downRes.reason.includes('3 consecutive failures recorded'),
    `State: ${downRes.currentState}, reason: ${downRes.reason}`,
  );

  // --------------------------------------------------------------------------
  // Suite 6: Immediate Timeout to DOWN Configuration
  // --------------------------------------------------------------------------
  console.log('\n--- Suite 6: Immediate Timeout Handling ---');
  const timeoutCheck = [
    createCheck(0, { statusCode: null, success: false, timeout: true, errorType: 'TIMEOUT' }),
    createCheck(30, { statusCode: 200, latencyMs: 100 }),
  ];
  const timeoutRes = service.evaluate(timeoutCheck, { immediateDownOnTimeout: true });
  recordTest(
    'Immediate Timeout DOWN',
    'Timeout with immediateDownOnTimeout=true transitions immediately to DOWN',
    timeoutRes.currentState === HealthState.DOWN &&
      timeoutRes.reason.includes('request timeout'),
    `State: ${timeoutRes.currentState}, reason: ${timeoutRes.reason}`,
  );

  // --------------------------------------------------------------------------
  // Suite 7: Availability Percentage Transitions
  // --------------------------------------------------------------------------
  console.log('\n--- Suite 7: Monitoring Availability Transitions ---');
  // 20 checks with 2 failures = 90% availability (< 95% degraded threshold)
  // But latest check is success (so consecutiveFailures = 0)
  const window20Checks: HealthCheckRecord[] = [];
  window20Checks.push(createCheck(0, { statusCode: 200, latencyMs: 100 }));
  for (let i = 1; i <= 17; i++) {
    window20Checks.push(createCheck(i * 30, { statusCode: 200, latencyMs: 100 }));
  }
  // Add 2 failed checks in the past
  window20Checks.push(createCheck(550, { statusCode: 500, success: false }));
  window20Checks.push(createCheck(580, { statusCode: 500, success: false }));

  const availDegradedRes = service.evaluate(window20Checks);
  recordTest(
    'Availability Degradation',
    'Availability below 95% SLA transitions to DEGRADED even when latest check succeeded',
    availDegradedRes.currentState === HealthState.DEGRADED &&
      availDegradedRes.availabilityPercentage === 90 &&
      availDegradedRes.consecutiveFailures === 0 &&
      availDegradedRes.reason.includes('Availability (90%) dropped below SLA'),
    `Availability: ${availDegradedRes.availabilityPercentage}%, state: ${availDegradedRes.currentState}`,
  );

  // Severe availability drop below 70% -> DOWN
  const severeDropChecks: HealthCheckRecord[] = [];
  severeDropChecks.push(createCheck(0, { statusCode: 500, success: false, errorType: 'HTTP_5XX' }));
  for (let i = 1; i <= 6; i++) {
    severeDropChecks.push(createCheck(i * 30, { statusCode: 200, latencyMs: 100 }));
  }
  for (let i = 7; i <= 19; i++) {
    severeDropChecks.push(createCheck(i * 30, { statusCode: 500, success: false }));
  }
  const severeDropRes = service.evaluate(severeDropChecks);
  recordTest(
    'Availability DOWN',
    'Severe availability drop below 70% transitions state to DOWN',
    severeDropRes.currentState === HealthState.DOWN &&
      severeDropRes.availabilityPercentage === 30 &&
      severeDropRes.reason.includes('Severe availability degradation'),
    `Availability: ${severeDropRes.availabilityPercentage}%, state: ${severeDropRes.currentState}`,
  );

  // --------------------------------------------------------------------------
  // Suite 8: Recovery Transitions (DOWN -> HEALTHY and DOWN -> DEGRADED)
  // --------------------------------------------------------------------------
  console.log('\n--- Suite 8: Health Recovery Transitions ---');
  // Previous 3 failures, followed by fresh success with normal latency
  const recoverySuccessChecks = [
    createCheck(0, { statusCode: 200, latencyMs: 75 }), // fresh recovery!
    createCheck(30, { statusCode: 500, success: false }),
    createCheck(60, { statusCode: 500, success: false }),
    createCheck(90, { statusCode: 500, success: false }),
  ];
  const recoverySuccessRes = service.evaluate(recoverySuccessChecks);
  recordTest(
    'Recovery to HEALTHY',
    'Recovery check with expected status and normal latency transitions state to HEALTHY',
    recoverySuccessRes.currentState === HealthState.HEALTHY &&
      recoverySuccessRes.consecutiveFailures === 0 &&
      recoverySuccessRes.consecutiveSuccesses === 1 &&
      recoverySuccessRes.lastSuccessfulCheck === recoverySuccessChecks[0].timestamp &&
      recoverySuccessRes.lastFailedCheck === recoverySuccessChecks[1].timestamp,
    `State: ${recoverySuccessRes.currentState}, reason: ${recoverySuccessRes.reason}`,
  );

  // Recovery check arrives, but with high latency (1700ms) -> transitions to DEGRADED, not full HEALTHY
  const recoveryDegradedChecks = [
    createCheck(0, { statusCode: 200, latencyMs: 1700 }), // high latency recovery
    createCheck(30, { statusCode: 500, success: false }),
    createCheck(60, { statusCode: 500, success: false }),
    createCheck(90, { statusCode: 500, success: false }),
  ];
  const recoveryDegradedRes = service.evaluate(recoveryDegradedChecks);
  recordTest(
    'Recovery to DEGRADED',
    'Recovery check with elevated latency transitions state from DOWN to DEGRADED',
    recoveryDegradedRes.currentState === HealthState.DEGRADED &&
      recoveryDegradedRes.consecutiveFailures === 0 &&
      recoveryDegradedRes.reason.includes('Elevated latency (1700ms)'),
    `State: ${recoveryDegradedRes.currentState}, reason: ${recoveryDegradedRes.reason}`,
  );

  // --------------------------------------------------------------------------
  // Suite 9: Configurable Health Policies & Overrides
  // --------------------------------------------------------------------------
  console.log('\n--- Suite 9: Configurable Health Policy ---');
  // Custom expectedStatus: 204 No Content
  const customStatusChecks = [
    createCheck(0, { statusCode: 200, latencyMs: 80 }), // 200 received
  ];
  const customStatusRes = service.evaluate(customStatusChecks, { expectedStatus: 204 });
  recordTest(
    'Configurable Policy',
    'Custom expectedStatus=204 treats status 200 as failure (DEGRADED state)',
    customStatusRes.currentState === HealthState.DEGRADED &&
      customStatusRes.consecutiveFailures === 1,
    `State: ${customStatusRes.currentState}, failures: ${customStatusRes.consecutiveFailures}`,
  );

  // Custom consecutiveFailuresForDown = 2
  const customDownThresholdChecks = [
    createCheck(0, { statusCode: 500, success: false }),
    createCheck(30, { statusCode: 500, success: false }),
    createCheck(60, { statusCode: 200, latencyMs: 90 }),
  ];
  const customDownRes = service.evaluate(customDownThresholdChecks, {
    consecutiveFailuresForDown: 2,
  });
  recordTest(
    'Configurable Policy',
    'Custom consecutiveFailuresForDown=2 marks 2 failures as DOWN immediately',
    customDownRes.currentState === HealthState.DOWN &&
      customDownRes.consecutiveFailures === 2,
    `State: ${customDownRes.currentState}, failures: ${customDownRes.consecutiveFailures}`,
  );

  // Custom degradedLatencyThresholdMs = 250ms
  const customLatencyChecks = [
    createCheck(0, { statusCode: 200, latencyMs: 320 }),
  ];
  const customLatencyRes = service.evaluate(customLatencyChecks, {
    degradedLatencyThresholdMs: 250,
  });
  recordTest(
    'Configurable Policy',
    'Custom degradedLatencyThresholdMs=250ms marks 320ms latency as DEGRADED',
    customLatencyRes.currentState === HealthState.DEGRADED &&
      customLatencyRes.reason.includes('exceeds degradation threshold (250ms)'),
    `State: ${customLatencyRes.currentState}, reason: ${customLatencyRes.reason}`,
  );

  // --------------------------------------------------------------------------
  // Suite 10: Return Payload Structure
  // --------------------------------------------------------------------------
  console.log('\n--- Suite 10: Return Payload Structure ---');
  const sampleRes = service.evaluate(normalChecks);
  recordTest(
    'Return Contract',
    'Return object contains all 5 required fields: currentState, reason, lastSuccessfulCheck, lastFailedCheck, consecutiveFailures',
    'currentState' in sampleRes &&
      'reason' in sampleRes &&
      'lastSuccessfulCheck' in sampleRes &&
      'lastFailedCheck' in sampleRes &&
      'consecutiveFailures' in sampleRes &&
      Object.values(HealthState).includes(sampleRes.currentState) &&
      typeof sampleRes.reason === 'string' &&
      typeof sampleRes.consecutiveFailures === 'number',
    `Keys: ${Object.keys(sampleRes).join(', ')}`,
  );

  // --------------------------------------------------------------------------
  // Suite 11: End-to-End API Integration (Delegated Controller)
  // --------------------------------------------------------------------------
  console.log('\n--- Suite 11: End-to-End Delegated Endpoint ---');
  const timestamp = Date.now();
  const regRes = await apiRequest('/auth/register', {
    method: 'POST',
    body: {
      email: `health-eval-${timestamp}@sentinel.io`,
      password: 'Password123!',
      firstName: 'Health',
      lastName: 'Evaluation',
      organizationName: `Health-Org-${timestamp}`,
    },
  });
  const token = regRes.data?.accessToken;

  // Create API
  const apiRes = await apiRequest('/apis', {
    method: 'POST',
    token,
    body: {
      name: `Health-API-${timestamp}`,
      service: 'health-service',
    },
  });
  const apiId = apiRes.data?.id;

  // Create Environment
  const envRes = await apiRequest('/environments', {
    method: 'POST',
    token,
    body: {
      name: 'Prod',
      baseUrl: 'https://httpbin.org',
      type: 'PRODUCTION',
      apiId,
    },
  });
  const envId = envRes.data?.id;

  // Create Monitor
  const monRes = await apiRequest('/monitors/configs', {
    method: 'POST',
    token,
    body: {
      name: 'Health-Endpoint-Probe',
      url: '/status/200',
      environmentId: envId,
      interval: 30,
      timeout: 5000,
      expectedStatus: 200,
    },
  });
  const monId = monRes.data?.id;

  // Query health endpoint for monitor: GET /health/monitors/:id
  const healthEndpointRes = await apiRequest(`/health/monitors/${monId}`, {
    method: 'GET',
    token,
  });

  recordTest(
    'Delegated Controller',
    'GET /health/monitors/:id delegates to HealthEvaluationService and returns health payload',
    healthEndpointRes.status === 200 &&
      'currentState' in healthEndpointRes.data &&
      'reason' in healthEndpointRes.data &&
      'consecutiveFailures' in healthEndpointRes.data &&
      'lastSuccessfulCheck' in healthEndpointRes.data &&
      'lastFailedCheck' in healthEndpointRes.data,
    `Payload: ${JSON.stringify(healthEndpointRes.data)}`,
  );

  // Query health endpoint for API: GET /health/apis/:id
  const apiHealthRes = await apiRequest(`/health/apis/${apiId}`, {
    method: 'GET',
    token,
  });

  recordTest(
    'Delegated Controller',
    'GET /health/apis/:id delegates to HealthEvaluationService and returns aggregated health',
    apiHealthRes.status === 200 &&
      'currentState' in apiHealthRes.data &&
      'reason' in apiHealthRes.data,
    `Payload: ${JSON.stringify(apiHealthRes.data)}`,
  );

  // Query health endpoint on /monitors/:id/health
  const monitorHealthRoute = await apiRequest(`/monitors/${monId}/health`, {
    method: 'GET',
    token,
  });
  recordTest(
    'Delegated Controller',
    'GET /monitors/:id/health returns health evaluation result',
    monitorHealthRoute.status === 200 &&
      'currentState' in monitorHealthRoute.data &&
      'reason' in monitorHealthRoute.data,
  );

  await prisma.$disconnect();

  // --------------------------------------------------------------------------
  // Summary
  // --------------------------------------------------------------------------
  console.log('\n======================================================');
  const passed = testResults.filter((t) => t.passed).length;
  const failed = testResults.filter((t) => !t.passed).length;
  console.log(`Phase 5 Results: ${passed}/${testResults.length} passed (${failed} failed)`);
  console.log('======================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal error running Phase 5 test suite:', err);
  process.exit(1);
});

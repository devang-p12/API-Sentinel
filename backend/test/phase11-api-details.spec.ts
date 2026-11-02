import { PrismaClient } from '@prisma/client';
import { PrismaService } from '../src/prisma/prisma.service';
import { ApisService } from '../src/apis/apis.service';
import { HealthEvaluationService } from '../src/health-evaluation/health-evaluation.service';
import { ReliabilityScoreService } from '../src/reliability-score/reliability-score.service';
import { NotFoundException } from '@nestjs/common';
import * as crypto from 'crypto';

const prisma = new PrismaClient();

async function runPhase11Tests() {
  console.log('\n======================================================');
  console.log('🚀 RUNNING PHASE 11: API DETAILS (/apis/:id) TEST SUITE');
  console.log('======================================================\n');

  let passedTests = 0;
  let failedTests = 0;

  function assert(condition: boolean, testName: string, details?: any) {
    if (condition) {
      console.log(`✅ PASS [${testName}]`);
      passedTests++;
    } else {
      console.error(`❌ FAIL [${testName}]`, details || '');
      failedTests++;
    }
  }

  // 1. Setup Organizations
  const orgAId = crypto.randomUUID();
  const orgBId = crypto.randomUUID();

  await prisma.organization.create({
    data: {
      id: orgAId,
      name: 'Tenant Alpha (Phase 11)',
      slug: `tenant-alpha-p11-${Date.now()}`,
    },
  });

  await prisma.organization.create({
    data: {
      id: orgBId,
      name: 'Tenant Beta (Phase 11)',
      slug: `tenant-beta-p11-${Date.now()}`,
    },
  });

  // 2. Create API with 3 Environments (Development, UAT, Production)
  const apiA = await prisma.api.create({
    data: {
      id: crypto.randomUUID(),
      name: 'Payment Processing Service',
      service: 'payment-svc',
      organizationId: orgAId,
    },
  });

  const envDev = await prisma.environment.create({
    data: {
      id: crypto.randomUUID(),
      name: 'development',
      type: 'DEVELOPMENT',
      baseUrl: 'https://dev-pay.internal.io',
      apiId: apiA.id,
      organizationId: orgAId,
    },
  });

  const envUat = await prisma.environment.create({
    data: {
      id: crypto.randomUUID(),
      name: 'uat',
      type: 'STAGING',
      baseUrl: 'https://uat-pay.internal.io',
      apiId: apiA.id,
      organizationId: orgAId,
    },
  });

  const envProd = await prisma.environment.create({
    data: {
      id: crypto.randomUUID(),
      name: 'production',
      type: 'PRODUCTION',
      baseUrl: 'https://api.payment.example.com',
      apiId: apiA.id,
      organizationId: orgAId,
    },
  });

  // 3. Create Monitoring Results for environments
  // Production: 8 checks (7 success 200 OK ~50ms, 1 error 500 ~200ms)
  for (let i = 0; i < 7; i++) {
    await prisma.monitorResult.create({
      data: {
        id: crypto.randomUUID(),
        organizationId: orgAId,
        apiId: apiA.id,
        environmentId: envProd.id,
        statusCode: 200,
        latencyMs: 40 + i * 5,
        success: true,
        timeout: false,
        responseSize: 1024,
        schemaValid: true,
        timestamp: new Date(Date.now() - (7 - i) * 60000),
      },
    });
  }
  await prisma.monitorResult.create({
    data: {
      id: crypto.randomUUID(),
      organizationId: orgAId,
      apiId: apiA.id,
      environmentId: envProd.id,
      statusCode: 500,
      latencyMs: 250,
      success: false,
      timeout: false,
      errorType: 'HTTP_500',
      responseSize: 256,
      schemaValid: false,
      timestamp: new Date(Date.now() - 30000),
    },
  });

  // UAT: 4 checks (3 success, 1 failure)
  for (let i = 0; i < 3; i++) {
    await prisma.monitorResult.create({
      data: {
        id: crypto.randomUUID(),
        organizationId: orgAId,
        apiId: apiA.id,
        environmentId: envUat.id,
        statusCode: 200,
        latencyMs: 80 + i * 10,
        success: true,
        timeout: false,
        responseSize: 1024,
        schemaValid: true,
        timestamp: new Date(Date.now() - (3 - i) * 120000),
      },
    });
  }
  await prisma.monitorResult.create({
    data: {
      id: crypto.randomUUID(),
      organizationId: orgAId,
      apiId: apiA.id,
      environmentId: envUat.id,
      statusCode: 504,
      latencyMs: 5000,
      success: false,
      timeout: true,
      errorType: 'GATEWAY_TIMEOUT',
      responseSize: 0,
      schemaValid: false,
      timestamp: new Date(Date.now() - 60000),
    },
  });

  // Development: 2 checks
  for (let i = 0; i < 2; i++) {
    await prisma.monitorResult.create({
      data: {
        id: crypto.randomUUID(),
        organizationId: orgAId,
        apiId: apiA.id,
        environmentId: envDev.id,
        statusCode: 200,
        latencyMs: 120,
        success: true,
        timeout: false,
        responseSize: 512,
        schemaValid: true,
        timestamp: new Date(Date.now() - (2 - i) * 180000),
      },
    });
  }

  // 4. Create Contract Schema & Changes
  const apiSchema = await prisma.apiSchema.create({
    data: {
      id: crypto.randomUUID(),
      organizationId: orgAId,
      apiId: apiA.id,
      environmentId: envProd.id,
      endpoint: '/payments/charge',
      method: 'POST',
      createdAt: new Date(Date.now() - 86400000),
    },
  });

  const schemaV1 = await prisma.schemaVersion.create({
    data: {
      id: crypto.randomUUID(),
      schemaId: apiSchema.id,
      versionNumber: 1,
      isBaseline: false,
      normalizedSchema: {
        type: 'object',
        properties: {
          transactionId: { type: 'string' },
          amount: { type: 'number' },
          status: { type: 'string' },
        },
        required: ['transactionId', 'amount'],
      },
      createdAt: new Date(Date.now() - 86400000),
    },
  });

  const schemaV2 = await prisma.schemaVersion.create({
    data: {
      id: crypto.randomUUID(),
      schemaId: apiSchema.id,
      versionNumber: 2,
      isBaseline: true,
      normalizedSchema: {
        type: 'object',
        properties: {
          transactionId: { type: 'string' },
          amount: { type: 'number' },
          status: { type: 'string' },
          fee: { type: 'number' },
        },
        required: ['transactionId', 'amount'],
      },
      createdAt: new Date(Date.now() - 3600000),
    },
  });

  // Update active baseline pointer
  await prisma.apiSchema.update({
    where: { id: apiSchema.id },
    data: { activeBaselineVersionId: schemaV2.id },
  });

  const schemaChange1 = await prisma.schemaChange.create({
    data: {
      id: crypto.randomUUID(),
      schemaId: apiSchema.id,
      versionId: schemaV2.id,
      changeType: 'FIELD_ADDED',
      severity: 'INFO',
      fieldPath: 'fee',
      previousType: null,
      currentType: 'number',
      description: 'New optional field "fee" was added to response contract',
      isBreaking: false,
      detectedAt: new Date(Date.now() - 3600000),
    },
  });

  // 5. Create Incidents (1 Active, 1 Historical Resolved)
  const activeIncident = await prisma.incident.create({
    data: {
      id: crypto.randomUUID(),
      organizationId: orgAId,
      apiId: apiA.id,
      environmentId: envProd.id,
      title: 'Elevated 500 Server Errors on Payment Processing',
      description: 'API returned repeated HTTP 500 internal errors',
      status: 'OPEN',
      severity: 'HIGH',
      reason: 'Consecutive HTTP 500 error responses',
      startedAt: new Date(Date.now() - 1800000),
    },
  });

  const resolvedIncident = await prisma.incident.create({
    data: {
      id: crypto.randomUUID(),
      organizationId: orgAId,
      apiId: apiA.id,
      environmentId: envUat.id,
      title: 'Gateway Timeout on UAT environment',
      description: 'Upstream gateway unresponsive',
      status: 'RESOLVED',
      severity: 'WARNING',
      reason: '504 Gateway Timeout',
      startedAt: new Date(Date.now() - 7200000),
      resolvedAt: new Date(Date.now() - 3600000),
      durationSeconds: 3600,
    },
  });

  // 6. Create Configured Alerts
  const alert1 = await prisma.alertRule.create({
    data: {
      id: crypto.randomUUID(),
      organizationId: orgAId,
      apiId: apiA.id,
      environmentId: envProd.id,
      name: 'High Latency Warning (>500ms)',
      metric: 'p95_latency',
      operator: '>',
      threshold: 500,
      duration: 300,
      severity: 'WARNING',
      enabled: true,
      notificationChannels: ['slack', 'pagerduty'],
      grafanaRuleUid: 'grafana-uid-pay-latency-001',
    },
  });

  const alert2 = await prisma.alertRule.create({
    data: {
      id: crypto.randomUUID(),
      organizationId: orgAId,
      apiId: apiA.id,
      environmentId: envProd.id,
      name: 'Critical Downtime Detection',
      metric: 'consecutive_failures',
      operator: '>',
      threshold: 3,
      duration: 60,
      severity: 'CRITICAL',
      enabled: true,
      notificationChannels: ['pagerduty'],
      grafanaRuleUid: 'grafana-uid-pay-down-002',
    },
  });

  // Instantiate Services
  const prismaService = new PrismaService();
  const healthService = new HealthEvaluationService(prismaService);
  const reliabilityService = new ReliabilityScoreService(prismaService);
  const apisService = new ApisService(prismaService, healthService, reliabilityService);

  // =========================================================================
  // TEST SUITE: Phase 11 Requirements
  // =========================================================================

  // Test 1: Fetch Full API Details
  console.log('--- Test Group 1: API Details Fetch & Base Structure ---');
  const details = await apisService.getApiDetails(apiA.id, orgAId);
  assert(!!details, 'Details returned for valid API and organization');
  assert(details.api.id === apiA.id, 'API ID matches');
  assert(details.api.name === 'Payment Processing Service', 'API name matches');
  assert(details.api.service === 'payment-svc', 'API service matches');

  // Test 2: Overview Section
  console.log('\n--- Test Group 2: Overview Section ---');
  const ov = details.overview;
  assert(!!ov, 'Overview section exists');
  assert(['HEALTHY', 'DEGRADED', 'DOWN'].includes(ov.health), 'Overview health is a valid status', ov.health);
  assert(typeof ov.reliabilityScore === 'number' && ov.reliabilityScore >= 0 && ov.reliabilityScore <= 100, 'Overview reliability is 0-100', ov.reliabilityScore);
  assert(typeof ov.availabilityPct === 'number' && ov.availabilityPct >= 0 && ov.availabilityPct <= 100, 'Overview availability is 0-100', ov.availabilityPct);
  assert(typeof ov.errorRatePct === 'number' && ov.errorRatePct >= 0 && ov.errorRatePct <= 100, 'Overview errorRate is 0-100', ov.errorRatePct);
  assert(typeof ov.averageLatencyMs === 'number' && ov.averageLatencyMs >= 0, 'Overview average latency is positive number', ov.averageLatencyMs);
  assert(typeof ov.p95LatencyMs === 'number' && ov.p95LatencyMs >= 0, 'Overview p95 latency is positive number', ov.p95LatencyMs);

  // Test 3: Performance Section
  console.log('\n--- Test Group 3: Performance Section (Graphs) ---');
  const perf = details.performance;
  assert(!!perf, 'Performance section exists');
  assert(Array.isArray(perf.latencyGraph) && perf.latencyGraph.length > 0, 'Latency graph array populated', perf.latencyGraph.length);
  assert(Array.isArray(perf.errorGraph) && perf.errorGraph.length > 0, 'Error graph array populated', perf.errorGraph.length);
  assert(Array.isArray(perf.availabilityGraph) && perf.availabilityGraph.length > 0, 'Availability graph array populated', perf.availabilityGraph.length);
  const samplePt = perf.latencyGraph[0];
  assert('timestamp' in samplePt && 'avgMs' in samplePt && 'p95Ms' in samplePt, 'Latency point contains timestamp, avgMs, p95Ms');
  const sampleErr = perf.errorGraph[0];
  assert('timestamp' in sampleErr && 'errorRatePct' in sampleErr && 'failureCount' in sampleErr, 'Error point contains timestamp, errorRatePct, failureCount');
  const sampleAvail = perf.availabilityGraph[0];
  assert('timestamp' in sampleAvail && 'availabilityPct' in sampleAvail, 'Availability point contains timestamp, availabilityPct');

  // Test 4: Monitoring Section
  console.log('\n--- Test Group 4: Monitoring Section ---');
  const mon = details.monitoring;
  assert(!!mon, 'Monitoring section exists');
  assert(Array.isArray(mon.recentChecks) && mon.recentChecks.length > 0, 'Recent checks array populated', mon.recentChecks.length);
  assert(Array.isArray(mon.failures) && mon.failures.length > 0, 'Failures array populated with failed checks', mon.failures.length);
  assert(mon.failures.every(f => !f.success), 'All entries in failures array have success === false');
  assert(!!mon.responseTimes, 'Response times distribution exists');
  assert(typeof mon.responseTimes.minMs === 'number', 'Response times minMs exists', mon.responseTimes.minMs);
  assert(typeof mon.responseTimes.avgMs === 'number', 'Response times avgMs exists', mon.responseTimes.avgMs);
  assert(typeof mon.responseTimes.p95Ms === 'number', 'Response times p95Ms exists', mon.responseTimes.p95Ms);
  assert(typeof mon.responseTimes.p99Ms === 'number', 'Response times p99Ms exists', mon.responseTimes.p99Ms);
  assert(typeof mon.responseTimes.maxMs === 'number', 'Response times maxMs exists', mon.responseTimes.maxMs);

  // Test 5: Contract Section
  console.log('\n--- Test Group 5: Contract Section ---');
  const contract = details.contract;
  assert(!!contract, 'Contract section exists');
  assert(Array.isArray(contract.schemas) && contract.schemas.length === 1, 'Contract schemas array populated', contract.schemas.length);
  const activeSchema = contract.schemas[0];
  assert(!!activeSchema.currentSchema, 'Current schema exists');
  assert(Array.isArray(activeSchema.versions) && activeSchema.versions.length === 2, 'Schema versions list v1 and v2', activeSchema.versions.length);
  assert(Array.isArray(activeSchema.changes) && activeSchema.changes.length >= 1, 'Schema changes detected and recorded', activeSchema.changes.length);
  assert(activeSchema.changes[0].fieldPath === 'fee' && activeSchema.changes[0].changeType === 'FIELD_ADDED', 'Schema change details match created record');

  // Test 6: Incidents Section
  console.log('\n--- Test Group 6: Incidents Section ---');
  const inc = details.incidents;
  assert(!!inc, 'Incidents section exists');
  assert(Array.isArray(inc.activeIncidents) && inc.activeIncidents.length === 1, 'Active incidents correctly contains 1 OPEN incident', inc.activeIncidents.length);
  assert(inc.activeIncidents[0].id === activeIncident.id, 'Active incident ID matches');
  assert(inc.activeIncidents[0].status === 'OPEN', 'Active incident has OPEN status');
  assert(Array.isArray(inc.historicalIncidents) && inc.historicalIncidents.length === 1, 'Historical incidents correctly contains 1 RESOLVED incident', inc.historicalIncidents.length);
  assert(inc.historicalIncidents[0].id === resolvedIncident.id, 'Historical incident ID matches');
  assert(inc.historicalIncidents[0].status === 'RESOLVED', 'Historical incident has RESOLVED status');

  // Test 7: Alerts Section
  console.log('\n--- Test Group 7: Alerts Section ---');
  const alerts = details.alerts;
  assert(!!alerts, 'Alerts section exists');
  assert(Array.isArray(alerts.configuredAlerts) && alerts.configuredAlerts.length === 2, 'Configured alerts contains 2 rules', alerts.configuredAlerts.length);
  const latencyAlert = alerts.configuredAlerts.find(a => a.id === alert1.id);
  assert(!!latencyAlert && latencyAlert.metric === 'p95_latency' && latencyAlert.threshold === 500, 'Alert rule 1 matches configuration');
  const downAlert = alerts.configuredAlerts.find(a => a.id === alert2.id);
  assert(!!downAlert && downAlert.metric === 'consecutive_failures' && downAlert.threshold === 3, 'Alert rule 2 matches configuration');

  // Test 8: Environments & Environment Comparison Matrix
  console.log('\n--- Test Group 8: Environments & Comparison Matrix ---');
  const envs = details.environments;
  assert(Array.isArray(envs) && envs.length === 3, 'API has 3 environments (Development, UAT, Production)', envs.length);
  
  for (const item of envs) {
    assert(['development', 'uat', 'production'].includes(item.environmentName), `Matrix item has valid environment: ${item.environmentName}`);
    assert(typeof item.availability === 'number' && item.availability >= 0 && item.availability <= 100, `Matrix availability valid for ${item.environmentName}`, item.availability);
    assert(typeof item.latency === 'number' && item.latency >= 0, `Matrix latency valid for ${item.environmentName}`, item.latency);
    assert(typeof item.p95 === 'number' && item.p95 >= 0, `Matrix p95 valid for ${item.environmentName}`, item.p95);
    assert(typeof item.errors === 'number' && item.errors >= 0 && item.errors <= 100, `Matrix errors valid for ${item.environmentName}`, item.errors);
    assert(typeof item.reliability === 'number' && item.reliability >= 0 && item.reliability <= 100, `Matrix reliability valid for ${item.environmentName}`, item.reliability);
  }

  // Test 9: Multi-Tenant Isolation
  console.log('\n--- Test Group 9: Multi-Tenant Isolation ---');
  let crossTenantBlocked = false;
  try {
    // Tenant B attempts to fetch Tenant A's API
    await apisService.getApiDetails(apiA.id, orgBId);
  } catch (err: any) {
    if (err instanceof NotFoundException || err.message.includes('not found')) {
      crossTenantBlocked = true;
    }
  }
  assert(crossTenantBlocked, 'Cross-tenant access blocked with NotFoundException when Tenant B queries Tenant A API');

  let nonExistentBlocked = false;
  try {
    await apisService.getApiDetails(crypto.randomUUID(), orgAId);
  } catch (err: any) {
    if (err instanceof NotFoundException) {
      nonExistentBlocked = true;
    }
  }
  assert(nonExistentBlocked, 'Querying non-existent API returns NotFoundException');

  // Test 10: Verification of No Grafana embedding
  console.log('\n--- Test Group 10: Grafana Architecture Check ---');
  const detailsJson = JSON.stringify(details);
  const containsGrafanaIframeOrUrl = detailsJson.includes('grafana.example.com') || detailsJson.includes('/d-solo/');
  assert(!containsGrafanaIframeOrUrl, 'Details payload contains no Grafana iframes or external dashboard URLs (Grafana is internal)');

  // Clean up
  await prisma.monitorResult.deleteMany({ where: { apiId: apiA.id } });
  await prisma.schemaChange.deleteMany({ where: { schemaId: apiSchema.id } });
  await prisma.schemaVersion.deleteMany({ where: { schemaId: apiSchema.id } });
  await prisma.apiSchema.deleteMany({ where: { apiId: apiA.id } });
  await prisma.incident.deleteMany({ where: { apiId: apiA.id } });
  await prisma.alertRule.deleteMany({ where: { apiId: apiA.id } });
  await prisma.environment.deleteMany({ where: { apiId: apiA.id } });
  await prisma.api.delete({ where: { id: apiA.id } });
  await prisma.organization.deleteMany({ where: { id: { in: [orgAId, orgBId] } } });

  console.log('\n======================================================');
  console.log(`🏁 PHASE 11 RESULTS: ${passedTests} PASSED, ${failedTests} FAILED`);
  console.log('======================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runPhase11Tests()
  .catch((err) => {
    console.error('Fatal error during Phase 11 test suite:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

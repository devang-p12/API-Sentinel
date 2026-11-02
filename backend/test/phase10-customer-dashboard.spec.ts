import { PrismaClient } from '@prisma/client';
import { PrismaService } from '../src/prisma/prisma.service';
import { CustomerDashboardService } from '../src/customer-dashboard/customer-dashboard.service';
import { HealthEvaluationService } from '../src/health-evaluation/health-evaluation.service';
import { ReliabilityScoreService } from '../src/reliability-score/reliability-score.service';
import * as crypto from 'crypto';

const prisma = new PrismaClient();

async function runPhase10Tests() {
  console.log('\n======================================================');
  console.log('🚀 RUNNING PHASE 10: CUSTOMER DASHBOARD TEST SUITE');
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

  // 1. Setup Test Organizations
  const orgAId = crypto.randomUUID();
  const orgBId = crypto.randomUUID();

  await prisma.organization.create({
    data: {
      id: orgAId,
      name: 'Tenant Alpha (Phase 10)',
      slug: `tenant-alpha-p10-${Date.now()}`,
    },
  });

  await prisma.organization.create({
    data: {
      id: orgBId,
      name: 'Tenant Beta (Phase 10)',
      slug: `tenant-beta-p10-${Date.now()}`,
    },
  });

  // Create 2 APIs for Org A
  const apiA1 = await prisma.api.create({
    data: {
      id: crypto.randomUUID(),
      name: 'Checkout Payments Service',
      service: 'payments',
      organizationId: orgAId,
    },
  });

  const envA1 = await prisma.environment.create({
    data: {
      id: crypto.randomUUID(),
      name: 'production',
      baseUrl: 'https://checkout.example.com',
      apiId: apiA1.id,
      organizationId: orgAId,
    },
  });

  const apiA2 = await prisma.api.create({
    data: {
      id: crypto.randomUUID(),
      name: 'Catalog Service',
      service: 'catalog',
      organizationId: orgAId,
    },
  });

  const envA2 = await prisma.environment.create({
    data: {
      id: crypto.randomUUID(),
      name: 'production',
      baseUrl: 'https://catalog.example.com',
      apiId: apiA2.id,
      organizationId: orgAId,
    },
  });

  // Create 1 API for Org B
  const apiB = await prisma.api.create({
    data: {
      id: crypto.randomUUID(),
      name: 'Beta Auth Service',
      service: 'auth',
      organizationId: orgBId,
    },
  });

  // Insert Monitor Results for Api A1 (Healthy: 200 OK, 60ms latency)
  for (let i = 0; i < 5; i++) {
    await prisma.monitorResult.create({
      data: {
        organizationId: orgAId,
        apiId: apiA1.id,
        environmentId: envA1.id,
        timestamp: new Date(Date.now() - i * 60000),
        statusCode: 200,
        latencyMs: 50 + i * 5,
        success: true,
        timeout: false,
      },
    });
  }

  // Insert Monitor Results for Api A2 (Degraded: latency elevated and 1 failure)
  for (let i = 0; i < 5; i++) {
    await prisma.monitorResult.create({
      data: {
        organizationId: orgAId,
        apiId: apiA2.id,
        environmentId: envA2.id,
        timestamp: new Date(Date.now() - i * 60000),
        statusCode: i === 0 ? 500 : 200,
        latencyMs: 380 + i * 10,
        success: i !== 0,
        timeout: false,
      },
    });
  }

  // Create an active incident for Org A
  const incidentA = await prisma.incident.create({
    data: {
      id: crypto.randomUUID(),
      organizationId: orgAId,
      apiId: apiA2.id,
      environmentId: envA2.id,
      title: 'Elevated Latency Incident',
      description: 'Automated test incident',
      status: 'OPEN',
      severity: 'WARNING',
      reason: 'Elevated latency and sporadic 500 errors detected',
      startedAt: new Date(Date.now() - 300000),
    },
  });

  // Create an active alert event for Org A
  const alertRuleA = await prisma.alertRule.create({
    data: {
      id: crypto.randomUUID(),
      organizationId: orgAId,
      name: 'High Latency Alert',
      metric: 'P95 latency',
      threshold: 300,
      operator: '>',
      apiId: apiA2.id,
    },
  });

  await prisma.alertEvent.create({
    data: {
      id: crypto.randomUUID(),
      organizationId: orgAId,
      alertRuleId: alertRuleA.id,
      type: 'FIRING',
      metricValue: 420,
      threshold: 300,
      message: 'P95 latency 420ms exceeds threshold 300ms',
    },
  });

  // Instantiate services
  const prismaService = new PrismaService();
  const healthService = new HealthEvaluationService(prismaService);
  const reliabilityService = new ReliabilityScoreService(prismaService);
  const dashboardService = new CustomerDashboardService(
    prismaService,
    healthService,
    reliabilityService,
  );

  try {
    // =========================================================================
    // Suite 1: Customer Dashboard Summary Generation & Contract
    // =========================================================================
    console.log('\n--- Suite 1: Customer Dashboard Summary Generation & Contract ---');

    const summaryA = await dashboardService.getDashboardSummary(orgAId);

    assert(!!summaryA, 'Generates complete CustomerDashboardSummary object');
    assert(summaryA.organizationId === orgAId, 'Summary scoped to requesting organization');
    assert(!!summaryA.kpis, 'Summary contains top KPIs section');
    assert(!!summaryA.apiHealthTable, 'Summary contains API Health Table section');
    assert(!!summaryA.trends, 'Summary contains Trends section');
    assert(Array.isArray(summaryA.recentIncidents), 'Summary contains recent incidents list');
    assert(Array.isArray(summaryA.recentSchemaChanges), 'Summary contains recent schema changes list');
    assert(Array.isArray(summaryA.activeAlerts), 'Summary contains active alerts list');

    // =========================================================================
    // Suite 2: Top KPIs Calculation
    // =========================================================================
    console.log('\n--- Suite 2: Top KPIs Accuracy ---');

    const kpisA = summaryA.kpis;
    assert(kpisA.totalApis === 2, `Total APIs count matches registered APIs (expected 2, got ${kpisA.totalApis})`);
    assert(kpisA.healthy >= 1, `Healthy APIs count evaluated (got ${kpisA.healthy})`);
    assert(kpisA.activeIncidents === 1, `Active Incidents count matches OPEN/ACKNOWLEDGED incidents (expected 1, got ${kpisA.activeIncidents})`);
    assert(typeof kpisA.averageReliability === 'number' && kpisA.averageReliability > 0, `Average Reliability score calculated (got ${kpisA.averageReliability})`);
    assert(kpisA.healthy + kpisA.degraded + kpisA.down === kpisA.totalApis, 'Sum of healthy + degraded + down equals total APIs');

    // =========================================================================
    // Suite 3: API Health Table Row Fields
    // =========================================================================
    console.log('\n--- Suite 3: API Health Table Row Structure & Metrics ---');

    assert(summaryA.apiHealthTable.length === 2, 'API health table contains rows for both APIs');

    const row1 = summaryA.apiHealthTable.find((r) => r.apiId === apiA1.id);
    assert(!!row1, 'Row for Checkout Payments Service exists');
    assert(row1?.apiName === 'Checkout Payments Service', 'Row contains correct API name');
    assert(row1?.environmentName === 'production', 'Row contains environment name');
    assert(row1?.health === 'HEALTHY', `Evaluates healthy API state as HEALTHY (got ${row1?.health})`);
    assert(typeof row1?.reliability === 'number', 'Row contains numeric reliability score');
    assert(typeof row1?.availability === 'number', 'Row contains numeric availability percentage');
    assert(typeof row1?.p95LatencyMs === 'number', 'Row contains P95 latency in ms');
    assert(typeof row1?.errorRate === 'number', 'Row contains error rate percentage');

    const row2 = summaryA.apiHealthTable.find((r) => r.apiId === apiA2.id);
    assert(!!row2, 'Row for Catalog Service exists');
    assert(row2?.errorRate > 0 || row2?.p95LatencyMs > 300, 'Row reflects elevated error rate or latency');

    // =========================================================================
    // Suite 4: Telemetry Trends (Reliability, Latency, Error Rate)
    // =========================================================================
    console.log('\n--- Suite 4: Telemetry Trend Time-Series ---');

    const trends = summaryA.trends;
    assert(Array.isArray(trends.reliabilityTrend) && trends.reliabilityTrend.length > 0, 'Generates reliability trend time-series points');
    assert(Array.isArray(trends.latencyTrend) && trends.latencyTrend.length > 0, 'Generates latency trend time-series points');
    assert(Array.isArray(trends.errorRateTrend) && trends.errorRateTrend.length > 0, 'Generates error rate trend time-series points');

    assert(typeof trends.reliabilityTrend[0].score === 'number', 'Reliability trend points contain numeric score');
    assert(typeof trends.latencyTrend[0].p95Ms === 'number', 'Latency trend points contain numeric p95Ms');
    assert(typeof trends.errorRateTrend[0].errorRatePct === 'number', 'Error rate trend points contain numeric errorRatePct');

    // =========================================================================
    // Suite 5: Recent Incidents & Active Alerts
    // =========================================================================
    console.log('\n--- Suite 5: Recent Incidents & Active Alerts ---');

    assert(summaryA.recentIncidents.length === 1, 'Includes recent incident');
    assert(summaryA.recentIncidents[0].id === incidentA.id, 'Recent incident ID matches created incident');
    assert(summaryA.recentIncidents[0].status === 'OPEN', 'Recent incident status is OPEN');

    assert(summaryA.activeAlerts.length === 1, 'Includes active firing alert');
    assert(summaryA.activeAlerts[0].alertRuleName === 'High Latency Alert', 'Active alert rule name matches');
    assert(summaryA.activeAlerts[0].metric === 'P95 latency', 'Active alert metric matches');

    // =========================================================================
    // Suite 6: Strict Multi-Tenant Organization Scoping
    // =========================================================================
    console.log('\n--- Suite 6: Multi-Tenant Scoping & Zero Data Leakage ---');

    const summaryB = await dashboardService.getDashboardSummary(orgBId);

    assert(summaryB.kpis.totalApis === 1, `Tenant B has exactly 1 registered API (got ${summaryB.kpis.totalApis})`);
    assert(summaryB.kpis.activeIncidents === 0, `Tenant B has 0 active incidents (Tenant A incidents isolated)`);
    assert(summaryB.apiHealthTable.every((r) => r.apiId === apiB.id), 'Tenant B health table contains only Tenant B APIs');
    assert(summaryB.recentIncidents.length === 0, 'Tenant B sees 0 of Tenant A incidents');
    assert(summaryB.activeAlerts.length === 0, 'Tenant B sees 0 of Tenant A active alerts');

    // =========================================================================
    // Suite 7: Zero Grafana Exposure (Pure Sentinel Dashboard)
    // =========================================================================
    console.log('\n--- Suite 7: Zero Grafana Exposure Verification ---');

    const summaryJson = JSON.stringify(summaryA);
    assert(
      !summaryJson.includes('localhost:3002') &&
        !summaryJson.includes('grafana') &&
        !summaryJson.includes('iframe') &&
        !summaryJson.includes('admin:admin'),
      'Dashboard payload contains NO Grafana iframe URLs, credentials, or internal links',
    );

    // =========================================================================
    // Cleanup Test Data
    // =========================================================================
    await prisma.alertEvent.deleteMany({ where: { organizationId: { in: [orgAId, orgBId] } } });
    await prisma.alertRule.deleteMany({ where: { organizationId: { in: [orgAId, orgBId] } } });
    await prisma.incident.deleteMany({ where: { organizationId: { in: [orgAId, orgBId] } } });
    await prisma.monitorResult.deleteMany({ where: { organizationId: { in: [orgAId, orgBId] } } });
    await prisma.environment.deleteMany({ where: { organizationId: { in: [orgAId, orgBId] } } });
    await prisma.api.deleteMany({ where: { organizationId: { in: [orgAId, orgBId] } } });
    await prisma.organization.deleteMany({ where: { id: { in: [orgAId, orgBId] } } });
  } catch (error) {
    console.error('Fatal test error:', error);
    failedTests++;
  } finally {
    await prisma.$disconnect();
  }

  console.log('\n======================================================');
  console.log('📊 PHASE 10 TEST RESULTS SUMMARY');
  console.log('======================================================');
  console.log(`Total Tests:  ${passedTests + failedTests}`);
  console.log(`Passed:       ${passedTests} ✅`);
  console.log(`Failed:       ${failedTests} ❌`);
  const successRate = ((passedTests / (passedTests + failedTests)) * 100).toFixed(1);
  console.log(`Success Rate: ${successRate}%`);

  if (failedTests === 0) {
    console.log('\n✨ ALL PHASE 10 CUSTOMER DASHBOARD TESTS PASSED CLEANLY!\n');
    process.exit(0);
  } else {
    console.error(`\n⚠️  ${failedTests} TEST(S) FAILED.\n`);
    process.exit(1);
  }
}

runPhase10Tests();

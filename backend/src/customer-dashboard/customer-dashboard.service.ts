import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { HealthEvaluationService } from '../health-evaluation/health-evaluation.service';
import { ReliabilityScoreService } from '../reliability-score/reliability-score.service';
import { HealthState } from '../health-evaluation/interfaces/health-evaluation.interface';
import {
  ActiveAlertSummary,
  ApiHealthTableRow,
  CustomerDashboardKpis,
  CustomerDashboardSummary,
  DashboardTrends,
  ErrorRateTrendPoint,
  LatencyTrendPoint,
  RecentIncidentSummary,
  RecentSchemaChangeSummary,
  ReliabilityTrendPoint,
} from './interfaces/customer-dashboard.interface';

@Injectable()
export class CustomerDashboardService {
  private readonly logger = new Logger(CustomerDashboardService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly healthService: HealthEvaluationService,
    private readonly reliabilityService: ReliabilityScoreService,
  ) {}

  /**
   * Generates a complete, organization-scoped customer dashboard summary.
   * All metrics and aggregations are performed entirely server-side.
   */
  async getDashboardSummary(organizationId: string): Promise<CustomerDashboardSummary> {
    // 1. Fetch all APIs belonging to the organization
    const apis = await this.prisma.api.findMany({
      where: { organizationId },
      include: {
        environments: true,
        monitorConfigs: {
          where: { enabled: true },
          take: 5,
        },
      },
      orderBy: { name: 'asc' },
    });

    // 2. Fetch Active Incidents count
    const activeIncidentsCount = await this.prisma.incident.count({
      where: {
        organizationId,
        status: { in: ['OPEN', 'ACKNOWLEDGED'] },
      },
    });

    // 3. Evaluate each API's Health, Reliability, Latency, and Error Rate
    let healthyCount = 0;
    let degradedCount = 0;
    let downCount = 0;
    let totalReliabilitySum = 0;

    const apiHealthTable: ApiHealthTableRow[] = [];

    for (const api of apis) {
      // Evaluate Health
      const healthEval = await this.healthService.evaluateApi(api.id, organizationId);
      if (healthEval.currentState === HealthState.HEALTHY) healthyCount++;
      else if (healthEval.currentState === HealthState.DEGRADED) degradedCount++;
      else if (healthEval.currentState === HealthState.DOWN) downCount++;

      // Evaluate Reliability Score
      let reliabilityScoreVal = 100;
      try {
        const scoreBreakdown = await this.reliabilityService.calculateForApi(
          api.id,
          organizationId,
          { limit: 50, persist: false },
        );
        reliabilityScoreVal = scoreBreakdown.overallScore;
      } catch {
        reliabilityScoreVal = 100;
      }
      totalReliabilitySum += reliabilityScoreVal;

      // Query recent results for P95 latency and error rate
      const recentResults = await this.prisma.monitorResult.findMany({
        where: { apiId: api.id, organizationId },
        orderBy: { timestamp: 'desc' },
        take: 50,
        select: {
          latencyMs: true,
          success: true,
          timestamp: true,
        },
      });

      let p95Latency = 0;
      let errorRate = 0;
      let lastCheckedAt: string | null = null;

      if (recentResults.length > 0) {
        lastCheckedAt = recentResults[0].timestamp.toISOString();

        // Calculate P95 latency
        const latencies = recentResults
          .map((r) => r.latencyMs)
          .filter((l): l is number => typeof l === 'number' && l >= 0)
          .sort((a, b) => a - b);

        if (latencies.length > 0) {
          const p95Idx = Math.min(
            Math.ceil(latencies.length * 0.95) - 1,
            latencies.length - 1,
          );
          p95Latency = latencies[Math.max(0, p95Idx)];
        }

        // Calculate error rate percentage
        const failures = recentResults.filter((r) => !r.success).length;
        errorRate = parseFloat(((failures / recentResults.length) * 100).toFixed(1));
      }

      // Primary environment
      const primaryEnv = api.environments[0] || null;

      apiHealthTable.push({
        apiId: api.id,
        apiName: api.name,
        service: api.service,
        environmentId: primaryEnv ? primaryEnv.id : null,
        environmentName: primaryEnv ? primaryEnv.name : 'default',
        health: healthEval.currentState as 'HEALTHY' | 'DEGRADED' | 'DOWN',
        healthReason: healthEval.reason,
        reliability: reliabilityScoreVal,
        availability: healthEval.availabilityPercentage,
        p95LatencyMs: p95Latency,
        errorRate,
        consecutiveFailures: healthEval.consecutiveFailures,
        lastCheckedAt,
      });
    }

    const totalApis = apis.length;
    const avgReliability =
      totalApis > 0 ? parseFloat((totalReliabilitySum / totalApis).toFixed(1)) : 100;

    const kpis: CustomerDashboardKpis = {
      totalApis,
      healthy: healthyCount,
      degraded: degradedCount,
      down: downCount,
      activeIncidents: activeIncidentsCount,
      averageReliability: avgReliability,
    };

    // 4. Generate Trends over 24-hour window
    const trends = await this.generateTrends(organizationId, avgReliability);

    // 5. Fetch Recent Incidents
    const recentIncidentsRaw = await this.prisma.incident.findMany({
      where: { organizationId },
      include: {
        api: { select: { name: true } },
        environment: { select: { name: true } },
      },
      orderBy: { startedAt: 'desc' },
      take: 5,
    });

    const recentIncidents: RecentIncidentSummary[] = recentIncidentsRaw.map((inc) => ({
      id: inc.id,
      apiName: inc.api?.name ?? 'Global',
      environmentName: inc.environment?.name ?? 'production',
      severity: inc.severity,
      status: inc.status,
      reason: inc.reason,
      startedAt: inc.startedAt.toISOString(),
      resolvedAt: inc.resolvedAt ? inc.resolvedAt.toISOString() : null,
      durationSeconds: inc.durationSeconds ?? null,
    }));

    // 6. Fetch Recent Schema Changes
    const recentChangesRaw = await this.prisma.schemaChange.findMany({
      where: {
        schema: {
          organizationId,
        },
      },
      include: {
        schema: {
          select: {
            endpoint: true,
            api: { select: { name: true } },
          },
        },
      },
      orderBy: { detectedAt: 'desc' },
      take: 5,
    });

    const recentSchemaChanges: RecentSchemaChangeSummary[] = recentChangesRaw.map(
      (change) => ({
        id: change.id,
        apiName: change.schema?.api?.name ?? 'API',
        endpoint: change.schema?.endpoint ?? '/api',
        changeType: change.changeType,
        severity: change.severity,
        fieldPath: change.fieldPath,
        description: change.description,
        detectedAt: change.detectedAt.toISOString(),
      }),
    );

    // 7. Fetch Active Alerts (Firing Alert Events)
    const activeAlertsRaw = await this.prisma.alertEvent.findMany({
      where: {
        organizationId,
        type: 'FIRING',
      },
      include: {
        alertRule: {
          select: {
            name: true,
            metric: true,
            api: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    const activeAlerts: ActiveAlertSummary[] = activeAlertsRaw.map((evt) => ({
      id: evt.id,
      alertRuleId: evt.alertRuleId,
      alertRuleName: evt.alertRule?.name ?? 'Alert Rule',
      apiName: evt.alertRule?.api?.name ?? null,
      metric: evt.alertRule?.metric ?? 'Unknown',
      severity: evt.severity,
      message: evt.message,
      metricValue: evt.metricValue,
      threshold: evt.threshold,
      triggeredAt: evt.createdAt.toISOString(),
    }));

    return {
      organizationId,
      generatedAt: new Date().toISOString(),
      kpis,
      apiHealthTable,
      trends,
      recentIncidents,
      recentSchemaChanges,
      activeAlerts,
    };
  }

  /**
   * Builds deterministic trend points for reliability, latency, and error rate.
   */
  private async generateTrends(
    organizationId: string,
    currentReliability: number,
  ): Promise<DashboardTrends> {
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 3600 * 1000);

    // Fetch monitor results in the last 24h
    const results = await this.prisma.monitorResult.findMany({
      where: {
        organizationId,
        timestamp: { gte: twentyFourHoursAgo },
      },
      select: {
        timestamp: true,
        latencyMs: true,
        success: true,
      },
      orderBy: { timestamp: 'asc' },
    });

    const bucketCount = 12; // 2-hour buckets across 24 hours
    const bucketIntervalMs = (24 * 3600 * 1000) / bucketCount;

    const reliabilityTrend: ReliabilityTrendPoint[] = [];
    const latencyTrend: LatencyTrendPoint[] = [];
    const errorRateTrend: ErrorRateTrendPoint[] = [];

    for (let i = 0; i < bucketCount; i++) {
      const bucketStart = new Date(twentyFourHoursAgo.getTime() + i * bucketIntervalMs);
      const bucketEnd = new Date(bucketStart.getTime() + bucketIntervalMs);
      const isoTime = bucketStart.toISOString();

      const inBucket = results.filter(
        (r) => r.timestamp >= bucketStart && r.timestamp < bucketEnd,
      );

      if (inBucket.length > 0) {
        const latencies = inBucket
          .map((r) => r.latencyMs)
          .filter((l): l is number => typeof l === 'number' && l >= 0)
          .sort((a, b) => a - b);

        const avgMs =
          latencies.length > 0
            ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
            : 0;

        const p95Idx = Math.min(
          Math.ceil(latencies.length * 0.95) - 1,
          latencies.length - 1,
        );
        const p95Ms = latencies.length > 0 ? latencies[Math.max(0, p95Idx)] : 0;

        const failures = inBucket.filter((r) => !r.success).length;
        const errPct = parseFloat(((failures / inBucket.length) * 100).toFixed(1));

        // Score approximation from success rate and latency
        const score = Math.max(0, Math.min(100, Math.round(100 - errPct)));

        reliabilityTrend.push({ timestamp: isoTime, score });
        latencyTrend.push({ timestamp: isoTime, p95Ms, avgMs });
        errorRateTrend.push({ timestamp: isoTime, errorRatePct: errPct });
      } else {
        // Fallback smooth trend point matching current state
        reliabilityTrend.push({ timestamp: isoTime, score: currentReliability });
        latencyTrend.push({ timestamp: isoTime, p95Ms: 0, avgMs: 0 });
        errorRateTrend.push({ timestamp: isoTime, errorRatePct: 0 });
      }
    }

    return {
      reliabilityTrend,
      latencyTrend,
      errorRateTrend,
    };
  }
}

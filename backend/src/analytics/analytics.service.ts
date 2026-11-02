import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface LatencyPercentiles {
  p50: number;
  p90: number;
  p95: number;
  p99: number;
}

export interface TimeBucket {
  timestamp: string;
  totalChecks: number;
  successChecks: number;
  failedChecks: number;
  avgResponseTimeMs: number;
  availabilityPct: number;
}

export interface MonitorAnalyticsSummary {
  monitorId: string;
  monitorName: string;
  timeRange: {
    from: Date;
    to: Date;
  };
  totalChecks: number;
  successChecks: number;
  failedChecks: number;
  timeoutChecks: number;
  availabilityPct: number;
  latency: {
    avgMs: number;
    minMs: number;
    maxMs: number;
    percentiles: LatencyPercentiles;
  };
  timeSeries: TimeBucket[];
}

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getMonitorAnalytics(
    monitorId: string,
    from?: Date,
    to?: Date,
    bucketMinutes: number = 60,
    organizationId?: string,
  ): Promise<MonitorAnalyticsSummary> {
    const monitor = await this.prisma.monitor.findFirst({
      where: {
        id: monitorId,
        ...(organizationId ? { organizationId } : {}),
      },
    });

    if (!monitor) {
      throw new NotFoundException(`Monitor with ID ${monitorId} not found`);
    }

    const toDate = to || new Date();
    const fromDate = from || new Date(toDate.getTime() - 24 * 60 * 60 * 1000); // default last 24h

    // Fetch executions in range
    const executions = await this.prisma.monitorExecution.findMany({
      where: {
        monitorId,
        executedAt: {
          gte: fromDate,
          lte: toDate,
        },
      },
      orderBy: { executedAt: 'asc' },
    });

    const totalChecks = executions.length;
    let successChecks = 0;
    let failedChecks = 0;
    let timeoutChecks = 0;
    const responseTimes: number[] = [];

    // Bucket aggregation map
    const bucketIntervalMs = bucketMinutes * 60 * 1000;
    const bucketsMap = new Map<number, { total: number; success: number; failed: number; responseTimes: number[] }>();

    for (const exec of executions) {
      if (exec.status === 'SUCCESS') successChecks++;
      else if (exec.status === 'FAILED') failedChecks++;
      else if (exec.status === 'TIMEOUT') timeoutChecks++;

      responseTimes.push(exec.responseTimeMs);

      // Map to bucket floor timestamp
      const execTime = new Date(exec.executedAt).getTime();
      const bucketKey = Math.floor(execTime / bucketIntervalMs) * bucketIntervalMs;

      let bucket = bucketsMap.get(bucketKey);
      if (!bucket) {
        bucket = { total: 0, success: 0, failed: 0, responseTimes: [] };
        bucketsMap.set(bucketKey, bucket);
      }

      bucket.total++;
      if (exec.status === 'SUCCESS') bucket.success++;
      else bucket.failed++;
      bucket.responseTimes.push(exec.responseTimeMs);
    }

    // Sort response times for percentiles
    responseTimes.sort((a, b) => a - b);

    const minMs = responseTimes.length > 0 ? responseTimes[0] : 0;
    const maxMs = responseTimes.length > 0 ? responseTimes[responseTimes.length - 1] : 0;
    const avgMs =
      responseTimes.length > 0
        ? Math.round(responseTimes.reduce((acc, v) => acc + v, 0) / responseTimes.length)
        : 0;

    const percentiles: LatencyPercentiles = {
      p50: this.calculatePercentile(responseTimes, 50),
      p90: this.calculatePercentile(responseTimes, 90),
      p95: this.calculatePercentile(responseTimes, 95),
      p99: this.calculatePercentile(responseTimes, 99),
    };

    const availabilityPct =
      totalChecks > 0 ? Number(((successChecks / totalChecks) * 100).toFixed(2)) : 100;

    // Build timeline series
    const timeSeries: TimeBucket[] = Array.from(bucketsMap.entries())
      .sort(([a], [b]) => a - b)
      .map(([timestampMs, b]) => {
        const avg =
          b.responseTimes.length > 0
            ? Math.round(b.responseTimes.reduce((acc, v) => acc + v, 0) / b.responseTimes.length)
            : 0;
        const avail = b.total > 0 ? Number(((b.success / b.total) * 100).toFixed(2)) : 100;

        return {
          timestamp: new Date(timestampMs).toISOString(),
          totalChecks: b.total,
          successChecks: b.success,
          failedChecks: b.failed,
          avgResponseTimeMs: avg,
          availabilityPct: avail,
        };
      });

    return {
      monitorId: monitor.id,
      monitorName: monitor.name,
      timeRange: {
        from: fromDate,
        to: toDate,
      },
      totalChecks,
      successChecks,
      failedChecks,
      timeoutChecks,
      availabilityPct,
      latency: {
        avgMs,
        minMs,
        maxMs,
        percentiles,
      },
      timeSeries,
    };
  }

  async getApiAnalytics(apiId: string, organizationId?: string) {
    const api = await this.prisma.api.findFirst({
      where: {
        id: apiId,
        ...(organizationId ? { organizationId } : {}),
      },
      include: {
        environments: {
          include: {
            monitors: true,
          },
        },
      },
    });

    if (!api) {
      throw new NotFoundException(`API with ID ${apiId} not found`);
    }

    const environmentReports = [];

    for (const env of api.environments) {
      const monitorSummaries = [];
      let envTotalChecks = 0;
      let envSuccessChecks = 0;

      for (const mon of env.monitors) {
        const summary = await this.getMonitorAnalytics(mon.id, undefined, undefined, 60, organizationId);
        monitorSummaries.push(summary);
        envTotalChecks += summary.totalChecks;
        envSuccessChecks += summary.successChecks;
      }

      const envAvailability =
        envTotalChecks > 0 ? Number(((envSuccessChecks / envTotalChecks) * 100).toFixed(2)) : 100;

      environmentReports.push({
        environmentId: env.id,
        environmentName: env.name,
        baseUrl: env.baseUrl,
        totalMonitors: env.monitors.length,
        totalChecks: envTotalChecks,
        availabilityPct: envAvailability,
        monitors: monitorSummaries,
      });
    }

    return {
      apiId: api.id,
      apiName: api.name,
      environments: environmentReports,
    };
  }

  private calculatePercentile(sorted: number[], p: number): number {
    if (sorted.length === 0) return 0;
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, Math.min(index, sorted.length - 1))];
  }
}

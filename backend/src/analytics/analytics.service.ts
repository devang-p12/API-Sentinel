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
  ): Promise<MonitorAnalyticsSummary> {
    const monitor = await this.prisma.monitor.findUnique({
      where: { id: monitorId },
    });

    if (!monitor) {
      throw new NotFoundException(`Monitor with ID ${monitorId} not found`);
    }

    const toDate = to || new Date();
    const fromDate = from || new Date(toDate.getTime() - 24 * 60 * 60 * 1000); // default last 24h

    // Retrieve executions using composite index: (monitor_id, executed_at DESC)
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
    if (totalChecks === 0) {
      return {
        monitorId,
        monitorName: monitor.name,
        timeRange: { from: fromDate, to: toDate },
        totalChecks: 0,
        successChecks: 0,
        failedChecks: 0,
        timeoutChecks: 0,
        availabilityPct: 100,
        latency: {
          avgMs: 0,
          minMs: 0,
          maxMs: 0,
          percentiles: { p50: 0, p90: 0, p95: 0, p99: 0 },
        },
        timeSeries: [],
      };
    }

    let successChecks = 0;
    let failedChecks = 0;
    let timeoutChecks = 0;
    const latencies: number[] = [];

    for (const exec of executions) {
      if (exec.status === 'SUCCESS') {
        successChecks++;
      } else if (exec.status === 'TIMEOUT') {
        timeoutChecks++;
      } else {
        failedChecks++;
      }

      if (exec.responseTimeMs !== null && exec.responseTimeMs !== undefined) {
        latencies.push(exec.responseTimeMs);
      }
    }

    const availabilityPct = Number(((successChecks / totalChecks) * 100).toFixed(2));

    // Latency statistics
    latencies.sort((a, b) => a - b);
    const sumLatency = latencies.reduce((sum, val) => sum + val, 0);
    const avgMs = latencies.length > 0 ? Math.round(sumLatency / latencies.length) : 0;
    const minMs = latencies.length > 0 ? latencies[0] : 0;
    const maxMs = latencies.length > 0 ? latencies[latencies.length - 1] : 0;

    const percentiles: LatencyPercentiles = {
      p50: this.calculatePercentile(latencies, 50),
      p90: this.calculatePercentile(latencies, 90),
      p95: this.calculatePercentile(latencies, 95),
      p99: this.calculatePercentile(latencies, 99),
    };

    // Calculate time buckets for chart rendering
    const bucketMs = bucketMinutes * 60 * 1000;
    const bucketsMap = new Map<number, { total: number; success: number; failed: number; latencySum: number }>();

    for (const exec of executions) {
      const bucketTime = Math.floor(exec.executedAt.getTime() / bucketMs) * bucketMs;
      const current = bucketsMap.get(bucketTime) || { total: 0, success: 0, failed: 0, latencySum: 0 };
      current.total++;
      if (exec.status === 'SUCCESS') current.success++;
      else current.failed++;
      current.latencySum += exec.responseTimeMs;
      bucketsMap.set(bucketTime, current);
    }

    const timeSeries: TimeBucket[] = [];
    for (const [timestampMs, data] of bucketsMap.entries()) {
      timeSeries.push({
        timestamp: new Date(timestampMs).toISOString(),
        totalChecks: data.total,
        successChecks: data.success,
        failedChecks: data.failed,
        avgResponseTimeMs: Math.round(data.latencySum / data.total),
        availabilityPct: Number(((data.success / data.total) * 100).toFixed(2)),
      });
    }

    return {
      monitorId,
      monitorName: monitor.name,
      timeRange: { from: fromDate, to: toDate },
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

  async getApiAnalytics(apiId: string) {
    const api = await this.prisma.api.findUnique({
      where: { id: apiId },
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
        const summary = await this.getMonitorAnalytics(mon.id);
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

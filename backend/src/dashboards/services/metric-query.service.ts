import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { getMetricDefinition, MetricDefinition } from '../metric-registry';

export interface MetricQueryFilters {
  projectId?: string;
  apiId?: string;
  environmentId?: string;
  monitorId?: string;
}

export interface MetricQueryOptions {
  metric: string;
  filters?: MetricQueryFilters;
  from?: Date;
  to?: Date;
  bucketMinutes?: number;
}

export interface TimeSeriesPoint {
  timestamp: string;
  value: number;
  label?: string;
}

export interface DistributionItem {
  category: string;
  count: number;
  percentage: number;
}

export interface MetricQueryResult {
  metric: string;
  metricName: string;
  unit: string;
  timeRange: {
    from: string;
    to: string;
  };
  summary: {
    current: number | null;
    min?: number;
    max?: number;
    avg?: number;
    total?: number;
    label?: string;
  };
  timeSeries: TimeSeriesPoint[];
  distribution?: DistributionItem[];
  table?: {
    columns: string[];
    rows: Array<Record<string, any>>;
  };
}

@Injectable()
export class MetricQueryService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Main metric query resolver.
   * Isolates dashboard widgets from direct database execution queries.
   * Future Prometheus integration plugs into this interface.
   */
  async query(options: MetricQueryOptions): Promise<MetricQueryResult> {
    const metricDef = getMetricDefinition(options.metric);
    if (!metricDef) {
      throw new NotFoundException(`Unknown metric: ${options.metric}`);
    }

    const to = options.to || new Date();
    const from = options.from || new Date(to.getTime() - 24 * 60 * 60 * 1000); // default last 24h

    // 1. Resolve Target Monitors based on scoped filters
    const targetMonitors = await this.resolveTargetMonitors(options.filters);
    const monitorIds = targetMonitors.map((m) => m.id);

    // If no monitors matched the filter criteria, return clean empty result
    if (monitorIds.length === 0) {
      return this.buildEmptyResult(metricDef, from, to);
    }

    // 2. Query executions across the target monitors in the time window
    const executions = await this.prisma.monitorExecution.findMany({
      where: {
        monitorId: { in: monitorIds },
        executedAt: {
          gte: from,
          lte: to,
        },
      },
      orderBy: { executedAt: 'asc' },
    });

    if (executions.length === 0) {
      return this.buildEmptyResult(metricDef, from, to);
    }

    // 3. Compute aggregate statistics
    let successCount = 0;
    let failedCount = 0;
    let timeoutCount = 0;
    let errorCount = 0;
    const latencies: number[] = [];
    const sizes: number[] = [];
    const statusCounts: Record<string, number> = {};

    for (const exec of executions) {
      if (exec.status === 'SUCCESS') {
        successCount++;
      } else if (exec.status === 'TIMEOUT') {
        timeoutCount++;
      } else if (exec.status === 'ERROR') {
        errorCount++;
      } else {
        failedCount++;
      }

      if (exec.responseTimeMs !== null && exec.responseTimeMs !== undefined) {
        latencies.push(exec.responseTimeMs);
      }

      if (exec.responseSize !== null && exec.responseSize !== undefined) {
        sizes.push(exec.responseSize);
      }

      const statusKey =
        exec.status === 'TIMEOUT'
          ? 'TIMEOUT'
          : exec.status === 'ERROR'
          ? 'ERROR'
          : exec.statusCode
          ? `${exec.statusCode}`
          : 'UNKNOWN';

      statusCounts[statusKey] = (statusCounts[statusKey] || 0) + 1;
    }

    latencies.sort((a, b) => a - b);
    const totalExecutions = executions.length;

    // Latency Percentiles
    const p50 = this.calculatePercentile(latencies, 50);
    const p90 = this.calculatePercentile(latencies, 90);
    const p95 = this.calculatePercentile(latencies, 95);
    const p99 = this.calculatePercentile(latencies, 99);
    const minLatency = latencies.length > 0 ? latencies[0] : 0;
    const maxLatency = latencies.length > 0 ? latencies[latencies.length - 1] : 0;
    const sumLatency = latencies.reduce((sum, v) => sum + v, 0);
    const avgLatency = latencies.length > 0 ? Math.round(sumLatency / latencies.length) : 0;

    // Reliability Calculations
    const availabilityPct = Number(((successCount / totalExecutions) * 100).toFixed(2));
    const successRatePct = availabilityPct;
    const errorRatePct = Number((((failedCount + timeoutCount + errorCount) / totalExecutions) * 100).toFixed(2));

    const avgSize = sizes.length > 0 ? Math.round(sizes.reduce((a, b) => a + b, 0) / sizes.length) : 0;

    // Determine current value for requested metric
    let currentValue: number | null = null;
    switch (metricDef.id) {
      case 'availability':
        currentValue = availabilityPct;
        break;
      case 'success_rate':
        currentValue = successRatePct;
        break;
      case 'error_rate':
        currentValue = errorRatePct;
        break;
      case 'average_latency':
        currentValue = avgLatency;
        break;
      case 'p50_latency':
        currentValue = p50;
        break;
      case 'p90_latency':
        currentValue = p90;
        break;
      case 'p95_latency':
        currentValue = p95;
        break;
      case 'p99_latency':
        currentValue = p99;
        break;
      case 'min_latency':
        currentValue = minLatency;
        break;
      case 'max_latency':
        currentValue = maxLatency;
        break;
      case 'request_count':
        currentValue = totalExecutions;
        break;
      case 'response_size':
        currentValue = avgSize;
        break;
      case 'failure_count':
        currentValue = failedCount;
        break;
      case 'timeout_count':
        currentValue = timeoutCount;
        break;
      case 'http_status_distribution':
        currentValue = totalExecutions;
        break;
      default:
        currentValue = avgLatency;
    }

    // 4. Time Series Generation with Dynamic Bucketization
    const bucketDurationMs = this.resolveBucketDurationMs(from, to, options.bucketMinutes);
    const bucketMap = new Map<number, { total: number; success: number; failed: number; latencies: number[]; sizeSum: number }>();

    for (const exec of executions) {
      const bTime = Math.floor(exec.executedAt.getTime() / bucketDurationMs) * bucketDurationMs;
      const b = bucketMap.get(bTime) || { total: 0, success: 0, failed: 0, latencies: [], sizeSum: 0 };
      b.total++;
      if (exec.status === 'SUCCESS') {
        b.success++;
      } else {
        b.failed++;
      }
      if (exec.responseTimeMs !== null && exec.responseTimeMs !== undefined) {
        b.latencies.push(exec.responseTimeMs);
      }
      if (exec.responseSize) {
        b.sizeSum += exec.responseSize;
      }
      bucketMap.set(bTime, b);
    }

    const timeSeries: TimeSeriesPoint[] = [];
    const sortedBucketTimes = Array.from(bucketMap.keys()).sort((a, b) => a - b);

    for (const bTime of sortedBucketTimes) {
      const b = bucketMap.get(bTime)!;
      let val = 0;
      b.latencies.sort((a, b) => a - b);

      switch (metricDef.id) {
        case 'availability':
        case 'success_rate':
          val = Number(((b.success / b.total) * 100).toFixed(2));
          break;
        case 'error_rate':
          val = Number(((b.failed / b.total) * 100).toFixed(2));
          break;
        case 'average_latency':
          val = b.latencies.length > 0 ? Math.round(b.latencies.reduce((x, y) => x + y, 0) / b.latencies.length) : 0;
          break;
        case 'p50_latency':
          val = this.calculatePercentile(b.latencies, 50);
          break;
        case 'p90_latency':
          val = this.calculatePercentile(b.latencies, 90);
          break;
        case 'p95_latency':
          val = this.calculatePercentile(b.latencies, 95);
          break;
        case 'p99_latency':
          val = this.calculatePercentile(b.latencies, 99);
          break;
        case 'min_latency':
          val = b.latencies.length > 0 ? b.latencies[0] : 0;
          break;
        case 'max_latency':
          val = b.latencies.length > 0 ? b.latencies[b.latencies.length - 1] : 0;
          break;
        case 'request_count':
          val = b.total;
          break;
        case 'failure_count':
        case 'timeout_count':
          val = b.failed;
          break;
        case 'response_size':
          val = b.total > 0 ? Math.round(b.sizeSum / b.total) : 0;
          break;
        default:
          val = b.latencies.length > 0 ? Math.round(b.latencies.reduce((x, y) => x + y, 0) / b.latencies.length) : 0;
      }

      timeSeries.push({
        timestamp: new Date(bTime).toISOString(),
        value: val,
      });
    }

    // 5. Distribution Generation (for bar/pie charts)
    const distribution: DistributionItem[] = Object.entries(statusCounts)
      .map(([cat, count]) => ({
        category: cat,
        count,
        percentage: Number(((count / totalExecutions) * 100).toFixed(1)),
      }))
      .sort((a, b) => b.count - a.count);

    // 6. Tabular breakdown by Monitor
    const monitorExecsMap = new Map<string, { total: number; success: number; latencies: number[] }>();
    for (const exec of executions) {
      const item = monitorExecsMap.get(exec.monitorId) || { total: 0, success: 0, latencies: [] };
      item.total++;
      if (exec.status === 'SUCCESS') item.success++;
      if (exec.responseTimeMs !== null) item.latencies.push(exec.responseTimeMs);
      monitorExecsMap.set(exec.monitorId, item);
    }

    const tableRows = targetMonitors
      .filter((m) => monitorExecsMap.has(m.id))
      .map((m) => {
        const stats = monitorExecsMap.get(m.id)!;
        stats.latencies.sort((a, b) => a - b);
        const monP95 = this.calculatePercentile(stats.latencies, 95);
        const monAvg = stats.latencies.length > 0 ? Math.round(stats.latencies.reduce((a, b) => a + b, 0) / stats.latencies.length) : 0;
        const monAvail = Number(((stats.success / stats.total) * 100).toFixed(2));
        return {
          monitorId: m.id,
          monitorName: m.name,
          url: m.url,
          totalChecks: stats.total,
          availability: `${monAvail}%`,
          avgLatency: `${monAvg}ms`,
          p95Latency: `${monP95}ms`,
          status: monAvail >= 99 ? 'HEALTHY' : monAvail >= 90 ? 'DEGRADED' : 'CRITICAL',
        };
      });

    return {
      metric: metricDef.id,
      metricName: metricDef.name,
      unit: metricDef.unit,
      timeRange: {
        from: from.toISOString(),
        to: to.toISOString(),
      },
      summary: {
        current: currentValue,
        min: minLatency,
        max: maxLatency,
        avg: avgLatency,
        total: totalExecutions,
        label: `${currentValue}${metricDef.unit === '%' ? '%' : metricDef.unit === 'ms' ? ' ms' : ''}`,
      },
      timeSeries,
      distribution,
      table: {
        columns: ['Monitor', 'URL', 'Checks', 'Availability', 'Avg Latency', 'P95 Latency', 'Status'],
        rows: tableRows,
      },
    };
  }

  /**
   * Resolves target monitors based on filter scope (Monitor, Environment, API, or Project).
   */
  private async resolveTargetMonitors(filters?: MetricQueryFilters) {
    if (filters?.monitorId) {
      const mon = await this.prisma.monitor.findUnique({
        where: { id: filters.monitorId },
      });
      return mon ? [mon] : [];
    }

    if (filters?.environmentId) {
      return this.prisma.monitor.findMany({
        where: { environmentId: filters.environmentId },
      });
    }

    if (filters?.apiId) {
      return this.prisma.monitor.findMany({
        where: {
          environment: {
            apiId: filters.apiId,
          },
        },
      });
    }

    if (filters?.projectId) {
      return this.prisma.monitor.findMany({
        where: {
          environment: {
            api: {
              projectId: filters.projectId,
            },
          },
        },
      });
    }

    // Default: all monitors in database
    return this.prisma.monitor.findMany();
  }

  private resolveBucketDurationMs(from: Date, to: Date, explicitBucketMinutes?: number): number {
    if (explicitBucketMinutes && explicitBucketMinutes > 0) {
      return explicitBucketMinutes * 60 * 1000;
    }
    const diffMs = to.getTime() - from.getTime();
    const oneHour = 60 * 60 * 1000;
    const sixHours = 6 * oneHour;
    const oneDay = 24 * oneHour;
    const sevenDays = 7 * oneDay;

    if (diffMs <= oneHour) {
      return 1 * 60 * 1000; // 1-minute buckets
    }
    if (diffMs <= sixHours) {
      return 5 * 60 * 1000; // 5-minute buckets
    }
    if (diffMs <= oneDay) {
      return 30 * 60 * 1000; // 30-minute buckets
    }
    if (diffMs <= sevenDays) {
      return 3 * oneHour; // 3-hour buckets
    }
    return oneDay; // 1-day buckets
  }

  private calculatePercentile(sorted: number[], p: number): number {
    if (sorted.length === 0) return 0;
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, Math.min(index, sorted.length - 1))];
  }

  private buildEmptyResult(metricDef: MetricDefinition, from: Date, to: Date): MetricQueryResult {
    return {
      metric: metricDef.id,
      metricName: metricDef.name,
      unit: metricDef.unit,
      timeRange: {
        from: from.toISOString(),
        to: to.toISOString(),
      },
      summary: {
        current: null,
        min: 0,
        max: 0,
        avg: 0,
        total: 0,
        label: 'No Data',
      },
      timeSeries: [],
      distribution: [],
      table: {
        columns: ['Monitor', 'URL', 'Checks', 'Availability', 'Avg Latency', 'P95 Latency', 'Status'],
        rows: [],
      },
    };
  }
}

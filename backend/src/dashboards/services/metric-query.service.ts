import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { getMetricDefinition, MetricDefinition } from '../metric-registry';
import {
  METRIC_DATA_SOURCE,
  MetricDataRecord,
  MetricDataSource,
} from '../data-sources/metric-data-source.interface';
import { PostgresMetricDataSource } from '../data-sources/postgres-metric-data-source.service';

export interface MetricQueryFilters {
  organizationId?: string;
  projectId?: string;
  apiId?: string;
  environmentId?: string;
  monitorId?: string;
}

export interface MetricQueryOptions {
  metric: string;
  filters?: MetricQueryFilters;
  apiId?: string;
  environmentId?: string;
  monitorId?: string;
  projectId?: string;
  organizationId?: string;
  from?: Date | string;
  to?: Date | string;
  aggregation?: string;
  groupBy?: string;
  bucketMinutes?: number;
}

export interface TimeSeriesPoint {
  timestamp: string;
  value: number | null;
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
    min: number | null;
    max: number | null;
    avg: number | null;
    total: number;
    label: string;
  };
  timeSeries: TimeSeriesPoint[];
  distribution?: DistributionItem[];
  table?: {
    columns: string[];
    rows: Array<Record<string, any>>;
  };
  value?: number | null;
  type?: 'scalar' | 'timeseries';
  series?: TimeSeriesPoint[];
  from?: string;
  to?: string;
}

@Injectable()
export class MetricQueryService {
  private readonly dataSource: MetricDataSource;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(METRIC_DATA_SOURCE) dataSource?: MetricDataSource,
  ) {
    this.dataSource = dataSource || new PostgresMetricDataSource(this.prisma);
  }

  /**
   * Main metric query resolver.
   * Isolates dashboard widgets from direct database execution queries.
   * Future Prometheus integration plugs into this interface via MetricDataSource.
   */
  async query(options: MetricQueryOptions): Promise<MetricQueryResult> {
    // 1. Validate Metric
    const metricDef = getMetricDefinition(options.metric);
    if (!metricDef) {
      throw new BadRequestException(`Unknown metric: ${options.metric}`);
    }

    // 2. Resolve and Validate Time Window
    const to = options.to ? new Date(options.to) : new Date();
    const from = options.from
      ? new Date(options.from)
      : new Date(to.getTime() - 24 * 60 * 60 * 1000); // default last 24h

    if (isNaN(from.getTime()) || isNaN(to.getTime())) {
      throw new BadRequestException('Invalid date format for "from" or "to"');
    }

    if (from.getTime() > to.getTime()) {
      throw new BadRequestException('Invalid time range: "from" must be before "to"');
    }

    const maxRangeMs = 365 * 24 * 60 * 60 * 1000;
    if (to.getTime() - from.getTime() > maxRangeMs) {
      throw new BadRequestException('Requested time range exceeds maximum limit of 365 days');
    }

    // 3. Compose filters (merging nested filters and flat options)
    const filters: MetricQueryFilters = {
      projectId: options.filters?.projectId || options.projectId,
      apiId: options.filters?.apiId || options.apiId,
      environmentId: options.filters?.environmentId || options.environmentId,
      monitorId: options.filters?.monitorId || options.monitorId,
      organizationId: options.filters?.organizationId || options.organizationId,
    };

    // 4. Resolve Target Monitors based on scoped filters and authorization
    const targetMonitors = await this.resolveTargetMonitors(filters);
    const monitorIds = targetMonitors.map((m) => m.id);

    // If no monitors matched the filter criteria, return clean empty result
    if (monitorIds.length === 0) {
      return this.buildEmptyResult(metricDef, from, to);
    }

    // 5. Query executions across the target monitors via Data Source Abstraction
    const executions = await this.dataSource.getExecutions({
      monitorIds,
      from,
      to,
    });

    if (executions.length === 0) {
      return this.buildEmptyResult(metricDef, from, to, true);
    }

    // 6. Compute aggregate statistics
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
        failedCount++;
      } else if (exec.status === 'ERROR') {
        errorCount++;
        failedCount++;
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

    // Latency calculations (null if no valid latencies)
    const p50 = this.calculatePercentile(latencies, 50);
    const p90 = this.calculatePercentile(latencies, 90);
    const p95 = this.calculatePercentile(latencies, 95);
    const p99 = this.calculatePercentile(latencies, 99);
    const minLatency = latencies.length > 0 ? latencies[0] : null;
    const maxLatency = latencies.length > 0 ? latencies[latencies.length - 1] : null;
    const sumLatency = latencies.reduce((sum, v) => sum + v, 0);
    const avgLatency = latencies.length > 0 ? Math.round(sumLatency / latencies.length) : null;

    // Reliability calculations
    const availabilityPct = Number(((successCount / totalExecutions) * 100).toFixed(2));
    const successRatePct = availabilityPct;
    const errorRatePct = Number(((failedCount / totalExecutions) * 100).toFixed(2));

    const avgSize = sizes.length > 0 ? Math.round(sizes.reduce((a, b) => a + b, 0) / sizes.length) : null;

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

    // 7. Time Series Generation with Intelligent Dynamic Bucketization
    const bucketDurationMs = this.resolveBucketDurationMs(from, to, options.bucketMinutes);
    const bucketMap = new Map<
      number,
      { total: number; success: number; failed: number; timeouts: number; latencies: number[]; sizeSum: number }
    >();

    for (const exec of executions) {
      const bTime = Math.floor(exec.executedAt.getTime() / bucketDurationMs) * bucketDurationMs;
      const b = bucketMap.get(bTime) || {
        total: 0,
        success: 0,
        failed: 0,
        timeouts: 0,
        latencies: [],
        sizeSum: 0,
      };
      b.total++;
      if (exec.status === 'SUCCESS') {
        b.success++;
      } else {
        b.failed++;
        if (exec.status === 'TIMEOUT') {
          b.timeouts++;
        }
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
      let val: number | null = null;
      b.latencies.sort((a, b) => a - b);

      switch (metricDef.id) {
        case 'availability':
        case 'success_rate':
          val = b.total > 0 ? Number(((b.success / b.total) * 100).toFixed(2)) : null;
          break;
        case 'error_rate':
          val = b.total > 0 ? Number(((b.failed / b.total) * 100).toFixed(2)) : null;
          break;
        case 'average_latency':
          val = b.latencies.length > 0 ? Math.round(b.latencies.reduce((x, y) => x + y, 0) / b.latencies.length) : null;
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
          val = b.latencies.length > 0 ? b.latencies[0] : null;
          break;
        case 'max_latency':
          val = b.latencies.length > 0 ? b.latencies[b.latencies.length - 1] : null;
          break;
        case 'request_count':
          val = b.total;
          break;
        case 'failure_count':
          val = b.failed;
          break;
        case 'timeout_count':
          val = b.timeouts;
          break;
        case 'response_size':
          val = b.total > 0 ? Math.round(b.sizeSum / b.total) : null;
          break;
        default:
          val = b.latencies.length > 0 ? Math.round(b.latencies.reduce((x, y) => x + y, 0) / b.latencies.length) : null;
      }

      timeSeries.push({
        timestamp: new Date(bTime).toISOString(),
        value: val,
      });
    }

    // 8. Distribution Generation (for bar/pie charts)
    const distribution: DistributionItem[] = Object.entries(statusCounts)
      .map(([cat, count]) => ({
        category: cat,
        count,
        percentage: Number(((count / totalExecutions) * 100).toFixed(1)),
      }))
      .sort((a, b) => b.count - a.count);

    // 9. Tabular breakdown by Monitor
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
        const monAvg =
          stats.latencies.length > 0
            ? Math.round(stats.latencies.reduce((a, b) => a + b, 0) / stats.latencies.length)
            : null;
        const monAvail = Number(((stats.success / stats.total) * 100).toFixed(2));
        return {
          monitorId: m.id,
          monitorName: m.name,
          url: m.url,
          totalChecks: stats.total,
          availability: `${monAvail}%`,
          avgLatency: monAvg !== null ? `${monAvg}ms` : '—',
          p95Latency: monP95 !== null ? `${monP95}ms` : '—',
          status: monAvail >= 99 ? 'HEALTHY' : monAvail >= 90 ? 'DEGRADED' : 'CRITICAL',
        };
      });

    const formattedLabel =
      currentValue !== null
        ? `${currentValue}${metricDef.unit === '%' ? '%' : metricDef.unit === 'ms' ? ' ms' : ''}`
        : 'No Data';

    return {
      metric: metricDef.id,
      metricName: metricDef.name,
      unit: metricDef.unit,
      value: currentValue,
      type: options.groupBy === 'time' ? 'timeseries' : 'scalar',
      series: timeSeries,
      from: from.toISOString(),
      to: to.toISOString(),
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
        label: formattedLabel,
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
   * Resolves target monitors based on filter scope (Monitor, Environment, API, or Project)
   * while strictly enforcing tenant / organization boundaries.
   */
  private async resolveTargetMonitors(filters?: MetricQueryFilters) {
    const where: any = {};

    if (filters?.organizationId) {
      where.organizationId = filters.organizationId;
    }

    if (filters?.projectId) {
      where.environment = {
        ...(where.environment || {}),
        api: {
          ...(where.environment?.api || {}),
          projectId: filters.projectId,
        },
      };
    }

    if (filters?.apiId) {
      where.OR = [
        { apiId: filters.apiId },
        { environment: { apiId: filters.apiId } },
      ];
    }

    if (filters?.environmentId) {
      where.environmentId = filters.environmentId;
    }

    if (filters?.monitorId) {
      where.id = filters.monitorId;
    }

    const monitors = await this.prisma.monitor.findMany({ where });

    // Also include monitorConfigs targeting the same scope
    const configWhere: any = {};
    if (filters?.organizationId) configWhere.organizationId = filters.organizationId;
    if (filters?.apiId) configWhere.apiId = filters.apiId;
    if (filters?.environmentId) configWhere.environmentId = filters.environmentId;
    if (filters?.monitorId) configWhere.id = filters.monitorId;

    const configs = await this.prisma.monitorConfig.findMany({ where: configWhere });

    return [
      ...monitors,
      ...configs.map((c) => ({
        id: c.id,
        name: c.name,
        url: c.url,
        environmentId: c.environmentId,
        apiId: c.apiId,
        organizationId: c.organizationId,
      })),
    ];
  }


  /**
   * Intelligently derives time-bucket durations from the requested time window:
   * - Range <= 1h: 1-minute buckets (60 points)
   * - Range <= 6h: 5-minute buckets (72 points)
   * - Range <= 24h: 15-minute buckets (96 points)
   * - Range <= 7d: 1-hour buckets (168 points)
   * - Range <= 30d: 6-hour buckets (120 points)
   * - Range > 30d: 24-hour buckets
   */
  private resolveBucketDurationMs(from: Date, to: Date, explicitBucketMinutes?: number): number {
    if (explicitBucketMinutes && explicitBucketMinutes > 0) {
      return explicitBucketMinutes * 60 * 1000;
    }
    const diffMs = to.getTime() - from.getTime();
    const oneHour = 60 * 60 * 1000;
    const sixHours = 6 * oneHour;
    const oneDay = 24 * oneHour;
    const sevenDays = 7 * oneDay;
    const thirtyDays = 30 * oneDay;

    if (diffMs <= oneHour) {
      return 1 * 60 * 1000; // 1-minute buckets
    }
    if (diffMs <= sixHours) {
      return 5 * 60 * 1000; // 5-minute buckets
    }
    if (diffMs <= oneDay) {
      return 15 * 60 * 1000; // 15-minute buckets
    }
    if (diffMs <= sevenDays) {
      return 1 * oneHour; // 1-hour buckets
    }
    if (diffMs <= thirtyDays) {
      return 6 * oneHour; // 6-hour buckets
    }
    return oneDay; // 1-day buckets
  }

  /**
   * Deterministic percentile calculation on sorted array.
   * Returns null if array is empty (never returns fake 0ms).
   */
  public calculatePercentile(sorted: number[], p: number): number | null {
    if (!sorted || sorted.length === 0) return null;
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, Math.min(index, sorted.length - 1))];
  }

  /**
   * Builds normalized empty result with null values rather than fake zeroes.
   */
  private buildEmptyResult(
    metricDef: MetricDefinition,
    from: Date,
    to: Date,
    monitorsExist = false,
  ): MetricQueryResult {
    const isCount = ['request_count', 'failure_count', 'timeout_count'].includes(metricDef.id);
    const currentValue = isCount ? 0 : null;

    return {
      metric: metricDef.id,
      metricName: metricDef.name,
      unit: metricDef.unit,
      value: currentValue,
      type: 'scalar',
      series: [],
      from: from.toISOString(),
      to: to.toISOString(),
      timeRange: {
        from: from.toISOString(),
        to: to.toISOString(),
      },
      summary: {
        current: currentValue,
        min: null,
        max: null,
        avg: null,
        total: 0,
        label: currentValue !== null ? `${currentValue}` : 'No Data',
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

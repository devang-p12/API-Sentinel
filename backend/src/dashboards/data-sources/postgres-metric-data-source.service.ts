import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  MetricDataRecord,
  MetricDataSource,
  MetricDataSourceQuery,
} from './metric-data-source.interface';

@Injectable()
export class PostgresMetricDataSource implements MetricDataSource {
  constructor(private readonly prisma: PrismaService) {}

  async getExecutions(query: MetricDataSourceQuery): Promise<MetricDataRecord[]> {
    if (query.monitorIds.length === 0) {
      return [];
    }

    const execs = await this.prisma.monitorExecution.findMany({
      where: {
        monitorId: { in: query.monitorIds },
        executedAt: {
          gte: query.from,
          lte: query.to,
        },
      },
      select: {
        id: true,
        monitorId: true,
        status: true,
        statusCode: true,
        responseTimeMs: true,
        responseSize: true,
        executedAt: true,
      },
      orderBy: { executedAt: 'asc' },
    });

    if (execs.length > 0) {
      return execs;
    }

    // Fallback: Check MonitorResult if executions were logged in monitor_results
    const results = await this.prisma.monitorResult.findMany({
      where: {
        monitorConfigId: { in: query.monitorIds },
        timestamp: {
          gte: query.from,
          lte: query.to,
        },
      },
      select: {
        id: true,
        monitorConfigId: true,
        success: true,
        statusCode: true,
        latencyMs: true,
        responseSize: true,
        timestamp: true,
      },
      orderBy: { timestamp: 'asc' },
    });

    return results.map((r) => ({
      id: r.id,
      monitorId: r.monitorConfigId || '',
      status: r.success ? ('SUCCESS' as any) : ('ERROR' as any),
      statusCode: r.statusCode,
      responseTimeMs: r.latencyMs,
      responseSize: r.responseSize,
      executedAt: r.timestamp,
    }));
  }

}

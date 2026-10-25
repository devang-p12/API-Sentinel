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

    return this.prisma.monitorExecution.findMany({
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
  }
}

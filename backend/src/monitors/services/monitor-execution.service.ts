import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ProbeResult } from './http-probe.service';
import { ExecutionStatus } from '@prisma/client';

export interface ExecutionQueryOptions {
  limit?: number;
  offset?: number;
  from?: Date;
  to?: Date;
  status?: ExecutionStatus;
}

@Injectable()
export class MonitorExecutionService {
  private readonly logger = new Logger(MonitorExecutionService.name);

  constructor(private readonly prisma: PrismaService) {}

  async recordExecution(monitorId: string, result: ProbeResult) {
    try {
      const execution = await this.prisma.monitorExecution.create({
        data: {
          monitorId,
          status: result.status,
          statusCode: result.statusCode,
          responseTimeMs: result.responseTimeMs,
          responseSize: result.responseSize,
          responseHeaders: result.responseHeaders ?? undefined,
          assertionResults: result.assertionResults,
          errorMessage: result.errorMessage,
          executedAt: new Date(),
        },
      });

      this.logger.debug(
        `[Monitor ${monitorId}] Executed -> Status: ${result.status}, HTTP: ${result.statusCode}, Latency: ${result.responseTimeMs}ms`,
      );

      return this.formatExecution(execution);
    } catch (err: any) {
      this.logger.error(`Failed to record monitor execution for ${monitorId}: ${err.message}`, err.stack);
      throw err;
    }
  }

  async getRecentExecutions(
    monitorId: string,
    optionsOrLimit: ExecutionQueryOptions | number = 50,
    offsetArg: number = 0,
  ) {
    let limit = 50;
    let offset = 0;
    let from: Date | undefined;
    let to: Date | undefined;
    let status: ExecutionStatus | undefined;

    if (typeof optionsOrLimit === 'number') {
      limit = optionsOrLimit;
      offset = offsetArg;
    } else if (optionsOrLimit && typeof optionsOrLimit === 'object') {
      limit = optionsOrLimit.limit ?? 50;
      offset = optionsOrLimit.offset ?? 0;
      from = optionsOrLimit.from;
      to = optionsOrLimit.to;
      status = optionsOrLimit.status;
    }

    const where: any = { monitorId };
    if (status) {
      where.status = status;
    }
    if (from || to) {
      where.executedAt = {};
      if (from) where.executedAt.gte = from;
      if (to) where.executedAt.lte = to;
    }

    const records = await this.prisma.monitorExecution.findMany({
      where,
      orderBy: { executedAt: 'desc' },
      take: limit,
      skip: offset,
    });

    return records.map((r) => this.formatExecution(r));
  }

  async getExecutionById(monitorId: string, executionId: string) {
    const record = await this.prisma.monitorExecution.findFirst({
      where: { id: executionId, monitorId },
    });
    if (!record) {
      throw new NotFoundException(`MonitorExecution ${executionId} not found for monitor ${monitorId}`);
    }
    return this.formatExecution(record);
  }

  private formatExecution(r: any) {
    const isSuccess = r.status === 'SUCCESS';
    let errorType: string | null = null;
    if (!isSuccess) {
      if (r.status === 'TIMEOUT') {
        errorType = 'TIMEOUT';
      } else if (r.status === 'ERROR') {
        errorType = 'NETWORK_ERROR';
      } else if (r.errorMessage?.includes('Schema contract violation')) {
        errorType = 'SCHEMA_ERROR';
      } else if (r.statusCode && r.statusCode >= 400) {
        errorType = 'HTTP_ERROR';
      } else {
        errorType = 'UNKNOWN_ERROR';
      }
    }

    return {
      ...r,
      durationMs: r.responseTimeMs,
      startedAt: r.executedAt,
      completedAt: new Date(new Date(r.executedAt).getTime() + (r.responseTimeMs || 0)),
      createdAt: r.executedAt,
      success: isSuccess,
      errorType,
      schemaValid: isSuccess || !r.errorMessage?.includes('Schema contract violation'),
      sslValid: r.status !== 'ERROR' || !r.errorMessage?.toLowerCase().includes('ssl'),
    };
  }
}

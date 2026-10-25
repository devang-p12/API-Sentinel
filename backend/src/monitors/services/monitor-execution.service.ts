import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ProbeResult } from './http-probe.service';

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

      return execution;
    } catch (err: any) {
      this.logger.error(`Failed to record monitor execution for ${monitorId}: ${err.message}`, err.stack);
      throw err;
    }
  }

  async getRecentExecutions(monitorId: string, limit: number = 50) {
    return this.prisma.monitorExecution.findMany({
      where: { monitorId },
      orderBy: { executedAt: 'desc' },
      take: limit,
    });
  }
}

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { HttpProbeService, ProbeResult } from './http-probe.service';
import { IncidentEvaluatorService } from '../../incidents/incident-evaluator.service';
import { ExecutionStatus } from '@prisma/client';

export interface ExecutionQueryOptions {
  limit?: number;
  offset?: number;
  from?: Date;
  to?: Date;
  status?: ExecutionStatus;
}

import { Optional } from '@nestjs/common';
import { AlertEvaluationService } from '../../alert-rules/services/alert-evaluation.service';

@Injectable()
export class MonitorExecutionService {
  private readonly logger = new Logger(MonitorExecutionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly httpProbeService: HttpProbeService,
    private readonly incidentEvaluator: IncidentEvaluatorService,
    @Optional() private readonly alertEvaluator?: AlertEvaluationService,
  ) {}

  /**
   * Complete execution lifecycle:
   * 1. Load monitor & environment
   * 2. Build URL & headers
   * 3. Execute HTTP probe
   * 4. Persist MonitorExecution
   * 5. Evaluate incidents & return normalized execution
   */
  async executeMonitor(monitorId: string) {
    const monitor = await this.prisma.monitor.findUnique({
      where: { id: monitorId },
      include: {
        environment: {
          include: {
            api: true,
          },
        },
      },
    });

    if (!monitor) {
      this.logger.warn(`Monitor ${monitorId} not found in database. Skipping.`);
      return null;
    }

    if (!monitor.isActive) {
      this.logger.log(`Monitor ${monitorId} is marked inactive. Skipping.`);
      return null;
    }

    // Resolve full target URL
    let targetUrl = monitor.url;
    if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
      const baseUrl = monitor.environment?.baseUrl || '';
      const cleanBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
      const cleanPath = targetUrl.startsWith('/') ? targetUrl : `/${targetUrl}`;
      targetUrl = `${cleanBase}${cleanPath}`;
    }

    // SSRF / Protocol validation
    try {
      const parsed = new URL(targetUrl);
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        this.logger.error(`Blocked probe: invalid protocol "${parsed.protocol}". Only HTTP and HTTPS allowed.`);
        return null;
      }
    } catch (e: any) {
      this.logger.error(`Blocked probe: malformed target URL "${targetUrl}"`);
      return null;
    }

    // Merge environment variables / headers with monitor headers
    const envHeaders = (monitor.environment?.variables as Record<string, string>) || {};
    const monitorHeaders = (monitor.headers as Record<string, string>) || {};
    const mergedHeaders = { ...envHeaders, ...monitorHeaders };

    // Determine expected status code from assertions or default 200
    let expectedStatus = 200;
    const assertionsList = Array.isArray(monitor.assertions) ? (monitor.assertions as any[]) : [];
    const statusAssertion = assertionsList.find((a) => a && (a.type === 'statusCode' || a.type === 'status'));
    if (statusAssertion && statusAssertion.expected) {
      expectedStatus = parseInt(statusAssertion.expected, 10);
    }

    // Structured logging: log method and URL without credentials
    this.logger.log(`[MonitoringWorker] Request: ${monitor.method} ${targetUrl}`);

    // Execute probe (Agentless network call)
    const probeResult = await this.httpProbeService.probe({
      method: monitor.method,
      url: targetUrl,
      headers: mergedHeaders,
      body: monitor.body || undefined,
      timeoutMs: monitor.timeoutMs,
      expectedStatusCode: expectedStatus,
      assertions: assertionsList,
    });

    // Persist telemetry record to PostgreSQL
    const execution = await this.recordExecution(monitor.id, probeResult);

    // Evaluate alert rules and incident state machine
    try {
      await this.incidentEvaluator.evaluateMonitor(monitor.id);
    } catch (err: any) {
      this.logger.warn(`Incident evaluation skipped: ${err.message}`);
    }

    if (this.alertEvaluator) {
      try {
        await this.alertEvaluator.evaluateRulesForMonitor(monitor.id);
      } catch (err: any) {
        this.logger.warn(`Alert rule evaluation skipped: ${err.message}`);
      }
    }

    return execution;
  }

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

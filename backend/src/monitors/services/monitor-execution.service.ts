import { Injectable, Logger, NotFoundException, Optional } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { HttpProbeService, ProbeResult } from './http-probe.service';
import { IncidentEvaluatorService } from '../../incidents/incident-evaluator.service';
import { ExecutionStatus } from '@prisma/client';
import { AlertEvaluationService } from '../../alert-rules/services/alert-evaluation.service';
import { MonitorJobData } from '../workers/monitor.worker';
import { PrometheusMetricsService } from '../../metrics/prometheus-metrics.service';
import { SchemaMonitoringService } from '../../schema-monitoring/schema-monitoring.service';

export interface ExecutionQueryOptions {
  limit?: number;
  offset?: number;
  from?: Date;
  to?: Date;
  status?: ExecutionStatus;
  apiId?: string;
  environmentId?: string;
}

@Injectable()
export class MonitorExecutionService {
  private readonly logger = new Logger(MonitorExecutionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly httpProbeService: HttpProbeService,
    private readonly incidentEvaluator: IncidentEvaluatorService,
    @Optional() private readonly alertEvaluator?: AlertEvaluationService,
    @Optional() private readonly metricsService?: PrometheusMetricsService,
    @Optional() private readonly schemaMonitoringService?: SchemaMonitoringService,
  ) {}

  /**
   * Complete execution lifecycle:
   * 1. Load monitor / monitor config & environment (organization-aware)
   * 2. Build URL & headers
   * 3. Execute HTTP probe via RequestExecutionService
   * 4. Persist MonitorResult to PostgreSQL
   * 5. Persist MonitorExecution if applicable
   * 6. Return normalized execution record
   */
  async executeMonitor(target: string | MonitorJobData) {
    const monitorId = typeof target === 'string' ? target : (target.monitorId || target.monitorConfigId);
    const expectedOrgId = typeof target === 'object' ? target.organizationId : undefined;

    if (!monitorId) {
      this.logger.warn('executeMonitor called with empty monitorId');
      return null;
    }

    // Try finding in Monitor table first
    let monitor: any = await this.prisma.monitor.findUnique({
      where: { id: monitorId },
      include: {
        organization: true,
        environment: {
          include: {
            api: true,
          },
        },
      },
    });

    let isConfigModel = false;

    // If not found in Monitor, check MonitorConfig table
    if (!monitor) {
      monitor = await this.prisma.monitorConfig.findUnique({
        where: { id: monitorId },
        include: {
          organization: true,
          environment: {
            include: {
              api: true,
            },
          },
          api: true,
        },
      });
      if (monitor) {
        isConfigModel = true;
      }
    }

    if (!monitor) {
      this.logger.warn(`Monitor ${monitorId} not found in database. Skipping.`);
      return null;
    }

    // 1. Organization boundary enforcement
    if (expectedOrgId && monitor.organizationId !== expectedOrgId) {
      this.logger.error(
        `[Security] Tenant mismatch for monitor ${monitorId}. Expected org: ${expectedOrgId}, Found: ${monitor.organizationId}`,
      );
      return null;
    }

    // 2. Disabled monitor check
    const isEnabled = isConfigModel ? monitor.enabled : monitor.isActive;
    if (!isEnabled) {
      this.logger.log(`Monitor ${monitorId} is marked inactive/disabled. Skipping.`);
      return null;
    }

    // Resolve target URL
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

    // Resolve expected status code
    let expectedStatus = 200;
    if (isConfigModel) {
      expectedStatus = monitor.expectedStatus || 200;
    } else {
      const assertionsList = Array.isArray(monitor.assertions) ? (monitor.assertions as any[]) : [];
      const statusAssertion = assertionsList.find((a) => a && (a.type === 'statusCode' || a.type === 'status'));
      if (statusAssertion && statusAssertion.expected) {
        expectedStatus = parseInt(statusAssertion.expected, 10);
      }
    }

    const timeoutMs = isConfigModel ? monitor.timeout : monitor.timeoutMs;
    const assertions = isConfigModel
      ? (Array.isArray(monitor.expectedResponse) ? monitor.expectedResponse : (monitor.expectedResponse ? [monitor.expectedResponse] : []))
      : (Array.isArray(monitor.assertions) ? (monitor.assertions as any[]) : []);

    this.logger.log(`[MonitoringWorker] Executing probe: ${monitor.method} ${targetUrl} (timeout: ${timeoutMs}ms)`);

    // Execute probe (Agentless network call via RequestExecutionService)
    const probeResult = await this.httpProbeService.probe({
      method: monitor.method,
      url: targetUrl,
      queryParams: monitor.queryParams || undefined,
      headers: mergedHeaders,
      body: monitor.body || undefined,
      timeoutMs,
      expectedStatusCode: expectedStatus,
      assertions,
    });

    const resolvedApiId = monitor.apiId || monitor.environment?.apiId;
    const resolvedOrgId = monitor.organizationId;
    const resolvedEnvId = monitor.environmentId;

    // Evaluate Schema Contract Conformance (Detect unexpected schema drift even when HTTP 200 OK)
    if (
      this.schemaMonitoringService &&
      (resolvedApiId || resolvedOrgId) &&
      probeResult.statusCode &&
      probeResult.statusCode >= 200 &&
      probeResult.statusCode < 300 &&
      probeResult.responseBody
    ) {
      try {
        const schemaComparison = await this.schemaMonitoringService.processResponse({
          organizationId: resolvedOrgId,
          apiId: resolvedApiId || '',
          environmentId: resolvedEnvId,
          monitorConfigId: isConfigModel ? monitor.id : undefined,
          endpoint: targetUrl || monitor.url,
          method: monitor.method || 'GET',
          statusCode: probeResult.statusCode,
          responseBody: probeResult.responseBody,
          autoBaselineIfMissing: false,
        });

        if (schemaComparison.hasBreakingChanges) {
          probeResult.schemaValid = false;
          probeResult.errorType = 'SCHEMA_ERROR';
          const breakingDesc = schemaComparison.changes
            .filter((c) => c.isBreaking)
            .map((c) => c.description)
            .join('; ');
          const schemaMsg = `Contract drift violation (HTTP ${probeResult.statusCode}): ${breakingDesc}`;
          probeResult.errorMessage = probeResult.errorMessage
            ? `${probeResult.errorMessage} | ${schemaMsg}`
            : schemaMsg;
        }
      } catch (schemaErr: any) {
        this.logger.debug(`Schema monitoring evaluation skipped: ${schemaErr.message}`);
      }
    }

    // 3. Persist MonitorResult and MonitorExecution to PostgreSQL
    const recorded = await this.recordExecution({
      monitorId: monitor.id,
      isConfigModel,
      organizationId: resolvedOrgId,
      apiId: resolvedApiId,
      environmentId: resolvedEnvId,
      endpoint: targetUrl || monitor.url,
      organizationName: monitor.organization?.slug || monitor.organization?.name,
      apiName: monitor.api?.name || monitor.environment?.api?.name,
      environmentName: monitor.environment?.name,
      probeResult,
    });

    // Evaluate incidents & alerts if applicable
    if (!isConfigModel) {
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
    }

    return recorded;
  }

  async recordExecution(params: {
    monitorId: string;
    isConfigModel: boolean;
    organizationId: string;
    apiId: string;
    environmentId: string;
    probeResult: ProbeResult;
    endpoint?: string;
    organizationName?: string;
    apiName?: string;
    environmentName?: string;
  }) {
    const { monitorId, isConfigModel, organizationId, apiId, environmentId, probeResult } = params;
    const timestamp = new Date();
    const isSuccess = probeResult.status === ExecutionStatus.SUCCESS;

    try {
      // 1. Create MonitorResult record (Phase 4 requirement: store every monitoring result)
      const monitorResult = await this.prisma.monitorResult.create({
        data: {
          organizationId,
          apiId,
          environmentId,
          monitorConfigId: isConfigModel ? monitorId : undefined,
          timestamp,
          statusCode: probeResult.statusCode,
          latencyMs: probeResult.responseTimeMs,
          success: isSuccess,
          timeout: probeResult.isTimeout,
          errorType: probeResult.errorType,
          responseSize: probeResult.responseSize,
          schemaValid: probeResult.schemaValid,
          errorMessage: probeResult.errorMessage,
          responseHeaders: probeResult.responseHeaders ?? undefined,
        },
      });

      // 2. Export Prometheus metrics (Phase 12 requirement: monitoring workers publish metrics)
      if (this.metricsService) {
        try {
          const org = params.organizationName || params.organizationId;
          const api = params.apiName || params.apiId;
          const env = params.environmentName || params.environmentId;
          const endpoint = params.endpoint || '/';

          this.metricsService.recordApiRequest({
            organization: org,
            api,
            environment: env,
            endpoint,
            statusCode: probeResult.statusCode,
            latencyMs: probeResult.responseTimeMs,
            success: isSuccess,
            errorType: probeResult.errorType,
            responseSize: probeResult.responseSize,
          });

          if (apiId && environmentId) {
            this.publishAggregatedMetrics(params.organizationId, apiId, environmentId, org, api, env).catch(() => {});
          }
        } catch (mErr: any) {
          this.logger.warn(`Failed to export Prometheus metrics: ${mErr.message}`);
        }
      }

      // 3. If existing Monitor entity, also create MonitorExecution row for backwards compatibility
      let executionRecord: any = null;
      if (!isConfigModel) {
        executionRecord = await this.prisma.monitorExecution.create({
          data: {
            monitorId,
            status: probeResult.status,
            statusCode: probeResult.statusCode,
            responseTimeMs: probeResult.responseTimeMs,
            responseSize: probeResult.responseSize,
            responseHeaders: probeResult.responseHeaders ?? undefined,
            assertionResults: probeResult.assertionResults,
            errorMessage: probeResult.errorMessage,
            executedAt: timestamp,
          },
        });
      }

      this.logger.debug(
        `[Monitor ${monitorId}] Result saved -> success=${isSuccess}, http=${probeResult.statusCode}, latency=${probeResult.responseTimeMs}ms, errorType=${probeResult.errorType}`,
      );

      return {
        id: executionRecord?.id || monitorResult.id,
        resultId: monitorResult.id,
        monitorId,
        organizationId,
        apiId,
        environmentId,
        status: probeResult.status,
        statusCode: probeResult.statusCode,
        latencyMs: probeResult.responseTimeMs,
        durationMs: probeResult.responseTimeMs,
        responseSize: probeResult.responseSize,
        success: isSuccess,
        timeout: probeResult.isTimeout,
        errorType: probeResult.errorType,
        schemaValid: probeResult.schemaValid,
        errorMessage: probeResult.errorMessage,
        timestamp,
        executedAt: timestamp,
      };
    } catch (err: any) {
      this.logger.error(`Failed to record monitor result for ${monitorId}: ${err.message}`, err.stack);
      throw err;
    }
  }

  private async publishAggregatedMetrics(
    organizationId: string,
    apiId: string,
    environmentId: string,
    orgLabel: string,
    apiLabel: string,
    envLabel: string,
  ) {
    if (!this.metricsService) return;

    try {
      // 1. Calculate recent availability ratio
      const recent = await this.prisma.monitorResult.findMany({
        where: { organizationId, apiId, environmentId },
        take: 20,
        orderBy: { timestamp: 'desc' },
        select: { success: true },
      });

      if (recent.length > 0) {
        const successCount = recent.filter((r) => r.success).length;
        const availabilityRatio = parseFloat((successCount / recent.length).toFixed(4));
        this.metricsService.updateApiAvailability(
          { organization: orgLabel, api: apiLabel, environment: envLabel },
          availabilityRatio,
        );
      }

      // 2. Fetch latest reliability score
      const latestScore = await this.prisma.reliabilityScoreRecord.findFirst({
        where: { organizationId, apiId },
        orderBy: { calculatedAt: 'desc' },
        select: { score: true },
      });

      if (latestScore) {
        this.metricsService.updateReliabilityScore(
          { organization: orgLabel, api: apiLabel, environment: envLabel },
          latestScore.score,
        );
      }
    } catch {
      // Ignore background calculation anomalies
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

  async getMonitorResults(filter: {
    organizationId: string;
    apiId?: string;
    environmentId?: string;
    monitorConfigId?: string;
    limit?: number;
    offset?: number;
    from?: Date;
    to?: Date;
  }) {
    const where: any = {
      organizationId: filter.organizationId,
    };
    if (filter.apiId) where.apiId = filter.apiId;
    if (filter.environmentId) where.environmentId = filter.environmentId;
    if (filter.monitorConfigId) where.monitorConfigId = filter.monitorConfigId;
    if (filter.from || filter.to) {
      where.timestamp = {};
      if (filter.from) where.timestamp.gte = filter.from;
      if (filter.to) where.timestamp.lte = filter.to;
    }

    return this.prisma.monitorResult.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      take: filter.limit || 50,
      skip: filter.offset || 0,
      include: {
        api: true,
        environment: true,
        monitorConfig: true,
      },
    });
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
      latencyMs: r.responseTimeMs,
      startedAt: r.executedAt,
      completedAt: new Date(new Date(r.executedAt).getTime() + (r.responseTimeMs || 0)),
      createdAt: r.executedAt,
      success: isSuccess,
      timeout: r.status === 'TIMEOUT',
      errorType,
      schemaValid: isSuccess || !r.errorMessage?.includes('Schema contract violation'),
      sslValid: r.status !== 'ERROR' || !r.errorMessage?.toLowerCase().includes('ssl'),
    };
  }
}

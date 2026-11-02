import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateApiDto } from './dto/create-api.dto';
import { UpdateApiDto } from './dto/update-api.dto';
import {
  validateAndNormalizeUrl,
  sanitizeUrl,
  maskUrl,
  inferEnvironmentType,
} from '../common/url-utils';
import { HealthEvaluationService } from '../health-evaluation/health-evaluation.service';
import { ReliabilityScoreService } from '../reliability-score/reliability-score.service';
import {
  ApiAlertsSection,
  ApiContractSection,
  ApiDetailsResponse,
  ApiEnvironmentComparisonItem,
  ApiIncidentsSection,
  ApiMonitoringSection,
  ApiOverviewMetrics,
  ApiPerformanceGraphs,
  ApiResponseTimeStats,
} from './interfaces/api-details.interface';

@Injectable()
export class ApisService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly healthService: HealthEvaluationService,
    private readonly reliabilityService: ReliabilityScoreService,
  ) {}

  /**
   * Helper to format environment for safe exposure (Requirement 3).
   */
  private formatEnvironment(env: any) {
    return {
      ...env,
      baseUrl: sanitizeUrl(env.baseUrl),
      maskedBaseUrl: maskUrl(env.baseUrl),
    };
  }

  /**
   * Helper to format API with safe environment representations.
   */
  private formatApi(api: any) {
    return {
      ...api,
      environments: (api.environments || []).map((e: any) =>
        this.formatEnvironment(e),
      ),
    };
  }

  async create(dto: CreateApiDto, organizationId: string) {
    if (!dto.name || !dto.name.trim()) {
      throw new BadRequestException('API name is required');
    }

    if (dto.projectId) {
      const project = await this.prisma.project.findFirst({
        where: { id: dto.projectId, organizationId },
      });
      if (!project) {
        throw new NotFoundException(`Project with ID ${dto.projectId} not found`);
      }
    }

    // Auto-generate service identifier from name if not provided
    const serviceTag =
      dto.service?.trim() ||
      dto.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');

    // Check for duplicate API name within the organization
    const existing = await this.prisma.api.findFirst({
      where: {
        organizationId,
        name: { equals: dto.name.trim(), mode: 'insensitive' },
      },
    });

    if (existing) {
      throw new ConflictException(
        `An API with the name "${dto.name.trim()}" already exists in this organization`,
      );
    }

    // Parse & validate optional initial environments
    let initialEnvData: any = undefined;
    if (dto.environments && dto.environments.length > 0) {
      initialEnvData = {
        create: dto.environments.map((env) => {
          const validatedUrl = env.baseUrl ? validateAndNormalizeUrl(env.baseUrl) : null;
          return {
            name: env.name.trim(),
            baseUrl: validatedUrl,
            type: env.type || (validatedUrl ? inferEnvironmentType(validatedUrl) : 'DEVELOPMENT'),
            organizationId,
          };
        }),
      };
    }

    const api = await this.prisma.api.create({
      data: {
        name: dto.name.trim(),
        description: dto.description?.trim() || null,
        service: serviceTag,
        projectId: dto.projectId || null,
        organizationId,
        ...(initialEnvData ? { environments: initialEnvData } : {}),
      },
      include: {
        project: { select: { id: true, name: true } },
        environments: true,
      },
    });

    return this.formatApi(api);
  }

  async findAll(
    organizationId: string,
    filter?: { projectId?: string; service?: string; search?: string },
  ) {
    const where: any = { organizationId };

    if (filter?.projectId) {
      where.projectId = filter.projectId;
    }
    if (filter?.service) {
      where.service = { contains: filter.service, mode: 'insensitive' };
    }
    if (filter?.search) {
      where.OR = [
        { name: { contains: filter.search, mode: 'insensitive' } },
        { description: { contains: filter.search, mode: 'insensitive' } },
        { service: { contains: filter.search, mode: 'insensitive' } },
      ];
    }

    const apis = await this.prisma.api.findMany({
      where,
      include: {
        project: {
          select: { id: true, name: true },
        },
        environments: {
          include: {
            _count: {
              select: {
                monitors: true,
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
        _count: {
          select: {
            environments: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return apis.map((a) => this.formatApi(a));
  }

  async findOne(id: string, organizationId: string) {
    const api = await this.prisma.api.findFirst({
      where: { id, organizationId },
      include: {
        project: {
          select: { id: true, name: true },
        },
        environments: {
          include: {
            monitors: {
              select: {
                id: true,
                name: true,
                url: true,
                method: true,
                isActive: true,
                intervalSeconds: true,
              },
            },
            _count: {
              select: {
                monitors: true,
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
        _count: {
          select: {
            environments: true,
          },
        },
      },
    });

    if (!api) {
      throw new NotFoundException(`API with ID ${id} not found in this organization`);
    }

    return this.formatApi(api);
  }

  async update(id: string, dto: UpdateApiDto, organizationId: string) {
    await this.findOne(id, organizationId);

    if (dto.projectId) {
      const project = await this.prisma.project.findFirst({
        where: { id: dto.projectId, organizationId },
      });
      if (!project) {
        throw new NotFoundException(`Project with ID ${dto.projectId} not found`);
      }
    }

    const updated = await this.prisma.api.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.description !== undefined ? { description: dto.description?.trim() || null } : {}),
        ...(dto.service !== undefined ? { service: dto.service.trim() } : {}),
        ...(dto.projectId !== undefined ? { projectId: dto.projectId || null } : {}),
      },
      include: {
        project: { select: { id: true, name: true } },
        environments: true,
      },
    });

    return this.formatApi(updated);
  }

  async delete(id: string, organizationId: string) {
    await this.findOne(id, organizationId);

    await this.prisma.api.delete({
      where: { id },
    });

    return { message: 'API deleted successfully', id };
  }

  /**
   * Phase 11: Comprehensive API Details endpoint aggregation.
   * Compiles Overview, Performance, Monitoring, Contract, Incidents, Alerts,
   * and Environment Comparison for a specific API strictly scoped to organizationId.
   */
  async getApiDetails(apiId: string, organizationId: string): Promise<ApiDetailsResponse> {
    const api = await this.prisma.api.findFirst({
      where: { id: apiId, organizationId },
      include: {
        project: { select: { id: true, name: true } },
        environments: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!api) {
      throw new NotFoundException(`API with ID ${apiId} not found in this organization`);
    }

    // 1. Overview Health & Reliability
    const healthEval = await this.healthService.evaluateApi(apiId, organizationId);

    let reliabilityScoreVal = 100;
    let reliabilityGrade = 'EXCELLENT';
    try {
      const breakdown = await this.reliabilityService.calculateForApi(
        apiId,
        organizationId,
        { limit: 50, persist: false },
      );
      reliabilityScoreVal = breakdown.overallScore;
      reliabilityGrade = breakdown.grade;
    } catch {
      reliabilityScoreVal = 100;
      reliabilityGrade = 'EXCELLENT';
    }

    // 2. Monitoring Results (last 100 checks)
    const recentResults = await this.prisma.monitorResult.findMany({
      where: { apiId, organizationId },
      orderBy: { timestamp: 'desc' },
      take: 100,
    });

    const envMap = new Map<string, string>();
    for (const env of api.environments) {
      envMap.set(env.id, env.name);
    }

    let avgLatency = 0;
    let p95Latency = 0;
    let errorRate = 0;

    const latencies = recentResults
      .map((r) => r.latencyMs)
      .filter((l): l is number => typeof l === 'number' && l >= 0)
      .sort((a, b) => a - b);

    if (latencies.length > 0) {
      avgLatency = Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length);
      const p95Idx = Math.min(
        Math.ceil(latencies.length * 0.95) - 1,
        latencies.length - 1,
      );
      p95Latency = latencies[Math.max(0, p95Idx)];
    }

    if (recentResults.length > 0) {
      const failures = recentResults.filter((r) => !r.success || r.timeout).length;
      errorRate = parseFloat(((failures / recentResults.length) * 100).toFixed(1));
    }

    const overview: ApiOverviewMetrics = {
      health: healthEval.currentState as 'HEALTHY' | 'DEGRADED' | 'DOWN',
      healthReason: healthEval.reason,
      reliabilityScore: reliabilityScoreVal,
      reliabilityGrade,
      availabilityPct: healthEval.availabilityPercentage,
      errorRatePct: errorRate,
      averageLatencyMs: avgLatency,
      p95LatencyMs: p95Latency,
      consecutiveFailures: healthEval.consecutiveFailures,
      lastSuccessfulCheck: healthEval.lastSuccessfulCheck
        ? new Date(healthEval.lastSuccessfulCheck).toISOString()
        : null,
      lastFailedCheck: healthEval.lastFailedCheck
        ? new Date(healthEval.lastFailedCheck).toISOString()
        : null,
    };

    // 3. Performance Graphs (24h time buckets)
    const performance = this.generateApiPerformanceGraphs(recentResults);

    // 4. Monitoring Telemetry & Response Time Stats
    const recentChecks = recentResults.slice(0, 30).map((r) => ({
      id: r.id,
      timestamp: r.timestamp.toISOString(),
      statusCode: r.statusCode,
      latencyMs: r.latencyMs,
      success: r.success,
      timeout: r.timeout,
      errorType: r.errorType,
      errorMessage: r.errorMessage,
      environmentId: r.environmentId,
      environmentName: r.environmentId ? envMap.get(r.environmentId) || null : null,
    }));

    const failures = recentResults
      .filter((r) => !r.success || r.timeout || (r.statusCode && r.statusCode >= 400))
      .slice(0, 20)
      .map((r) => ({
        id: r.id,
        timestamp: r.timestamp.toISOString(),
        statusCode: r.statusCode,
        latencyMs: r.latencyMs,
        success: r.success,
        timeout: r.timeout,
        errorType: r.errorType,
        errorMessage: r.errorMessage,
        environmentId: r.environmentId,
        environmentName: r.environmentId ? envMap.get(r.environmentId) || null : null,
      }));

    const responseTimes: ApiResponseTimeStats = {
      minMs: latencies.length > 0 ? latencies[0] : 0,
      maxMs: latencies.length > 0 ? latencies[latencies.length - 1] : 0,
      avgMs: avgLatency,
      p50Ms: latencies.length > 0 ? latencies[Math.floor(latencies.length * 0.5)] : 0,
      p90Ms: latencies.length > 0 ? latencies[Math.floor(latencies.length * 0.9)] : 0,
      p95Ms: p95Latency,
      p99Ms: latencies.length > 0 ? latencies[Math.floor(latencies.length * 0.99)] : 0,
    };

    const monitoring: ApiMonitoringSection = {
      recentChecks,
      failures,
      responseTimes,
      totalChecksEvaluated: recentResults.length,
    };

    // 5. Contract (Schema Monitoring)
    const schemasRaw = await this.prisma.apiSchema.findMany({
      where: { apiId, organizationId },
      include: {
        versions: {
          orderBy: { versionNumber: 'desc' },
          take: 10,
        },
        changes: {
          orderBy: { detectedAt: 'desc' },
          take: 20,
        },
      },
    });

    let totalChanges = 0;
    let breakingChangesCount = 0;

    const schemas = schemasRaw.map((s) => {
      totalChanges += s.changes.length;
      breakingChangesCount += s.changes.filter((c) => c.isBreaking).length;
      const baselineVersion = s.versions.find((v) => v.isBaseline) || s.versions[0];

      return {
        id: s.id,
        endpoint: s.endpoint,
        method: s.method,
        activeBaselineVersionId: s.activeBaselineVersionId,
        createdAt: s.createdAt.toISOString(),
        currentSchema: baselineVersion?.normalizedSchema || null,
        versions: s.versions.map((v) => ({
          id: v.id,
          versionNumber: v.versionNumber,
          isBaseline: v.isBaseline,
          checksum: v.checksum,
          createdAt: v.createdAt.toISOString(),
        })),
        changes: s.changes.map((c) => ({
          id: c.id,
          fieldPath: c.fieldPath,
          changeType: c.changeType,
          severity: c.severity,
          description: c.description,
          isBreaking: c.isBreaking,
          detectedAt: c.detectedAt.toISOString(),
          isAcknowledged: c.isAcknowledged,
        })),
      };
    });

    const contract: ApiContractSection = {
      schemas,
      totalChanges,
      breakingChangesCount,
    };

    // 6. Incidents
    const activeIncidentsRaw = await this.prisma.incident.findMany({
      where: {
        apiId,
        organizationId,
        status: { in: ['OPEN', 'ACKNOWLEDGED'] },
      },
      include: { environment: { select: { name: true } } },
      orderBy: { startedAt: 'desc' },
    });

    const historicalIncidentsRaw = await this.prisma.incident.findMany({
      where: {
        apiId,
        organizationId,
        status: 'RESOLVED',
      },
      include: { environment: { select: { name: true } } },
      orderBy: { startedAt: 'desc' },
      take: 10,
    });

    const incidents: ApiIncidentsSection = {
      activeIncidents: activeIncidentsRaw.map((inc) => ({
        id: inc.id,
        title: inc.title,
        severity: inc.severity,
        status: inc.status,
        reason: inc.reason,
        startedAt: inc.startedAt.toISOString(),
        environmentName: inc.environment?.name ?? 'production',
      })),
      historicalIncidents: historicalIncidentsRaw.map((inc) => ({
        id: inc.id,
        title: inc.title,
        severity: inc.severity,
        status: inc.status,
        reason: inc.reason,
        startedAt: inc.startedAt.toISOString(),
        resolvedAt: inc.resolvedAt ? inc.resolvedAt.toISOString() : null,
        durationSeconds: inc.durationSeconds,
        environmentName: inc.environment?.name ?? 'production',
      })),
    };

    // 7. Alerts
    const alertsRaw = await this.prisma.alertRule.findMany({
      where: { apiId, organizationId },
      include: { environment: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    });

    const alerts: ApiAlertsSection = {
      configuredAlerts: alertsRaw.map((a) => ({
        id: a.id,
        name: a.name,
        metric: a.metric,
        operator: a.operator,
        threshold: a.threshold,
        duration: a.duration,
        severity: a.severity,
        enabled: a.enabled,
        notificationChannels: a.notificationChannels,
        cooldownSeconds: a.cooldownSeconds,
        environmentName: a.environment?.name ?? null,
      })),
    };

    // 8. Environments & Environment Comparison
    const environmentsComparison: ApiEnvironmentComparisonItem[] = [];

    for (const env of api.environments) {
      const envHealth = await this.healthService.evaluateEnvironment(env.id, organizationId);

      const envResults = recentResults.filter((r) => r.environmentId === env.id);

      const envLatencies = envResults
        .map((r) => r.latencyMs)
        .filter((l): l is number => typeof l === 'number' && l >= 0)
        .sort((a, b) => a - b);

      const envAvgLatency =
        envLatencies.length > 0
          ? Math.round(envLatencies.reduce((a, b) => a + b, 0) / envLatencies.length)
          : 0;

      const envP95Idx = Math.min(
        Math.ceil(envLatencies.length * 0.95) - 1,
        envLatencies.length - 1,
      );
      const envP95 = envLatencies.length > 0 ? envLatencies[Math.max(0, envP95Idx)] : 0;

      const envFailures = envResults.filter((r) => !r.success || r.timeout).length;
      const envErrorRate =
        envResults.length > 0
          ? parseFloat(((envFailures / envResults.length) * 100).toFixed(1))
          : 0;

      let envReliability = 100;
      try {
        const envScore = await this.reliabilityService.calculateForApi(
          apiId,
          organizationId,
          { environmentId: env.id, limit: 30, persist: false },
        );
        envReliability = envScore.overallScore;
      } catch {
        envReliability = Math.max(0, Math.round(100 - envErrorRate));
      }

      environmentsComparison.push({
        environmentId: env.id,
        environmentName: env.name,
        environmentType: env.type,
        baseUrl: sanitizeUrl(env.baseUrl),
        maskedBaseUrl: maskUrl(env.baseUrl),
        availability: envHealth.availabilityPercentage,
        latency: envAvgLatency,
        p95: envP95,
        errors: envErrorRate,
        reliability: envReliability,
        health: envHealth.currentState as 'HEALTHY' | 'DEGRADED' | 'DOWN',
        consecutiveFailures: envHealth.consecutiveFailures,
      });
    }

    return {
      api: {
        id: api.id,
        name: api.name,
        service: api.service,
        description: api.description,
        organizationId: api.organizationId,
        projectId: api.projectId,
        projectName: api.project?.name ?? null,
        createdAt: api.createdAt.toISOString(),
        updatedAt: api.updatedAt.toISOString(),
      },
      overview,
      performance,
      monitoring,
      contract,
      incidents,
      alerts,
      environments: environmentsComparison,
    };
  }

  /**
   * Helper to compute performance trend buckets from recent monitor results.
   */
  private generateApiPerformanceGraphs(results: any[]): ApiPerformanceGraphs {
    const bucketCount = 12;
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 3600 * 1000);
    const bucketIntervalMs = (24 * 3600 * 1000) / bucketCount;

    const latencyGraph: any[] = [];
    const errorGraph: any[] = [];
    const availabilityGraph: any[] = [];

    for (let i = 0; i < bucketCount; i++) {
      const bucketStart = new Date(twentyFourHoursAgo.getTime() + i * bucketIntervalMs);
      const bucketEnd = new Date(bucketStart.getTime() + bucketIntervalMs);
      const isoTime = bucketStart.toISOString();

      const inBucket = results.filter(
        (r) => r.timestamp >= bucketStart && r.timestamp < bucketEnd,
      );

      if (inBucket.length > 0) {
        const lats = inBucket
          .map((r) => r.latencyMs)
          .filter((l): l is number => typeof l === 'number' && l >= 0)
          .sort((a, b) => a - b);

        const avgMs =
          lats.length > 0 ? Math.round(lats.reduce((a, b) => a + b, 0) / lats.length) : 0;
        const maxMs = lats.length > 0 ? lats[lats.length - 1] : 0;
        const p95Idx = Math.min(Math.ceil(lats.length * 0.95) - 1, lats.length - 1);
        const p95Ms = lats.length > 0 ? lats[Math.max(0, p95Idx)] : 0;

        const fails = inBucket.filter((r) => !r.success || r.timeout).length;
        const errPct = parseFloat(((fails / inBucket.length) * 100).toFixed(1));
        const availPct = parseFloat((((inBucket.length - fails) / inBucket.length) * 100).toFixed(1));

        latencyGraph.push({ timestamp: isoTime, p95Ms, avgMs, maxMs });
        errorGraph.push({ timestamp: isoTime, errorRatePct: errPct, failureCount: fails, totalChecks: inBucket.length });
        availabilityGraph.push({ timestamp: isoTime, availabilityPct: availPct });
      } else {
        latencyGraph.push({ timestamp: isoTime, p95Ms: 0, avgMs: 0, maxMs: 0 });
        errorGraph.push({ timestamp: isoTime, errorRatePct: 0, failureCount: 0, totalChecks: 0 });
        availabilityGraph.push({ timestamp: isoTime, availabilityPct: 100 });
      }
    }

    return {
      latencyGraph,
      errorGraph,
      availabilityGraph,
    };
  }
}

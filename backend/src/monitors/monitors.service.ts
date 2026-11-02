import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMonitorDto } from './dto/create-monitor.dto';
import { UpdateMonitorDto } from './dto/update-monitor.dto';
import { MonitorSchedulerService } from './scheduler/monitor-scheduler.service';
import { MonitorExecutionService } from './services/monitor-execution.service';
import { HealthEvaluationService } from '../health-evaluation/health-evaluation.service';
import { HealthPolicyConfig } from '../health-evaluation/interfaces/health-evaluation.interface';
import { HttpMethod } from '@prisma/client';

@Injectable()
export class MonitorsService {
  private readonly logger = new Logger(MonitorsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly schedulerService: MonitorSchedulerService,
    private readonly executionService: MonitorExecutionService,
    private readonly healthEvaluationService: HealthEvaluationService,
  ) {}

  /**
   * Helper to normalize endpoint path.
   * Ensures leading slash for relative paths (e.g. "health" -> "/health").
   */
  private normalizeEndpoint(path?: string): string {
    if (!path || !path.trim()) {
      throw new BadRequestException('Endpoint path or URL is required');
    }
    const trimmed = path.trim();
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      return trimmed;
    }
    return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  }

  // ==========================================
  // Monitor (Standard / Legacy compatible)
  // ==========================================

  async create(dto: CreateMonitorDto, organizationId?: string) {
    if (!dto.name || !dto.name.trim()) {
      throw new BadRequestException('Monitor name is required');
    }

    if (!dto.environmentId) {
      throw new BadRequestException('environmentId is required');
    }

    // Verify Environment existence and resolve full ownership hierarchy
    const environment = await this.prisma.environment.findFirst({
      where: {
        id: dto.environmentId,
        ...(organizationId ? { organizationId } : {}),
      },
      include: {
        api: {
          include: {
            project: true,
          },
        },
      },
    });

    if (!environment) {
      throw new NotFoundException(`Environment with ID ${dto.environmentId} not found`);
    }

    const resolvedOrgId = organizationId || environment.organizationId || environment.api.project?.organizationId;
    const resolvedApiId = dto.apiId || environment.apiId;

    const endpointPath = this.normalizeEndpoint(dto.endpoint || dto.url);
    const intervalSeconds = dto.intervalSeconds ?? dto.interval ?? 60;

    // Timeout resolution (supports both timeout in seconds and timeoutMs in milliseconds)
    let timeoutMs = dto.timeoutMs;
    if (dto.timeout !== undefined) {
      timeoutMs = dto.timeout > 100 ? dto.timeout : dto.timeout * 1000;
    }
    if (timeoutMs === undefined) {
      timeoutMs = 10000;
    }

    // Validation rule: timeout must be strictly less than the scheduled interval
    if (timeoutMs >= intervalSeconds * 1000) {
      throw new BadRequestException(
        `Timeout (${timeoutMs}ms) must be less than the monitoring interval (${intervalSeconds * 1000}ms)`,
      );
    }

    const isActive = dto.isActive ?? dto.enabled ?? true;
    const expectedStatus = dto.expectedStatusCode ?? dto.expectedStatus ?? 200;

    // Build assertions list with default statusCode assertion if none provided
    const assertions = dto.assertions || [];
    if (!assertions.some((a: any) => a.type === 'statusCode')) {
      assertions.push({
        type: 'statusCode',
        expected: expectedStatus,
      });
    }

    const monitor = await this.prisma.monitor.create({
      data: {
        name: dto.name.trim(),
        description: dto.description?.trim() || null,
        method: dto.method || HttpMethod.GET,
        url: endpointPath,
        headers: dto.headers ?? {},
        body: dto.body || null,
        intervalSeconds,
        timeoutMs,
        isActive,
        assertions,
        apiId: resolvedApiId,
        environmentId: dto.environmentId,
        organizationId: resolvedOrgId,
      },
      include: {
        environment: {
          include: {
            api: true,
          },
        },
      },
    });

    // Also register MonitorConfig entry for unified configuration
    try {
      await this.prisma.monitorConfig.create({
        data: {
          id: monitor.id,
          name: monitor.name,
          description: monitor.description,
          method: monitor.method,
          url: monitor.url,
          headers: monitor.headers ?? {},
          body: monitor.body,
          queryParams: dto.queryParams ?? {},
          interval: intervalSeconds,
          timeout: timeoutMs,
          enabled: isActive,
          expectedStatus,
          expectedResponse: assertions,
          apiId: resolvedApiId,
          environmentId: dto.environmentId,
          organizationId: resolvedOrgId,
        },
      });
    } catch (err: any) {
      this.logger.debug(`Unified MonitorConfig record created or already exists: ${err.message}`);
    }

    // Register background repeatable schedule in BullMQ (organization-aware)
    try {
      await this.schedulerService.scheduleMonitor({
        id: monitor.id,
        organizationId: resolvedOrgId,
        apiId: resolvedApiId,
        environmentId: monitor.environmentId,
        intervalSeconds,
        isActive,
      });
    } catch (err: any) {
      this.logger.warn(`Could not register schedule in BullMQ queue: ${err.message}`);
    }

    return monitor;
  }

  async findAll(filter?: {
    environmentId?: string;
    apiId?: string;
    organizationId?: string;
  }) {
    return this.prisma.monitor.findMany({
      where: {
        ...(filter?.organizationId ? { organizationId: filter.organizationId } : {}),
        ...(filter?.environmentId ? { environmentId: filter.environmentId } : {}),
        ...(filter?.apiId ? { environment: { apiId: filter.apiId } } : {}),
      },
      include: {
        environment: {
          include: {
            api: true,
          },
        },
        executions: {
          take: 1,
          orderBy: { executedAt: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, organizationId?: string) {
    const monitor = await this.prisma.monitor.findFirst({
      where: {
        id,
        ...(organizationId ? { organizationId } : {}),
      },
      include: {
        environment: {
          include: {
            api: {
              include: {
                project: true,
              },
            },
          },
        },
        executions: {
          take: 10,
          orderBy: { executedAt: 'desc' },
        },
      },
    });

    if (!monitor) {
      throw new NotFoundException(`Monitor with ID ${id} not found`);
    }

    return monitor;
  }

  async update(id: string, dto: UpdateMonitorDto, organizationId?: string) {
    const existing = await this.findOne(id, organizationId);

    // If changing environmentId, verify that the new environment exists and belongs to the same organization
    let targetEnvId = existing.environmentId;
    let targetApiId = existing.apiId || existing.environment?.apiId;

    if (dto.environmentId && dto.environmentId !== existing.environmentId) {
      const targetEnv = await this.prisma.environment.findFirst({
        where: {
          id: dto.environmentId,
          ...(organizationId ? { organizationId } : {}),
        },
        include: {
          api: {
            include: {
              project: true,
            },
          },
        },
      });

      if (!targetEnv) {
        throw new NotFoundException(`Environment with ID ${dto.environmentId} not found`);
      }

      targetEnvId = dto.environmentId;
      targetApiId = targetEnv.apiId;
    }

    const intervalSeconds = dto.intervalSeconds ?? dto.interval ?? existing.intervalSeconds;

    let timeoutMs = existing.timeoutMs;
    if (dto.timeoutMs !== undefined) {
      timeoutMs = dto.timeoutMs;
    } else if (dto.timeout !== undefined) {
      timeoutMs = dto.timeout > 100 ? dto.timeout : dto.timeout * 1000;
    }

    if (timeoutMs >= intervalSeconds * 1000) {
      throw new BadRequestException(
        `Timeout (${timeoutMs}ms) must be less than the monitoring interval (${intervalSeconds * 1000}ms)`,
      );
    }

    const endpointPath = dto.endpoint || dto.url ? this.normalizeEndpoint(dto.endpoint || dto.url) : existing.url;
    const isActive = dto.isActive ?? dto.enabled ?? existing.isActive;

    // Handle assertions update or expected status update
    let assertions = dto.assertions ?? (existing.assertions as any[]);
    const expectedStatus = dto.expectedStatusCode ?? dto.expectedStatus;
    if (expectedStatus !== undefined) {
      assertions = (assertions || []).filter((a: any) => a.type !== 'statusCode');
      assertions.push({
        type: 'statusCode',
        expected: expectedStatus,
      });
    }

    const updated = await this.prisma.monitor.update({
      where: { id },
      data: {
        name: dto.name ? dto.name.trim() : existing.name,
        description: dto.description !== undefined ? dto.description : existing.description,
        method: dto.method ?? existing.method,
        url: endpointPath,
        intervalSeconds,
        timeoutMs,
        isActive,
        headers: dto.headers ?? (existing.headers as any),
        body: dto.body !== undefined ? dto.body : existing.body,
        assertions,
        apiId: targetApiId,
        environmentId: targetEnvId,
      },
      include: {
        environment: {
          include: {
            api: true,
          },
        },
      },
    });

    // Update corresponding MonitorConfig
    try {
      await this.prisma.monitorConfig.upsert({
        where: { id },
        create: {
          id: updated.id,
          name: updated.name,
          description: updated.description,
          method: updated.method,
          url: updated.url,
          headers: updated.headers ?? {},
          body: updated.body,
          interval: intervalSeconds,
          timeout: timeoutMs,
          enabled: isActive,
          expectedStatus: expectedStatus || 200,
          expectedResponse: assertions,
          apiId: targetApiId,
          environmentId: targetEnvId,
          organizationId: existing.organizationId,
        },
        update: {
          name: updated.name,
          description: updated.description,
          method: updated.method,
          url: updated.url,
          headers: updated.headers ?? {},
          body: updated.body,
          interval: intervalSeconds,
          timeout: timeoutMs,
          enabled: isActive,
          expectedStatus: expectedStatus || 200,
          expectedResponse: assertions,
          apiId: targetApiId,
          environmentId: targetEnvId,
        },
      });
    } catch (e: any) {
      this.logger.debug(`MonitorConfig upsert handled: ${e.message}`);
    }

    try {
      await this.schedulerService.scheduleMonitor({
        id: updated.id,
        organizationId: existing.organizationId,
        apiId: targetApiId,
        environmentId: targetEnvId,
        intervalSeconds,
        isActive,
      });
    } catch (err: any) {
      this.logger.warn(`Could not update BullMQ schedule for monitor ${id}: ${err.message}`);
    }

    return updated;
  }

  async delete(id: string, organizationId?: string) {
    await this.findOne(id, organizationId);

    try {
      await this.schedulerService.unscheduleMonitor(id);
    } catch (err: any) {
      this.logger.warn(`Could not unschedule monitor ${id}: ${err.message}`);
    }

    try {
      await this.prisma.monitorConfig.delete({ where: { id } }).catch(() => null);
    } catch {}

    return this.prisma.monitor.delete({
      where: { id },
      include: {
        environment: {
          include: {
            api: true,
          },
        },
      },
    });
  }

  async toggle(id: string, enabled?: boolean, organizationId?: string) {
    const existing = await this.findOne(id, organizationId);
    const newActiveState = enabled !== undefined ? enabled : !existing.isActive;

    const updated = await this.prisma.monitor.update({
      where: { id },
      data: {
        isActive: newActiveState,
      },
      include: {
        environment: {
          include: {
            api: true,
          },
        },
      },
    });

    try {
      await this.prisma.monitorConfig.update({
        where: { id },
        data: { enabled: newActiveState },
      }).catch(() => null);
    } catch {}

    try {
      await this.schedulerService.scheduleMonitor({
        id: updated.id,
        organizationId: existing.organizationId,
        apiId: updated.apiId || updated.environment?.apiId,
        environmentId: updated.environmentId,
        intervalSeconds: updated.intervalSeconds,
        isActive: newActiveState,
      });
    } catch (err: any) {
      this.logger.warn(`Could not toggle schedule in BullMQ for monitor ${id}: ${err.message}`);
    }

    return updated;
  }

  async getExecutions(
    id: string,
    optionsOrLimit: any = 50,
    offset: number = 0,
    organizationId?: string,
  ) {
    await this.findOne(id, organizationId);
    return this.executionService.getRecentExecutions(id, optionsOrLimit, offset);
  }

  async getExecutionById(id: string, executionId: string, organizationId?: string) {
    await this.findOne(id, organizationId);
    return this.executionService.getExecutionById(id, executionId);
  }

  async triggerManualRun(id: string, organizationId?: string) {
    const existing = await this.findOne(id, organizationId);
    return this.schedulerService.triggerImmediateRun({
      id,
      organizationId: existing.organizationId,
      apiId: existing.apiId || existing.environment?.apiId,
      environmentId: existing.environmentId,
    });
  }

  // ==========================================
  // MonitorConfig Specific Operations
  // ==========================================

  async createConfig(dto: CreateMonitorDto, organizationId: string) {
    const monitor = await this.create(dto, organizationId);
    return {
      ...monitor,
      interval: monitor.intervalSeconds,
      timeout: monitor.timeoutMs,
      enabled: monitor.isActive,
      expectedStatus: dto.expectedStatus ?? dto.expectedStatusCode ?? 200,
    };
  }

  async findAllConfigs(filter: {
    organizationId: string;
    apiId?: string;
    environmentId?: string;
  }) {
    return this.prisma.monitorConfig.findMany({
      where: {
        organizationId: filter.organizationId,
        ...(filter.apiId ? { apiId: filter.apiId } : {}),
        ...(filter.environmentId ? { environmentId: filter.environmentId } : {}),
      },
      include: {
        api: true,
        environment: true,
        results: {
          take: 1,
          orderBy: { timestamp: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOneConfig(id: string, organizationId: string) {
    const config = await this.prisma.monitorConfig.findFirst({
      where: {
        id,
        organizationId,
      },
      include: {
        api: true,
        environment: true,
        results: {
          take: 10,
          orderBy: { timestamp: 'desc' },
        },
      },
    });

    if (!config) {
      throw new NotFoundException(`MonitorConfig ${id} not found`);
    }

    return config;
  }

  async updateConfig(id: string, dto: UpdateMonitorDto, organizationId: string) {
    return this.update(id, dto, organizationId);
  }

  async deleteConfig(id: string, organizationId: string) {
    return this.delete(id, organizationId);
  }

  async getResults(filter: {
    organizationId: string;
    apiId?: string;
    environmentId?: string;
    monitorConfigId?: string;
    limit?: number;
    offset?: number;
    from?: Date;
    to?: Date;
  }) {
    return this.executionService.getMonitorResults(filter);
  }

  async getHealth(id: string, organizationId?: string, policy?: HealthPolicyConfig) {
    return this.healthEvaluationService.evaluateMonitor(id, organizationId, policy);
  }
}

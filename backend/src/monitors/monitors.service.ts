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
import { HttpMethod } from '@prisma/client';

@Injectable()
export class MonitorsService {
  private readonly logger = new Logger(MonitorsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly schedulerService: MonitorSchedulerService,
    private readonly executionService: MonitorExecutionService,
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

  async create(dto: CreateMonitorDto, organizationId?: string) {
    if (!dto.name || !dto.name.trim()) {
      throw new BadRequestException('Monitor name is required');
    }

    if (!dto.environmentId) {
      throw new BadRequestException('environmentId is required');
    }

    // Verify Environment existence and resolve full ownership hierarchy
    const environment = await this.prisma.environment.findUnique({
      where: { id: dto.environmentId },
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

    // Authorization: Verify organization boundary if tenant is scoped
    if (organizationId && environment.api.project.organizationId !== organizationId) {
      throw new ForbiddenException('Access denied: Environment belongs to another organization');
    }

    const endpointPath = this.normalizeEndpoint(dto.endpoint || dto.url);
    const intervalSeconds = dto.intervalSeconds ?? dto.interval ?? 60;

    // Timeout resolution (supports both timeout in seconds and timeoutMs in milliseconds)
    let timeoutMs = dto.timeoutMs;
    if (dto.timeout !== undefined) {
      timeoutMs = dto.timeout * 1000;
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
    if (!assertions.some((a) => a.type === 'statusCode')) {
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
        environmentId: dto.environmentId,
      },
      include: {
        environment: {
          include: {
            api: true,
          },
        },
      },
    });

    // Register background repeatable schedule if scheduler is active
    try {
      await this.schedulerService.scheduleMonitor(monitor);
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
        ...(filter?.environmentId ? { environmentId: filter.environmentId } : {}),
        ...(filter?.apiId ? { environment: { apiId: filter.apiId } } : {}),
        ...(filter?.organizationId
          ? { environment: { api: { project: { organizationId: filter.organizationId } } } }
          : {}),
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
    const monitor = await this.prisma.monitor.findUnique({
      where: { id },
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

    if (
      organizationId &&
      monitor.environment.api.project.organizationId !== organizationId
    ) {
      throw new ForbiddenException('Access denied: Monitor belongs to another organization');
    }

    return monitor;
  }

  async update(id: string, dto: UpdateMonitorDto, organizationId?: string) {
    const existing = await this.findOne(id, organizationId);

    // If changing environmentId, verify that the new environment exists and belongs to the same organization
    let targetEnvId = existing.environmentId;
    if (dto.environmentId && dto.environmentId !== existing.environmentId) {
      const targetEnv = await this.prisma.environment.findUnique({
        where: { id: dto.environmentId },
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

      if (
        organizationId &&
        targetEnv.api.project.organizationId !== organizationId
      ) {
        throw new ForbiddenException('Access denied: Target environment belongs to another organization');
      }

      targetEnvId = dto.environmentId;
    }

    const intervalSeconds = dto.intervalSeconds ?? dto.interval ?? existing.intervalSeconds;

    let timeoutMs = existing.timeoutMs;
    if (dto.timeoutMs !== undefined) {
      timeoutMs = dto.timeoutMs;
    } else if (dto.timeout !== undefined) {
      timeoutMs = dto.timeout * 1000;
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

    try {
      await this.schedulerService.scheduleMonitor(updated);
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
      await this.schedulerService.scheduleMonitor(updated);
    } catch (err: any) {
      this.logger.warn(`Could not toggle schedule in BullMQ for monitor ${id}: ${err.message}`);
    }

    return updated;
  }

  async getExecutions(id: string, limit: number = 50, organizationId?: string) {
    await this.findOne(id, organizationId);
    return this.executionService.getRecentExecutions(id, limit);
  }

  async triggerManualRun(id: string, organizationId?: string) {
    await this.findOne(id, organizationId);
    await this.schedulerService.triggerImmediateRun(id);
    return { message: `Immediate check queued for monitor ${id}` };
  }
}

import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { getMetricDefinition } from '../../dashboards/metric-registry';
import { CreateAlertRuleDto } from '../dto/create-alert-rule.dto';
import { UpdateAlertRuleDto } from '../dto/update-alert-rule.dto';
import { QueryAlertRulesDto } from '../dto/query-alert-rules.dto';
import { AlertEvaluationService } from './alert-evaluation.service';

@Injectable()
export class AlertRulesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly evaluationService: AlertEvaluationService,
  ) {}

  /**
   * Creates an AlertRule with multi-tenant hierarchy validation.
   */
  async create(dto: CreateAlertRuleDto, organizationId?: string) {
    // 1. Validate metric exists in MetricRegistry
    const metricDef = getMetricDefinition(dto.metric);
    if (!metricDef) {
      throw new BadRequestException(`Unsupported metric: "${dto.metric}"`);
    }

    // 2. Validate Project existence and tenant isolation
    const project = await this.prisma.project.findUnique({
      where: { id: dto.projectId },
    });
    if (!project) {
      throw new NotFoundException(`Project with ID ${dto.projectId} not found`);
    }
    if (organizationId && project.organizationId !== organizationId) {
      throw new ForbiddenException('You do not have access to this project');
    }

    // 3. Validate hierarchical dimensions
    if (dto.apiId) {
      const api = await this.prisma.api.findUnique({ where: { id: dto.apiId } });
      if (!api || api.projectId !== project.id) {
        throw new BadRequestException(`API ${dto.apiId} does not belong to Project ${project.id}`);
      }
    }

    if (dto.environmentId) {
      const env = await this.prisma.environment.findUnique({
        where: { id: dto.environmentId },
        include: { api: true },
      });
      if (!env || env.api.projectId !== project.id) {
        throw new BadRequestException(`Environment ${dto.environmentId} is invalid for this project`);
      }
    }

    if (dto.monitorId) {
      const mon = await this.prisma.monitor.findUnique({
        where: { id: dto.monitorId },
        include: { environment: { include: { api: true } } },
      });
      if (!mon || mon.environment.api.projectId !== project.id) {
        throw new BadRequestException(`Monitor ${dto.monitorId} is invalid for this project`);
      }
    }

    if (dto.notificationConfig) {
      this.validateNotificationConfig(dto.notificationConfig);
    }

    return this.prisma.alertRule.create({
      data: {
        name: dto.name.trim(),
        description: dto.description?.trim(),
        projectId: dto.projectId,
        metric: dto.metric,
        apiId: dto.apiId ?? null,
        environmentId: dto.environmentId ?? null,
        monitorId: dto.monitorId ?? null,
        condition: dto.condition,
        threshold: dto.threshold,
        duration: dto.duration ?? 0,
        evaluationInterval: dto.evaluationInterval ?? 60,
        severity: dto.severity ?? 'WARNING',
        labels: dto.labels ?? {},
        notificationConfig: dto.notificationConfig ?? {},
        enabled: dto.enabled ?? true,
        createdBy: dto.createdBy,
      },
      include: {
        project: true,
        api: true,
        environment: true,
        monitor: true,
      },
    });
  }

  async findAll(query: QueryAlertRulesDto, organizationId?: string) {
    const where: any = {};

    if (query.projectId) where.projectId = query.projectId;
    if (query.apiId) where.apiId = query.apiId;
    if (query.environmentId) where.environmentId = query.environmentId;
    if (query.monitorId) where.monitorId = query.monitorId;
    if (query.metric) where.metric = query.metric;
    if (query.enabled !== undefined) {
      where.enabled = query.enabled === 'true';
    }

    if (organizationId) {
      where.project = { organizationId };
    }

    return this.prisma.alertRule.findMany({
      where,
      include: {
        project: { select: { id: true, name: true } },
        api: { select: { id: true, name: true } },
        environment: { select: { id: true, name: true } },
        monitor: { select: { id: true, name: true } },
        instances: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            id: true,
            status: true,
            currentValue: true,
            threshold: true,
            lastEvaluatedAt: true,
            startedAt: true,
            pendingSince: true,
          },
        },
        evaluations: {
          orderBy: { evaluatedAt: 'desc' },
          take: 1,
          select: {
            id: true,
            value: true,
            conditionMet: true,
            stateBefore: true,
            stateAfter: true,
            evaluatedAt: true,
          },
        },
        deliveries: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            id: true,
            status: true,
            sentAt: true,
            createdAt: true,
            recipient: true,
            eventType: true,
          },
        },
        _count: {
          select: {
            instances: true,
            evaluations: true,
            deliveries: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, organizationId?: string) {
    const rule = await this.prisma.alertRule.findUnique({
      where: { id },
      include: {
        project: true,
        api: true,
        environment: true,
        monitor: true,
        instances: {
          include: {
            incidentAlerts: {
              include: {
                incident: {
                  include: {
                    project: { select: { id: true, name: true } },
                    api: { select: { id: true, name: true } },
                    environment: { select: { id: true, name: true } },
                  },
                },
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
        evaluations: {
          orderBy: { evaluatedAt: 'desc' },
          take: 50,
        },
        deliveries: {
          orderBy: { createdAt: 'desc' },
          take: 50,
        },
      },
    });

    if (!rule) {
      throw new NotFoundException(`AlertRule ${id} not found`);
    }

    if (organizationId && rule.project.organizationId !== organizationId) {
      throw new ForbiddenException('You do not have access to this alert rule');
    }

    return rule;
  }

  async findEvaluations(ruleId: string, limit = 50) {
    return this.prisma.alertEvaluation.findMany({
      where: { alertRuleId: ruleId },
      orderBy: { evaluatedAt: 'desc' },
      take: Math.min(limit, 100),
    });
  }

  async update(id: string, dto: UpdateAlertRuleDto, organizationId?: string) {
    const existing = await this.findOne(id, organizationId);

    if (dto.metric) {
      const def = getMetricDefinition(dto.metric);
      if (!def) throw new BadRequestException(`Unsupported metric: "${dto.metric}"`);
    }

    if (dto.notificationConfig !== undefined) {
      this.validateNotificationConfig(dto.notificationConfig);
    }

    return this.prisma.alertRule.update({
      where: { id: existing.id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.description !== undefined ? { description: dto.description?.trim() } : {}),
        ...(dto.projectId !== undefined ? { projectId: dto.projectId } : {}),
        ...(dto.metric !== undefined ? { metric: dto.metric } : {}),
        ...(dto.apiId !== undefined ? { apiId: dto.apiId } : {}),
        ...(dto.environmentId !== undefined ? { environmentId: dto.environmentId } : {}),
        ...(dto.monitorId !== undefined ? { monitorId: dto.monitorId } : {}),
        ...(dto.condition !== undefined ? { condition: dto.condition } : {}),
        ...(dto.threshold !== undefined ? { threshold: dto.threshold } : {}),
        ...(dto.duration !== undefined ? { duration: dto.duration } : {}),
        ...(dto.evaluationInterval !== undefined ? { evaluationInterval: dto.evaluationInterval } : {}),
        ...(dto.severity !== undefined ? { severity: dto.severity } : {}),
        ...(dto.labels !== undefined ? { labels: dto.labels } : {}),
        ...(dto.notificationConfig !== undefined ? { notificationConfig: dto.notificationConfig } : {}),
        ...(dto.enabled !== undefined ? { enabled: dto.enabled } : {}),
      },
      include: {
        project: true,
        api: true,
        environment: true,
        monitor: true,
      },
    });
  }

  private validateNotificationConfig(config?: Record<string, any>) {
    if (!config || !config.email) return;
    const email = config.email;
    if (email.enabled) {
      if (!Array.isArray(email.recipients) || email.recipients.length === 0) {
        throw new BadRequestException('Add at least one email recipient.');
      }

      const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
      const seen = new Set<string>();

      for (const r of email.recipients) {
        const trimmed = typeof r === 'string' ? r.trim() : '';
        if (!trimmed || !emailRegex.test(trimmed)) {
          throw new BadRequestException(`Invalid email recipient: "${r}"`);
        }
        const lower = trimmed.toLowerCase();
        if (seen.has(lower)) {
          throw new BadRequestException(`Duplicate email recipient: "${r}"`);
        }
        seen.add(lower);
      }

      if (email.onFiring === false && email.onResolved === false) {
        throw new BadRequestException('At least one notification event (Alert fires or Alert resolves) must be selected.');
      }
    }
  }

  async delete(id: string, organizationId?: string) {
    const existing = await this.findOne(id, organizationId);
    return this.prisma.alertRule.delete({
      where: { id: existing.id },
    });
  }

  async enable(id: string, organizationId?: string) {
    const existing = await this.findOne(id, organizationId);
    return this.prisma.alertRule.update({
      where: { id: existing.id },
      data: { enabled: true },
    });
  }

  async disable(id: string, organizationId?: string) {
    const existing = await this.findOne(id, organizationId);
    return this.prisma.alertRule.update({
      where: { id: existing.id },
      data: { enabled: false },
    });
  }

  async test(id: string, organizationId?: string) {
    await this.findOne(id, organizationId);
    return this.evaluationService.testRule(id);
  }
}

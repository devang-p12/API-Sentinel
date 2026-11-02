import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { getMetricDefinition } from '../../dashboards/metric-registry';
import {
  isMetricSupported,
  normalizeAlertMetric,
  normalizeOperator,
} from '../alert-rules.constants';
import { CreateAlertRuleDto } from '../dto/create-alert-rule.dto';
import { UpdateAlertRuleDto } from '../dto/update-alert-rule.dto';
import { QueryAlertRulesDto } from '../dto/query-alert-rules.dto';
import { AlertEvaluationService } from './alert-evaluation.service';
import { GrafanaAlertsService } from './grafana-alerts.service';
import { AlertCondition, AlertSeverity } from '@prisma/client';

@Injectable()
export class AlertRulesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly evaluationService: AlertEvaluationService,
    private readonly grafanaAlertsService: GrafanaAlertsService,
  ) {}

  /**
   * Evaluates an operator against a value and threshold.
   */
  private evaluateCondition(
    val: number,
    operator: string,
    threshold: number,
  ): boolean {
    switch (operator) {
      case '>':
      case 'GREATER_THAN':
        return val > threshold;
      case '>=':
      case 'GREATER_THAN_OR_EQUAL':
        return val >= threshold;
      case '<':
      case 'LESS_THAN':
        return val < threshold;
      case '<=':
      case 'LESS_THAN_OR_EQUAL':
        return val <= threshold;
      case '==':
      case '=':
      case 'EQUAL':
        return val === threshold;
      case '!=':
      case 'NOT_EQUAL':
        return val !== threshold;
      default:
        return val > threshold;
    }
  }

  /**
   * Creates an AlertRule with multi-tenant hierarchy validation,
   * creates the corresponding Grafana Alert Rule, and records an AlertEvent.
   */
  async create(dto: CreateAlertRuleDto, organizationId?: string) {
    // 1. Validate metric: either supported Phase 9 metric or in MetricRegistry
    const isSupported = isMetricSupported(dto.metric);
    const metricDef = getMetricDefinition(dto.metric);
    if (!isSupported && !metricDef) {
      throw new BadRequestException(`Unsupported metric: "${dto.metric}"`);
    }

    const normalizedMetric = isSupported
      ? normalizeAlertMetric(dto.metric)
      : dto.metric;

    // 2. Normalize operator & condition
    const opInfo = normalizeOperator(dto.operator || dto.condition);

    // 3. Resolve Organization and Project/API context
    let targetOrgId = organizationId || dto.organizationId;
    let resolvedProjectId = dto.projectId;

    if (dto.apiId) {
      const api = await this.prisma.api.findFirst({
        where: {
          id: dto.apiId,
          ...(targetOrgId ? { organizationId: targetOrgId } : {}),
        },
      });
      if (!api) {
        throw new NotFoundException(`API with ID ${dto.apiId} not found`);
      }
      targetOrgId = api.organizationId;
      if (!resolvedProjectId && api.projectId) {
        resolvedProjectId = api.projectId;
      }
    }

    if (resolvedProjectId) {
      const project = await this.prisma.project.findFirst({
        where: {
          id: resolvedProjectId,
          ...(targetOrgId ? { organizationId: targetOrgId } : {}),
        },
      });
      if (!project) {
        throw new NotFoundException(`Project with ID ${resolvedProjectId} not found`);
      }
      targetOrgId = project.organizationId;
    }

    if (!targetOrgId) {
      throw new BadRequestException('Organization ID is required');
    }

    // 4. Validate Environment if provided
    if (dto.environmentId) {
      const env = await this.prisma.environment.findFirst({
        where: {
          id: dto.environmentId,
          organizationId: targetOrgId,
        },
      });
      if (!env) {
        throw new BadRequestException(`Environment ${dto.environmentId} not found`);
      }
    }

    // 5. Validate Monitor if provided
    if (dto.monitorId) {
      const mon = await this.prisma.monitor.findFirst({
        where: {
          id: dto.monitorId,
          ...(resolvedProjectId ? { environment: { api: { projectId: resolvedProjectId } } } : {}),
        },
      });
      if (!mon) {
        throw new BadRequestException(`Monitor ${dto.monitorId} is invalid`);
      }
    }

    if (dto.notificationConfig) {
      this.validateNotificationConfig(dto.notificationConfig);
    }

    // 6. Create internal Grafana Alert Rule via Grafana API
    const grafanaRuleUid = await this.grafanaAlertsService.createAlertRule({
      name: dto.name.trim(),
      metric: normalizedMetric,
      operator: opInfo.symbol,
      threshold: dto.threshold,
      duration: dto.duration ?? 0,
      severity: dto.severity ?? 'WARNING',
      enabled: dto.enabled ?? true,
      labels: {
        organization_id: targetOrgId,
        ...(dto.apiId ? { api_id: dto.apiId } : {}),
        ...(dto.environmentId ? { environment_id: dto.environmentId } : {}),
      },
    });

    // 7. Store logical alert configuration in PostgreSQL
    const rule = await this.prisma.alertRule.create({
      data: {
        name: dto.name.trim(),
        description: dto.description?.trim(),
        projectId: resolvedProjectId ?? null,
        organizationId: targetOrgId,
        metric: normalizedMetric,
        apiId: dto.apiId ?? null,
        environmentId: dto.environmentId ?? null,
        monitorId: dto.monitorId ?? null,
        operator: opInfo.symbol,
        condition: opInfo.condition as AlertCondition,
        threshold: dto.threshold,
        duration: dto.duration ?? 0,
        evaluationInterval: dto.evaluationInterval ?? 60,
        severity: dto.severity ?? 'WARNING',
        labels: dto.labels ?? {},
        notificationConfig: dto.notificationConfig ?? {},
        notificationChannels: dto.notificationChannels ?? [],
        grafanaRuleUid,
        cooldownSeconds: dto.cooldownSeconds ?? 300,
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

    // 8. Record initial AlertEvent
    await this.prisma.alertEvent.create({
      data: {
        organizationId: targetOrgId,
        alertRuleId: rule.id,
        type: 'CREATED',
        message: `Alert rule "${rule.name}" created`,
        severity: rule.severity,
        threshold: rule.threshold,
        metadata: {
          metric: rule.metric,
          operator: rule.operator,
          grafanaRuleUid,
        },
      },
    });

    return rule;
  }

  async findAll(query: QueryAlertRulesDto, organizationId?: string) {
    const where: any = {};

    if (query.projectId) where.projectId = query.projectId;
    if (query.apiId) where.apiId = query.apiId;
    if (query.environmentId) {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(query.environmentId);
      if (isUuid) {
        where.environmentId = query.environmentId;
      } else {
        where.environment = {
          name: { equals: query.environmentId, mode: 'insensitive' },
        };
      }
    }
    if (query.monitorId) where.monitorId = query.monitorId;
    if (query.metric) where.metric = query.metric;
    if (query.enabled !== undefined) {
      where.enabled = query.enabled === 'true';
    }

    if (organizationId) {
      where.organizationId = organizationId;
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
        events: {
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
        _count: {
          select: {
            instances: true,
            evaluations: true,
            deliveries: true,
            events: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, organizationId?: string) {
    const rule = await this.prisma.alertRule.findFirst({
      where: {
        id,
        ...(organizationId ? { organizationId } : {}),
      },
      include: {
        project: true,
        api: true,
        environment: true,
        monitor: true,
        events: {
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
        instances: {
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

    return rule;
  }

  async findEvaluations(ruleId: string, limit = 50, organizationId?: string) {
    if (organizationId) {
      await this.findOne(ruleId, organizationId);
    }

    return this.prisma.alertEvaluation.findMany({
      where: { alertRuleId: ruleId },
      orderBy: { evaluatedAt: 'desc' },
      take: Math.min(limit, 100),
    });
  }

  async update(id: string, dto: UpdateAlertRuleDto, organizationId?: string) {
    const existing = await this.findOne(id, organizationId);

    let normalizedMetric: string | undefined = undefined;
    if (dto.metric) {
      const isSupported = isMetricSupported(dto.metric);
      const metricDef = getMetricDefinition(dto.metric);
      if (!isSupported && !metricDef) {
        throw new BadRequestException(`Unsupported metric: "${dto.metric}"`);
      }
      normalizedMetric = isSupported ? normalizeAlertMetric(dto.metric) : dto.metric;
    }

    let opInfo: { symbol: string; condition: string } | undefined = undefined;
    if (dto.operator || dto.condition) {
      opInfo = normalizeOperator(dto.operator || dto.condition);
    }

    if (dto.notificationConfig !== undefined) {
      this.validateNotificationConfig(dto.notificationConfig);
    }

    // Sync changes to Grafana alert rule
    if (existing.grafanaRuleUid) {
      await this.grafanaAlertsService.updateAlertRule(existing.grafanaRuleUid, {
        name: dto.name,
        threshold: dto.threshold,
        operator: opInfo?.symbol,
        duration: dto.duration,
        severity: dto.severity,
        enabled: dto.enabled,
      });
    }

    const updated = await this.prisma.alertRule.update({
      where: { id: existing.id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.description !== undefined ? { description: dto.description?.trim() } : {}),
        ...(dto.projectId !== undefined ? { projectId: dto.projectId } : {}),
        ...(normalizedMetric !== undefined ? { metric: normalizedMetric } : {}),
        ...(dto.apiId !== undefined ? { apiId: dto.apiId } : {}),
        ...(dto.environmentId !== undefined ? { environmentId: dto.environmentId } : {}),
        ...(dto.monitorId !== undefined ? { monitorId: dto.monitorId } : {}),
        ...(opInfo ? { operator: opInfo.symbol, condition: opInfo.condition as AlertCondition } : {}),
        ...(dto.threshold !== undefined ? { threshold: dto.threshold } : {}),
        ...(dto.duration !== undefined ? { duration: dto.duration } : {}),
        ...(dto.evaluationInterval !== undefined ? { evaluationInterval: dto.evaluationInterval } : {}),
        ...(dto.severity !== undefined ? { severity: dto.severity } : {}),
        ...(dto.notificationChannels !== undefined ? { notificationChannels: dto.notificationChannels } : {}),
        ...(dto.cooldownSeconds !== undefined ? { cooldownSeconds: dto.cooldownSeconds } : {}),
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

    // Record AlertEvent
    await this.prisma.alertEvent.create({
      data: {
        organizationId: existing.organizationId,
        alertRuleId: existing.id,
        type: 'UPDATED',
        message: `Alert rule "${updated.name}" updated`,
        severity: updated.severity,
        threshold: updated.threshold,
        metadata: {
          updatedFields: Object.keys(dto),
        },
      },
    });

    return updated;
  }

  async delete(id: string, organizationId?: string) {
    const existing = await this.findOne(id, organizationId);

    // Delete Grafana alert rule
    if (existing.grafanaRuleUid) {
      await this.grafanaAlertsService.deleteAlertRule(existing.grafanaRuleUid);
    }

    return this.prisma.alertRule.delete({
      where: { id: existing.id },
    });
  }

  async enable(id: string, organizationId?: string) {
    const existing = await this.findOne(id, organizationId);

    if (existing.grafanaRuleUid) {
      await this.grafanaAlertsService.toggleAlertRule(existing.grafanaRuleUid, true);
    }

    const updated = await this.prisma.alertRule.update({
      where: { id: existing.id },
      data: { enabled: true },
    });

    await this.prisma.alertEvent.create({
      data: {
        organizationId: existing.organizationId,
        alertRuleId: existing.id,
        type: 'ENABLED',
        message: `Alert rule "${existing.name}" enabled`,
        severity: existing.severity,
      },
    });

    return updated;
  }

  async disable(id: string, organizationId?: string) {
    const existing = await this.findOne(id, organizationId);

    if (existing.grafanaRuleUid) {
      await this.grafanaAlertsService.toggleAlertRule(existing.grafanaRuleUid, false);
    }

    const updated = await this.prisma.alertRule.update({
      where: { id: existing.id },
      data: { enabled: false },
    });

    await this.prisma.alertEvent.create({
      data: {
        organizationId: existing.organizationId,
        alertRuleId: existing.id,
        type: 'DISABLED',
        message: `Alert rule "${existing.name}" disabled`,
        severity: existing.severity,
      },
    });

    return updated;
  }

  /**
   * Evaluates an alert rule against an observed metric value,
   * enforcing condition evaluation and deduplication / cooldown suppression.
   */
  async evaluateRule(ruleId: string, metricValue?: number, organizationId?: string) {
    if (metricValue === undefined || metricValue === null || isNaN(metricValue)) {
      await this.findOne(ruleId, organizationId);
      const evalRes = await this.evaluationService.evaluateRule(ruleId);
      return {
        triggered: evalRes?.conditionMet ?? false,
        evaluation: evalRes,
      };
    }

    const rule = await this.findOne(ruleId, organizationId);


    if (!rule.enabled) {
      return {
        triggered: false,
        suppressed: false,
        reason: 'Alert rule is disabled',
      };
    }

    const operator = rule.operator || rule.condition || '>';
    const isBreached = this.evaluateCondition(metricValue, operator, rule.threshold);

    if (!isBreached) {
      return {
        triggered: false,
        suppressed: false,
        metricValue,
        threshold: rule.threshold,
        operator,
      };
    }

    // Condition is breached! Check cooldown / deduplication window
    const now = new Date();
    const cooldownMs = (rule.cooldownSeconds ?? 300) * 1000;
    const isWithinCooldown =
      rule.lastTriggeredAt &&
      now.getTime() - rule.lastTriggeredAt.getTime() < cooldownMs;

    if (isWithinCooldown) {
      const remainingSeconds = Math.ceil(
        (cooldownMs - (now.getTime() - rule.lastTriggeredAt!.getTime())) / 1000,
      );

      const event = await this.prisma.alertEvent.create({
        data: {
          organizationId: rule.organizationId,
          alertRuleId: rule.id,
          type: 'SUPPRESSED_COOLDOWN',
          metricValue,
          threshold: rule.threshold,
          severity: rule.severity,
          message: `Alert "${rule.name}" breached threshold (${metricValue} ${operator} ${rule.threshold}) but suppressed due to active cooldown (${remainingSeconds}s remaining)`,
          metadata: {
            cooldownSeconds: rule.cooldownSeconds,
            remainingSeconds,
          },
        },
      });

      return {
        triggered: true,
        suppressed: true,
        reason: 'Cooldown active',
        cooldownRemainingSeconds: remainingSeconds,
        event,
      };
    }

    // Cooldown expired or first trigger: Fire alert!
    await this.prisma.alertRule.update({
      where: { id: rule.id },
      data: { lastTriggeredAt: now },
    });

    const event = await this.prisma.alertEvent.create({
      data: {
        organizationId: rule.organizationId,
        alertRuleId: rule.id,
        type: 'FIRING',
        metricValue,
        threshold: rule.threshold,
        severity: rule.severity,
        message: `Alert "${rule.name}" FIRING: observed value ${metricValue} breached threshold ${rule.threshold} (${operator})`,
        metadata: {
          operator,
          notificationChannels: rule.notificationChannels,
        },
      },
    });

    return {
      triggered: true,
      suppressed: false,
      event,
    };
  }

  /**
   * Retrieves alert event history for a specific rule.
   */
  async findEvents(ruleId: string, organizationId?: string, limit = 50) {
    if (organizationId) {
      await this.findOne(ruleId, organizationId);
    }

    return this.prisma.alertEvent.findMany({
      where: {
        alertRuleId: ruleId,
        ...(organizationId ? { organizationId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 200),
    });
  }

  /**
   * Retrieves alert event history across all rules in an organization.
   */
  async findAllEvents(organizationId: string, limit = 50) {
    return this.prisma.alertEvent.findMany({
      where: { organizationId },
      include: {
        alertRule: {
          select: {
            id: true,
            name: true,
            metric: true,
            severity: true,
            grafanaRuleUid: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 200),
    });
  }

  private validateNotificationConfig(config?: Record<string, any>) {
    if (!config || !config.email) return;
    const email = config.email;
    if (email.enabled) {
      if (!Array.isArray(email.recipients) || email.recipients.length === 0) {
        throw new BadRequestException('Add at least one email recipient.');
      }

      const emailRegex =
        /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
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
        throw new BadRequestException(
          'At least one notification event (Alert fires or Alert resolves) must be selected.',
        );
      }
    }
  }

  async test(id: string, organizationId?: string) {
    await this.findOne(id, organizationId);
    return this.evaluationService.testRule(id);
  }
}

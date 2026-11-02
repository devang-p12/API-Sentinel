import { Injectable, NotFoundException } from '@nestjs/common';
import { AlertState } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { QueryAlertsDto } from '../dto/query-alerts.dto';

@Injectable()
export class AlertInstancesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Retrieves alert instances with flexible filtering (Section 20).
   */
  async findAll(query: QueryAlertsDto, organizationId?: string) {
    const where: any = {};

    if (query.status) where.status = query.status;
    if (query.alertRuleId) where.alertRuleId = query.alertRuleId;

    if (query.severity) {
      where.alertRule = { ...(where.alertRule || {}), severity: query.severity };
    }

    if (query.projectId) {
      where.alertRule = { ...(where.alertRule || {}), projectId: query.projectId };
    }

    if (query.apiId) {
      where.alertRule = { ...(where.alertRule || {}), apiId: query.apiId };
    }

    if (query.environmentId) {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(query.environmentId);
      if (isUuid) {
        where.alertRule = { ...(where.alertRule || {}), environmentId: query.environmentId };
      } else {
        where.alertRule = {
          ...(where.alertRule || {}),
          environment: {
            name: { equals: query.environmentId, mode: 'insensitive' },
          },
        };
      }
    }

    if (query.monitorId) {
      where.alertRule = { ...(where.alertRule || {}), monitorId: query.monitorId };
    }

    if (organizationId) {
      where.alertRule = {
        ...(where.alertRule || {}),
        project: { organizationId },
      };
    }

    if (query.from || query.to) {
      where.createdAt = {};
      if (query.from) where.createdAt.gte = new Date(query.from);
      if (query.to) where.createdAt.lte = new Date(query.to);
    }

    const limit = query.limit ? Math.min(parseInt(query.limit, 10), 100) : 50;
    const offset = query.offset ? parseInt(query.offset, 10) : 0;

    const [items, total] = await Promise.all([
      this.prisma.alertInstance.findMany({
        where,
        include: {
          alertRule: {
            include: {
              project: { select: { id: true, name: true } },
              api: { select: { id: true, name: true } },
              environment: { select: { id: true, name: true } },
              monitor: { select: { id: true, name: true } },
            },
          },
        },
        orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
        take: limit,
        skip: offset,
      }),
      this.prisma.alertInstance.count({ where }),
    ]);

    return {
      items,
      total,
      limit,
      offset,
    };
  }

  /**
   * Returns counts of active, pending, resolved alerts (Section 28).
   */
  async getSummary(projectId?: string, organizationId?: string) {
    const where: any = {};
    if (projectId) where.alertRule = { projectId };
    if (organizationId) where.alertRule = { ...(where.alertRule || {}), project: { organizationId } };

    const [firing, pending, resolved, total] = await Promise.all([
      this.prisma.alertInstance.count({ where: { ...where, status: AlertState.FIRING } }),
      this.prisma.alertInstance.count({ where: { ...where, status: AlertState.PENDING } }),
      this.prisma.alertInstance.count({ where: { ...where, status: AlertState.RESOLVED } }),
      this.prisma.alertInstance.count({ where }),
    ]);

    return {
      firing,
      pending,
      resolved,
      total,
    };
  }

  /**
   * Returns a single AlertInstance with full rule metadata and recent evaluation history.
   */
  async findOne(id: string, organizationId?: string) {
    const instance = await this.prisma.alertInstance.findUnique({
      where: { id },
      include: {
        alertRule: {
          include: {
            project: true,
            api: true,
            environment: true,
            monitor: true,
          },
        },
        evaluations: {
          orderBy: { evaluatedAt: 'desc' },
          take: 50,
        },
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
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!instance) {
      throw new NotFoundException(`AlertInstance ${id} not found`);
    }

    if (organizationId && instance.alertRule.project.organizationId !== organizationId) {
      throw new NotFoundException(`AlertInstance ${id} not found`);
    }

    return instance;
  }

  /**
   * Retrieves historical evaluations for an alert instance (Section 20 & 26).
   */
  async findEvaluations(instanceId: string, limit = 50) {
    const evaluations = await this.prisma.alertEvaluation.findMany({
      where: { alertInstanceId: instanceId },
      orderBy: { evaluatedAt: 'desc' },
      take: Math.min(limit, 100),
    });

    return evaluations;
  }
}

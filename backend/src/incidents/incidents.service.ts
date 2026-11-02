import { Injectable, NotFoundException, Optional, Logger } from '@nestjs/common';
import { ActorType, IncidentEventType, IncidentStatus, Prisma, NotificationEventType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { QueryIncidentsDto } from './dto/query-incidents.dto';
import { NotificationRoutingService } from '../notifications/services/notification-routing.service';

@Injectable()
export class IncidentsService {
  private readonly logger = new Logger(IncidentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly notificationRoutingService?: NotificationRoutingService,
  ) {}

  private mapIncidentWithDuration(incident: any) {
    const now = Date.now();
    const durationSeconds = incident.resolvedAt
      ? Math.round(
          (new Date(incident.resolvedAt).getTime() - new Date(incident.startedAt).getTime()) / 1000,
        )
      : Math.round((now - new Date(incident.startedAt).getTime()) / 1000);

    return {
      ...incident,
      durationSeconds,
    };
  }

  async findAll(query: QueryIncidentsDto = {}, organizationId?: string) {
    const where: Prisma.IncidentWhereInput = {};

    if (organizationId) {
      where.organizationId = organizationId;
    }
    if (query.status) {
      where.status = query.status;
    }
    if (query.severity) {
      where.severity = query.severity;
    }
    if (query.projectId) {
      where.projectId = query.projectId;
    }
    if (query.apiId) {
      where.apiId = query.apiId;
    }
    if (query.environmentId) {
      where.environmentId = query.environmentId;
    }
    if (query.search) {
      where.OR = [
        { title: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
        { api: { name: { contains: query.search, mode: 'insensitive' } } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.incident.findMany({
        where,
        include: {
          project: { select: { id: true, name: true } },
          api: { select: { id: true, name: true } },
          environment: { select: { id: true, name: true } },
          _count: {
            select: {
              alerts: true,
              events: true,
            },
          },
        },
        orderBy: { startedAt: 'desc' },
        take: query.limit ?? 50,
        skip: query.offset ?? 0,
      }),
      this.prisma.incident.count({ where }),
    ]);

    return {
      items: items.map((inc) => this.mapIncidentWithDuration(inc)),
      total,
      limit: query.limit ?? 50,
      offset: query.offset ?? 0,
    };
  }

  async getSummary(organizationId?: string, projectId?: string) {
    const where: Prisma.IncidentWhereInput = {
      ...(organizationId ? { organizationId } : {}),
      ...(projectId ? { projectId } : {}),
    };

    const [open, acknowledged, resolved, total] = await Promise.all([
      this.prisma.incident.count({ where: { ...where, status: IncidentStatus.OPEN } }),
      this.prisma.incident.count({ where: { ...where, status: IncidentStatus.ACKNOWLEDGED } }),
      this.prisma.incident.count({ where: { ...where, status: IncidentStatus.RESOLVED } }),
      this.prisma.incident.count({ where }),
    ]);

    return {
      open,
      acknowledged,
      resolved,
      total,
    };
  }

  async findOne(id: string, organizationId?: string) {
    const incident = await this.prisma.incident.findFirst({
      where: {
        id,
        ...(organizationId ? { organizationId } : {}),
      },
      include: {
        project: { select: { id: true, name: true } },
        api: { select: { id: true, name: true } },
        environment: { select: { id: true, name: true } },
        alerts: {
          include: {
            alertInstance: {
              include: {
                alertRule: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
        events: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!incident) {
      throw new NotFoundException(`Incident with ID ${id} not found`);
    }

    return this.mapIncidentWithDuration(incident);
  }

  async acknowledge(id: string, user?: { id?: string; name?: string }, organizationId?: string) {
    const incident = await this.findOne(id, organizationId);

    if (incident.status === IncidentStatus.RESOLVED) {
      return this.mapIncidentWithDuration(incident);
    }

    const now = new Date();
    const actorName = user?.name || 'Authorized Engineer';

    const updated = await this.prisma.$transaction(async (tx) => {
      const inc = await tx.incident.update({
        where: { id },
        data: {
          status: IncidentStatus.ACKNOWLEDGED,
          acknowledgedAt: now,
          acknowledgedBy: actorName,
        },
      });

      await tx.incidentEvent.create({
        data: {
          incidentId: id,
          type: IncidentEventType.ACKNOWLEDGED,
          message: `Incident acknowledged by ${actorName}`,
          actorType: ActorType.USER,
          actorId: user?.id ?? null,
          createdAt: now,
        },
      });

      return inc;
    });

    return this.findOne(updated.id, organizationId);
  }

  async resolve(id: string, user?: { id?: string; name?: string }, organizationId?: string) {
    const incident = await this.findOne(id, organizationId);

    if (incident.status === IncidentStatus.RESOLVED) {
      return this.mapIncidentWithDuration(incident);
    }

    const now = new Date();
    const actorName = user?.name || 'Authorized Engineer';

    const updated = await this.prisma.$transaction(async (tx) => {
      const inc = await tx.incident.update({
        where: { id },
        data: {
          status: IncidentStatus.RESOLVED,
          resolvedAt: now,
          resolvedBy: actorName,
        },
      });

      await tx.incidentEvent.create({
        data: {
          incidentId: id,
          type: IncidentEventType.RESOLVED,
          message: `Incident resolved by ${actorName}`,
          actorType: ActorType.USER,
          actorId: user?.id ?? null,
          createdAt: now,
        },
      });

      return inc;
    });

    // Notify on incident resolution
    if (this.notificationRoutingService) {
      try {
        await this.notificationRoutingService.routeIncidentNotification(
          incident.id,
          NotificationEventType.RECOVERY,
        );
      } catch (err: any) {
        this.logger.warn(`Could not dispatch resolution notification: ${err.message}`);
      }
    }

    return this.findOne(updated.id, organizationId);
  }

  async getTimeline(id: string, organizationId?: string) {
    const incident = await this.findOne(id, organizationId);

    return this.prisma.incidentEvent.findMany({
      where: { incidentId: incident.id },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getAlerts(id: string, organizationId?: string) {
    const incident = await this.findOne(id, organizationId);

    const alerts = await this.prisma.incidentAlert.findMany({
      where: { incidentId: incident.id },
      include: {
        alertInstance: {
          include: {
            alertRule: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return alerts.map((a) => a.alertInstance);
  }
}

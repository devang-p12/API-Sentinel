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

  async findAll(query: QueryIncidentsDto = {}) {
    const where: Prisma.IncidentWhereInput = {};

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

  async getSummary(projectId?: string) {
    const where: Prisma.IncidentWhereInput = projectId ? { projectId } : {};

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

  async findOne(id: string) {
    const incident = await this.prisma.incident.findUnique({
      where: { id },
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

  async acknowledge(id: string, user?: { id?: string; name?: string }) {
    const incident = await this.prisma.incident.findUnique({ where: { id } });
    if (!incident) {
      throw new NotFoundException(`Incident with ID ${id} not found`);
    }

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

    return this.findOne(updated.id);
  }

  async resolve(id: string, user?: { id?: string; name?: string }) {
    const incident = await this.prisma.incident.findUnique({ where: { id } });
    if (!incident) {
      throw new NotFoundException(`Incident with ID ${id} not found`);
    }

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
          message: `Incident manually resolved by ${actorName}`,
          actorType: ActorType.USER,
          actorId: user?.id ?? null,
          createdAt: now,
        },
      });

      return inc;
    });

    if (this.notificationRoutingService) {
      try {
        await this.notificationRoutingService.routeIncidentNotification(
          id,
          NotificationEventType.RECOVERY,
        );
      } catch (err: any) {
        this.logger.error(
          `[NotificationRouting] Failed to route manual RECOVERY notification for Incident ${id}: ${err.message}`,
        );
      }
    }

    return this.findOne(updated.id);
  }

  async getTimeline(id: string) {
    await this.findOne(id);
    return this.prisma.incidentEvent.findMany({
      where: { incidentId: id },
      orderBy: { createdAt: 'asc' },
    });
  }

  async getAlerts(id: string) {
    const incident = await this.findOne(id);
    return incident.alerts.map((a: any) => ({
      ...a.alertInstance,
      attachedAt: a.createdAt,
    }));
  }
}

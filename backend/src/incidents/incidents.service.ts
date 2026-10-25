import { Injectable, NotFoundException } from '@nestjs/common';
import { IncidentStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class IncidentsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(status?: IncidentStatus, alertId?: string) {
    return this.prisma.incident.findMany({
      where: {
        status: status || undefined,
        alertId: alertId || undefined,
      },
      include: {
        alert: {
          include: {
            monitor: {
              include: {
                environment: true,
              },
            },
          },
        },
      },
      orderBy: { startedAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const incident = await this.prisma.incident.findUnique({
      where: { id },
      include: {
        alert: {
          include: {
            monitor: {
              include: {
                environment: true,
              },
            },
          },
        },
      },
    });

    if (!incident) {
      throw new NotFoundException(`Incident with ID ${id} not found`);
    }

    return incident;
  }

  async acknowledge(id: string) {
    await this.findOne(id);
    return this.prisma.incident.update({
      where: { id },
      data: {
        status: IncidentStatus.ACKNOWLEDGED,
      },
    });
  }

  async resolve(id: string) {
    await this.findOne(id);
    return this.prisma.incident.update({
      where: { id },
      data: {
        status: IncidentStatus.RESOLVED,
        resolvedAt: new Date(),
      },
    });
  }
}

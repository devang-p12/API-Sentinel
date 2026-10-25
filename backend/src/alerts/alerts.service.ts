import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAlertDto } from './dto/create-alert.dto';

@Injectable()
export class AlertsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateAlertDto) {
    const monitor = await this.prisma.monitor.findUnique({
      where: { id: dto.monitorId },
    });

    if (!monitor) {
      throw new NotFoundException(`Monitor with ID ${dto.monitorId} not found`);
    }

    const condition = {
      consecutiveFailures: dto.consecutiveFailures ?? 2,
      latencyThresholdMs: dto.latencyThresholdMs ?? null,
    };

    return this.prisma.alert.create({
      data: {
        name: dto.name,
        severity: dto.severity,
        condition,
        isEnabled: dto.isEnabled ?? true,
        monitorId: dto.monitorId,
      },
      include: {
        monitor: true,
      },
    });
  }

  async findAll(monitorId?: string) {
    return this.prisma.alert.findMany({
      where: monitorId ? { monitorId } : undefined,
      include: {
        monitor: true,
        incidents: {
          orderBy: { startedAt: 'desc' },
          take: 5,
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const alert = await this.prisma.alert.findUnique({
      where: { id },
      include: {
        monitor: true,
        incidents: {
          orderBy: { startedAt: 'desc' },
        },
      },
    });

    if (!alert) {
      throw new NotFoundException(`Alert with ID ${id} not found`);
    }

    return alert;
  }
}

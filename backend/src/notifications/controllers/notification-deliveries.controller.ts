import { Controller, Get, Param, Query } from '@nestjs/common';
import {
  NotificationDeliveryStatus,
  NotificationEventType,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { SecretEncryptionService } from '../services/secret-encryption.service';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';

@Controller()
export class NotificationDeliveriesController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly encryptionService: SecretEncryptionService,
  ) {}

  @Get('notification-deliveries')
  async findAll(
    @CurrentUser() user: any,
    @Query('status') status?: NotificationDeliveryStatus,
    @Query('eventType') eventType?: NotificationEventType,
    @Query('incidentId') incidentId?: string,
    @Query('contactPointId') contactPointId?: string,
    @Query('limit') limitStr?: string,
    @Query('offset') offsetStr?: string,
  ) {
    const where: Prisma.NotificationDeliveryWhereInput = {
      organizationId: user.organizationId,
    };
    if (status) where.status = status;
    if (eventType) where.eventType = eventType;
    if (incidentId) where.incidentId = incidentId;
    if (contactPointId) where.contactPointId = contactPointId;

    const limit = limitStr ? parseInt(limitStr, 10) : 50;
    const offset = offsetStr ? parseInt(offsetStr, 10) : 0;

    const [items, total] = await Promise.all([
      this.prisma.notificationDelivery.findMany({
        where,
        include: {
          contactPoint: {
            select: { id: true, name: true, type: true, isEnabled: true },
          },
          policy: {
            select: { id: true, name: true, priority: true },
          },
          incident: {
            select: {
              id: true,
              title: true,
              severity: true,
              status: true,
              startedAt: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.notificationDelivery.count({ where }),
    ]);

    return {
      items,
      total,
      limit,
      offset,
    };
  }

  @Get('notification-deliveries/:id')
  async findOne(
    @CurrentUser() user: any,
    @Param('id') id: string,
  ) {
    const item = await this.prisma.notificationDelivery.findFirst({
      where: {
        id,
        organizationId: user.organizationId,
      },
      include: {
        contactPoint: true,
        policy: true,
        incident: true,
      },
    });

    if (!item) return null;

    return {
      ...item,
      contactPoint: item.contactPoint
        ? {
            ...item.contactPoint,
            configuration: this.encryptionService.maskConfig(
              item.contactPoint.configuration as Record<string, any>,
            ),
          }
        : null,
    };
  }

  /**
   * Incident-specific notification delivery audit history. (Section 21)
   */
  @Get('incidents/:id/notifications')
  async findForIncident(
    @CurrentUser() user: any,
    @Param('id') incidentId: string,
  ) {
    return this.prisma.notificationDelivery.findMany({
      where: {
        incidentId,
        organizationId: user.organizationId,
      },
      include: {
        contactPoint: {
          select: { id: true, name: true, type: true },
        },
        policy: {
          select: { id: true, name: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}

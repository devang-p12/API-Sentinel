import { Injectable, NotFoundException, Logger, BadRequestException } from '@nestjs/common';
import { ContactPointType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { SecretEncryptionService } from './secret-encryption.service';
import { WebhookSecurityService } from './webhook-security.service';
import { EmailNotificationChannel } from '../channels/email-notification.channel';
import { SlackNotificationChannel } from '../channels/slack-notification.channel';
import { WebhookNotificationChannel } from '../channels/webhook-notification.channel';

export interface CreateContactPointDto {
  name: string;
  type: ContactPointType;
  configuration: Record<string, any>;
  isEnabled?: boolean;
}

export interface UpdateContactPointDto {
  name?: string;
  type?: ContactPointType;
  configuration?: Record<string, any>;
  isEnabled?: boolean;
}

@Injectable()
export class ContactPointsService {
  private readonly logger = new Logger(ContactPointsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryptionService: SecretEncryptionService,
    private readonly securityService: WebhookSecurityService,
    private readonly emailChannel: EmailNotificationChannel,
    private readonly slackChannel: SlackNotificationChannel,
    private readonly webhookChannel: WebhookNotificationChannel,
  ) {}

  private async resolveOrgId(organizationId?: string): Promise<string> {
    if (organizationId) return organizationId;
    const defaultOrg = await this.prisma.organization.findFirst({
      orderBy: { createdAt: 'asc' },
    });
    if (!defaultOrg) {
      throw new BadRequestException('No default organization found');
    }
    return defaultOrg.id;
  }

  async create(data: CreateContactPointDto, organizationId?: string) {
    const orgId = await this.resolveOrgId(organizationId);

    // Validate URL format for Webhook and Slack contact points
    if (data.type === ContactPointType.WEBHOOK || data.type === ContactPointType.SLACK) {
      const targetUrl = data.configuration?.url || data.configuration?.webhookUrl;
      if (targetUrl) {
        this.securityService.validateUrl(targetUrl);
      }
    }

    // Encrypt sensitive fields
    const encryptedConfig = this.encryptionService.encryptConfig(data.configuration || {});

    const created = await this.prisma.contactPoint.create({
      data: {
        organizationId: orgId,
        name: data.name,
        type: data.type,
        configuration: encryptedConfig,
        isEnabled: data.isEnabled ?? true,
      },
    });

    return {
      ...created,
      configuration: this.encryptionService.maskConfig(created.configuration as Record<string, any>),
    };
  }

  async findAll(organizationId?: string) {
    const orgId = await this.resolveOrgId(organizationId);

    const points = await this.prisma.contactPoint.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { deliveries: true },
        },
      },
    });

    return points.map((p) => ({
      ...p,
      configuration: this.encryptionService.maskConfig(p.configuration as Record<string, any>),
    }));
  }

  async findOne(id: string, organizationId?: string) {
    const orgId = await this.resolveOrgId(organizationId);

    const point = await this.prisma.contactPoint.findFirst({
      where: { id, organizationId: orgId },
    });

    if (!point) {
      throw new NotFoundException(`ContactPoint with ID ${id} not found`);
    }

    return {
      ...point,
      configuration: this.encryptionService.maskConfig(point.configuration as Record<string, any>),
    };
  }

  async update(id: string, data: UpdateContactPointDto, organizationId?: string) {
    await this.findOne(id, organizationId);

    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.type !== undefined) updateData.type = data.type;
    if (data.isEnabled !== undefined) updateData.isEnabled = data.isEnabled;
    if (data.configuration !== undefined) {
      updateData.configuration = this.encryptionService.encryptConfig(data.configuration);
    }

    const updated = await this.prisma.contactPoint.update({
      where: { id },
      data: updateData,
    });

    return {
      ...updated,
      configuration: this.encryptionService.maskConfig(updated.configuration as Record<string, any>),
    };
  }

  async remove(id: string, organizationId?: string) {
    await this.findOne(id, organizationId);
    return this.prisma.contactPoint.delete({
      where: { id },
    });
  }

  /**
   * Tests a contact point without triggering any real alerts or production incidents. (Section 20)
   */
  async testContactPoint(id: string, organizationId?: string) {
    const point = await this.prisma.contactPoint.findFirst({
      where: { id },
    });

    if (!point) {
      throw new NotFoundException(`ContactPoint with ID ${id} not found`);
    }

    // Decrypt configuration for live dispatch
    const decryptedConfig = this.encryptionService.decryptConfig(
      point.configuration as Record<string, any>,
    );

    const testPayload = {
      eventType: 'TEST' as const,
      incidentTitle: 'Test Notification from API Sentinel',
      incidentSeverity: 'INFO',
      incidentStatus: 'OPEN',
      serviceName: 'Demo Service',
      environmentName: 'Testing',
      projectName: 'Sentinel Platform',
      testMessage: 'This is a test notification confirming your Contact Point configuration is valid.',
      alerts: [
        {
          ruleName: 'Synthetic Health Probe',
          metric: 'p95_latency',
          currentValue: 120,
          threshold: 500,
          severity: 'INFO',
        },
      ],
      startedAt: new Date().toISOString(),
    };

    let result;
    if (point.type === ContactPointType.EMAIL) {
      result = await this.emailChannel.send(decryptedConfig, testPayload);
    } else if (point.type === ContactPointType.SLACK) {
      result = await this.slackChannel.send(decryptedConfig, testPayload);
    } else if (point.type === ContactPointType.WEBHOOK) {
      result = await this.webhookChannel.send(decryptedConfig, testPayload);
    } else {
      throw new BadRequestException(`Unsupported channel type: ${point.type}`);
    }

    return {
      contactPointId: point.id,
      name: point.name,
      type: point.type,
      ...result,
    };
  }
}

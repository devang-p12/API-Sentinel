import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationPoliciesService, LabelMatcher } from './notification-policies.service';

export interface CreateNotificationSilenceDto {
  matchers: LabelMatcher[];
  startsAt: string;
  endsAt: string;
  reason?: string;
  createdBy?: string;
}

@Injectable()
export class NotificationSilencesService {
  private readonly logger = new Logger(NotificationSilencesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly policiesService: NotificationPoliciesService,
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

  async create(data: CreateNotificationSilenceDto, organizationId?: string) {
    const orgId = await this.resolveOrgId(organizationId);

    const startsAt = new Date(data.startsAt);
    const endsAt = new Date(data.endsAt);

    if (isNaN(startsAt.getTime()) || isNaN(endsAt.getTime())) {
      throw new BadRequestException('Invalid start or end date format');
    }

    if (endsAt <= startsAt) {
      throw new BadRequestException('Silence endsAt must be after startsAt');
    }

    return this.prisma.notificationSilence.create({
      data: {
        organizationId: orgId,
        matchers: (data.matchers || []) as any,
        startsAt,
        endsAt,
        reason: data.reason || 'Scheduled maintenance silence',
        createdBy: data.createdBy || 'Sentinel Engineer',
      },
    });
  }

  async findAll(organizationId?: string) {
    const orgId = await this.resolveOrgId(organizationId);
    return this.prisma.notificationSilence.findMany({
      where: { organizationId: orgId },
      orderBy: { startsAt: 'desc' },
    });
  }

  async remove(id: string, organizationId?: string) {
    const orgId = await this.resolveOrgId(organizationId);
    const silence = await this.prisma.notificationSilence.findFirst({
      where: { id, organizationId: orgId },
    });
    if (!silence) {
      throw new NotFoundException(`Silence with ID ${id} not found`);
    }
    return this.prisma.notificationSilence.delete({
      where: { id },
    });
  }

  /**
   * Checks whether the active silences cover the given labels. (Section 32)
   */
  async checkSilence(labels: Record<string, string>, organizationId?: string): Promise<{ silenced: boolean; reason?: string }> {
    const orgId = await this.resolveOrgId(organizationId);
    const now = new Date();

    const activeSilences = await this.prisma.notificationSilence.findMany({
      where: {
        organizationId: orgId,
        startsAt: { lte: now },
        endsAt: { gte: now },
      },
    });

    for (const silence of activeSilences) {
      const matchers = silence.matchers as unknown as LabelMatcher[];
      if (this.policiesService.matchesLabels(matchers, labels)) {
        return {
          silenced: true,
          reason: silence.reason || 'Silenced by scheduled maintenance window',
        };
      }
    }

    return { silenced: false };
  }
}

import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface LabelMatcher {
  label: string;
  operator: '=' | '!=' | 'contains' | 'regex' | 'in';
  value: string;
}

export interface CreateNotificationPolicyDto {
  name: string;
  description?: string;
  isEnabled?: boolean;
  priority?: number;
  matchers?: LabelMatcher[];
  contactPointIds: string[];
  notifyOnFiring?: boolean;
  notifyOnRecovery?: boolean;
  repeatInterval?: number;
}

export interface UpdateNotificationPolicyDto {
  name?: string;
  description?: string;
  isEnabled?: boolean;
  priority?: number;
  matchers?: LabelMatcher[];
  contactPointIds?: string[];
  notifyOnFiring?: boolean;
  notifyOnRecovery?: boolean;
  repeatInterval?: number;
}

@Injectable()
export class NotificationPoliciesService {
  private readonly logger = new Logger(NotificationPoliciesService.name);

  constructor(private readonly prisma: PrismaService) {}

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

  async create(data: CreateNotificationPolicyDto, organizationId?: string) {
    const orgId = await this.resolveOrgId(organizationId);

    // Validate that contact points exist
    if (data.contactPointIds && data.contactPointIds.length > 0) {
      const count = await this.prisma.contactPoint.count({
        where: {
          id: { in: data.contactPointIds },
          organizationId: orgId,
        },
      });
      if (count !== data.contactPointIds.length) {
        throw new BadRequestException('One or more specified ContactPoint IDs are invalid');
      }
    }

    return this.prisma.notificationPolicy.create({
      data: {
        organizationId: orgId,
        name: data.name,
        description: data.description,
        isEnabled: data.isEnabled ?? true,
        priority: data.priority ?? 100,
        matchers: (data.matchers || []) as any,
        contactPointIds: (data.contactPointIds || []) as any,
        notifyOnFiring: data.notifyOnFiring ?? true,
        notifyOnRecovery: data.notifyOnRecovery ?? true,
        repeatInterval: data.repeatInterval ?? 0,
      },
    });
  }

  async findAll(organizationId?: string) {
    const orgId = await this.resolveOrgId(organizationId);

    const policies = await this.prisma.notificationPolicy.findMany({
      where: { organizationId: orgId },
      orderBy: [{ priority: 'asc' }, { createdAt: 'desc' }],
      include: {
        _count: {
          select: { deliveries: true },
        },
      },
    });

    // Populate contact point summaries for UI convenience
    const allPointIds = Array.from(
      new Set(
        policies.flatMap((p) =>
          Array.isArray(p.contactPointIds) ? (p.contactPointIds as string[]) : [],
        ),
      ),
    );

    const contactPoints = await this.prisma.contactPoint.findMany({
      where: { id: { in: allPointIds } },
      select: { id: true, name: true, type: true, isEnabled: true },
    });

    const pointMap = new Map(contactPoints.map((cp) => [cp.id, cp]));

    return policies.map((p) => {
      const ids = Array.isArray(p.contactPointIds) ? (p.contactPointIds as string[]) : [];
      return {
        ...p,
        contactPoints: ids.map((id) => pointMap.get(id)).filter(Boolean),
      };
    });
  }

  async findOne(id: string, organizationId?: string) {
    const orgId = await this.resolveOrgId(organizationId);

    const policy = await this.prisma.notificationPolicy.findFirst({
      where: { id, organizationId: orgId },
    });

    if (!policy) {
      throw new NotFoundException(`NotificationPolicy with ID ${id} not found`);
    }

    const ids = Array.isArray(policy.contactPointIds) ? (policy.contactPointIds as string[]) : [];
    const contactPoints = await this.prisma.contactPoint.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true, type: true, isEnabled: true },
    });

    return {
      ...policy,
      contactPoints,
    };
  }

  async update(id: string, data: UpdateNotificationPolicyDto, organizationId?: string) {
    await this.findOne(id, organizationId);

    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.isEnabled !== undefined) updateData.isEnabled = data.isEnabled;
    if (data.priority !== undefined) updateData.priority = data.priority;
    if (data.matchers !== undefined) updateData.matchers = data.matchers as any;
    if (data.contactPointIds !== undefined) {
      updateData.contactPointIds = data.contactPointIds as any;
    }
    if (data.notifyOnFiring !== undefined) updateData.notifyOnFiring = data.notifyOnFiring;
    if (data.notifyOnRecovery !== undefined) updateData.notifyOnRecovery = data.notifyOnRecovery;
    if (data.repeatInterval !== undefined) updateData.repeatInterval = data.repeatInterval;

    return this.prisma.notificationPolicy.update({
      where: { id },
      data: updateData,
    });
  }

  async remove(id: string, organizationId?: string) {
    await this.findOne(id, organizationId);
    return this.prisma.notificationPolicy.delete({
      where: { id },
    });
  }

  /**
   * Evaluates if a set of policy matchers match against the given label dictionary.
   */
  matchesLabels(matchers: LabelMatcher[], labels: Record<string, string>): boolean {
    if (!matchers || matchers.length === 0) {
      // Empty matchers = catch-all default policy
      return true;
    }

    for (const m of matchers) {
      const actualValue = labels[m.label] !== undefined ? String(labels[m.label]) : '';
      const targetValue = m.value;

      switch (m.operator) {
        case '=':
          if (actualValue.toLowerCase() !== targetValue.toLowerCase()) {
            return false;
          }
          break;
        case '!=':
          if (actualValue.toLowerCase() === targetValue.toLowerCase()) {
            return false;
          }
          break;
        case 'contains':
          if (!actualValue.toLowerCase().includes(targetValue.toLowerCase())) {
            return false;
          }
          break;
        case 'regex':
          try {
            const re = new RegExp(targetValue, 'i');
            if (!re.test(actualValue)) return false;
          } catch {
            return false;
          }
          break;
        case 'in':
          const allowed = targetValue.split(',').map((v) => v.trim().toLowerCase());
          if (!allowed.includes(actualValue.toLowerCase())) {
            return false;
          }
          break;
        default:
          return false;
      }
    }

    return true;
  }

  /**
   * Previews matching for a policy and returns evaluation details. (Section 30)
   */
  async previewMatch(matchers: LabelMatcher[], sampleLabels: Record<string, string>) {
    const isMatched = this.matchesLabels(matchers, sampleLabels);
    const matcherBreakdown = (matchers || []).map((m) => {
      const actual = sampleLabels[m.label] ?? null;
      let matched = false;
      if (actual !== null) {
        matched = this.matchesLabels([m], { [m.label]: actual });
      }
      return {
        label: m.label,
        operator: m.operator,
        expected: m.value,
        actual,
        matched,
      };
    });

    return {
      matched: isMatched,
      sampleLabels,
      breakdown: matcherBreakdown,
    };
  }
}

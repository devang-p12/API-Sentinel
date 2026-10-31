import { Injectable, Logger, Inject } from '@nestjs/common';
import { Queue } from 'bullmq';
import {
  NotificationEventType,
  NotificationDeliveryStatus,
  IncidentStatus,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationPoliciesService, LabelMatcher } from './notification-policies.service';
import { NotificationSilencesService } from './notification-silences.service';
import { NOTIFICATION_BULL_QUEUE } from '../../queue/queue.constants';

@Injectable()
export class NotificationRoutingService {
  private readonly logger = new Logger(NotificationRoutingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly policiesService: NotificationPoliciesService,
    private readonly silencesService: NotificationSilencesService,
    @Inject(NOTIFICATION_BULL_QUEUE) private readonly notificationQueue: Queue,
  ) {}

  /**
   * Main entry point for routing incident-level notifications.
   * Section 7, 8, 9, 10, 13, 31, 34
   */
  async routeIncidentNotification(
    incidentId: string,
    eventType: NotificationEventType,
  ): Promise<string[]> {
    const incident = await this.prisma.incident.findUnique({
      where: { id: incidentId },
      include: {
        project: {
          include: { organization: true },
        },
        api: true,
        environment: true,
        alerts: {
          include: {
            alertInstance: {
              include: {
                alertRule: true,
              },
            },
          },
        },
      },
    });

    if (!incident) {
      this.logger.warn(`Cannot route notification: Incident ${incidentId} not found`);
      return [];
    }

    const orgId = incident.project.organizationId;

    // 1. Collect and normalize all labels/context (Section 6 & 8)
    const labels: Record<string, string> = {
      severity: incident.severity.toLowerCase(),
      status: incident.status.toLowerCase(),
      project: incident.project.name.toLowerCase(),
      service: incident.api?.name?.toLowerCase() || 'unknown',
      api: incident.api?.name?.toLowerCase() || 'unknown',
      environment: incident.environment?.name?.toLowerCase() || 'unknown',
    };

    // Merge labels from all attached alert rules
    for (const a of incident.alerts) {
      const ruleLabels = a.alertInstance.alertRule.labels;
      if (ruleLabels && typeof ruleLabels === 'object') {
        for (const [k, v] of Object.entries(ruleLabels)) {
          labels[k.toLowerCase()] = String(v).toLowerCase();
        }
      }
    }

    // 2. Check active maintenance silences (Section 32)
    const silenceCheck = await this.silencesService.checkSilence(labels, orgId);
    if (silenceCheck.silenced) {
      this.logger.log(
        `[NotificationRouter] Suppressed notification for Incident ${incident.id} (${eventType}): ${silenceCheck.reason}`,
      );
      return [];
    }

    // 3. Find matching active policies for organization (Section 5 & 6)
    const policies = await this.prisma.notificationPolicy.findMany({
      where: {
        organizationId: orgId,
        isEnabled: true,
      },
      orderBy: { priority: 'asc' },
    });

    const matchingPolicies = policies.filter((p) => {
      // Event type gating
      if (eventType === NotificationEventType.FIRING && !p.notifyOnFiring) return false;
      if (eventType === NotificationEventType.RECOVERY && !p.notifyOnRecovery) return false;
      if (eventType === NotificationEventType.REPEAT && (p.repeatInterval || 0) <= 0) return false;

      // Label matcher evaluation
      const matchers = p.matchers as unknown as LabelMatcher[];
      return this.policiesService.matchesLabels(matchers, labels);
    });

    if (matchingPolicies.length === 0) {
      this.logger.debug(
        `[NotificationRouter] No matching notification policies for Incident ${incident.id} (${eventType}) with labels: ${JSON.stringify(labels)}`,
      );
      return [];
    }

    this.logger.log(
      `[NotificationRouter] Incident ${incident.id} (${eventType}) matched ${matchingPolicies.length} policy(ies): [${matchingPolicies.map((p) => p.name).join(', ')}]`,
    );

    const deliveryIds: string[] = [];

    // Track contact point IDs already scheduled for this incident & event to prevent duplicate sends (Section 31)
    const processedContactPoints = new Set<string>();

    for (const policy of matchingPolicies) {
      const contactPointIds = Array.isArray(policy.contactPointIds)
        ? (policy.contactPointIds as string[])
        : [];

      for (const cpId of contactPointIds) {
        if (processedContactPoints.has(cpId)) {
          // Contact point already targeted by a higher-priority policy
          continue;
        }

        // 4. Generate deterministic deduplication key (Section 13)
        let deduplicationKey: string;
        if (eventType === NotificationEventType.REPEAT) {
          const intervalMins = policy.repeatInterval || 30;
          const bucket = Math.floor(Date.now() / (intervalMins * 60 * 1000));
          deduplicationKey = `inc_${incident.id}_pol_${policy.id}_cp_${cpId}_REPEAT_${bucket}`;
        } else {
          deduplicationKey = `inc_${incident.id}_pol_${policy.id}_cp_${cpId}_${eventType}`;
        }

        // 5. Concurrency-safe delivery registration (Section 13 & 34)
        const advisoryLockKey = `notif_dedup:${deduplicationKey}`;

        const delivery = await this.prisma.$transaction(async (tx) => {
          await tx.$executeRawUnsafe('SELECT pg_advisory_xact_lock(hashtext($1))', advisoryLockKey);

          const existing = await tx.notificationDelivery.findUnique({
            where: { deduplicationKey },
          });

          if (existing) {
            return existing;
          }

          // Build snapshot payload
          const alertsSummary = incident.alerts.map((ia) => ({
            ruleName: ia.alertInstance.alertRule.name,
            metric: ia.alertInstance.alertRule.metric,
            currentValue: ia.alertInstance.currentValue,
            threshold: ia.alertInstance.threshold,
            severity: ia.alertInstance.alertRule.severity,
          }));

          const durationSeconds = incident.resolvedAt
            ? Math.round((incident.resolvedAt.getTime() - incident.startedAt.getTime()) / 1000)
            : Math.round((Date.now() - incident.startedAt.getTime()) / 1000);

          const payload = {
            incidentId: incident.id,
            incidentTitle: incident.title,
            incidentSeverity: incident.severity,
            incidentStatus: incident.status,
            serviceName: incident.api?.name || 'General Service',
            environmentName: incident.environment?.name || 'Production',
            projectName: incident.project.name,
            startedAt: incident.startedAt.toISOString(),
            resolvedAt: incident.resolvedAt?.toISOString(),
            durationSeconds,
            alerts: alertsSummary,
            eventType,
            frontendUrl: `http://localhost:5174/incidents`,
          };

          const newDelivery = await tx.notificationDelivery.create({
            data: {
              organizationId: orgId,
              incidentId: incident.id,
              contactPointId: cpId,
              policyId: policy.id,
              eventType,
              status: NotificationDeliveryStatus.PENDING,
              deduplicationKey,
              payload: payload as any,
              attemptCount: 0,
            },
          });

          return newDelivery;
        });

        processedContactPoints.add(cpId);
        deliveryIds.push(delivery.id);

        // 6. Enqueue BullMQ delivery job
        try {
          await this.notificationQueue.add(
            'deliver-notification',
            { deliveryId: delivery.id },
            {
              jobId: delivery.id,
              removeOnComplete: 100,
              removeOnFail: 500,
            },
          );
          this.logger.log(
            `[NotificationRouter] Queued delivery ${delivery.id} (${eventType}) for contact point ${cpId}`,
          );
        } catch (queueErr: any) {
          this.logger.error(
            `[NotificationRouter] Failed to enqueue delivery ${delivery.id}: ${queueErr.message}`,
          );
        }
      }
    }

    return deliveryIds;
  }

  /**
   * Periodic repeat notification evaluator for unresolved active incidents. (Section 15)
   */
  async evaluateRepeatNotifications(): Promise<void> {
    const activeIncidents = await this.prisma.incident.findMany({
      where: {
        status: { in: [IncidentStatus.OPEN, IncidentStatus.ACKNOWLEDGED] },
      },
      select: { id: true },
    });

    for (const inc of activeIncidents) {
      try {
        await this.routeIncidentNotification(inc.id, NotificationEventType.REPEAT);
      } catch (err: any) {
        this.logger.error(`Error in repeat notification check for ${inc.id}: ${err.message}`);
      }
    }
  }
}

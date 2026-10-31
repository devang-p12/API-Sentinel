import { Injectable, Logger, Optional } from '@nestjs/common';
import {
  AlertSeverity,
  AlertState,
  IncidentEventType,
  IncidentStatus,
  ActorType,
  NotificationEventType,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationRoutingService } from '../notifications/services/notification-routing.service';

const SEVERITY_WEIGHTS: Record<AlertSeverity, number> = {
  [AlertSeverity.INFO]: 0,
  [AlertSeverity.WARNING]: 1,
  [AlertSeverity.HIGH]: 2,
  [AlertSeverity.CRITICAL]: 3,
};

@Injectable()
export class IncidentCorrelationService {
  private readonly logger = new Logger(IncidentCorrelationService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly notificationRoutingService?: NotificationRoutingService,
  ) {}

  /**
   * Generates a deterministic correlation key based on project, API, and environment.
   * Section 7 & 36: Two firing alert instances belong to the same incident when they share projectId, apiId, environmentId.
   */
  getCorrelationKey(projectId: string, apiId?: string | null, environmentId?: string | null): string {
    return `incident_corr:${projectId}:${apiId || 'global'}:${environmentId || 'global'}`;
  }

  /**
   * Correlates a newly firing AlertInstance with an active incident or creates a new incident.
   * Section 9, 10, 11, 34, 35
   */
  async correlateAlertInstance(alertInstanceId: string): Promise<string | null> {
    const instance = await this.prisma.alertInstance.findUnique({
      where: { id: alertInstanceId },
      include: {
        alertRule: {
          include: {
            project: true,
            api: true,
            environment: true,
          },
        },
      },
    });

    if (!instance || instance.status !== AlertState.FIRING) {
      return null;
    }

    const rule = instance.alertRule;
    const projectId = rule.projectId;
    const apiId = rule.apiId;
    const environmentId = rule.environmentId;
    const correlationKey = this.getCorrelationKey(projectId, apiId, environmentId);

    const resultingIncidentId = await this.prisma.$transaction(async (tx) => {
      // Concurrency safety (Section 35): advisory lock on deterministic correlation key
      await tx.$executeRawUnsafe('SELECT pg_advisory_xact_lock(hashtext($1))', correlationKey);

      // Check if this alert instance is already attached to an active incident
      const existingAttachment = await tx.incidentAlert.findFirst({
        where: {
          alertInstanceId: instance.id,
          incident: {
            status: { in: [IncidentStatus.OPEN, IncidentStatus.ACKNOWLEDGED] },
          },
        },
        include: { incident: true },
      });

      if (existingAttachment) {
        this.logger.debug(
          `[IncidentEngine] AlertInstance ${instance.id} already attached to active Incident ${existingAttachment.incidentId}`,
        );
        return existingAttachment.incidentId;
      }

      // Find an active incident matching the correlation scope (Section 7 & 8)
      const activeIncident = await tx.incident.findFirst({
        where: {
          projectId,
          apiId: apiId ?? null,
          environmentId: environmentId ?? null,
          status: { in: [IncidentStatus.OPEN, IncidentStatus.ACKNOWLEDGED] },
        },
        orderBy: { createdAt: 'desc' },
      });

      const now = new Date();

      if (activeIncident) {
        // Case A: Attach to existing active incident (Section 11)
        await tx.incidentAlert.create({
          data: {
            incidentId: activeIncident.id,
            alertInstanceId: instance.id,
            createdAt: now,
          },
        });

        // Severity evaluation (Section 4 & 20): Upgrade to highest severity if new alert is higher
        const currentWeight = SEVERITY_WEIGHTS[activeIncident.severity];
        const newWeight = SEVERITY_WEIGHTS[rule.severity];

        if (newWeight > currentWeight) {
          await tx.incident.update({
            where: { id: activeIncident.id },
            data: { severity: rule.severity },
          });

          await tx.incidentEvent.create({
            data: {
              incidentId: activeIncident.id,
              type: IncidentEventType.SEVERITY_CHANGED,
              message: `Severity escalated from ${activeIncident.severity} to ${rule.severity} due to rule "${rule.name}"`,
              actorType: ActorType.SYSTEM,
              metadata: {
                previousSeverity: activeIncident.severity,
                newSeverity: rule.severity,
                alertRuleId: rule.id,
                alertInstanceId: instance.id,
              },
              createdAt: now,
            },
          });
          this.logger.log(
            `[IncidentEngine] Escalated Incident ${activeIncident.id} severity: ${activeIncident.severity} -> ${rule.severity}`,
          );
        }

        // Add ALERT_ATTACHED timeline event (Section 16 & 17)
        await tx.incidentEvent.create({
          data: {
            incidentId: activeIncident.id,
            type: IncidentEventType.ALERT_ATTACHED,
            message: `Alert "${rule.name}" fired (${rule.metric} = ${instance.currentValue ?? 'breach'}) and attached to incident`,
            actorType: ActorType.SYSTEM,
            metadata: {
              alertRuleId: rule.id,
              alertRuleName: rule.name,
              metric: rule.metric,
              currentValue: instance.currentValue,
              threshold: instance.threshold,
              alertInstanceId: instance.id,
            },
            createdAt: now,
          },
        });

        this.logger.log(
          `[IncidentEngine] Attached AlertInstance ${instance.id} ("${rule.name}") to existing Incident ${activeIncident.id}`,
        );

        return activeIncident.id;
      }

      // Case B: Create new Incident (Section 2, 18, 19)
      const apiName = rule.api?.name;
      const envName = rule.environment?.name;

      let title: string;
      if (apiName && envName) {
        title = `${apiName} ${envName} Degradation`;
      } else if (apiName) {
        title = `${apiName} Degradation`;
      } else if (rule.project?.name) {
        title = `${rule.project.name} API Outage`;
      } else {
        title = `${rule.name} Outage`;
      }

      const description = apiName && envName
        ? `${apiName} in ${envName} is experiencing elevated ${rule.metric} (${instance.currentValue ?? 'breach'}) exceeding configured threshold (${rule.threshold}).`
        : `Elevated ${rule.metric} detected by rule "${rule.name}" (${instance.currentValue ?? 'breach'} vs threshold ${rule.threshold}).`;

      const newIncident = await tx.incident.create({
        data: {
          projectId,
          apiId: apiId ?? null,
          environmentId: environmentId ?? null,
          title,
          description,
          status: IncidentStatus.OPEN,
          severity: rule.severity,
          startedAt: instance.startedAt ?? now,
          createdAt: now,
        },
      });

      // Attach alert instance
      await tx.incidentAlert.create({
        data: {
          incidentId: newIncident.id,
          alertInstanceId: instance.id,
          createdAt: now,
        },
      });

      // Timeline events: CREATED and ALERT_ATTACHED (Section 16 & 17)
      await tx.incidentEvent.create({
        data: {
          incidentId: newIncident.id,
          type: IncidentEventType.CREATED,
          message: `Incident created: ${title}`,
          actorType: ActorType.SYSTEM,
          metadata: {
            title,
            severity: rule.severity,
            initialAlertRuleId: rule.id,
            initialAlertRuleName: rule.name,
          },
          createdAt: now,
        },
      });

      await tx.incidentEvent.create({
        data: {
          incidentId: newIncident.id,
          type: IncidentEventType.ALERT_ATTACHED,
          message: `Triggering alert "${rule.name}" fired (${rule.metric} = ${instance.currentValue ?? 'breach'})`,
          actorType: ActorType.SYSTEM,
          metadata: {
            alertRuleId: rule.id,
            alertRuleName: rule.name,
            metric: rule.metric,
            currentValue: instance.currentValue,
            threshold: instance.threshold,
            alertInstanceId: instance.id,
          },
          createdAt: now,
        },
      });

      this.logger.warn(
        `[IncidentEngine] 🚨 Created new Incident ${newIncident.id} ("${title}") with initial alert "${rule.name}"`,
      );

      return newIncident.id;
    });

    // Phase 6: Notification Routing for FIRING incidents
    if (resultingIncidentId && this.notificationRoutingService) {
      try {
        await this.notificationRoutingService.routeIncidentNotification(
          resultingIncidentId,
          NotificationEventType.FIRING,
        );
      } catch (err: any) {
        this.logger.error(
          `[NotificationRouting] Failed to route FIRING notification for Incident ${resultingIncidentId}: ${err.message}`,
        );
      }
    }

    return resultingIncidentId;
  }

  /**
   * Handles an AlertInstance transitioning to RESOLVED.
   * Section 12: Resolves incident only when all correlated alerts have resolved.
   */
  async handleAlertInstanceResolved(alertInstanceId: string): Promise<void> {
    const instance = await this.prisma.alertInstance.findUnique({
      where: { id: alertInstanceId },
      include: {
        alertRule: true,
        incidentAlerts: {
          include: {
            incident: true,
          },
        },
      },
    });

    if (!instance) {
      return;
    }

    const activeAttachments = instance.incidentAlerts.filter(
      (ia) => ia.incident.status === IncidentStatus.OPEN || ia.incident.status === IncidentStatus.ACKNOWLEDGED,
    );

    for (const attachment of activeAttachments) {
      const incidentId = attachment.incidentId;
      const correlationKey = `incident_res:${incidentId}`;

      await this.prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe('SELECT pg_advisory_xact_lock(hashtext($1))', correlationKey);

        const currentIncident = await tx.incident.findUnique({
          where: { id: incidentId },
          include: {
            alerts: {
              include: {
                alertInstance: true,
              },
            },
          },
        });

        if (!currentIncident || currentIncident.status === IncidentStatus.RESOLVED) {
          return;
        }

        const now = new Date();

        // 1. Record ALERT_RESOLVED event on incident timeline
        await tx.incidentEvent.create({
          data: {
            incidentId,
            type: IncidentEventType.ALERT_RESOLVED,
            message: `Alert "${instance.alertRule.name}" resolved (${instance.alertRule.metric} recovered)`,
            actorType: ActorType.SYSTEM,
            metadata: {
              alertRuleId: instance.alertRule.id,
              alertRuleName: instance.alertRule.name,
              metric: instance.alertRule.metric,
              resolvedAt: instance.resolvedAt ?? now,
              alertInstanceId: instance.id,
            },
            createdAt: now,
          },
        });

        // 2. Check if ANY attached alert is still FIRING or PENDING (Section 12)
        const hasActiveAlerts = currentIncident.alerts.some(
          (a) =>
            a.alertInstance.id !== instance.id &&
            (a.alertInstance.status === AlertState.FIRING || a.alertInstance.status === AlertState.PENDING),
        );

        if (!hasActiveAlerts) {
          // All alerts recovered! Auto-resolve incident
          await tx.incident.update({
            where: { id: incidentId },
            data: {
              status: IncidentStatus.RESOLVED,
              resolvedAt: now,
            },
          });

          await tx.incidentEvent.create({
            data: {
              incidentId,
              type: IncidentEventType.RESOLVED,
              message: 'Incident automatically resolved — all correlated alerts have recovered',
              actorType: ActorType.SYSTEM,
              metadata: {
                resolvedAt: now,
                autoResolved: true,
              },
              createdAt: now,
            },
          });

          const durationSeconds = Math.round(
            (now.getTime() - currentIncident.startedAt.getTime()) / 1000,
          );

          this.logger.log(
            `[IncidentEngine] ✅ Automatically resolved Incident ${incidentId} ("${currentIncident.title}") after ${durationSeconds}s`,
          );

          // Phase 6: Notification Routing for RECOVERY
          if (this.notificationRoutingService) {
            try {
              await this.notificationRoutingService.routeIncidentNotification(
                incidentId,
                NotificationEventType.RECOVERY,
              );
            } catch (err: any) {
              this.logger.error(
                `[NotificationRouting] Failed to route RECOVERY notification for Incident ${incidentId}: ${err.message}`,
              );
            }
          }
        } else {
          this.logger.log(
            `[IncidentEngine] Alert "${instance.alertRule.name}" resolved, but Incident ${incidentId} remains ${currentIncident.status} because other alerts are still active`,
          );
        }
      });
    }
  }
}

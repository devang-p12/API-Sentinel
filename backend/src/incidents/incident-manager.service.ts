import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  ActorType,
  AlertSeverity,
  IncidentEventType,
  IncidentStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  IncidentEvaluationCheck,
  IncidentPolicyConfig,
  IncidentProcessResult,
  ProcessCheckIncidentOptions,
} from './interfaces/incident-manager.interface';

export const DEFAULT_FAILURE_THRESHOLD = 3;
export const DEFAULT_RECOVERY_THRESHOLD = 3;

@Injectable()
export class IncidentManagerService {
  private readonly logger = new Logger(IncidentManagerService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Deterministically processes a monitoring check result:
   * 1. Evaluates failure / success conditions against configured thresholds.
   * 2. Prevents incident creation for transient single failures.
   * 3. Creates ONE incident when failure threshold is reached (e.g. 500, 500, timeout).
   * 4. Deduplicates repeated failures during the same outage into timeline events (no duplicates).
   * 5. Resolves active incident when recovery threshold is reached (e.g. 200, 200, 200).
   * 6. Permits separate distinct incidents for subsequent outages after recovery.
   */
  async processCheck(options: ProcessCheckIncidentOptions): Promise<IncidentProcessResult> {
    const {
      organizationId,
      apiId,
      environmentId = null,
      monitorConfigId = null,
      projectId = null,
      check,
      recentChecks,
      policy,
    } = options;

    const failureThreshold = policy?.failureThreshold ?? DEFAULT_FAILURE_THRESHOLD;
    const recoveryThreshold = policy?.recoveryThreshold ?? DEFAULT_RECOVERY_THRESHOLD;
    const defaultSeverity = policy?.defaultSeverity ?? (check.timeout ? AlertSeverity.HIGH : AlertSeverity.WARNING);

    // 1. Look for an existing ACTIVE (non-resolved) incident for this scope (Deduplication)
    const activeIncident = await this.findActiveIncident(
      organizationId,
      apiId,
      environmentId,
      monitorConfigId,
    );

    const isFailure = !check.success || check.timeout || (check.statusCode !== null && check.statusCode !== undefined && check.statusCode >= 400);

    // Case A: The check is a FAILURE
    if (isFailure) {
      if (activeIncident) {
        // Requirement: Do not create duplicate incidents for the same outage (Deduplication)
        const eventMessage = `Repeated outage failure recorded: ${this.describeCheckFailure(check)}`;
        
        await this.prisma.$transaction(async (tx) => {
          await tx.incidentEvent.create({
            data: {
              incidentId: activeIncident.id,
              type: IncidentEventType.FAILURE_RECORDED,
              message: eventMessage,
              actorType: ActorType.SYSTEM,
              metadata: {
                statusCode: check.statusCode,
                timeout: check.timeout,
                errorType: check.errorType,
              },
            },
          });

          await tx.incident.update({
            where: { id: activeIncident.id },
            data: { updatedAt: new Date() },
          });
        });

        this.logger.debug(
          `[IncidentDeduplication] Appended failure event to active incident ${activeIncident.id} (no duplicate created)`,
        );

        return {
          action: 'UPDATED',
          incidentId: activeIncident.id,
          isNewIncident: false,
          incident: activeIncident,
          reason: 'Existing outage incident updated with subsequent failure event.',
        };
      }

      // No active incident currently exists -> Check if consecutive failure threshold is satisfied
      const consecutiveFailures = await this.getConsecutiveFailureCount(
        organizationId,
        apiId,
        environmentId,
        monitorConfigId,
        check,
        recentChecks,
      );

      if (consecutiveFailures < failureThreshold) {
        // Requirement: Do not create an incident for every failed monitoring request
        return {
          action: 'THRESHOLD_PENDING',
          isNewIncident: false,
          reason: `Failure recorded (${consecutiveFailures}/${failureThreshold}). Incident creation suppressed pending threshold.`,
        };
      }

      // Consecutive failure threshold reached -> CREATE ONE INCIDENT
      const createdIncident = await this.createIncidentRecord({
        organizationId,
        apiId,
        environmentId,
        monitorConfigId,
        projectId,
        severity: defaultSeverity,
        consecutiveFailures,
        triggerCheck: check,
      });

      this.logger.warn(
        `[IncidentCreated] Triggered new incident ${createdIncident.id} after ${consecutiveFailures} consecutive failures`,
      );

      return {
        action: 'CREATED',
        incidentId: createdIncident.id,
        isNewIncident: true,
        incident: createdIncident,
        reason: `Outage incident triggered after ${consecutiveFailures} consecutive failures.`,
      };
    }

    // Case B: The check is a SUCCESS
    if (!activeIncident) {
      // Normal healthy operation, no incident active
      return {
        action: 'NO_OP',
        isNewIncident: false,
        reason: 'Check succeeded and no active incident exists.',
      };
    }

    // Active incident exists and we received a successful response -> evaluate recovery condition
    const consecutiveSuccesses = await this.getConsecutiveSuccessCount(
      organizationId,
      apiId,
      environmentId,
      monitorConfigId,
      check,
      recentChecks,
    );

    if (consecutiveSuccesses < recoveryThreshold) {
      return {
        action: 'THRESHOLD_PENDING',
        incidentId: activeIncident.id,
        isNewIncident: false,
        reason: `Recovery in progress (${consecutiveSuccesses}/${recoveryThreshold} successful checks). Active incident remains.`,
      };
    }

    // Recovery threshold reached -> RESOLVE ACTIVE INCIDENT
    const resolvedIncident = await this.resolveIncidentRecord(activeIncident, consecutiveSuccesses);

    this.logger.log(
      `[IncidentResolved] Incident ${resolvedIncident.id} automatically resolved after ${consecutiveSuccesses} consecutive successful checks`,
    );

    return {
      action: 'RESOLVED',
      incidentId: resolvedIncident.id,
      isNewIncident: false,
      incident: resolvedIncident,
      reason: `Outage resolved after ${consecutiveSuccesses} consecutive successful checks.`,
    };
  }

  /**
   * Retrieves an incident with duration, reason, and timeline events.
   */
  async getIncidentDetails(incidentId: string, organizationId?: string) {
    const where: any = { id: incidentId };
    if (organizationId) where.organizationId = organizationId;

    const incident = await this.prisma.incident.findFirst({
      where,
      include: {
        organization: { select: { id: true, name: true } },
        api: { select: { id: true, name: true, service: true } },
        environment: { select: { id: true, name: true, type: true } },
        monitorConfig: { select: { id: true, name: true, url: true, method: true } },
        events: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!incident) {
      throw new NotFoundException(`Incident ${incidentId} not found`);
    }

    const durationMs = incident.resolvedAt
      ? incident.resolvedAt.getTime() - incident.startedAt.getTime()
      : Date.now() - incident.startedAt.getTime();

    return {
      ...incident,
      durationMs,
      durationSeconds: Math.round(durationMs / 1000),
      timeline: incident.events,
    };
  }

  /**
   * Locates currently OPEN or ACKNOWLEDGED incident for given scope.
   */
  private async findActiveIncident(
    organizationId: string,
    apiId: string,
    environmentId?: string | null,
    monitorConfigId?: string | null,
  ) {
    const where: any = {
      organizationId,
      apiId,
      status: { in: [IncidentStatus.OPEN, IncidentStatus.ACKNOWLEDGED] },
    };

    if (monitorConfigId) {
      where.monitorConfigId = monitorConfigId;
    } else if (environmentId) {
      where.environmentId = environmentId;
    }

    return this.prisma.incident.findFirst({
      where,
      orderBy: { startedAt: 'desc' },
      include: {
        events: { orderBy: { createdAt: 'asc' } },
      },
    });
  }

  private async createIncidentRecord(params: {
    organizationId: string;
    apiId: string;
    environmentId?: string | null;
    monitorConfigId?: string | null;
    projectId?: string | null;
    severity: AlertSeverity;
    consecutiveFailures: number;
    triggerCheck: IncidentEvaluationCheck;
  }) {
    const {
      organizationId,
      apiId,
      environmentId,
      monitorConfigId,
      projectId,
      severity,
      consecutiveFailures,
      triggerCheck,
    } = params;

    const api = await this.prisma.api.findUnique({
      where: { id: apiId },
      select: { name: true, projectId: true },
    });

    const envName = environmentId
      ? (await this.prisma.environment.findUnique({ where: { id: environmentId }, select: { name: true } }))?.name
      : null;

    const title = `Outage on ${api?.name || 'API'}${envName ? ` (${envName})` : ''}`;
    const reason = `${consecutiveFailures} consecutive failures detected (latest: ${this.describeCheckFailure(triggerCheck)})`;
    const startedAt = triggerCheck.timestamp ? new Date(triggerCheck.timestamp) : new Date();

    return this.prisma.$transaction(async (tx) => {
      const inc = await tx.incident.create({
        data: {
          organizationId,
          apiId,
          environmentId,
          monitorConfigId,
          projectId: projectId || api?.projectId || null,
          title,
          description: `Automated incident triggered after reaching failure threshold (${consecutiveFailures} failures).`,
          reason,
          status: IncidentStatus.OPEN,
          severity,
          startedAt,
        },
      });

      await tx.incidentEvent.create({
        data: {
          incidentId: inc.id,
          type: IncidentEventType.CREATED,
          message: `Incident opened: ${reason}`,
          actorType: ActorType.SYSTEM,
          metadata: {
            consecutiveFailures,
            triggerCheck: triggerCheck as any,
          },
          createdAt: startedAt,
        },
      });

      return inc;
    });
  }

  private async resolveIncidentRecord(activeIncident: any, consecutiveSuccesses: number) {
    const resolvedAt = new Date();
    const durationMs = resolvedAt.getTime() - new Date(activeIncident.startedAt).getTime();
    const durationSeconds = Math.round(durationMs / 1000);

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.incident.update({
        where: { id: activeIncident.id },
        data: {
          status: IncidentStatus.RESOLVED,
          resolvedAt,
          resolvedBy: 'Automated Recovery Monitor',
          durationMs,
          durationSeconds,
        },
      });

      await tx.incidentEvent.create({
        data: {
          incidentId: activeIncident.id,
          type: IncidentEventType.RESOLVED,
          message: `Outage resolved: ${consecutiveSuccesses} consecutive successful checks confirmed recovery. Outage duration: ${durationSeconds}s.`,
          actorType: ActorType.SYSTEM,
          metadata: {
            consecutiveSuccesses,
            durationSeconds,
          },
          createdAt: resolvedAt,
        },
      });

      return updated;
    });
  }

  private async getConsecutiveFailureCount(
    organizationId: string,
    apiId: string,
    environmentId: string | null,
    monitorConfigId: string | null,
    latestCheck: IncidentEvaluationCheck,
    recentChecks?: IncidentEvaluationCheck[],
  ): Promise<number> {
    if (recentChecks && recentChecks.length > 0) {
      let streak = 0;
      for (let i = recentChecks.length - 1; i >= 0; i--) {
        const c = recentChecks[i];
        if (!c.success || c.timeout || (c.statusCode && c.statusCode >= 400)) {
          streak++;
        } else {
          break;
        }
      }
      return streak;
    }

    // Query recent MonitorResults from PostgreSQL
    const where: any = { organizationId, apiId };
    if (monitorConfigId) where.monitorConfigId = monitorConfigId;
    if (environmentId) where.environmentId = environmentId;

    const recentResults = await this.prisma.monitorResult.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      take: 10,
    });

    let streak = 0;
    for (const r of recentResults) {
      if (!r.success || r.timeout || (r.statusCode && r.statusCode >= 400)) {
        streak++;
      } else {
        break;
      }
    }

    return streak;
  }

  private async getConsecutiveSuccessCount(
    organizationId: string,
    apiId: string,
    environmentId: string | null,
    monitorConfigId: string | null,
    latestCheck: IncidentEvaluationCheck,
    recentChecks?: IncidentEvaluationCheck[],
  ): Promise<number> {
    if (recentChecks && recentChecks.length > 0) {
      let streak = 0;
      for (let i = recentChecks.length - 1; i >= 0; i--) {
        const c = recentChecks[i];
        if (c.success && !c.timeout && (!c.statusCode || c.statusCode < 400)) {
          streak++;
        } else {
          break;
        }
      }
      return streak;
    }

    // Query recent MonitorResults from PostgreSQL
    const where: any = { organizationId, apiId };
    if (monitorConfigId) where.monitorConfigId = monitorConfigId;
    if (environmentId) where.environmentId = environmentId;

    const recentResults = await this.prisma.monitorResult.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      take: 10,
    });

    let streak = 0;
    for (const r of recentResults) {
      if (r.success && !r.timeout && (!r.statusCode || r.statusCode < 400)) {
        streak++;
      } else {
        break;
      }
    }

    return streak;
  }

  private describeCheckFailure(check: IncidentEvaluationCheck): string {
    if (check.timeout) return 'Request Timeout';
    if (check.statusCode) return `HTTP ${check.statusCode}`;
    return check.errorType || check.errorMessage || 'Connection Failure';
  }
}

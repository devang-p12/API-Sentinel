import { Injectable, Logger } from '@nestjs/common';
import { IncidentStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class IncidentEvaluatorService {
  private readonly logger = new Logger(IncidentEvaluatorService.name);

  constructor(private readonly prisma: PrismaService) {}

  async evaluateMonitor(monitorId: string) {
    const alerts = await this.prisma.alert.findMany({
      where: { monitorId, isEnabled: true },
      include: {
        incidents: {
          where: {
            status: { in: [IncidentStatus.TRIGGERED, IncidentStatus.ACKNOWLEDGED] },
          },
        },
      },
    });

    if (alerts.length === 0) {
      return;
    }

    // Fetch recent 10 executions
    const recentExecutions = await this.prisma.monitorExecution.findMany({
      where: { monitorId },
      orderBy: { executedAt: 'desc' },
      take: 10,
    });

    if (recentExecutions.length === 0) {
      return;
    }

    // Count consecutive failures starting from the most recent run
    let consecutiveFailures = 0;
    for (const exec of recentExecutions) {
      if (exec.status === 'FAILED' || exec.status === 'TIMEOUT' || exec.status === 'ERROR') {
        consecutiveFailures++;
      } else {
        break; // Stop at first success
      }
    }

    const isMostRecentSuccess = recentExecutions[0].status === 'SUCCESS';

    for (const alert of alerts) {
      const condition = (alert.condition as any) || {};
      const failureThreshold = condition.consecutiveFailures || 2;
      const activeIncident = alert.incidents[0];

      // Case 1: Outage Trigger Condition Met
      if (consecutiveFailures >= failureThreshold) {
        if (!activeIncident) {
          const newIncident = await this.prisma.incident.create({
            data: {
              alertId: alert.id,
              status: IncidentStatus.TRIGGERED,
              summary: `Alert "${alert.name}" triggered: ${consecutiveFailures} consecutive probe failures detected on monitor`,
              startedAt: new Date(),
            },
          });
          this.logger.warn(`🚨 [Incident Opened] ID: ${newIncident.id} for Alert "${alert.name}"`);
        }
      }

      // Case 2: Recovery Condition Met (Most recent probe succeeded and active incident exists)
      if (isMostRecentSuccess && activeIncident) {
        const resolvedIncident = await this.prisma.incident.update({
          where: { id: activeIncident.id },
          data: {
            status: IncidentStatus.RESOLVED,
            resolvedAt: new Date(),
            summary: `${activeIncident.summary} [RECOVERED: probe returned HTTP ${recentExecutions[0].statusCode}]`,
          },
        });
        const durationSeconds = Math.round(
          (resolvedIncident.resolvedAt!.getTime() - resolvedIncident.startedAt.getTime()) / 1000,
        );
        this.logger.log(
          `✅ [Incident Resolved] ID: ${resolvedIncident.id} for Alert "${alert.name}" (Downtime: ${durationSeconds}s)`,
        );
      }
    }
  }
}

import { Injectable, Logger } from '@nestjs/common';
import {
  NotificationEventType,
  NotificationDeliveryStatus,
  ContactPointType,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { EmailNotificationChannel } from '../../notifications/channels/email-notification.channel';

export interface AlertRuleNotificationConfig {
  email?: {
    enabled: boolean;
    recipients: string[];
    onFiring: boolean;
    onResolved: boolean;
    repeatInterval?: number; // in minutes, 0 = disabled
  };
}

@Injectable()
export class AlertRuleNotificationService {
  private readonly logger = new Logger(AlertRuleNotificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailChannel: EmailNotificationChannel,
  ) {}

  /**
   * Dispatches email notifications for an alert rule when state transitions occur.
   * Ensures idempotency via deterministic deduplication keys.
   */
  async sendAlertRuleNotification(
    ruleId: string,
    alertInstanceId: string,
    eventType: NotificationEventType,
  ): Promise<void> {
    const rule = await this.prisma.alertRule.findUnique({
      where: { id: ruleId },
      include: {
        project: { select: { id: true, name: true, organizationId: true } },
        api: { select: { id: true, name: true } },
        environment: { select: { id: true, name: true } },
        monitor: { select: { id: true, name: true } },
      },
    });

    if (!rule) {
      this.logger.warn(`Cannot send notification: AlertRule ${ruleId} not found`);
      return;
    }

    const notifConfig = (rule.notificationConfig || {}) as AlertRuleNotificationConfig;
    const emailConfig = notifConfig.email;

    if (!emailConfig || !emailConfig.enabled) {
      this.logger.debug(`Email notifications not enabled for rule "${rule.name}" (${rule.id})`);
      return;
    }

    if (eventType === NotificationEventType.FIRING && emailConfig.onFiring === false) {
      this.logger.debug(`Firing notifications disabled for rule "${rule.name}"`);
      return;
    }

    if (eventType === NotificationEventType.RECOVERY && emailConfig.onResolved === false) {
      this.logger.debug(`Recovery notifications disabled for rule "${rule.name}"`);
      return;
    }

    const recipients = (emailConfig.recipients || [])
      .map((r) => r.trim())
      .filter((r) => r.length > 0);

    if (recipients.length === 0) {
      this.logger.warn(`Email notifications enabled for rule "${rule.name}" but no recipients configured`);
      return;
    }

    // Fetch AlertInstance with related incident and evaluations
    const instance = await this.prisma.alertInstance.findUnique({
      where: { id: alertInstanceId },
      include: {
        incidentAlerts: {
          include: {
            incident: true,
          },
        },
      },
    });

    if (!instance) {
      this.logger.warn(`AlertInstance ${alertInstanceId} not found`);
      return;
    }

    const incident = instance.incidentAlerts?.[0]?.incident;

    // Format timestamps
    const startedAt = instance.startedAt
      ? instance.startedAt.toISOString().replace('T', ' ').substring(0, 19)
      : new Date().toISOString().replace('T', ' ').substring(0, 19);

    const resolvedAt = instance.resolvedAt
      ? instance.resolvedAt.toISOString().replace('T', ' ').substring(0, 19)
      : new Date().toISOString().replace('T', ' ').substring(0, 19);

    // Duration calculation
    let durationText = 'Immediate';
    if (instance.startedAt && instance.resolvedAt) {
      const diffSecs = Math.max(
        0,
        Math.round((instance.resolvedAt.getTime() - instance.startedAt.getTime()) / 1000),
      );
      const mins = Math.floor(diffSecs / 60);
      const secs = diffSecs % 60;
      if (mins > 0 && secs === 0) {
        durationText = `${mins} minute${mins > 1 ? 's' : ''}`;
      } else if (mins > 0) {
        durationText = `${mins}m ${secs}s`;
      } else {
        durationText = `${secs} seconds`;
      }
    }

    const opMap: Record<string, string> = {
      GREATER_THAN: '>',
      GREATER_THAN_OR_EQUAL: '>=',
      LESS_THAN: '<',
      LESS_THAN_OR_EQUAL: '<=',
      EQUAL: '=',
      NOT_EQUAL: '!=',
    };
    const operatorStr = opMap[rule.condition] || '>';

    const metricNameFormatted = rule.metric
      .split('_')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');

    const payload = {
      ruleName: rule.name,
      incidentId: incident?.id,
      incidentTitle: incident?.title,
      incidentSeverity: rule.severity,
      apiName: rule.api?.name || 'All APIs',
      environmentName: rule.environment?.name || 'Production',
      monitorName: rule.monitor?.name || 'All Monitors',
      metricName: metricNameFormatted,
      currentValue: instance.currentValue,
      resolvedValue: instance.currentValue,
      threshold: rule.threshold,
      thresholdOperator: operatorStr,
      startedAt,
      resolvedAt,
      durationText,
      eventType: eventType as any,
      alertUrl: `http://localhost:5174/alert-rules/${rule.id}`,
    };

    // Send to each recipient individually to track per-recipient delivery status
    for (const recipient of recipients) {
      const deduplicationKey = `alert_${rule.id}_inst_${instance.id}_${eventType}_${recipient.toLowerCase()}`;

      try {
        // Register delivery record with concurrency-safe advisory lock
        const delivery = await this.prisma.$transaction(async (tx) => {
          const advisoryKey = `notif_rule_dedup:${deduplicationKey}`;
          await tx.$executeRawUnsafe('SELECT pg_advisory_xact_lock(hashtext($1))', advisoryKey);

          const existing = await tx.notificationDelivery.findUnique({
            where: { deduplicationKey },
          });

          if (existing) {
            return existing;
          }

          return tx.notificationDelivery.create({
            data: {
              organizationId: rule.project.organizationId,
              alertRuleId: rule.id,
              alertInstanceId: instance.id,
              incidentId: incident?.id ?? null,
              recipient,
              channel: ContactPointType.EMAIL,
              eventType,
              status: NotificationDeliveryStatus.PENDING,
              deduplicationKey,
              payload: payload as any,
              attemptCount: 0,
            },
          });
        });

        // If delivery was already sent or cancelled, skip
        if (delivery.status === NotificationDeliveryStatus.SENT) {
          this.logger.debug(`[AlertRuleNotification] Delivery ${deduplicationKey} already sent, skipping`);
          continue;
        }

        // Execute email send
        const sendResult = await this.emailChannel.send(
          { recipients: [recipient] },
          payload,
        );

        if (sendResult.success) {
          await this.prisma.notificationDelivery.update({
            where: { id: delivery.id },
            data: {
              status: NotificationDeliveryStatus.SENT,
              sentAt: new Date(),
              lastAttemptAt: new Date(),
              attemptCount: delivery.attemptCount + 1,
              errorMessage: null,
            },
          });
          this.logger.log(
            `[AlertRuleNotification] Sent ${eventType} email to ${recipient} for rule "${rule.name}"`,
          );
        } else {
          await this.prisma.notificationDelivery.update({
            where: { id: delivery.id },
            data: {
              status: NotificationDeliveryStatus.FAILED,
              lastAttemptAt: new Date(),
              attemptCount: delivery.attemptCount + 1,
              errorMessage: sendResult.statusMessage,
            },
          });
          this.logger.error(
            `[AlertRuleNotification] Failed sending ${eventType} email to ${recipient}: ${sendResult.statusMessage}`,
          );
        }
      } catch (err: any) {
        this.logger.error(
          `[AlertRuleNotification] Error processing delivery for ${recipient} on rule ${rule.id}: ${err.message}`,
        );
        try {
          await this.prisma.notificationDelivery.updateMany({
            where: { deduplicationKey, status: NotificationDeliveryStatus.PENDING },
            data: {
              status: NotificationDeliveryStatus.FAILED,
              lastAttemptAt: new Date(),
              errorMessage: err.message,
            },
          });
        } catch {
          // Ignore secondary DB error
        }
      }
    }
  }

  /**
   * Sends an immediate test email without creating AlertInstance, Incident, or altering state.
   */
  async sendTestEmail(
    recipients: string[],
    ruleName?: string,
    ruleId?: string,
  ): Promise<{ success: boolean; message: string; recipients: string[] }> {
    const validRecipients = recipients
      .map((r) => r.trim())
      .filter((r) => this.isValidEmail(r));

    if (validRecipients.length === 0) {
      return {
        success: false,
        message: 'No valid recipient email addresses provided',
        recipients: [],
      };
    }

    const payload = {
      ruleName: ruleName || 'Alert Rule Test',
      eventType: 'TEST' as any,
      testMessage: 'This is a test notification verifying that email delivery is properly configured for this alert rule.',
      frontendUrl: ruleId ? `http://localhost:5174/alert-rules/${ruleId}` : undefined,
    };

    const sendResult = await this.emailChannel.send(
      { recipients: validRecipients },
      payload,
    );

    // If ruleId is present, also log the test delivery to notification_deliveries table
    if (ruleId) {
      try {
        const rule = await this.prisma.alertRule.findUnique({
          where: { id: ruleId },
          include: { project: true },
        });

        if (rule) {
          for (const recipient of validRecipients) {
            await this.prisma.notificationDelivery.create({
              data: {
                organizationId: rule.project.organizationId,
                alertRuleId: rule.id,
                recipient,
                channel: ContactPointType.EMAIL,
                eventType: NotificationEventType.TEST,
                status: sendResult.success
                  ? NotificationDeliveryStatus.SENT
                  : NotificationDeliveryStatus.FAILED,
                deduplicationKey: `test_${rule.id}_${Date.now()}_${recipient}`,
                payload: payload as any,
                sentAt: sendResult.success ? new Date() : null,
                errorMessage: sendResult.success ? null : sendResult.statusMessage,
              },
            });
          }
        }
      } catch (err: any) {
        this.logger.warn(`Could not log test delivery to database: ${err.message}`);
      }
    }

    if (sendResult.success) {
      return {
        success: true,
        message: 'Test email sent successfully.',
        recipients: validRecipients,
      };
    } else {
      return {
        success: false,
        message: `Delivery failed: ${sendResult.statusMessage}`,
        recipients: validRecipients,
      };
    }
  }

  /**
   * Fetches recent notification deliveries for an AlertRule.
   */
  async getDeliveriesForRule(ruleId: string, limit = 50) {
    return this.prisma.notificationDelivery.findMany({
      where: { alertRuleId: ruleId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        eventType: true,
        status: true,
        recipient: true,
        channel: true,
        errorMessage: true,
        sentAt: true,
        createdAt: true,
        attemptCount: true,
      },
    });
  }

  private isValidEmail(email: string): boolean {
    const re = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
    return re.test(email);
  }
}

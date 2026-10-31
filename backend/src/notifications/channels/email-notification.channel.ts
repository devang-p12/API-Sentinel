import { Injectable, Logger } from '@nestjs/common';
import {
  ChannelSendResult,
  NotificationChannel,
  NotificationPayload,
} from './notification-channel.interface';
import { EmailProviderService } from './email-provider.service';

@Injectable()
export class EmailNotificationChannel implements NotificationChannel {
  private readonly logger = new Logger(EmailNotificationChannel.name);

  constructor(private readonly emailProvider: EmailProviderService) {}

  async send(
    config: Record<string, any>,
    payload: NotificationPayload,
  ): Promise<ChannelSendResult> {
    const recipients = Array.isArray(config.recipients)
      ? config.recipients
      : typeof config.recipient === 'string'
      ? [config.recipient]
      : [];

    if (recipients.length === 0) {
      return {
        success: false,
        statusMessage: 'Email channel configuration missing recipients list',
        retryable: false,
      };
    }

    const isRecovery = payload.eventType === 'RECOVERY';
    const isTest = payload.eventType === 'TEST';
    const isFiring = payload.eventType === 'FIRING';

    const ruleName = payload.ruleName || payload.incidentTitle || 'Alert Rule';
    const apiName = payload.apiName || payload.serviceName || 'All APIs';
    const envName = payload.environmentName || 'Production';
    const severityRaw = payload.incidentSeverity || 'CRITICAL';
    const severityUpper = severityRaw.toUpperCase();
    const severityCapitalized = severityRaw.charAt(0).toUpperCase() + severityRaw.slice(1).toLowerCase();

    let subject: string;
    let emailBody: string;

    if (isTest) {
      subject = `[TEST] API Sentinel Alert Notification — ${ruleName}`;
      emailBody = [
        `Alert: High API Latency`,
        `Status: TEST`,
        `Severity: Info`,
        `Message: ${payload.testMessage || 'This is a test notification verifying that email delivery is properly configured for this alert rule.'}`,
        `Sent at: ${new Date().toISOString()}`,
      ].join('\n');
    } else if (isRecovery) {
      subject = `[RESOLVED] ${ruleName} - ${apiName} / ${envName}`;
      
      const lines = [
        `Alert: ${ruleName}`,
        `Status: RESOLVED`,
        `Severity: ${severityCapitalized}`,
        `API: ${apiName}`,
        `Environment: ${envName}`,
      ];

      if (payload.metricName) {
        lines.push(`Metric: ${payload.metricName}`);
      }

      if (payload.resolvedValue !== undefined && payload.resolvedValue !== null) {
        lines.push(`Resolved value: ${payload.resolvedValue} ${payload.metricUnit || ''}`.trim());
      }

      if (payload.threshold !== undefined) {
        const op = payload.thresholdOperator || '>';
        lines.push(`Threshold: ${op} ${payload.threshold} ${payload.metricUnit || ''}`.trim());
      }

      if (payload.startedAt) {
        lines.push(`Started at:\n${payload.startedAt}`);
      }

      if (payload.resolvedAt) {
        lines.push(`Resolved at:\n${payload.resolvedAt}`);
      }

      if (payload.durationText) {
        lines.push(`Duration:\n${payload.durationText}`);
      } else if (payload.durationSeconds !== undefined) {
        const mins = Math.floor(payload.durationSeconds / 60);
        lines.push(`Duration:\n${mins > 0 ? `${mins} minutes` : `${payload.durationSeconds} seconds`}`);
      }

      if (payload.incidentId) {
        lines.push(`Incident:\nINC-${payload.incidentId.substring(0, 8)}`);
      }

      emailBody = lines.join('\n');
    } else {
      // Firing or repeat
      subject = `[${severityUpper}] ${ruleName} - ${apiName} / ${envName}`;

      const lines = [
        `Alert: ${ruleName}`,
        `Status: FIRING`,
        `Severity: ${severityCapitalized}`,
        `API: ${apiName}`,
        `Environment: ${envName}`,
      ];

      if (payload.monitorName) {
        lines.push(`Monitor: ${payload.monitorName}`);
      }

      if (payload.metricName) {
        lines.push(`Metric: ${payload.metricName}`);
      }

      if (payload.currentValue !== undefined && payload.currentValue !== null) {
        lines.push(`Current value: ${payload.currentValue} ${payload.metricUnit || ''}`.trim());
      }

      if (payload.threshold !== undefined) {
        const op = payload.thresholdOperator || '>';
        lines.push(`Threshold: ${op} ${payload.threshold} ${payload.metricUnit || ''}`.trim());
      }

      if (payload.startedAt) {
        lines.push(`Started at:\n${payload.startedAt}`);
      }

      lines.push(`Alert Rule:\n${ruleName}`);

      if (payload.incidentId) {
        lines.push(`Incident:\nINC-${payload.incidentId.substring(0, 8)}`);
      }

      const alertUrl = payload.alertUrl || payload.frontendUrl;
      if (alertUrl) {
        lines.push(`Dashboard / Alert URL:\n${alertUrl}`);
      }

      emailBody = lines.join('\n');
    }

    // Dispatch via email provider
    const sendResult = await this.emailProvider.sendEmail({
      to: recipients,
      subject,
      text: emailBody,
    });

    if (!sendResult.success) {
      return {
        success: false,
        statusMessage: sendResult.error || 'Failed to dispatch email',
        retryable: true,
        details: {
          recipients,
          subject,
          error: sendResult.error,
        },
      };
    }

    return {
      success: true,
      statusMessage: `Delivered to ${recipients.length} recipient(s): ${recipients.join(', ')}`,
      retryable: false,
      details: {
        recipients,
        subject,
        messageId: sendResult.messageId,
        provider: sendResult.provider,
      },
    };
  }
}

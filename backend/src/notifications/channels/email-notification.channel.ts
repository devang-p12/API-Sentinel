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

    const htmlBody = this.generateHtmlEmail({
      subject,
      ruleName,
      apiName,
      envName,
      severity: severityCapitalized,
      isTest,
      isRecovery,
      metricName: payload.metricName,
      monitorName: payload.monitorName,
      currentValue: payload.currentValue,
      resolvedValue: payload.resolvedValue,
      threshold: payload.threshold,
      thresholdOperator: payload.thresholdOperator || '>',
      metricUnit: payload.metricUnit || '',
      startedAt: payload.startedAt,
      resolvedAt: payload.resolvedAt,
      incidentId: payload.incidentId,
      alertUrl: payload.alertUrl || payload.frontendUrl,
      testMessage: payload.testMessage,
    });

    // Dispatch via email provider
    const sendResult = await this.emailProvider.sendEmail({
      to: recipients,
      subject,
      text: emailBody,
      html: htmlBody,
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

  private generateHtmlEmail(params: {
    subject: string;
    ruleName: string;
    apiName: string;
    envName: string;
    severity: string;
    isTest: boolean;
    isRecovery: boolean;
    metricName?: string;
    monitorName?: string;
    currentValue?: number;
    resolvedValue?: number;
    threshold?: number;
    thresholdOperator?: string;
    metricUnit?: string;
    startedAt?: string;
    resolvedAt?: string;
    incidentId?: string;
    alertUrl?: string;
    testMessage?: string;
  }): string {
    const bannerColor = params.isTest
      ? '#2563eb'
      : params.isRecovery
      ? '#059669'
      : params.severity.toUpperCase() === 'CRITICAL'
      ? '#dc2626'
      : '#d97706';

    const statusBadge = params.isTest
      ? 'TEST NOTIFICATION'
      : params.isRecovery
      ? 'RESOLVED'
      : `FIRING • ${params.severity.toUpperCase()}`;

    const rows: { label: string; value: string }[] = [];

    rows.push({ label: 'Alert Rule', value: params.ruleName });
    rows.push({ label: 'API / Service', value: params.apiName });
    rows.push({ label: 'Environment', value: params.envName });

    if (params.monitorName) {
      rows.push({ label: 'Monitor', value: params.monitorName });
    }

    if (params.metricName) {
      rows.push({ label: 'Metric', value: params.metricName });
    }

    if (params.currentValue !== undefined && params.currentValue !== null) {
      rows.push({
        label: 'Current Value',
        value: `${params.currentValue} ${params.metricUnit}`.trim(),
      });
    }

    if (params.resolvedValue !== undefined && params.resolvedValue !== null) {
      rows.push({
        label: 'Resolved Value',
        value: `${params.resolvedValue} ${params.metricUnit}`.trim(),
      });
    }

    if (params.threshold !== undefined && params.threshold !== null) {
      rows.push({
        label: 'Threshold',
        value: `${params.thresholdOperator} ${params.threshold} ${params.metricUnit}`.trim(),
      });
    }

    if (params.startedAt) {
      rows.push({ label: 'Triggered At', value: params.startedAt });
    }

    if (params.resolvedAt) {
      rows.push({ label: 'Resolved At', value: params.resolvedAt });
    }

    if (params.incidentId) {
      rows.push({ label: 'Incident Reference', value: `INC-${params.incidentId.substring(0, 8)}` });
    }

    const rowsHtml = rows
      .map(
        (r) => `
        <tr>
          <td style="padding: 10px 14px; font-weight: 600; color: #64748b; font-size: 13px; border-bottom: 1px solid #334155; width: 38%;">${r.label}</td>
          <td style="padding: 10px 14px; color: #f1f5f9; font-size: 14px; border-bottom: 1px solid #334155; font-family: monospace;">${r.value}</td>
        </tr>`,
      )
      .join('');

    const ctaButton = params.alertUrl
      ? `
      <div style="margin-top: 24px; text-align: center;">
        <a href="${params.alertUrl}" style="background-color: ${bannerColor}; color: #ffffff; text-decoration: none; font-weight: 600; font-size: 14px; padding: 12px 24px; border-radius: 6px; display: inline-block;">
          View in Sentinel Dashboard &rarr;
        </a>
      </div>`
      : '';

    const testNote = params.isTest
      ? `
      <div style="background-color: #1e293b; border-left: 4px solid #2563eb; padding: 12px 16px; margin-bottom: 20px; border-radius: 4px; color: #cbd5e1; font-size: 14px;">
        ${params.testMessage || 'This is a test notification verifying that email delivery is properly configured for this alert rule.'}
      </div>`
      : '';

    return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${params.subject}</title>
    </head>
    <body style="margin: 0; padding: 24px 12px; background-color: #0b0f19; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f8fafc;">
      <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; margin: 0 auto; background-color: #1e293b; border-radius: 8px; overflow: hidden; border: 1px solid #334155;">
        <tr>
          <td style="padding: 20px 24px; background-color: #0f172a; border-bottom: 2px solid ${bannerColor};">
            <table width="100%" border="0" cellpadding="0" cellspacing="0">
              <tr>
                <td>
                  <span style="font-size: 18px; font-weight: 700; color: #38bdf8; letter-spacing: 0.5px;">API SENTINEL</span>
                </td>
                <td align="right">
                  <span style="display: inline-block; padding: 4px 12px; border-radius: 12px; background-color: ${bannerColor}; color: #ffffff; font-size: 11px; font-weight: 700; letter-spacing: 0.5px;">
                    ${statusBadge}
                  </span>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding: 24px;">
            <h2 style="margin: 0 0 16px 0; font-size: 18px; font-weight: 600; color: #f8fafc;">
              ${params.ruleName}
            </h2>
            ${testNote}
            <table width="100%" border="0" cellpadding="0" cellspacing="0" style="border-collapse: collapse; background-color: #0f172a; border-radius: 6px; overflow: hidden; border: 1px solid #334155;">
              ${rowsHtml}
            </table>
            ${ctaButton}
          </td>
        </tr>
        <tr>
          <td style="padding: 16px 24px; background-color: #0f172a; border-top: 1px solid #334155; text-align: center; color: #64748b; font-size: 12px;">
            This alert was generated automatically by API Sentinel Monitoring Engine.
          </td>
        </tr>
      </table>
    </body>
    </html>
    `;
  }
}


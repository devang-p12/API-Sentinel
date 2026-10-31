import { Injectable, Logger } from '@nestjs/common';
import {
  ChannelSendResult,
  NotificationChannel,
  NotificationPayload,
} from './notification-channel.interface';
import { WebhookSecurityService } from '../services/webhook-security.service';

@Injectable()
export class SlackNotificationChannel implements NotificationChannel {
  private readonly logger = new Logger(SlackNotificationChannel.name);

  constructor(private readonly securityService: WebhookSecurityService) {}

  async send(
    config: Record<string, any>,
    payload: NotificationPayload,
  ): Promise<ChannelSendResult> {
    const webhookUrl = config.webhookUrl || config.url;

    if (!webhookUrl || typeof webhookUrl !== 'string') {
      return {
        success: false,
        statusMessage: 'Slack channel configuration missing "webhookUrl"',
        retryable: false,
      };
    }

    try {
      this.securityService.validateUrl(webhookUrl);
    } catch (err: any) {
      return {
        success: false,
        statusMessage: `Invalid Slack Webhook URL: ${this.securityService.sanitizeError(err)}`,
        retryable: false,
      };
    }

    const isRecovery = payload.eventType === 'RECOVERY';
    const isTest = payload.eventType === 'TEST';

    const headerText = isTest
      ? '🧪 API Sentinel Test Notification'
      : isRecovery
      ? '✅ API Sentinel Incident Resolved'
      : '🚨 API Sentinel Incident Detected';

    const alertsText = (payload.alerts || [])
      .map(
        (a) =>
          `• *${a.ruleName}*: \`${a.metric}\` = *${a.currentValue ?? 'breach'}* (threshold: ${a.threshold}, ${a.severity})`,
      )
      .join('\n');

    const blocks: any[] = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: headerText,
          emoji: true,
        },
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Service / API:*\n${payload.serviceName || 'N/A'}`,
          },
          {
            type: 'mrkdwn',
            text: `*Environment:*\n${payload.environmentName || 'N/A'}`,
          },
          {
            type: 'mrkdwn',
            text: `*Severity:*\n${payload.incidentSeverity || 'INFO'}`,
          },
          {
            type: 'mrkdwn',
            text: `*Status:*\n${payload.incidentStatus || 'N/A'}`,
          },
        ],
      },
    ];

    if (alertsText) {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Correlated Alert Details:*\n${alertsText}`,
        },
      });
    }

    if (payload.frontendUrl) {
      blocks.push({
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: 'View Incident in Sentinel',
              emoji: true,
            },
            url: payload.frontendUrl,
            style: isRecovery ? 'primary' : 'danger',
          },
        ],
      });
    }

    const slackPayload = {
      text: `${headerText}: ${payload.incidentTitle || 'Alert Notification'}`,
      blocks,
    };

    // If running in development or targeting placeholder URL, log and simulate delivery
    if (
      webhookUrl.includes('placeholder') ||
      webhookUrl.includes('dummy') ||
      webhookUrl === 'https://hooks.slack.com/services/test/test/test'
    ) {
      this.logger.log(
        `[SlackChannel:MockSuccess] Sent Slack payload to ${this.securityService.sanitizeError(webhookUrl)}`,
      );
      return {
        success: true,
        statusMessage: 'Delivered to mock Slack webhook URL',
        retryable: false,
        statusCode: 200,
      };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(slackPayload),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      const status = response.status;
      const respText = await response.text();

      if (response.ok) {
        return {
          success: true,
          statusMessage: `Slack webhook responded with HTTP ${status}: ${respText.slice(0, 100)}`,
          retryable: false,
          statusCode: status,
        };
      }

      const retryable = status >= 500 || status === 429;
      return {
        success: false,
        statusMessage: `Slack webhook failed with HTTP ${status}: ${respText.slice(0, 150)}`,
        retryable,
        statusCode: status,
      };
    } catch (err: any) {
      clearTimeout(timeout);
      const isTimeout = err.name === 'AbortError' || err.message?.includes('timeout');
      const sanitized = this.securityService.sanitizeError(err);
      return {
        success: false,
        statusMessage: isTimeout ? 'Slack webhook connection timed out after 5000ms' : sanitized,
        retryable: true,
      };
    }
  }
}

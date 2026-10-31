import { Injectable, Logger } from '@nestjs/common';
import {
  ChannelSendResult,
  NotificationChannel,
  NotificationPayload,
} from './notification-channel.interface';
import { WebhookSecurityService } from '../services/webhook-security.service';

@Injectable()
export class WebhookNotificationChannel implements NotificationChannel {
  private readonly logger = new Logger(WebhookNotificationChannel.name);

  constructor(private readonly securityService: WebhookSecurityService) {}

  async send(
    config: Record<string, any>,
    payload: NotificationPayload,
  ): Promise<ChannelSendResult> {
    const rawUrl = config.url || config.webhookUrl;

    if (!rawUrl || typeof rawUrl !== 'string') {
      return {
        success: false,
        statusMessage: 'Webhook configuration missing "url"',
        retryable: false,
      };
    }

    try {
      this.securityService.validateUrl(rawUrl);
    } catch (err: any) {
      return {
        success: false,
        statusMessage: `Webhook URL rejected by security policy: ${this.securityService.sanitizeError(err)}`,
        retryable: false,
      };
    }

    const method = (config.method || 'POST').toUpperCase();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'API-Sentinel-Notifier/1.0',
      ...(config.headers || {}),
    };

    const webhookBody = {
      event: `INCIDENT_${payload.eventType}`,
      eventType: payload.eventType,
      incident: payload.incidentId
        ? {
            id: payload.incidentId,
            title: payload.incidentTitle,
            severity: payload.incidentSeverity,
            status: payload.incidentStatus,
            startedAt: payload.startedAt,
            resolvedAt: payload.resolvedAt,
            durationSeconds: payload.durationSeconds,
          }
        : null,
      project: { name: payload.projectName },
      api: { name: payload.serviceName },
      environment: { name: payload.environmentName },
      alerts: payload.alerts || [],
      frontendUrl: payload.frontendUrl,
      testMessage: payload.testMessage,
      timestamp: new Date().toISOString(),
    };

    // If targeting mock/placeholder URL
    if (
      rawUrl.includes('example.com/mock-webhook') ||
      rawUrl.includes('test-placeholder')
    ) {
      this.logger.log(`[WebhookChannel:MockSuccess] Sent mock webhook to ${rawUrl}`);
      return {
        success: true,
        statusMessage: 'Delivered to mock HTTP Webhook endpoint',
        retryable: false,
        statusCode: 200,
      };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    try {
      const response = await fetch(rawUrl, {
        method,
        headers,
        body: method !== 'GET' && method !== 'HEAD' ? JSON.stringify(webhookBody) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeout);

      const status = response.status;
      const respText = await response.text();
      // Cap response snippet to 200 chars
      const responseSnippet = respText.slice(0, 200);

      if (response.ok) {
        return {
          success: true,
          statusMessage: `HTTP ${status} OK: ${responseSnippet}`,
          retryable: false,
          statusCode: status,
        };
      }

      const retryable = status >= 500 || status === 429;
      return {
        success: false,
        statusMessage: `HTTP ${status}: ${responseSnippet}`,
        retryable,
        statusCode: status,
      };
    } catch (err: any) {
      clearTimeout(timeout);
      const isTimeout = err.name === 'AbortError' || err.message?.includes('timeout');
      const sanitized = this.securityService.sanitizeError(err);
      return {
        success: false,
        statusMessage: isTimeout ? 'Webhook connection timed out after 5000ms' : sanitized,
        retryable: true,
      };
    }
  }
}

import axios from 'axios';
import { NotificationChannel, NotificationPayload } from '../notification.types';

/**
 * Webhook notification channel.
 *
 * Sends a generic JSON payload via HTTP POST to a configured URL.
 * Only active when NOTIFICATION_WEBHOOK_ENABLED=true and a valid URL is set.
 *
 * Environment variables:
 *   NOTIFICATION_WEBHOOK_ENABLED  — "true" to enable (default: disabled)
 *   NOTIFICATION_WEBHOOK_URL      — target endpoint URL
 *   NOTIFICATION_WEBHOOK_SECRET   — optional secret sent as X-Notification-Secret header
 *
 * Uses a 5-second timeout. Failures are caught and logged — they never
 * propagate to the monitoring worker or incident processing.
 */
export class WebhookChannel implements NotificationChannel {
  readonly name = 'webhook';

  private enabled: boolean;
  private url: string;
  private secret: string;

  constructor() {
    this.enabled =
      (process.env.NOTIFICATION_WEBHOOK_ENABLED || '').toLowerCase() === 'true';
    this.url = (process.env.NOTIFICATION_WEBHOOK_URL || '').trim();
    this.secret = (process.env.NOTIFICATION_WEBHOOK_SECRET || '').trim();

    // Disable if no URL is configured even when enabled flag is set
    if (this.enabled && !this.url) {
      console.warn(
        '[Notification:webhook] NOTIFICATION_WEBHOOK_ENABLED is true but no NOTIFICATION_WEBHOOK_URL is configured. Webhook channel disabled.'
      );
      this.enabled = false;
    }
  }

  async send(payload: NotificationPayload): Promise<void> {
    if (!this.enabled) {
      return;
    }

    try {
      const body = {
        event: payload.eventType,
        incident_id: payload.incidentId,
        rule_id: payload.ruleId,
        api_id: payload.apiId,
        api_name: payload.apiName,
        environment: payload.environment,
        severity: payload.severity,
        metric: payload.metric,
        details: payload.details,
        timestamp: payload.timestamp.toISOString(),
      };

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (this.secret) {
        headers['X-Notification-Secret'] = this.secret;
      }

      await axios.post(this.url, body, {
        headers,
        timeout: 5000,
      });

      console.log(
        `[Notification:webhook] Successfully delivered ${payload.eventType} for incident #${payload.incidentId}`
      );
    } catch (err: any) {
      // Webhook failures must never break monitoring or incident processing
      const message = axios.isAxiosError(err)
        ? `${err.code || 'HTTP_ERROR'} — ${err.message}`
        : (err.message || String(err));

      console.error(
        `[Notification:webhook] Failed to deliver ${payload.eventType} for incident #${payload.incidentId}: ${message}`
      );
    }
  }
}

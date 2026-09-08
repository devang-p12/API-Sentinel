import { NotificationChannel, NotificationPayload } from '../notification.types';

/**
 * Console notification channel.
 *
 * Always active. Logs structured notification messages to stdout.
 * Useful for development, debugging, and audit trails.
 * Never throws — all errors are caught and logged to stderr.
 */
export class ConsoleChannel implements NotificationChannel {
  readonly name = 'console';

  async send(payload: NotificationPayload): Promise<void> {
    try {
      const icon = payload.eventType === 'INCIDENT_CREATED' ? '🚨' : '✅';
      const severityLabel = payload.severity ? ` [${payload.severity}]` : '';

      const lines = [
        `${icon} [${payload.eventType}]${severityLabel} API "${payload.apiName}" (${payload.environment})`,
        `   Metric: ${payload.metric}`,
        `   ${payload.details}`,
        `   Incident #${payload.incidentId} | Rule #${payload.ruleId} | API #${payload.apiId}`,
        `   ${payload.timestamp.toISOString()}`,
      ];

      console.log(`\n[Notification] ${lines.join('\n')}\n`);
    } catch (err) {
      // Console channel must never throw
      console.error('[Notification:console] Failed to log notification:', err);
    }
  }
}

import { query } from '../config/database';
import { EvaluatorReport, RuleEvaluationResult } from './alert-evaluator.service';
import { NotificationChannel, NotificationEventType, NotificationPayload } from './notification.types';
import { ConsoleChannel } from './channels/console.channel';
import { WebhookChannel } from './channels/webhook.channel';

/**
 * Notification orchestrator.
 *
 * Receives EvaluatorReport results from the MonitoringWorker,
 * filters to notification-worthy events (INCIDENT_CREATED and INCIDENT_RESOLVED),
 * applies in-memory cooldown deduplication, builds a NotificationPayload,
 * and dispatches to all registered channels.
 *
 * This service never throws — all errors are caught internally so that
 * notification failures cannot affect monitoring or incident processing.
 *
 * The in-memory cooldown is a best-effort spam guard only. It does NOT replace
 * or modify the evaluator's own alert cooldown or incident deduplication logic.
 */
export class NotificationService {
  private channels: NotificationChannel[] = [];

  /**
   * In-memory cooldown map.
   * Key:   "ruleId:<id>:<eventType>"   (e.g. "ruleId:42:INCIDENT_CREATED")
   * Value: timestamp (ms) of last dispatched notification for that key.
   *
   * INCIDENT_CREATED and INCIDENT_RESOLVED have independent cooldowns,
   * so resolving an incident immediately after creation is never suppressed.
   */
  private cooldownMap: Map<string, number> = new Map();

  /** Cooldown duration in milliseconds */
  private cooldownMs: number;

  constructor() {
    // Parse cooldown from environment (default: 5 minutes)
    const cooldownMins = Math.max(0, parseInt(process.env.NOTIFICATION_COOLDOWN_MINS || '5', 10));
    this.cooldownMs = (isNaN(cooldownMins) ? 5 : cooldownMins) * 60 * 1000;

    // Always register console channel
    this.channels.push(new ConsoleChannel());

    // Conditionally register webhook channel
    this.channels.push(new WebhookChannel());
  }

  /**
   * Process an EvaluatorReport and dispatch notifications for actionable events.
   *
   * Called by MonitoringWorker after alert evaluation completes.
   * This method is fire-and-forget — it never throws.
   *
   * @param report  - The evaluator report containing rule evaluation results
   * @param apiName - The API name from the monitoring worker's api record
   */
  async processEvaluatorReport(report: EvaluatorReport, apiName: string): Promise<void> {
    try {
      for (const result of report.results) {
        // Only INCIDENT_CREATED and INCIDENT_RESOLVED warrant a notification
        if (result.action !== 'INCIDENT_CREATED' && result.action !== 'INCIDENT_RESOLVED') {
          continue;
        }

        // incidentId is required for notification — skip if missing
        if (result.incidentId === undefined) {
          continue;
        }

        const eventType: NotificationEventType = result.action;

        // Check in-memory cooldown (keyed by ruleId + eventType independently)
        const cooldownKey = `ruleId:${result.ruleId}:${eventType}`;
        const lastDispatched = this.cooldownMap.get(cooldownKey);
        const now = Date.now();

        if (lastDispatched !== undefined && (now - lastDispatched) < this.cooldownMs) {
          console.log(
            `[Notification] Skipped ${eventType} for rule #${result.ruleId} — cooldown active (${Math.round((this.cooldownMs - (now - lastDispatched)) / 1000)}s remaining)`
          );
          continue;
        }

        // Look up severity from alert_rules table
        const severity = await this.lookupRuleSeverity(result.ruleId);

        // Build payload from actual evaluator fields
        const payload: NotificationPayload = {
          eventType,
          incidentId: result.incidentId,
          ruleId: result.ruleId,
          apiId: report.apiId,
          apiName,
          environment: report.environment,
          metric: result.metric,
          details: result.details,
          severity,
          timestamp: report.evaluatedAt,
        };

        // Dispatch to all channels, isolating failures per channel
        await this.dispatchToChannels(payload);

        // Update cooldown map after successful dispatch attempt
        this.cooldownMap.set(cooldownKey, now);
      }
    } catch (err) {
      // Top-level catch ensures this method never throws
      console.error('[Notification] Unexpected error processing evaluator report:', err);
    }
  }

  /**
   * Dispatch a notification payload to every registered channel.
   * Each channel call is individually wrapped in try/catch so
   * a failing webhook never prevents the console channel from logging.
   */
  private async dispatchToChannels(payload: NotificationPayload): Promise<void> {
    for (const channel of this.channels) {
      try {
        await channel.send(payload);
      } catch (err) {
        console.error(
          `[Notification] Channel "${channel.name}" failed for ${payload.eventType} incident #${payload.incidentId}:`,
          err
        );
      }
    }
  }

  /**
   * Look up the severity of an alert rule from the database.
   * Returns null if the rule is not found or the query fails.
   */
  private async lookupRuleSeverity(ruleId: number): Promise<string | null> {
    try {
      const result = await query(
        'SELECT severity FROM alert_rules WHERE id = $1',
        [ruleId]
      );
      return result.rows[0]?.severity || null;
    } catch {
      return null;
    }
  }
}

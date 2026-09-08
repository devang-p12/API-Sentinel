/**
 * Notification System — Shared types and interfaces.
 *
 * All payload fields are derived from the actual EvaluatorReport and
 * RuleEvaluationResult definitions in alert-evaluator.service.ts,
 * plus context passed in by the MonitoringWorker.
 */

/**
 * Only these evaluator actions warrant an outbound notification.
 * INCIDENT_UPDATED, SKIPPED_COOLDOWN, STREAK_PENDING, and NO_ACTION
 * are intentionally excluded to prevent notification spam.
 */
export type NotificationEventType = 'INCIDENT_CREATED' | 'INCIDENT_RESOLVED';

/**
 * Payload dispatched to every registered notification channel.
 *
 * Field sources:
 *   eventType    — mapped from RuleEvaluationResult.action
 *   incidentId   — RuleEvaluationResult.incidentId
 *   ruleId       — RuleEvaluationResult.ruleId
 *   apiId        — EvaluatorReport.apiId
 *   apiName      — passed from MonitoringWorker (api.name)
 *   environment  — EvaluatorReport.environment
 *   metric       — RuleEvaluationResult.metric
 *   details      — RuleEvaluationResult.details
 *   severity     — looked up from alert_rules table via ruleId (optional)
 *   timestamp    — EvaluatorReport.evaluatedAt
 */
export interface NotificationPayload {
  eventType: NotificationEventType;
  incidentId: number;
  ruleId: number;
  apiId: number;
  apiName: string;
  environment: string;
  metric: string;
  details: string;
  severity: string | null;
  timestamp: Date;
}

/**
 * Interface that every notification channel must implement.
 * Channels should handle their own errors internally and never throw.
 */
export interface NotificationChannel {
  readonly name: string;
  send(payload: NotificationPayload): Promise<void>;
}

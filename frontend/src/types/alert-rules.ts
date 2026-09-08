export type AlertMetric =
  | 'RESPONSE_TIME'
  | 'ERROR_RATE'
  | 'HTTP_STATUS'
  | 'API_UNAVAILABLE'
  | 'UPTIME'
  | 'CONSECUTIVE_FAILURES';

export type AlertOperator =
  | 'GREATER_THAN'
  | 'LESS_THAN'
  | 'GREATER_THAN_OR_EQUAL'
  | 'LESS_THAN_OR_EQUAL'
  | 'EQUALS';

export type AlertSeverity = 'INFO' | 'WARNING' | 'CRITICAL';

export interface AlertRule {
  id: number;
  apiId: number;
  environment: string;
  metric: AlertMetric;
  operator: AlertOperator;
  threshold: number;
  evaluationWindowMins: number;
  consecutiveFailuresCount: number;
  severity: AlertSeverity;
  cooldownMins: number;
  lastTriggeredAt: string | null;
  isEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAlertRulePayload {
  api_id: number;
  environment: string;
  metric: AlertMetric;
  operator: AlertOperator;
  threshold: number;
  evaluation_window_mins?: number;
  consecutive_failures_count?: number;
  severity: AlertSeverity;
  cooldown_mins?: number;
  is_enabled?: boolean;
}

export type UpdateAlertRulePayload = Partial<CreateAlertRulePayload>;

export interface AlertRulesFilter {
  apiId?: number;
  environment?: string;
  severity?: AlertSeverity | 'all';
}

export interface NotificationAlertSummary {
  ruleName: string;
  metric: string;
  currentValue?: number | null;
  threshold: number;
  severity: string;
}

export interface NotificationPayload {
  incidentId?: string;
  incidentTitle?: string;
  incidentSeverity?: string;
  incidentStatus?: string;
  serviceName?: string;
  environmentName?: string;
  projectName?: string;
  startedAt?: string;
  resolvedAt?: string;
  durationSeconds?: number;
  alerts?: NotificationAlertSummary[];
  eventType: 'FIRING' | 'RECOVERY' | 'REPEAT' | 'TEST';
  frontendUrl?: string;
  testMessage?: string;
  // Specific alert rule notification parameters
  ruleName?: string;
  metricName?: string;
  metricUnit?: string;
  currentValue?: number | null;
  resolvedValue?: number | null;
  threshold?: number;
  thresholdOperator?: string;
  apiName?: string;
  monitorName?: string;
  alertUrl?: string;
  durationText?: string;
}

export interface ChannelSendResult {
  success: boolean;
  statusMessage: string;
  retryable: boolean;
  statusCode?: number;
  details?: Record<string, any>;
}

export interface NotificationChannel {
  send(contactPointConfig: Record<string, any>, payload: NotificationPayload): Promise<ChannelSendResult>;
}

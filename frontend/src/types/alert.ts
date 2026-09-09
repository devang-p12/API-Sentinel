export interface AlertRule {
  id: number;
  apiId: number;
  apiName?: string;
  environment: string;
  metric: string;
  operator: string;
  threshold: number;
  evaluationWindow: string;
  consecutiveFailures: number;
  severity: string;
  enabled: boolean;
  createdAt: string;
}

export interface IncidentEvent {
  id: number;
  eventType: string;
  message: string;
  metadata?: any;
  createdAt: string;
}

export interface Incident {
  id: number;
  incidentId: string;
  apiId: number;
  apiName?: string;
  alertRuleId?: number;
  environment: string;
  severity: string;
  triggerReason: string;
  status: 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED';
  startedAt: string;
  resolvedAt?: string;
  failedChecks: number;
  errorInfo?: any;
  events?: IncidentEvent[];
}

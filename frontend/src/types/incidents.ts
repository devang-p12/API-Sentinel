export type IncidentStatus = 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED';

export type IncidentSeverity = 'INFO' | 'WARNING' | 'CRITICAL';

export type TimelineEventType =
  | 'ALERT_TRIGGERED'
  | 'ACKNOWLEDGED'
  | 'NOTE_ADDED'
  | 'RESOLVED';

export interface Incident {
  id: number;
  apiId: number;
  apiName: string;
  ruleId: number;
  ruleMetric: string;
  ruleOperator: string;
  ruleThreshold: number | string;
  environment: string;
  severity: IncidentSeverity;
  status: IncidentStatus;
  triggerDetails: string | null;
  startedAt: string;
  resolvedAt: string | null;
  failedChecksCount: number;
  errorInfo: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TimelineEvent {
  id: number;
  incidentId: number;
  eventType: TimelineEventType;
  description: string | null;
  timestamp: string;
}

export interface ListIncidentsQuery {
  api_id?: number;
  environment?: string;
  status?: IncidentStatus | 'all';
  severity?: IncidentSeverity | 'all';
  limit?: number;
  offset?: number;
}

export interface AcknowledgePayload {
  note?: string;
}

export interface ResolvePayload {
  note?: string;
}

export interface AddNotePayload {
  note: string;
}

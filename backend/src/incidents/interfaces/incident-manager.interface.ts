import { AlertSeverity, IncidentEventType, IncidentStatus } from '@prisma/client';

export interface IncidentEvaluationCheck {
  id?: string;
  timestamp?: Date | string;
  statusCode?: number | null;
  success: boolean;
  timeout?: boolean;
  errorType?: string | null;
  errorMessage?: string | null;
}

export interface IncidentPolicyConfig {
  /** Number of consecutive failures required before creating an incident (default: 3) */
  failureThreshold?: number;

  /** Number of consecutive successes required to resolve an active incident (default: 3) */
  recoveryThreshold?: number;

  /** Default severity for the incident (default: HIGH or WARNING) */
  defaultSeverity?: AlertSeverity;
}

export interface ProcessCheckIncidentOptions {
  organizationId: string;
  apiId: string;
  environmentId?: string | null;
  monitorConfigId?: string | null;
  projectId?: string | null;
  check: IncidentEvaluationCheck;
  recentChecks?: IncidentEvaluationCheck[];
  policy?: IncidentPolicyConfig;
}

export interface IncidentProcessResult {
  action: 'CREATED' | 'UPDATED' | 'RESOLVED' | 'NO_OP' | 'THRESHOLD_PENDING';
  incidentId?: string;
  isNewIncident: boolean;
  incident?: any;
  reason?: string;
}

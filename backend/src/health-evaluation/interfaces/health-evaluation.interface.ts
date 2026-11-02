export enum HealthState {
  HEALTHY = 'HEALTHY',
  DEGRADED = 'DEGRADED',
  DOWN = 'DOWN',
}

export interface HealthPolicyConfig {
  /** Expected HTTP status code (default: 200) */
  expectedStatus?: number;

  /** Latency in ms above which a successful check is deemed DEGRADED (default: 1000) */
  degradedLatencyThresholdMs?: number;

  /** Latency in ms deemed critically high (default: 3000) */
  criticalLatencyThresholdMs?: number;

  /** Consecutive failures threshold to mark status as DOWN (default: 3) */
  consecutiveFailuresForDown?: number;

  /** Consecutive failures threshold to mark status as DEGRADED (default: 1) */
  consecutiveFailuresForDegraded?: number;

  /** Minimum availability percentage in sliding window before state is DEGRADED (default: 95.0) */
  minAvailabilityDegraded?: number;

  /** Minimum availability percentage in sliding window below which state is DOWN (default: 70.0) */
  minAvailabilityDown?: number;

  /** Number of recent checks in the evaluation sliding window (default: 20) */
  slidingWindowSize?: number;

  /** Whether a single request timeout immediately forces DOWN state (default: false) */
  immediateDownOnTimeout?: boolean;
}

export interface HealthCheckRecord {
  id?: string;
  timestamp: Date | string;
  statusCode?: number | null;
  latencyMs: number;
  success: boolean;
  timeout?: boolean;
  errorType?: string | null;
  errorMessage?: string | null;
  schemaValid?: boolean | null;
  hasBreakingSchemaChange?: boolean;
}

export interface HealthEvaluationResult {
  currentState: HealthState;
  reason: string;
  lastSuccessfulCheck: Date | string | null;
  lastFailedCheck: Date | string | null;
  consecutiveFailures: number;
  consecutiveSuccesses: number;
  availabilityPercentage: number;
  averageLatencyMs: number;
  checksEvaluated: number;
  policy: Required<HealthPolicyConfig>;
}

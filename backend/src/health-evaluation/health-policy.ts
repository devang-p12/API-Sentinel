import { HealthPolicyConfig } from './interfaces/health-evaluation.interface';

export const DEFAULT_HEALTH_POLICY: Required<HealthPolicyConfig> = {
  expectedStatus: 200,
  degradedLatencyThresholdMs: 1000,
  criticalLatencyThresholdMs: 3000,
  consecutiveFailuresForDown: 3,
  consecutiveFailuresForDegraded: 1,
  minAvailabilityDegraded: 95.0,
  minAvailabilityDown: 70.0,
  slidingWindowSize: 20,
  immediateDownOnTimeout: false,
};

/**
 * Resolves a complete, validated HealthPolicyConfig by applying overrides on top of defaults.
 */
export function resolveHealthPolicy(
  overrides?: Partial<HealthPolicyConfig>,
): Required<HealthPolicyConfig> {
  if (!overrides) {
    return { ...DEFAULT_HEALTH_POLICY };
  }

  const expectedStatus = overrides.expectedStatus ?? DEFAULT_HEALTH_POLICY.expectedStatus;
  const degradedLatencyThresholdMs = Math.max(
    50,
    overrides.degradedLatencyThresholdMs ?? DEFAULT_HEALTH_POLICY.degradedLatencyThresholdMs,
  );
  const criticalLatencyThresholdMs = Math.max(
    degradedLatencyThresholdMs,
    overrides.criticalLatencyThresholdMs ?? DEFAULT_HEALTH_POLICY.criticalLatencyThresholdMs,
  );
  const consecutiveFailuresForDown = Math.max(
    1,
    overrides.consecutiveFailuresForDown ?? DEFAULT_HEALTH_POLICY.consecutiveFailuresForDown,
  );
  const consecutiveFailuresForDegraded = Math.max(
    1,
    Math.min(
      consecutiveFailuresForDown,
      overrides.consecutiveFailuresForDegraded ?? DEFAULT_HEALTH_POLICY.consecutiveFailuresForDegraded,
    ),
  );
  const minAvailabilityDown = Math.min(
    100,
    Math.max(0, overrides.minAvailabilityDown ?? DEFAULT_HEALTH_POLICY.minAvailabilityDown),
  );
  const minAvailabilityDegraded = Math.min(
    100,
    Math.max(
      minAvailabilityDown,
      overrides.minAvailabilityDegraded ?? DEFAULT_HEALTH_POLICY.minAvailabilityDegraded,
    ),
  );
  const slidingWindowSize = Math.max(
    1,
    overrides.slidingWindowSize ?? DEFAULT_HEALTH_POLICY.slidingWindowSize,
  );
  const immediateDownOnTimeout = overrides.immediateDownOnTimeout ?? DEFAULT_HEALTH_POLICY.immediateDownOnTimeout;

  return {
    expectedStatus,
    degradedLatencyThresholdMs,
    criticalLatencyThresholdMs,
    consecutiveFailuresForDown,
    consecutiveFailuresForDegraded,
    minAvailabilityDegraded,
    minAvailabilityDown,
    slidingWindowSize,
    immediateDownOnTimeout,
  };
}

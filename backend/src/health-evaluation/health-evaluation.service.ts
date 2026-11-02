import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  HealthCheckRecord,
  HealthEvaluationResult,
  HealthPolicyConfig,
  HealthState,
} from './interfaces/health-evaluation.interface';
import { resolveHealthPolicy } from './health-policy';

@Injectable()
export class HealthEvaluationService {
  private readonly logger = new Logger(HealthEvaluationService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Pure, deterministic health evaluation function.
   * Evaluates health state, reason, streaks, and timestamps based on provided policy.
   *
   * Considers:
   * 1. Status Code vs Expected Status
   * 2. Timeout occurrences
   * 3. Consecutive failures streak
   * 4. Latency vs Degradation/Critical thresholds
   * 5. Monitoring availability percentage over sliding window
   */
  evaluate(
    checks: HealthCheckRecord[],
    customPolicy?: HealthPolicyConfig,
  ): HealthEvaluationResult {
    const policy = resolveHealthPolicy(customPolicy);

    if (!checks || checks.length === 0) {
      return {
        currentState: HealthState.HEALTHY,
        reason: 'No monitoring checks recorded yet. Initializing in HEALTHY baseline state.',
        lastSuccessfulCheck: null,
        lastFailedCheck: null,
        consecutiveFailures: 0,
        consecutiveSuccesses: 0,
        availabilityPercentage: 100,
        averageLatencyMs: 0,
        checksEvaluated: 0,
        policy,
      };
    }

    // Sort descending by timestamp (newest first)
    const sorted = [...checks].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );

    const window = sorted.slice(0, policy.slidingWindowSize);
    const checksEvaluated = window.length;

    let consecutiveFailures = 0;
    let consecutiveSuccesses = 0;
    let countingFailures = true;
    let countingSuccesses = true;
    let lastSuccessfulCheck: Date | string | null = null;
    let lastFailedCheck: Date | string | null = null;

    let successfulCount = 0;
    let latencySum = 0;
    let latencyCount = 0;

    for (const check of window) {
      const isSuccess =
        check.success &&
        !check.timeout &&
        check.schemaValid !== false &&
        !check.hasBreakingSchemaChange &&
        (check.statusCode === undefined ||
          check.statusCode === null ||
          check.statusCode === policy.expectedStatus);

      if (isSuccess) {
        successfulCount++;
        if (!lastSuccessfulCheck) {
          lastSuccessfulCheck = check.timestamp;
        }
        if (countingSuccesses) {
          consecutiveSuccesses++;
        }
        countingFailures = false;

        if (check.latencyMs > 0) {
          latencySum += check.latencyMs;
          latencyCount++;
        }
      } else {
        if (!lastFailedCheck) {
          lastFailedCheck = check.timestamp;
        }
        if (countingFailures) {
          consecutiveFailures++;
        }
        countingSuccesses = false;
      }
    }

    const availabilityPercentage = Number(
      ((successfulCount / checksEvaluated) * 100).toFixed(2),
    );
    const averageLatencyMs =
      latencyCount > 0 ? Math.round(latencySum / latencyCount) : 0;

    const latest = window[0];
    const latestIsSuccess =
      latest.success &&
      !latest.timeout &&
      latest.schemaValid !== false &&
      !latest.hasBreakingSchemaChange &&
      (latest.statusCode === undefined ||
        latest.statusCode === null ||
        latest.statusCode === policy.expectedStatus);

    let currentState: HealthState;
    let reason: string;

    // Rule 1: DOWN State Evaluation
    if (consecutiveFailures >= policy.consecutiveFailuresForDown) {
      currentState = HealthState.DOWN;
      const detail = latest.timeout
        ? 'request timeout'
        : latest.hasBreakingSchemaChange || latest.schemaValid === false
          ? 'breaking schema change'
          : latest.errorType ||
            (latest.statusCode ? `HTTP ${latest.statusCode}` : 'connection failure');
      reason = `Target API is DOWN: ${consecutiveFailures} consecutive failures recorded (latest: ${detail}).`;
    } else if (policy.immediateDownOnTimeout && latest.timeout) {
      currentState = HealthState.DOWN;
      reason = 'Target API is DOWN: Immediate request timeout encountered.';
    } else if (
      !latestIsSuccess &&
      checksEvaluated >= 5 &&
      availabilityPercentage < policy.minAvailabilityDown
    ) {
      currentState = HealthState.DOWN;
      reason = `Target API is DOWN: Severe availability degradation (${availabilityPercentage}% < ${policy.minAvailabilityDown}% threshold).`;
    }
    // Rule 2: DEGRADED State Evaluation
    else if (latest.hasBreakingSchemaChange || latest.schemaValid === false) {
      // Requirement 7: Do not mark HTTP 200 as fully healthy when a breaking contract change exists
      currentState = HealthState.DEGRADED;
      reason = `Target API is DEGRADED: Breaking schema contract change detected (HTTP ${latest.statusCode ?? 200} returned but response payload violates contract baseline).`;
    } else if (consecutiveFailures >= policy.consecutiveFailuresForDegraded) {
      currentState = HealthState.DEGRADED;
      const detail = latest.timeout
        ? 'request timeout'
        : latest.errorType ||
          (latest.statusCode ? `HTTP ${latest.statusCode}` : 'failure');
      reason = `Target API is DEGRADED: ${consecutiveFailures} consecutive failure(s) recorded (${detail}), below DOWN threshold (${policy.consecutiveFailuresForDown}).`;
    } else if (latestIsSuccess && latest.latencyMs > policy.criticalLatencyThresholdMs) {
      currentState = HealthState.DEGRADED;
      reason = `Target API is DEGRADED: Critical latency spike (${latest.latencyMs}ms) exceeds critical threshold (${policy.criticalLatencyThresholdMs}ms).`;
    } else if (latestIsSuccess && latest.latencyMs > policy.degradedLatencyThresholdMs) {
      currentState = HealthState.DEGRADED;
      reason = `Target API is DEGRADED: Elevated latency (${latest.latencyMs}ms) exceeds degradation threshold (${policy.degradedLatencyThresholdMs}ms).`;
    } else if (
      checksEvaluated >= 5 &&
      availabilityPercentage < policy.minAvailabilityDegraded
    ) {
      currentState = HealthState.DEGRADED;
      reason = `Target API is DEGRADED: Availability (${availabilityPercentage}%) dropped below SLA (${policy.minAvailabilityDegraded}%).`;
    }
    // Rule 3: HEALTHY State Evaluation
    else {
      currentState = HealthState.HEALTHY;
      reason = `Target API is HEALTHY: Status ${latest.statusCode ?? policy.expectedStatus} matches expected (${policy.expectedStatus}), latency (${latest.latencyMs}ms) is optimal, and availability is ${availabilityPercentage}%.`;
    }

    return {
      currentState,
      reason,
      lastSuccessfulCheck,
      lastFailedCheck,
      consecutiveFailures,
      consecutiveSuccesses,
      availabilityPercentage,
      averageLatencyMs,
      checksEvaluated,
      policy,
    };
  }

  /**
   * Evaluates health for a specific monitor configuration from PostgreSQL MonitorResults.
   */
  async evaluateMonitor(
    monitorId: string,
    organizationId?: string,
    customPolicy?: HealthPolicyConfig,
  ): Promise<HealthEvaluationResult> {
    const policy = resolveHealthPolicy(customPolicy);

    // Load recent results from monitor_results
    const results = await this.prisma.monitorResult.findMany({
      where: {
        OR: [{ monitorConfigId: monitorId }, { id: monitorId }],
        ...(organizationId ? { organizationId } : {}),
      },
      orderBy: { timestamp: 'desc' },
      take: policy.slidingWindowSize,
    });

    // Also check monitor_executions for backward compatibility if results are empty
    let checks: HealthCheckRecord[] = results.map((r) => ({
      id: r.id,
      timestamp: r.timestamp,
      statusCode: r.statusCode,
      latencyMs: r.latencyMs,
      success: r.success,
      timeout: r.timeout,
      errorType: r.errorType,
      errorMessage: r.errorMessage,
      schemaValid: r.schemaValid,
      hasBreakingSchemaChange: r.schemaValid === false,
    }));

    if (checks.length === 0) {
      const legacyExecutions = await this.prisma.monitorExecution.findMany({
        where: { monitorId },
        orderBy: { executedAt: 'desc' },
        take: policy.slidingWindowSize,
      });

      checks = legacyExecutions.map((e) => ({
        id: e.id,
        timestamp: e.executedAt,
        statusCode: e.statusCode,
        latencyMs: e.responseTimeMs,
        success: e.status === 'SUCCESS',
        timeout: e.status === 'TIMEOUT',
        errorMessage: e.errorMessage,
        schemaValid: !e.errorMessage?.includes('Schema contract violation'),
        hasBreakingSchemaChange: !!e.errorMessage?.includes('Schema contract violation'),
      }));
    }

    return this.evaluate(checks, customPolicy);
  }

  /**
   * Evaluates aggregated health for an API across all its environments.
   */
  async evaluateApi(
    apiId: string,
    organizationId?: string,
    customPolicy?: HealthPolicyConfig,
  ): Promise<HealthEvaluationResult> {
    const policy = resolveHealthPolicy(customPolicy);

    const results = await this.prisma.monitorResult.findMany({
      where: {
        apiId,
        ...(organizationId ? { organizationId } : {}),
      },
      orderBy: { timestamp: 'desc' },
      take: policy.slidingWindowSize,
    });

    const checks: HealthCheckRecord[] = results.map((r) => ({
      id: r.id,
      timestamp: r.timestamp,
      statusCode: r.statusCode,
      latencyMs: r.latencyMs,
      success: r.success,
      timeout: r.timeout,
      errorType: r.errorType,
      errorMessage: r.errorMessage,
      schemaValid: r.schemaValid,
      hasBreakingSchemaChange: r.schemaValid === false,
    }));

    return this.evaluate(checks, customPolicy);
  }

  /**
   * Evaluates aggregated health for an Environment.
   */
  async evaluateEnvironment(
    environmentId: string,
    organizationId?: string,
    customPolicy?: HealthPolicyConfig,
  ): Promise<HealthEvaluationResult> {
    const policy = resolveHealthPolicy(customPolicy);

    const results = await this.prisma.monitorResult.findMany({
      where: {
        environmentId,
        ...(organizationId ? { organizationId } : {}),
      },
      orderBy: { timestamp: 'desc' },
      take: policy.slidingWindowSize,
    });

    const checks: HealthCheckRecord[] = results.map((r) => ({
      id: r.id,
      timestamp: r.timestamp,
      statusCode: r.statusCode,
      latencyMs: r.latencyMs,
      success: r.success,
      timeout: r.timeout,
      errorType: r.errorType,
      errorMessage: r.errorMessage,
    }));

    return this.evaluate(checks, customPolicy);
  }
}

/**
 * ==============================================================================
 * Deterministic API Reliability Scoring Algorithm
 * ==============================================================================
 *
 * Composite Score Formula:
 * ------------------------------------------------------------------------------
 * Score = (w_avail * S_avail) + (w_lat * S_lat) + (w_err * S_err) +
 *         (w_stab * S_stab) + (w_schema * S_schema)
 *
 * Range: [0, 100]
 * Default Weights:
 *   - Availability (w_avail):       35% (0.35)
 *   - Error Rate   (w_err):         25% (0.25)
 *   - Latency      (w_lat):         20% (0.20)
 *   - Stability    (w_stab):        10% (0.10)
 *   - Schema       (w_schema):      10% (0.10)
 *
 * Normalized Weights:
 *   W = sum(w_i)
 *   w'_i = w_i / W (ensures weights always sum to exactly 1.0 even if custom weights provided)
 *
 * Sub-score Formulas:
 * 1. S_avail (Availability, 0-100):
 *    S_avail = min(100, max(0, (successful_checks / total_checks) * 100))
 *
 * 2. S_err (Errors, 0-100):
 *    error_rate = (failed_checks / total_checks) * 100
 *    S_err = max(0, 100 - error_rate)
 *
 * 3. S_lat (Latency, 0-100):
 *    Evaluates average response time against SLA thresholds:
 *      avg_lat <= targetLatencyMs (200ms)  => 100
 *      avg_lat >= maxLatencyMs (2000ms)    => 0
 *      target < avg_lat < max              => 100 - ((avg_lat - target) / (max - target)) * 100
 *
 * 4. S_stab (Latency Stability, 0-100):
 *    Evaluates jitter using Coefficient of Variation CV = std_dev / mean_lat:
 *      CV <= minJitterCv (0.10)            => 100
 *      CV >= maxJitterCv (1.50)            => 0
 *      min < CV < max                      => 100 - ((CV - min) / (max - min)) * 100
 *
 * 5. S_schema (Schema Stability, 0-100):
 *    schema_valid_rate = (schema_valid_checks / total_schema_validated_checks) * 100
 *    S_schema = min(100, max(0, schema_valid_rate)) (default: 100 if no schema errors)
 * ==============================================================================
 */

import {
  ReliabilityAlgorithmConfig,
  ReliabilitySampleCheck,
  ReliabilityScoreBreakdown,
  ReliabilityWeights,
  ScoreDimensionBreakdown,
} from './interfaces/reliability-score.interface';

export const DEFAULT_RELIABILITY_WEIGHTS: Required<ReliabilityWeights> = {
  availabilityWeight: 0.35,
  latencyWeight: 0.20,
  errorRateWeight: 0.25,
  latencyStabilityWeight: 0.10,
  schemaStabilityWeight: 0.10,
};

export const DEFAULT_ALGORITHM_CONFIG: Required<ReliabilityAlgorithmConfig> = {
  weights: DEFAULT_RELIABILITY_WEIGHTS,
  targetLatencyMs: 200,
  maxAcceptableLatencyMs: 2000,
  minJitterCv: 0.10,
  maxJitterCv: 1.50,
};

export class ReliabilityScoringAlgorithm {
  /**
   * Deterministically calculates reliability score and full dimensional breakdown.
   */
  public static calculate(
    checks: ReliabilitySampleCheck[],
    customConfig?: ReliabilityAlgorithmConfig,
  ): ReliabilityScoreBreakdown {
    const config = this.resolveConfig(customConfig);

    if (!checks || checks.length === 0) {
      return this.generateEmptyBaseline(config);
    }

    const totalChecks = checks.length;
    let availableCount = 0;
    let successfulCount = 0;
    let failedCount = 0;
    let schemaErrorsCount = 0;
    let schemaEvaluatedCount = 0;

    const latencies: number[] = [];

    let periodStart: Date | string = checks[0].timestamp;
    let periodEnd: Date | string = checks[0].timestamp;

    for (const c of checks) {
      const ts = new Date(c.timestamp).getTime();
      if (ts < new Date(periodStart).getTime()) periodStart = c.timestamp;
      if (ts > new Date(periodEnd).getTime()) periodEnd = c.timestamp;

      // Determine reachability / availability (SRE standard: service responds, not timed out or network drop)
      const isUnavailable =
        c.timeout ||
        c.statusCode === 0 ||
        c.statusCode === 502 ||
        c.statusCode === 503 ||
        c.statusCode === 504 ||
        c.errorType === 'NETWORK_ERROR' ||
        c.errorType === 'TIMEOUT' ||
        c.errorType === 'CONNECTION_REFUSED';

      if (!isUnavailable) {
        availableCount++;
      }

      // Determine application success vs error
      const isError =
        !c.success ||
        c.timeout ||
        (c.statusCode !== undefined && c.statusCode !== null && (c.statusCode < 200 || c.statusCode >= 400));

      if (!isError) {
        successfulCount++;
      } else {
        failedCount++;
      }

      // Collect latency metrics for responsive checks
      if (!isUnavailable && c.latencyMs > 0) {
        latencies.push(c.latencyMs);
      }

      if (c.schemaValid !== null && c.schemaValid !== undefined) {
        schemaEvaluatedCount++;
        if (!c.schemaValid) {
          schemaErrorsCount++;
        }
      }
    }

    // 1. Availability Dimension (reachability & service uptime)
    const rawAvailabilityPct = Number(((availableCount / totalChecks) * 100).toFixed(2));
    const availabilityScore = Math.min(100, Math.max(0, rawAvailabilityPct));

    // 2. Error Rate Dimension (application transaction success)
    const rawErrorRatePct = Number(((failedCount / totalChecks) * 100).toFixed(2));
    const errorScore = Math.min(100, Math.max(0, Number((100 - rawErrorRatePct).toFixed(2))));

    // 3. Latency Dimension
    let avgLatency = 0;
    let latencyScore = 0;

    if (latencies.length > 0) {
      avgLatency = Math.round(latencies.reduce((sum, v) => sum + v, 0) / latencies.length);
      if (avgLatency <= config.targetLatencyMs) {
        latencyScore = 100;
      } else if (avgLatency >= config.maxAcceptableLatencyMs) {
        latencyScore = 0;
      } else {
        const penaltyRatio =
          (avgLatency - config.targetLatencyMs) /
          (config.maxAcceptableLatencyMs - config.targetLatencyMs);
        latencyScore = Number((100 - penaltyRatio * 100).toFixed(2));
      }
    } else {
      // If no requests were completed/responsive, latency score is 0
      avgLatency = 0;
      latencyScore = 0;
    }

    // 4. Latency Stability (Jitter / CV)
    let latencyStabilityScore = 0;
    let stdDev = 0;
    let cv = 0;

    if (latencies.length > 1 && avgLatency > 0) {
      const variance =
        latencies.reduce((sum, l) => sum + Math.pow(l - avgLatency, 2), 0) /
        latencies.length;
      stdDev = Math.round(Math.sqrt(variance));
      cv = Number((stdDev / avgLatency).toFixed(2));

      if (cv <= config.minJitterCv) {
        latencyStabilityScore = 100;
      } else if (cv >= config.maxJitterCv) {
        latencyStabilityScore = 0;
      } else {
        const jitterRatio = (cv - config.minJitterCv) / (config.maxJitterCv - config.minJitterCv);
        latencyStabilityScore = Number((100 - jitterRatio * 100).toFixed(2));
      }
    } else if (latencies.length === 1) {
      latencyStabilityScore = 100;
    } else {
      latencyStabilityScore = 0;
    }

    // 5. Schema Stability Dimension
    let schemaScore = 0;
    if (availableCount > 0) {
      if (schemaEvaluatedCount > 0) {
        const compliancePct = ((schemaEvaluatedCount - schemaErrorsCount) / schemaEvaluatedCount) * 100;
        schemaScore = Math.min(100, Math.max(0, Number(compliancePct.toFixed(2))));
      } else {
        schemaScore = 100;
      }
    } else {
      schemaScore = 0;
    }

    // Compute Weighted Composite Score
    const w = config.weights;
    const totalWeight =
      w.availabilityWeight +
      w.latencyWeight +
      w.errorRateWeight +
      w.latencyStabilityWeight +
      w.schemaStabilityWeight;

    const normAvail = w.availabilityWeight / totalWeight;
    const normLat = w.latencyWeight / totalWeight;
    const normErr = w.errorRateWeight / totalWeight;
    const normStab = w.latencyStabilityWeight / totalWeight;
    const normSchema = w.schemaStabilityWeight / totalWeight;

    const compositeScore = Number(
      (
        availabilityScore * normAvail +
        latencyScore * normLat +
        errorScore * normErr +
        latencyStabilityScore * normStab +
        schemaScore * normSchema
      ).toFixed(1),
    );

    const boundedOverall = Math.min(100, Math.max(0, compositeScore));

    // Dimensional Breakdowns
    const availabilityBreakdown: ScoreDimensionBreakdown = {
      score: availabilityScore,
      weight: Number(normAvail.toFixed(2)),
      contribution: Number((availabilityScore * normAvail).toFixed(2)),
      rawMetricValue: `${rawAvailabilityPct}%`,
      description: `${availableCount}/${totalChecks} checks reachable (${rawAvailabilityPct}% uptime).`,
    };

    const latencyBreakdown: ScoreDimensionBreakdown = {
      score: latencyScore,
      weight: Number(normLat.toFixed(2)),
      contribution: Number((latencyScore * normLat).toFixed(2)),
      rawMetricValue: `${avgLatency}ms`,
      description: `Mean latency ${avgLatency}ms (target: <=${config.targetLatencyMs}ms, max: ${config.maxAcceptableLatencyMs}ms).`,
    };

    const errorsBreakdown: ScoreDimensionBreakdown = {
      score: errorScore,
      weight: Number(normErr.toFixed(2)),
      contribution: Number((errorScore * normErr).toFixed(2)),
      rawMetricValue: `${rawErrorRatePct}%`,
      description: `${failedCount} failure(s) recorded (${rawErrorRatePct}% error rate).`,
    };

    const latencyStabilityBreakdown: ScoreDimensionBreakdown = {
      score: latencyStabilityScore,
      weight: Number(normStab.toFixed(2)),
      contribution: Number((latencyStabilityScore * normStab).toFixed(2)),
      rawMetricValue: `CV: ${cv} (σ: ${stdDev}ms)`,
      description:
        cv <= config.minJitterCv
          ? 'Exceptional latency consistency with minimal response variance.'
          : cv >= config.maxJitterCv
            ? 'High latency variability and inconsistent response durations.'
            : `Moderate latency fluctuation with standard deviation of ${stdDev}ms.`,
    };

    const schemaBreakdown: ScoreDimensionBreakdown = {
      score: schemaScore,
      weight: Number(normSchema.toFixed(2)),
      contribution: Number((schemaScore * normSchema).toFixed(2)),
      rawMetricValue: `${schemaScore}%`,
      description:
        schemaEvaluatedCount === 0
          ? 'No schema contract violations detected across checks.'
          : `${schemaEvaluatedCount - schemaErrorsCount}/${schemaEvaluatedCount} checks conformed to expected schema structure.`,
    };

    // Qualitative Grade
    let grade: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR' | 'CRITICAL';
    if (boundedOverall >= 90) {
      grade = 'EXCELLENT';
    } else if (boundedOverall >= 80) {
      grade = 'GOOD';
    } else if (boundedOverall >= 70) {
      grade = 'FAIR';
    } else if (boundedOverall >= 50) {
      grade = 'POOR';
    } else {
      grade = 'CRITICAL';
    }

    const summary = `${grade} reliability: ${Math.round(boundedOverall)}/100 based on ${totalChecks} evaluation samples. Availability is ${rawAvailabilityPct}%, average latency is ${avgLatency}ms, and error rate is ${rawErrorRatePct}%.`;

    return {
      overallScore: boundedOverall,
      grade,
      sampleCount: totalChecks,
      periodStart,
      periodEnd,
      dimensions: {
        availability: availabilityBreakdown,
        latency: latencyBreakdown,
        errors: errorsBreakdown,
        latencyStability: latencyStabilityBreakdown,
        schema: schemaBreakdown,
      },
      summary,
    };
  }

  private static resolveConfig(
    custom?: ReliabilityAlgorithmConfig,
  ): Required<ReliabilityAlgorithmConfig> & { weights: Required<ReliabilityWeights> } {
    const weights: Required<ReliabilityWeights> = {
      availabilityWeight:
        custom?.weights?.availabilityWeight ?? DEFAULT_RELIABILITY_WEIGHTS.availabilityWeight,
      latencyWeight:
        custom?.weights?.latencyWeight ?? DEFAULT_RELIABILITY_WEIGHTS.latencyWeight,
      errorRateWeight:
        custom?.weights?.errorRateWeight ?? DEFAULT_RELIABILITY_WEIGHTS.errorRateWeight,
      latencyStabilityWeight:
        custom?.weights?.latencyStabilityWeight ?? DEFAULT_RELIABILITY_WEIGHTS.latencyStabilityWeight,
      schemaStabilityWeight:
        custom?.weights?.schemaStabilityWeight ?? DEFAULT_RELIABILITY_WEIGHTS.schemaStabilityWeight,
    };

    return {
      weights,
      targetLatencyMs: custom?.targetLatencyMs ?? DEFAULT_ALGORITHM_CONFIG.targetLatencyMs,
      maxAcceptableLatencyMs:
        custom?.maxAcceptableLatencyMs ?? DEFAULT_ALGORITHM_CONFIG.maxAcceptableLatencyMs,
      minJitterCv: custom?.minJitterCv ?? DEFAULT_ALGORITHM_CONFIG.minJitterCv,
      maxJitterCv: custom?.maxJitterCv ?? DEFAULT_ALGORITHM_CONFIG.maxJitterCv,
    };
  }

  private static generateEmptyBaseline(
    config: Required<ReliabilityAlgorithmConfig>,
  ): ReliabilityScoreBreakdown {
    const w = config.weights;
    const totalWeight =
      w.availabilityWeight +
      w.latencyWeight +
      w.errorRateWeight +
      w.latencyStabilityWeight +
      w.schemaStabilityWeight;

    return {
      overallScore: 100,
      grade: 'EXCELLENT',
      sampleCount: 0,
      periodStart: null,
      periodEnd: null,
      dimensions: {
        availability: {
          score: 100,
          weight: Number((w.availabilityWeight / totalWeight).toFixed(2)),
          contribution: Number(((100 * w.availabilityWeight) / totalWeight).toFixed(2)),
          rawMetricValue: '100%',
          description: 'No sample checks recorded yet. Initializing at baseline.',
        },
        latency: {
          score: 100,
          weight: Number((w.latencyWeight / totalWeight).toFixed(2)),
          contribution: Number(((100 * w.latencyWeight) / totalWeight).toFixed(2)),
          rawMetricValue: '0ms',
          description: 'Optimal initial latency baseline.',
        },
        errors: {
          score: 100,
          weight: Number((w.errorRateWeight / totalWeight).toFixed(2)),
          contribution: Number(((100 * w.errorRateWeight) / totalWeight).toFixed(2)),
          rawMetricValue: '0%',
          description: 'Zero errors recorded.',
        },
        latencyStability: {
          score: 100,
          weight: Number((w.latencyStabilityWeight / totalWeight).toFixed(2)),
          contribution: Number(((100 * w.latencyStabilityWeight) / totalWeight).toFixed(2)),
          rawMetricValue: 'CV: 0.0',
          description: 'Stable baseline jitter.',
        },
        schema: {
          score: 100,
          weight: Number((w.schemaStabilityWeight / totalWeight).toFixed(2)),
          contribution: Number(((100 * w.schemaStabilityWeight) / totalWeight).toFixed(2)),
          rawMetricValue: '100%',
          description: 'No contract violations.',
        },
      },
      summary: 'Baseline EXCELLENT score: 100/100. Awaiting live probe results for historical calibration.',
    };
  }
}

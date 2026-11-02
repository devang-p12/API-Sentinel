export interface ReliabilityWeights {
  availabilityWeight?: number;       // default: 0.35
  latencyWeight?: number;            // default: 0.20
  errorRateWeight?: number;          // default: 0.25
  latencyStabilityWeight?: number;   // default: 0.10
  schemaStabilityWeight?: number;    // default: 0.10
}

export interface ReliabilityAlgorithmConfig {
  weights?: ReliabilityWeights;
  targetLatencyMs?: number;          // default: 200ms (100% latency score threshold)
  maxAcceptableLatencyMs?: number;   // default: 2000ms (0% latency score threshold)
  minJitterCv?: number;              // default: 0.10 (coefficient of variation for 100% stability)
  maxJitterCv?: number;              // default: 1.50 (coefficient of variation for 0% stability)
}

export interface ReliabilitySampleCheck {
  id?: string;
  timestamp: Date | string;
  statusCode?: number | null;
  latencyMs: number;
  success: boolean;
  timeout?: boolean;
  errorType?: string | null;
  schemaValid?: boolean | null;
}

export interface ScoreDimensionBreakdown {
  score: number;                     // 0 - 100
  weight: number;                    // 0.0 - 1.0
  contribution: number;              // score * weight
  rawMetricValue: number | string;   // e.g. "99.7%", "240ms", "3.0%"
  description: string;               // Human-readable explanation
}

export interface ReliabilityScoreBreakdown {
  overallScore: number;              // 0 - 100
  grade: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR' | 'CRITICAL';
  sampleCount: number;
  periodStart: Date | string | null;
  periodEnd: Date | string | null;
  dimensions: {
    availability: ScoreDimensionBreakdown;
    latency: ScoreDimensionBreakdown;
    errors: ScoreDimensionBreakdown;
    latencyStability: ScoreDimensionBreakdown;
    schema: ScoreDimensionBreakdown;
  };
  summary: string;
}

export interface HistoricalScoreFilter {
  apiId: string;
  organizationId: string;
  environmentId?: string;
  from?: Date;
  to?: Date;
  limit?: number;
  offset?: number;
}

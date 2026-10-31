export interface K6SummaryMetricValue {
  avg?: number;
  min?: number;
  med?: number;
  max?: number;
  'p(90)'?: number;
  'p(95)'?: number;
  'p(99)'?: number;
  count?: number;
  rate?: number;
  passes?: number;
  fails?: number;
  value?: number;
}

export interface K6Summary {
  root_group?: {
    checks?: Record<string, { passes: number; fails: number }>;
  };
  metrics?: {
    http_reqs?: K6SummaryMetricValue;
    http_req_duration?: K6SummaryMetricValue;
    http_req_failed?: K6SummaryMetricValue;
    vus?: { value: number; min: number; max: number };
    iteration_duration?: K6SummaryMetricValue;
    iterations?: K6SummaryMetricValue;
    data_received?: K6SummaryMetricValue;
    data_sent?: K6SummaryMetricValue;
  };
}

export interface K6Point {
  type: string;
  metric: string;
  data: {
    time: string;
    value: number;
    tags?: Record<string, string>;
  };
}

export interface ParsedK6Result {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  requestsPerSecond: number;
  actualDurationSeconds: number;
  avgLatency: number;
  minLatency: number;
  maxLatency: number;
  p50Latency: number;
  p90Latency: number;
  p95Latency: number;
  p99Latency: number;
  errorRate: number;
  timeoutCount: number;
  connectionErrors: number;
  statusCodeCounts: Record<string, number>;
  errorBreakdown: {
    http_4xx: number;
    http_5xx: number;
    timeouts: number;
    connection_errors: number;
  };
}

export interface ParsedK6Sample {
  timestamp: Date;
  relativeSeconds: number;
  requestsPerSecond: number;
  activeUsers: number;
  avgLatency: number;
  p50Latency: number | null;
  p95Latency: number;
  p99Latency: number | null;
  errorRate: number;
  totalRequestsSoFar: number;
  successCount: number;
  failureCount: number;
}

export interface LiveProgressData {
  elapsedSeconds: number;
  currentRequests: number;
  currentRps: number;
  currentP95: number;
  currentErrorRate: number;
  activeUsers: number;
}

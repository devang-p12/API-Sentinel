export type MetricCategory = 'reliability' | 'performance' | 'traffic';
export type VisualizationType = 'stat' | 'time_series' | 'bar' | 'table' | 'gauge';

export interface MetricDefinition {
  id: string;
  name: string;
  description: string;
  category: MetricCategory;
  unit: string;
  supportedVisualizations: VisualizationType[];
  defaultVisualization: VisualizationType;
}

export const METRIC_REGISTRY: Record<string, MetricDefinition> = {
  // --- Reliability Category ---
  availability: {
    id: 'availability',
    name: 'Availability (Uptime SLA)',
    description: 'Percentage of health checks meeting expected status code without timeout or error',
    category: 'reliability',
    unit: '%',
    supportedVisualizations: ['stat', 'gauge', 'time_series', 'table'],
    defaultVisualization: 'stat',
  },
  success_rate: {
    id: 'success_rate',
    name: 'Success Rate',
    description: 'Percentage of total executions returning success status',
    category: 'reliability',
    unit: '%',
    supportedVisualizations: ['stat', 'gauge', 'time_series', 'table'],
    defaultVisualization: 'stat',
  },
  error_rate: {
    id: 'error_rate',
    name: 'Error Rate',
    description: 'Percentage of executions failing assertions or encountering errors',
    category: 'reliability',
    unit: '%',
    supportedVisualizations: ['time_series', 'stat', 'gauge', 'table'],
    defaultVisualization: 'time_series',
  },
  failure_count: {
    id: 'failure_count',
    name: 'Failure Count',
    description: 'Count of executions failing assertions or encountering HTTP/network errors',
    category: 'reliability',
    unit: 'fails',
    supportedVisualizations: ['stat', 'bar', 'time_series', 'table'],
    defaultVisualization: 'stat',
  },
  timeout_count: {
    id: 'timeout_count',
    name: 'Timeout Count',
    description: 'Count of executions aborted due to timeout expiration',
    category: 'reliability',
    unit: 'timeouts',
    supportedVisualizations: ['stat', 'bar', 'time_series', 'table'],
    defaultVisualization: 'stat',
  },
  http_status_distribution: {
    id: 'http_status_distribution',
    name: 'HTTP Status Code Distribution',
    description: 'Breakdown of status codes (200, 500, TIMEOUT, ERROR)',
    category: 'reliability',
    unit: 'distribution',
    supportedVisualizations: ['bar', 'table', 'stat'],
    defaultVisualization: 'bar',
  },

  // --- Performance Category ---
  average_latency: {
    id: 'average_latency',
    name: 'Average Response Time',
    description: 'Mean round-trip response time across all successful executions',
    category: 'performance',
    unit: 'ms',
    supportedVisualizations: ['stat', 'gauge', 'time_series', 'table'],
    defaultVisualization: 'stat',
  },
  p50_latency: {
    id: 'p50_latency',
    name: 'P50 Latency (Median)',
    description: '50th percentile response time (median user experience)',
    category: 'performance',
    unit: 'ms',
    supportedVisualizations: ['stat', 'gauge', 'time_series', 'table'],
    defaultVisualization: 'stat',
  },
  p90_latency: {
    id: 'p90_latency',
    name: 'P90 Latency',
    description: '90th percentile response time',
    category: 'performance',
    unit: 'ms',
    supportedVisualizations: ['stat', 'gauge', 'time_series', 'table'],
    defaultVisualization: 'stat',
  },
  p95_latency: {
    id: 'p95_latency',
    name: 'P95 Latency',
    description: '95th percentile response time (identifies latency tail)',
    category: 'performance',
    unit: 'ms',
    supportedVisualizations: ['time_series', 'stat', 'gauge', 'table'],
    defaultVisualization: 'time_series',
  },
  p99_latency: {
    id: 'p99_latency',
    name: 'P99 Latency (Tail)',
    description: '99th percentile worst-case latency',
    category: 'performance',
    unit: 'ms',
    supportedVisualizations: ['stat', 'gauge', 'time_series', 'table'],
    defaultVisualization: 'stat',
  },
  min_latency: {
    id: 'min_latency',
    name: 'Minimum Latency',
    description: 'Fastest recorded response time in the time range',
    category: 'performance',
    unit: 'ms',
    supportedVisualizations: ['stat', 'gauge', 'time_series', 'table'],
    defaultVisualization: 'stat',
  },
  max_latency: {
    id: 'max_latency',
    name: 'Maximum Latency (Peak)',
    description: 'Peak response time recorded in the time range',
    category: 'performance',
    unit: 'ms',
    supportedVisualizations: ['stat', 'gauge', 'time_series', 'table'],
    defaultVisualization: 'stat',
  },

  // --- Traffic Category ---
  request_count: {
    id: 'request_count',
    name: 'Request / Check Count',
    description: 'Total number of health check probes executed',
    category: 'traffic',
    unit: 'req',
    supportedVisualizations: ['stat', 'bar', 'time_series', 'table'],
    defaultVisualization: 'stat',
  },
  response_size: {
    id: 'response_size',
    name: 'Average Response Size',
    description: 'Average HTTP response payload size in bytes',
    category: 'traffic',
    unit: 'bytes',
    supportedVisualizations: ['stat', 'gauge', 'time_series', 'table'],
    defaultVisualization: 'stat',
  },
  schema_change: {
    id: 'schema_change',
    name: 'Schema Changes',
    description: 'Number of unexpected or breaking schema alterations detected',
    category: 'reliability',
    unit: 'changes',
    supportedVisualizations: ['stat', 'bar', 'time_series', 'table'],
    defaultVisualization: 'stat',
  },
};

export function normalizeMetricId(metricId: string): string {
  if (!metricId) return '';
  const clean = metricId.trim().toLowerCase().replace(/[\s-]+/g, '_');

  switch (clean) {
    case 'error_rate':
    case 'errorrate':
    case 'error':
    case 'errors':
      return 'error_rate';
    case 'p95_latency':
    case 'p95':
    case 'p95latency':
      return 'p95_latency';
    case 'p50_latency':
    case 'p50':
    case 'median_latency':
    case 'median':
      return 'p50_latency';
    case 'p90_latency':
    case 'p90':
      return 'p90_latency';
    case 'p99_latency':
    case 'p99':
      return 'p99_latency';
    case 'average_latency':
    case 'avg_latency':
    case 'avg':
    case 'latency':
      return 'average_latency';
    case 'min_latency':
    case 'minimum_latency':
      return 'min_latency';
    case 'max_latency':
    case 'maximum_latency':
      return 'max_latency';
    case 'availability':
    case 'uptime':
    case 'sla':
      return 'availability';

    case 'success_rate':
    case 'success':
      return 'success_rate';
    case 'consecutive_failures':
    case 'consecutive_failure':
    case 'failure_count':
    case 'failures':
    case 'failure':
    case 'api_down':
    case 'down':
      return 'failure_count';
    case 'timeout_count':
    case 'timeouts':
    case 'timeout':
      return 'timeout_count';
    case 'request_count':
    case 'requests':
    case 'checks':
    case 'probes':
      return 'request_count';
    case 'response_size':
    case 'size':
    case 'payload_size':
      return 'response_size';
    case 'http_status_distribution':
    case 'status_distribution':
    case 'status_codes':
      return 'http_status_distribution';
    case 'schema_change':
    case 'schema_changes':
    case 'schemachange':
      return 'schema_change';
    default:
      return clean;
  }
}

export function getMetricCatalog(): MetricDefinition[] {
  return Object.values(METRIC_REGISTRY);
}

export function getMetricDefinition(metricId: string): MetricDefinition | undefined {
  if (!metricId) return undefined;
  if (METRIC_REGISTRY[metricId]) {
    return METRIC_REGISTRY[metricId];
  }
  const normalized = normalizeMetricId(metricId);
  return METRIC_REGISTRY[normalized];
}


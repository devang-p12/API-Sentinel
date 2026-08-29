export type APIEnvironment = 'Production' | 'Staging' | 'Development';
export type APIStatus = 'Active' | 'Inactive';
export type APIGroup = 'Payments' | 'Authentication' | 'Users' | 'Orders' | 'Notifications' | 'Other';
export type APIAuthType = 'None' | 'API Key' | 'Bearer Token' | 'OAuth 2.0';

export interface AuthConfig {
  apiKeyName?: string;
  apiHeaderName?: string;
  tokenValue?: string;
  clientId?: string;
  clientSecret?: string;
  tokenUrl?: string;
}

export interface API {
  id: string;
  name: string;
  description: string;
  version: string;
  baseUrl: string;
  environment: APIEnvironment;
  status: APIStatus;
  healthEndpoint: string;
  healthMethod: 'GET' | 'POST';
  healthEnabled: boolean;
  authType: APIAuthType;
  authConfig?: AuthConfig;
  documentationUrl?: string;
  tags: string[];
  createdAt: string;
  group: APIGroup;
  monitoringEnabled?: boolean;
  monitoringInterval?: number;
  timeout?: number;
  degradedThresholdMs?: number;
  healthStatus?: 'HEALTHY' | 'DEGRADED' | 'DOWN';
  consecutiveFailures?: number;
  lastMonitoredAt?: string;
}

export interface AnalyticsMetrics {
  totalChecks: number;
  successfulChecks: number;
  failedChecks: number;
  uptime: number;
  errorRate: number;
  avgLatency: number;
  minLatency: number;
  maxLatency: number;
  p50Latency: number;
  p95Latency: number;
  p99Latency: number;
  totalDowntimeSeconds: number;
}

export interface TimeseriesPoint {
  timestamp: string;
  checkVolume: number;
  avgLatency: number;
  p95Latency: number;
  uptime: number;
  errorRate: number;
}

export interface StatusDistribution {
  statusCode: number;
  count: number;
}

export interface AnalyticsData {
  metrics: AnalyticsMetrics;
  timeseries: TimeseriesPoint[];
  statusDistribution: StatusDistribution[];
  meta: {
    startDate: string;
    endDate: string;
    bucketInterval: string;
  };
}

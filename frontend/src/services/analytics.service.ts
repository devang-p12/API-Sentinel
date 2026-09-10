export interface EnvComparisonData {
  apiName: string;
  timeRange: string;
  environments: Record<string, {
    apiId: number;
    health: string;
    availability: number;
    avgLatency: number;
    p50Latency: number;
    p95Latency: number;
    p99Latency: number;
    errorRate: number;
    statusDistribution: Array<{ statusCode: number; count: number }>;
    requestVolume: number;
    schemaVersion: number;
    recentIncidents: number;
  }>;
  timeseries: Record<string, Array<{
    timestamp: string;
    avgLatency: number;
    p95Latency: number;
    errorRate: number;
    requests: number;
  }>>;
  meta: {
    startDate: string;
    endDate: string;
    bucketInterval: string;
  };
}

export const fetchEnvComparison = async (apiName: string, timeRange: string = '24h'): Promise<EnvComparisonData> => {
  const response = await fetch(`/api/analytics/compare?apiName=${encodeURIComponent(apiName)}&timeRange=${timeRange}`);
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to fetch environment comparison data');
  }
  return response.json();
};

export interface MetricDataRecord {
  id: string;
  monitorId: string;
  status: string;
  statusCode: number | null;
  responseTimeMs: number;
  responseSize: number | null;
  executedAt: Date;
}

export interface MetricDataSourceQuery {
  monitorIds: string[];
  from: Date;
  to: Date;
}

export interface MetricDataSource {
  getExecutions(query: MetricDataSourceQuery): Promise<MetricDataRecord[]>;
}

export const METRIC_DATA_SOURCE = 'METRIC_DATA_SOURCE';

export interface GrafanaHealthStatus {
  status: 'healthy' | 'degraded' | 'down';
  connected: boolean;
  latencyMs: number;
  version?: string;
  database?: string;
  commit?: string;
  error?: string;
  checkedAt: string;
}

export interface GrafanaDataSource {
  id?: number;
  uid: string;
  name: string;
  type: string;
  url: string;
  isDefault: boolean;
  jsonData?: Record<string, any>;
}

export interface GrafanaDashboardSummary {
  id?: number;
  uid: string;
  title: string;
  uri?: string;
  url?: string;
  slug?: string;
  type?: string;
  tags: string[];
  isStarred?: boolean;
}

export interface GrafanaRuleInput {
  name: string;
  metric: string;
  operator?: string;
  threshold: number;
  duration?: number; // in seconds
  severity?: string;
  enabled?: boolean;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
}

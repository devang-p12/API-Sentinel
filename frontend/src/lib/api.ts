export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';

export type EnvironmentType =
  | 'DEVELOPMENT'
  | 'UAT'
  | 'STAGING'
  | 'PRODUCTION'
  | 'CUSTOM';

export interface Project {
  id: string;
  name: string;
  description?: string;
  apis?: Api[];
}

export interface Api {
  id: string;
  name: string;
  description?: string | null;
  service?: string | null;
  projectId?: string | null;
  project?: Project | null;
  organizationId?: string;
  environments?: Environment[];
  createdAt?: string;
  updatedAt?: string;
  _count?: {
    environments?: number;
    monitors?: number;
  };
}

export interface Environment {
  id: string;
  name: string;
  baseUrl?: string;
  maskedBaseUrl?: string;
  type?: EnvironmentType;
  variables?: Record<string, any>;
  apiId: string;
  organizationId?: string;
  api?: Api;
  monitors?: Monitor[];
  createdAt?: string;
  updatedAt?: string;
  _count?: {
    monitors?: number;
  };
}

export interface ScoreDimension {
  score: number;
  weight: number;
  contribution: number;
  rawMetricValue: string;
  description: string;
}

export interface ReliabilityScoreBreakdown {
  overallScore: number;
  grade: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR' | 'CRITICAL';
  sampleCount: number;
  periodStart: string | null;
  periodEnd: string | null;
  dimensions: {
    availability: ScoreDimension;
    latency: ScoreDimension;
    errors: ScoreDimension;
    latencyStability: ScoreDimension;
    schema: ScoreDimension;
  };
  summary: string;
  recordId?: string;
}

export interface ReliabilityScoreRecord {
  id: string;
  organizationId: string;
  apiId: string;
  environmentId?: string | null;
  score: number;
  availabilityScore: number;
  latencyScore: number;
  errorScore: number;
  latencyStabilityScore: number;
  schemaScore: number;
  sampleCount: number;
  periodStart: string | null;
  periodEnd: string | null;
  breakdown: ReliabilityScoreBreakdown;
  calculatedAt: string;
}

export interface CustomerDashboardKpis {
  totalApis: number;
  healthy: number;
  degraded: number;
  down: number;
  activeIncidents: number;
  averageReliability: number;
}

export interface ApiHealthTableRow {
  apiId: string;
  apiName: string;
  service?: string | null;
  environmentId?: string | null;
  environmentName?: string | null;
  health: 'HEALTHY' | 'DEGRADED' | 'DOWN';
  healthReason?: string;
  reliability: number;
  availability: number;
  p95LatencyMs: number;
  errorRate: number;
  consecutiveFailures: number;
  lastCheckedAt: string | null;
}

export interface ReliabilityTrendPoint {
  timestamp: string;
  score: number;
}

export interface LatencyTrendPoint {
  timestamp: string;
  p95Ms: number;
  avgMs: number;
}

export interface ErrorRateTrendPoint {
  timestamp: string;
  errorRatePct: number;
}

export interface DashboardTrends {
  reliabilityTrend: ReliabilityTrendPoint[];
  latencyTrend: LatencyTrendPoint[];
  errorRateTrend: ErrorRateTrendPoint[];
}

export interface RecentIncidentSummary {
  id: string;
  apiName?: string | null;
  environmentName?: string | null;
  severity: string;
  status: string;
  reason: string;
  startedAt: string;
  resolvedAt?: string | null;
  durationSeconds?: number | null;
}

export interface RecentSchemaChangeSummary {
  id: string;
  apiName?: string | null;
  endpoint?: string | null;
  changeType: string;
  severity: string;
  fieldPath: string;
  description: string;
  detectedAt: string;
}

export interface ActiveAlertSummary {
  id: string;
  alertRuleId: string;
  alertRuleName: string;
  apiName?: string | null;
  metric: string;
  severity: string;
  message: string;
  metricValue?: number | null;
  threshold?: number | null;
  triggeredAt: string;
}

export interface CustomerDashboardSummary {
  organizationId: string;
  generatedAt: string;
  kpis: CustomerDashboardKpis;
  apiHealthTable: ApiHealthTableRow[];
  trends: DashboardTrends;
  recentIncidents: RecentIncidentSummary[];
  recentSchemaChanges: RecentSchemaChangeSummary[];
  activeAlerts: ActiveAlertSummary[];
}

export interface ApiOverviewMetrics {
  health: 'HEALTHY' | 'DEGRADED' | 'DOWN';
  healthReason: string;
  reliabilityScore: number;
  reliabilityGrade: string;
  availabilityPct: number;
  errorRatePct: number;
  averageLatencyMs: number;
  p95LatencyMs: number;
  consecutiveFailures: number;
  lastSuccessfulCheck: string | null;
  lastFailedCheck: string | null;
}

export interface ApiPerformanceGraphs {
  latencyGraph: Array<{
    timestamp: string;
    p95Ms: number;
    avgMs: number;
    maxMs: number;
  }>;
  errorGraph: Array<{
    timestamp: string;
    errorRatePct: number;
    failureCount: number;
    totalChecks: number;
  }>;
  availabilityGraph: Array<{
    timestamp: string;
    availabilityPct: number;
  }>;
}

export interface ApiRecentCheckItem {
  id: string;
  timestamp: string;
  statusCode: number | null;
  latencyMs: number;
  success: boolean;
  timeout: boolean;
  errorType: string | null;
  errorMessage: string | null;
  environmentId: string | null;
  environmentName: string | null;
}

export interface ApiResponseTimeStats {
  minMs: number;
  maxMs: number;
  avgMs: number;
  p50Ms: number;
  p90Ms: number;
  p95Ms: number;
  p99Ms: number;
}

export interface ApiMonitoringSection {
  recentChecks: ApiRecentCheckItem[];
  failures: ApiRecentCheckItem[];
  responseTimes: ApiResponseTimeStats;
  totalChecksEvaluated: number;
}

export interface ApiContractSection {
  schemas: Array<{
    id: string;
    endpoint: string;
    method: string;
    activeBaselineVersionId: string | null;
    createdAt: string;
    currentSchema: any | null;
    versions: Array<{
      id: string;
      versionNumber: number;
      isBaseline: boolean;
      checksum: string | null;
      createdAt: string;
    }>;
    changes: Array<{
      id: string;
      fieldPath: string;
      changeType: string;
      severity: string;
      description: string;
      isBreaking: boolean;
      detectedAt: string;
      isAcknowledged: boolean;
    }>;
  }>;
  totalChanges: number;
  breakingChangesCount: number;
}

export interface ApiIncidentsSection {
  activeIncidents: Array<{
    id: string;
    title: string;
    severity: string;
    status: string;
    reason: string | null;
    startedAt: string;
    environmentName: string | null;
  }>;
  historicalIncidents: Array<{
    id: string;
    title: string;
    severity: string;
    status: string;
    reason: string | null;
    startedAt: string;
    resolvedAt: string | null;
    durationSeconds: number | null;
    environmentName: string | null;
  }>;
}

export interface ApiAlertsSection {
  configuredAlerts: Array<{
    id: string;
    name: string;
    metric: string;
    operator: string | null;
    threshold: number;
    duration: number;
    severity: string;
    enabled: boolean;
    notificationChannels: any;
    cooldownSeconds: number;
    environmentName: string | null;
  }>;
}

export interface ApiEnvironmentComparisonItem {
  environmentId: string;
  environmentName: string;
  environmentType: string;
  baseUrl: string | null;
  maskedBaseUrl: string | null;
  availability: number;
  latency: number;
  p95: number;
  errors: number;
  reliability: number;
  health: 'HEALTHY' | 'DEGRADED' | 'DOWN';
  consecutiveFailures: number;
}

export interface ApiDetailsResponse {
  api: {
    id: string;
    name: string;
    service: string | null;
    description: string | null;
    organizationId: string;
    projectId: string | null;
    projectName: string | null;
    createdAt: string;
    updatedAt: string;
  };
  overview: ApiOverviewMetrics;
  performance: ApiPerformanceGraphs;
  monitoring: ApiMonitoringSection;
  contract: ApiContractSection;
  incidents: ApiIncidentsSection;
  alerts: ApiAlertsSection;
  environments: ApiEnvironmentComparisonItem[];
}

export interface Monitor {
  id: string;
  name: string;
  description?: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';
  url: string;
  headers?: Record<string, string>;
  body?: string;
  intervalSeconds: number;
  timeoutMs: number;
  isActive: boolean;
  assertions?: any[];
  environmentId: string;
  environment?: Environment & { api?: Api };
  executions?: MonitorExecution[];
  createdAt: string;
  updatedAt: string;
}

export interface MonitorExecution {
  id: string;
  monitorId: string;
  status: 'SUCCESS' | 'FAILED' | 'TIMEOUT' | 'ERROR';
  statusCode: number | null;
  responseTimeMs: number;
  durationMs?: number;
  responseSize: number | null;
  errorMessage: string | null;
  errorType?: 'SUCCESS' | 'HTTP_ERROR' | 'TIMEOUT' | 'NETWORK_ERROR' | 'SCHEMA_ERROR' | 'UNKNOWN_ERROR' | string | null;
  schemaValid?: boolean;
  sslValid?: boolean;
  responseHeaders?: Record<string, string> | null;
  assertionResults?: any[];
  startedAt?: string;
  completedAt?: string;
  createdAt?: string;
  success?: boolean;
  executedAt: string;
}

export type IncidentStatus = 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED' | 'TRIGGERED';

export type IncidentEventType =
  | 'CREATED'
  | 'ALERT_ATTACHED'
  | 'ALERT_RESOLVED'
  | 'ACKNOWLEDGED'
  | 'SEVERITY_CHANGED'
  | 'RESOLVED';

export interface IncidentEvent {
  id: string;
  incidentId: string;
  type: IncidentEventType;
  message: string;
  actorType: 'SYSTEM' | 'USER';
  actorId?: string | null;
  metadata?: Record<string, any> | null;
  createdAt: string;
}

export interface IncidentAlert {
  id: string;
  incidentId: string;
  alertInstanceId: string;
  alertInstance: AlertInstance;
  createdAt: string;
}

export interface Incident {
  id: string;
  projectId: string;
  project?: { id: string; name: string };
  title: string;
  description?: string | null;
  status: IncidentStatus;
  severity: AlertSeverity;
  apiId?: string | null;
  api?: { id: string; name: string } | null;
  environmentId?: string | null;
  environment?: { id: string; name: string } | null;
  startedAt: string;
  acknowledgedAt?: string | null;
  resolvedAt?: string | null;
  acknowledgedBy?: string | null;
  resolvedBy?: string | null;
  durationSeconds?: number;
  alerts?: IncidentAlert[];
  events?: IncidentEvent[];
  _count?: {
    alerts: number;
    events: number;
  };
  createdAt: string;
  updatedAt: string;
  // Backward compatibility with legacy views
  summary?: string;
  alert?: {
    id: string;
    name: string;
    severity: string;
    monitor?: {
      id: string;
      name: string;
      environment?: { name: string };
    };
  };
}

export interface IncidentSummary {
  open: number;
  acknowledged: number;
  resolved: number;
  total: number;
}

export interface QueryIncidentsParams {
  status?: string;
  severity?: string;
  projectId?: string;
  apiId?: string;
  environmentId?: string;
  search?: string;
  limit?: number;
  offset?: number;
}


export type AlertCondition =
  | 'GREATER_THAN'
  | 'GREATER_THAN_OR_EQUAL'
  | 'LESS_THAN'
  | 'LESS_THAN_OR_EQUAL'
  | 'EQUAL'
  | 'NOT_EQUAL';

export type AlertState = 'NORMAL' | 'PENDING' | 'FIRING' | 'RESOLVED';
export type AlertSeverity = 'INFO' | 'WARNING' | 'HIGH' | 'CRITICAL';

export interface AlertRuleNotificationConfig {
  email?: {
    enabled: boolean;
    recipients: string[];
    onFiring: boolean;
    onResolved: boolean;
    repeatInterval?: number; // in minutes, 0 = disabled
  };
}

export interface AlertRule {
  id: string;
  name: string;
  description?: string | null;
  projectId: string;
  project?: { id: string; name: string };
  metric: string;
  apiId?: string | null;
  api?: { id: string; name: string } | null;
  environmentId?: string | null;
  environment?: { id: string; name: string } | null;
  monitorId?: string | null;
  monitor?: { id: string; name: string } | null;
  condition: AlertCondition;
  threshold: number;
  duration: number; // in seconds
  evaluationInterval: number; // in seconds
  severity: AlertSeverity;
  labels?: Record<string, any> | null;
  notificationConfig?: AlertRuleNotificationConfig | null;
  enabled: boolean;
  createdBy?: string | null;
  createdAt: string;
  updatedAt: string;
  instances?: AlertInstance[];
  evaluations?: AlertEvaluation[];
  deliveries?: NotificationDelivery[];
  _count?: { instances: number; evaluations: number; deliveries?: number };
}

export interface GrafanaHealthStatus {
  status: 'healthy' | 'degraded' | 'down';
  connected: boolean;
  latencyMs: number;
  version?: string;
  database?: string;
  checkedAt: string;
}

export interface AlertEvaluation {
  id: string;
  alertRuleId: string;
  alertInstanceId?: string | null;
  value: number | null;
  threshold: number;
  conditionMet: boolean;
  stateBefore: AlertState;
  stateAfter: AlertState;
  evaluatedAt: string;
}

export interface AlertInstance {
  id: string;
  alertRuleId: string;
  alertRule: AlertRule;
  fingerprint: string;
  status: AlertState;
  currentValue: number | null;
  threshold: number;
  pendingSince?: string | null;
  startedAt?: string | null;
  lastEvaluatedAt: string;
  resolvedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  evaluations?: AlertEvaluation[];
  incidentAlerts?: {
    id: string;
    incident: Incident;
    createdAt: string;
  }[];
}

export interface AlertSummary {
  firing: number;
  pending: number;
  resolved: number;
  total: number;
}

export interface MonitorAnalyticsSummary {
  monitorId: string;
  monitorName: string;
  timeRange: { from: string; to: string };
  totalChecks: number;
  successChecks: number;
  failedChecks: number;
  timeoutChecks: number;
  availabilityPct: number;
  latency: {
    avgMs: number;
    minMs: number;
    maxMs: number;
    percentiles: {
      p50: number;
      p90: number;
      p95: number;
      p99: number;
    };
  };
  timeSeries: Array<{
    timestamp: string;
    totalChecks: number;
    successChecks: number;
    failedChecks: number;
    avgResponseTimeMs: number;
    availabilityPct: number;
  }>;
}

export interface MetricDefinition {
  id: string;
  name: string;
  description: string;
  category: 'reliability' | 'performance' | 'traffic' | 'errors';
  unit: string;
  supportedVisualizations: Array<'stat' | 'time_series' | 'bar' | 'table' | 'gauge'>;
  defaultVisualization: 'stat' | 'time_series' | 'bar' | 'table' | 'gauge';
}

export interface MetricQueryResult {
  metric: string;
  metricName: string;
  unit: string;
  timeRange: { from: string; to: string };
  summary: {
    current: number | null;
    min?: number;
    max?: number;
    avg?: number;
    total?: number;
    label?: string;
  };
  timeSeries: Array<{ timestamp: string; value: number; label?: string }>;
  distribution?: Array<{ category: string; count: number; percentage: number }>;
  table?: {
    columns: string[];
    rows: Array<Record<string, any>>;
  };
}

export interface DashboardWidget {
  id: string;
  dashboardId: string;
  title: string;
  metric: string;
  visualizationType: 'stat' | 'time_series' | 'bar' | 'table' | 'gauge';
  configuration: {
    apiId?: string;
    environmentId?: string;
    monitorId?: string;
    [key: string]: any;
  };
  x: number;
  y: number;
  width: number;
  height: number;
  createdAt?: string;
  updatedAt?: string;
  data?: MetricQueryResult;
}

export interface Dashboard {
  id: string;
  name: string;
  description?: string;
  projectId: string;
  project?: { id: string; name: string };
  projectName?: string;
  layout?: any;
  widgets: DashboardWidget[];
  createdAt: string;
  updatedAt: string;
}

export interface DashboardDataResponse {
  dashboard: {
    id: string;
    name: string;
    description?: string;
    projectId: string;
    projectName?: string;
    layout?: any;
  };
  timeRange: {
    from: string;
    to: string;
    preset: string;
  };
  widgets: DashboardWidget[];
}

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  organizationId: string;
  organization?: {
    id: string;
    name: string;
    slug: string;
  };
}

const API_BASE = import.meta.env.VITE_API_URL
  ? `${String(import.meta.env.VITE_API_URL).replace(/\/+$/, '')}/api/v1`
  : '/api/v1';

async function fetchJson<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('sentinel_token') : null;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers as Record<string, string> || {}),
  };

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    let errMessage = `HTTP ${res.status}`;
    try {
      const errData = await res.json();
      errMessage = errData.message || errMessage;
    } catch {}
    throw new Error(errMessage);
  }

  return res.json();
}

export const api = {
  auth: {
    login: (data: { email: string; password: string }) =>
      fetchJson<{ accessToken: string; user: AuthUser }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    register: (data: {
      email: string;
      password: string;
      firstName: string;
      lastName: string;
      organizationName?: string;
    }) =>
      fetchJson<{ accessToken: string; user: AuthUser }>('/auth/register', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    getMe: () => fetchJson<AuthUser>('/auth/me'),
  },
  getProjects: () => fetchJson<Project[]>('/projects'),
  getProject: (id: string) => fetchJson<Project>(`/projects/${id}`),
  createProject: (data: { name: string; description?: string }) =>
    fetchJson<Project>('/projects', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  deleteProject: (id: string) =>
    fetchJson<{ success: boolean }>(`/projects/${id}`, {
      method: 'DELETE',
    }),
  getApis: (filter?: string | { projectId?: string; service?: string; search?: string }) => {
    let query = '';
    if (typeof filter === 'string') {
      query = `?projectId=${filter}`;
    } else if (filter) {
      const params = new URLSearchParams();
      if (filter.projectId) params.set('projectId', filter.projectId);
      if (filter.service) params.set('service', filter.service);
      if (filter.search) params.set('search', filter.search);
      const str = params.toString();
      if (str) query = `?${str}`;
    }
    return fetchJson<Api[]>(`/apis${query}`);
  },
  getApi: (id: string) => fetchJson<Api>(`/apis/${id}`),
  getApiDetails: (id: string) => fetchJson<ApiDetailsResponse>(`/apis/${id}/details`),
  createApi: (data: {
    name: string;
    description?: string;
    service?: string;
    projectId?: string;
    environments?: Array<{
      name: string;
      baseUrl: string;
      type?: EnvironmentType;
      variables?: Record<string, any>;
    }>;
  }) =>
    fetchJson<Api>('/apis', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateApi: (
    id: string,
    data: {
      name?: string;
      description?: string;
      service?: string;
      projectId?: string;
    },
  ) =>
    fetchJson<Api>(`/apis/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  deleteApi: (id: string) =>
    fetchJson<{ message: string; id: string }>(`/apis/${id}`, {
      method: 'DELETE',
    }),
  getReliabilityScore: (apiId: string, params?: { environmentId?: string; limit?: number }) => {
    const q = new URLSearchParams();
    if (params?.environmentId) q.set('environmentId', params.environmentId);
    if (params?.limit) q.set('limit', params.limit.toString());
    const query = q.toString() ? `?${q.toString()}` : '';
    return fetchJson<ReliabilityScoreBreakdown>(`/apis/${apiId}/reliability-score${query}`);
  },
  getReliabilityScoreHistory: (apiId: string, params?: { environmentId?: string; limit?: number }) => {
    const q = new URLSearchParams();
    if (params?.environmentId) q.set('environmentId', params.environmentId);
    if (params?.limit) q.set('limit', params.limit.toString());
    const query = q.toString() ? `?${q.toString()}` : '';
    return fetchJson<ReliabilityScoreRecord[]>(`/apis/${apiId}/reliability-score/history${query}`);
  },
  getEnvironments: (apiId?: string) =>
    fetchJson<Environment[]>(`/environments${apiId ? `?apiId=${apiId}` : ''}`),
  getApiEnvironments: (apiId: string) =>
    fetchJson<Environment[]>(`/apis/${apiId}/environments`),
  createEnvironment: (
    apiId: string,
    data: {
      name: string;
      baseUrl: string;
      type?: EnvironmentType;
      variables?: Record<string, any>;
    },
  ) =>
    fetchJson<Environment>(`/apis/${apiId}/environments`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateEnvironment: (
    id: string,
    data: {
      name?: string;
      baseUrl?: string;
      type?: EnvironmentType;
      variables?: Record<string, any>;
    },
  ) =>
    fetchJson<Environment>(`/environments/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  deleteEnvironment: (id: string) =>
    fetchJson<{ message: string; id: string }>(`/environments/${id}`, {
      method: 'DELETE',
    }),
  getMonitors: (filter?: { environmentId?: string; apiId?: string }) => {
    const params = new URLSearchParams();
    if (filter?.environmentId) params.set('environmentId', filter.environmentId);
    if (filter?.apiId) params.set('apiId', filter.apiId);
    const query = params.toString();
    return fetchJson<Monitor[]>(`/monitors${query ? `?${query}` : ''}`);
  },
  getMonitor: (id: string) => fetchJson<Monitor>(`/monitors/${id}`),
  createMonitor: (
    data: {
      name: string;
      description?: string;
      environmentId: string;
      method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';
      endpoint?: string;
      url?: string;
      interval?: number;
      intervalSeconds?: number;
      timeout?: number;
      timeoutMs?: number;
      expectedStatus?: number;
      expectedStatusCode?: number;
      enabled?: boolean;
      isActive?: boolean;
      headers?: Record<string, string>;
      body?: string;
    },
  ) =>
    fetchJson<Monitor>('/monitors', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateMonitor: (
    id: string,
    data: Partial<{
      name: string;
      description: string | null;
      environmentId: string;
      method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';
      endpoint: string;
      url: string;
      interval: number;
      intervalSeconds: number;
      timeout: number;
      timeoutMs: number;
      expectedStatus: number;
      expectedStatusCode: number;
      enabled: boolean;
      isActive: boolean;
      headers: Record<string, string>;
      body: string | null;
    }>,
  ) =>
    fetchJson<Monitor>(`/monitors/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  toggleMonitor: (id: string, enabled?: boolean) =>
    fetchJson<Monitor>(`/monitors/${id}/toggle`, {
      method: 'PATCH',
      body: JSON.stringify({ enabled }),
    }),
  deleteMonitor: (id: string) =>
    fetchJson<Monitor>(`/monitors/${id}`, {
      method: 'DELETE',
    }),
  enableMonitor: (id: string) =>
    fetchJson<Monitor>(`/monitors/${id}/enable`, { method: 'POST' }),
  disableMonitor: (id: string) =>
    fetchJson<Monitor>(`/monitors/${id}/disable`, { method: 'POST' }),
  triggerMonitorRun: (id: string) =>
    fetchJson<{ message: string; monitorId: string; queued: boolean; executed?: boolean; execution?: any; timestamp: string }>(`/monitors/${id}/run`, { method: 'POST' }),
  getMonitorExecutions: (
    id: string,
    optionsOrLimit: number | { limit?: number; offset?: number; from?: string; to?: string; status?: string } = 30
  ) => {
    let query = '';
    if (typeof optionsOrLimit === 'number') {
      query = `?limit=${optionsOrLimit}`;
    } else if (optionsOrLimit && typeof optionsOrLimit === 'object') {
      const params = new URLSearchParams();
      if (optionsOrLimit.limit !== undefined) params.set('limit', String(optionsOrLimit.limit));
      if (optionsOrLimit.offset !== undefined) params.set('offset', String(optionsOrLimit.offset));
      if (optionsOrLimit.from) params.set('from', optionsOrLimit.from);
      if (optionsOrLimit.to) params.set('to', optionsOrLimit.to);
      if (optionsOrLimit.status) params.set('status', optionsOrLimit.status);
      query = `?${params.toString()}`;
    }
    return fetchJson<MonitorExecution[]>(`/monitors/${id}/executions${query}`);
  },
  getMonitorExecutionById: (id: string, executionId: string) =>
    fetchJson<MonitorExecution>(`/monitors/${id}/executions/${executionId}`),
  getMonitorAnalytics: (id: string, from?: string, to?: string) => {
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    return fetchJson<MonitorAnalyticsSummary>(`/monitors/${id}/analytics?${params.toString()}`);
  },
  getIncidents: (paramsOrStatus?: QueryIncidentsParams | string) => {
    if (typeof paramsOrStatus === 'string') {
      return fetchJson<{ items: Incident[]; total: number }>(`/incidents?status=${paramsOrStatus}`);
    }
    const params = new URLSearchParams();
    if (paramsOrStatus?.status) params.set('status', paramsOrStatus.status);
    if (paramsOrStatus?.severity) params.set('severity', paramsOrStatus.severity);
    if (paramsOrStatus?.projectId) params.set('projectId', paramsOrStatus.projectId);
    if (paramsOrStatus?.apiId) params.set('apiId', paramsOrStatus.apiId);
    if (paramsOrStatus?.environmentId) params.set('environmentId', paramsOrStatus.environmentId);
    if (paramsOrStatus?.search) params.set('search', paramsOrStatus.search);
    if (paramsOrStatus?.limit !== undefined) params.set('limit', String(paramsOrStatus.limit));
    if (paramsOrStatus?.offset !== undefined) params.set('offset', String(paramsOrStatus.offset));
    const qs = params.toString();
    return fetchJson<{ items: Incident[]; total: number; limit: number; offset: number }>(`/incidents${qs ? `?${qs}` : ''}`);
  },
  getIncidentSummary: (projectId?: string) =>
    fetchJson<IncidentSummary>(`/incidents/summary${projectId ? `?projectId=${projectId}` : ''}`),
  getIncident: (id: string) => fetchJson<Incident>(`/incidents/${id}`),
  getIncidentTimeline: (id: string) => fetchJson<IncidentEvent[]>(`/incidents/${id}/timeline`),
  getIncidentAlerts: (id: string) => fetchJson<AlertInstance[]>(`/incidents/${id}/alerts`),
  acknowledgeIncident: (id: string) =>
    fetchJson<Incident>(`/incidents/${id}/acknowledge`, { method: 'POST' }),
  resolveIncident: (id: string) =>
    fetchJson<Incident>(`/incidents/${id}/resolve`, { method: 'POST' }),

  // Customer Dashboard (Phase 10)
  getCustomerDashboardSummary: () =>
    fetchJson<CustomerDashboardSummary>('/customer-dashboard/summary'),

  // Internal Infrastructure Health (Phase 13)
  getGrafanaHealth: () =>
    fetchJson<GrafanaHealthStatus>('/grafana/health'),

  // Dashboard & Custom Visualization APIs
  getMetricCatalog: () => fetchJson<MetricDefinition[]>('/dashboards/metrics/catalog'),
  previewMetricQuery: (data: {
    metric: string;
    filters?: { projectId?: string; apiId?: string; environmentId?: string; monitorId?: string };
    timeRange?: string;
    from?: string;
    to?: string;
  }) =>
    fetchJson<MetricQueryResult>('/dashboards/preview', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  getDashboards: (projectId?: string) =>
    fetchJson<Dashboard[]>(`/dashboards${projectId ? `?projectId=${projectId}` : ''}`),
  getDashboard: (id: string) => fetchJson<Dashboard>(`/dashboards/${id}`),
  getDashboardData: (
    id: string,
    timeRange?: string,
    from?: string,
    to?: string,
    apiId?: string,
    environmentId?: string,
    monitorId?: string,
  ) => {
    const params = new URLSearchParams();
    if (timeRange) params.set('timeRange', timeRange);
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    if (apiId) params.set('apiId', apiId);
    if (environmentId) params.set('environmentId', environmentId);
    if (monitorId) params.set('monitorId', monitorId);
    return fetchJson<DashboardDataResponse>(`/dashboards/${id}/data?${params.toString()}`);
  },
  queryMetric: (data: {
    metric: string;
    filters?: { projectId?: string; apiId?: string; environmentId?: string; monitorId?: string };
    apiId?: string;
    environmentId?: string;
    monitorId?: string;
    projectId?: string;
    timeRange?: string;
    from?: string;
    to?: string;
    groupBy?: string;
  }) =>
    fetchJson<MetricQueryResult>('/dashboards/metrics/query', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  createDashboard: (data: { name: string; description?: string; projectId?: string }) =>
    fetchJson<Dashboard>('/dashboards', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateDashboard: (id: string, data: { name?: string; description?: string; layout?: any }) =>
    fetchJson<Dashboard>(`/dashboards/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  deleteDashboard: (id: string) =>
    fetchJson<{ id: string }>(`/dashboards/${id}`, {
      method: 'DELETE',
    }),
  addWidget: (
    dashboardId: string,
    data: {
      title: string;
      metric: string;
      visualizationType: string;
      configuration?: Record<string, any>;
      x?: number;
      y?: number;
      width?: number;
      height?: number;
    },
  ) =>
    fetchJson<DashboardWidget>(`/dashboards/${dashboardId}/widgets`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateWidget: (
    dashboardId: string,
    widgetId: string,
    data: Partial<{
      title: string;
      metric: string;
      visualizationType: string;
      configuration: Record<string, any>;
      x: number;
      y: number;
      width: number;
      height: number;
    }>,
  ) =>
    fetchJson<DashboardWidget>(`/dashboards/${dashboardId}/widgets/${widgetId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  deleteWidget: (dashboardId: string, widgetId: string) =>
    fetchJson<{ id: string }>(`/dashboards/${dashboardId}/widgets/${widgetId}`, {
      method: 'DELETE',
    }),
  updateDashboardLayout: (
    dashboardId: string,
    layout: Array<{ id: string; x: number; y: number; width: number; height: number }>,
  ) =>
    fetchJson<{ success: boolean; count: number }>(`/dashboards/${dashboardId}/layout`, {
      method: 'PATCH',
      body: JSON.stringify({ layout }),
    }),

  // Alert Rules & Engine APIs (Phase 5A)
  getAlertRules: (query?: {
    projectId?: string;
    apiId?: string;
    environmentId?: string;
    monitorId?: string;
    metric?: string;
    enabled?: boolean;
  }) => {
    const params = new URLSearchParams();
    if (query?.projectId) params.set('projectId', query.projectId);
    if (query?.apiId) params.set('apiId', query.apiId);
    if (query?.environmentId) params.set('environmentId', query.environmentId);
    if (query?.monitorId) params.set('monitorId', query.monitorId);
    if (query?.metric) params.set('metric', query.metric);
    if (query?.enabled !== undefined) params.set('enabled', String(query.enabled));
    const qs = params.toString();
    return fetchJson<AlertRule[]>(`/alert-rules${qs ? `?${qs}` : ''}`);
  },
  getAlertRule: (id: string) => fetchJson<AlertRule>(`/alert-rules/${id}`),
  createAlertRule: (data: Partial<AlertRule>) =>
    fetchJson<AlertRule>('/alert-rules', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateAlertRule: (id: string, data: Partial<AlertRule>) =>
    fetchJson<AlertRule>(`/alert-rules/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  deleteAlertRule: (id: string) =>
    fetchJson<{ id: string }>(`/alert-rules/${id}`, {
      method: 'DELETE',
    }),
  enableAlertRule: (id: string) =>
    fetchJson<AlertRule>(`/alert-rules/${id}/enable`, {
      method: 'POST',
    }),
  disableAlertRule: (id: string) =>
    fetchJson<AlertRule>(`/alert-rules/${id}/disable`, {
      method: 'POST',
    }),
  testAlertRule: (id: string) =>
    fetchJson<{
      metric: string;
      currentValue: number | null;
      condition: string;
      threshold: number;
      conditionMet: boolean;
      wouldTransitionTo: AlertState;
    }>(`/alert-rules/${id}/test`, {
      method: 'POST',
    }),
  getAlertRuleEvaluations: (id: string, limit = 50) =>
    fetchJson<AlertEvaluation[]>(`/alert-rules/${id}/evaluations?limit=${limit}`),
  getAlertRuleDeliveries: (id: string, limit = 50) =>
    fetchJson<NotificationDelivery[]>(`/alert-rules/${id}/deliveries?limit=${limit}`),
  sendAlertRuleTestEmail: (data: { recipients: string[]; ruleName?: string; ruleId?: string }) =>
    fetchJson<{ success: boolean; message: string; recipients: string[] }>('/alert-rules/test-email', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  evaluateAlertRule: (id: string, metricValue?: number) =>
    fetchJson<{ triggered: boolean; evaluation?: any }>(`/alert-rules/${id}/evaluate`, {
      method: 'POST',
      body: JSON.stringify(metricValue !== undefined ? { metricValue } : {}),
    }),


  // Alert Instances APIs (Section 20)
  getAlerts: (query?: {
    projectId?: string;
    apiId?: string;
    environmentId?: string;
    monitorId?: string;
    alertRuleId?: string;
    status?: AlertState;
    severity?: AlertSeverity;
    from?: string;
    to?: string;
    limit?: number;
    offset?: number;
  }) => {
    const params = new URLSearchParams();
    if (query?.projectId) params.set('projectId', query.projectId);
    if (query?.apiId) params.set('apiId', query.apiId);
    if (query?.environmentId) params.set('environmentId', query.environmentId);
    if (query?.monitorId) params.set('monitorId', query.monitorId);
    if (query?.alertRuleId) params.set('alertRuleId', query.alertRuleId);
    if (query?.status) params.set('status', query.status);
    if (query?.severity) params.set('severity', query.severity);
    if (query?.from) params.set('from', query.from);
    if (query?.to) params.set('to', query.to);
    if (query?.limit) params.set('limit', String(query.limit));
    if (query?.offset) params.set('offset', String(query.offset));
    const qs = params.toString();
    return fetchJson<{ items: AlertInstance[]; total: number; limit: number; offset: number }>(
      `/alerts${qs ? `?${qs}` : ''}`,
    );
  },
  getAlertSummary: (projectId?: string) => {
    const qs = projectId ? `?projectId=${projectId}` : '';
    return fetchJson<AlertSummary>(`/alerts/summary${qs}`);
  },
  getAlertInstance: (id: string) => fetchJson<AlertInstance>(`/alerts/${id}`),
  getAlertEvaluations: (id: string) => fetchJson<AlertEvaluation[]>(`/alerts/${id}/evaluations`),

  // -------------------------------------------------------------
  // Phase 6: Notification & Alert Routing APIs
  // -------------------------------------------------------------
  getContactPoints: () => fetchJson<ContactPoint[]>('/contact-points'),
  getContactPoint: (id: string) => fetchJson<ContactPoint>(`/contact-points/${id}`),
  createContactPoint: (data: {
    name: string;
    type: ContactPointType;
    configuration: Record<string, any>;
    isEnabled?: boolean;
  }) =>
    fetchJson<ContactPoint>('/contact-points', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateContactPoint: (id: string, data: Partial<ContactPoint>) =>
    fetchJson<ContactPoint>(`/contact-points/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  deleteContactPoint: (id: string) =>
    fetchJson<void>(`/contact-points/${id}`, { method: 'DELETE' }),
  testContactPoint: (id: string) =>
    fetchJson<{ success: boolean; statusMessage: string; statusCode?: number; details?: any }>(
      `/contact-points/${id}/test`,
      { method: 'POST' },
    ),

  getNotificationPolicies: () => fetchJson<NotificationPolicy[]>('/notification-policies'),
  getNotificationPolicy: (id: string) =>
    fetchJson<NotificationPolicy>(`/notification-policies/${id}`),
  createNotificationPolicy: (data: {
    name: string;
    description?: string;
    isEnabled?: boolean;
    priority?: number;
    matchers?: LabelMatcher[];
    contactPointIds: string[];
    notifyOnFiring?: boolean;
    notifyOnRecovery?: boolean;
    repeatInterval?: number;
  }) =>
    fetchJson<NotificationPolicy>('/notification-policies', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateNotificationPolicy: (id: string, data: Partial<NotificationPolicy>) =>
    fetchJson<NotificationPolicy>(`/notification-policies/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  deleteNotificationPolicy: (id: string) =>
    fetchJson<void>(`/notification-policies/${id}`, { method: 'DELETE' }),
  previewNotificationPolicy: (matchers: LabelMatcher[], sampleLabels: Record<string, string>) =>
    fetchJson<{ matched: boolean; breakdown: any[] }>('/notification-policies/preview', {
      method: 'POST',
      body: JSON.stringify({ matchers, sampleLabels }),
    }),

  getNotificationDeliveries: (query?: {
    status?: NotificationDeliveryStatus;
    eventType?: NotificationEventType;
    incidentId?: string;
    contactPointId?: string;
    limit?: number;
    offset?: number;
  }) => {
    const params = new URLSearchParams();
    if (query?.status) params.set('status', query.status);
    if (query?.eventType) params.set('eventType', query.eventType);
    if (query?.incidentId) params.set('incidentId', query.incidentId);
    if (query?.contactPointId) params.set('contactPointId', query.contactPointId);
    if (query?.limit) params.set('limit', String(query.limit));
    if (query?.offset) params.set('offset', String(query.offset));
    const qs = params.toString();
    return fetchJson<{
      items: NotificationDelivery[];
      total: number;
      limit: number;
      offset: number;
    }>(`/notification-deliveries${qs ? `?${qs}` : ''}`);
  },
  getNotificationDelivery: (id: string) =>
    fetchJson<NotificationDelivery>(`/notification-deliveries/${id}`),
  getIncidentNotifications: (incidentId: string) =>
    fetchJson<NotificationDelivery[]>(`/incidents/${incidentId}/notifications`),

  getNotificationSilences: () => fetchJson<NotificationSilence[]>('/notification-silences'),
  createNotificationSilence: (data: {
    matchers: LabelMatcher[];
    startsAt: string;
    endsAt: string;
    reason?: string;
  }) =>
    fetchJson<NotificationSilence>('/notification-silences', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  deleteNotificationSilence: (id: string) =>
    fetchJson<void>(`/notification-silences/${id}`, { method: 'DELETE' }),

  // -------------------------------------------------------------
  // Load Testing API Client Methods
  // -------------------------------------------------------------
  getLoadTests: (query?: {
    projectId?: string;
    apiId?: string;
    environmentId?: string;
    status?: LoadTestStatus;
    search?: string;
    limit?: number;
    offset?: number;
  }) => {
    const params = new URLSearchParams();
    if (query?.projectId) params.set('projectId', query.projectId);
    if (query?.apiId) params.set('apiId', query.apiId);
    if (query?.environmentId) params.set('environmentId', query.environmentId);
    if (query?.status) params.set('status', query.status);
    if (query?.search) params.set('search', query.search);
    if (query?.limit) params.set('limit', String(query.limit));
    if (query?.offset) params.set('offset', String(query.offset));
    const qs = params.toString();
    return fetchJson<{
      items: LoadTest[];
      total: number;
      limit: number;
      offset: number;
    }>(`/load-tests${qs ? `?${qs}` : ''}`);
  },
  getLoadTest: (id: string) => fetchJson<LoadTest>(`/load-tests/${id}`),
  createLoadTest: (payload: CreateLoadTestPayload) =>
    fetchJson<{ id: string; name: string; status: LoadTestStatus }>('/load-tests', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  cancelLoadTest: (id: string) =>
    fetchJson<{ message: string; status: LoadTestStatus }>(`/load-tests/${id}/cancel`, {
      method: 'POST',
    }),
  deleteLoadTest: (id: string) =>
    fetchJson<{ message: string }>(`/load-tests/${id}`, { method: 'DELETE' }),

  // -------------------------------------------------------------
  // API Tester & Postman-like Client
  // -------------------------------------------------------------
  executeRequest: (payload: ExecuteRequestPayload, signal?: AbortSignal) =>
    fetchJson<ApiExecutionResult>('/api-tester/execute', {
      method: 'POST',
      body: JSON.stringify(payload),
      signal,
    }),
  getTesterHistory: (projectId?: string, limit?: number) => {
    const params = new URLSearchParams();
    if (projectId) params.set('projectId', projectId);
    if (limit) params.set('limit', String(limit));
    const qs = params.toString();
    return fetchJson<ApiRequestHistory[]>(`/api-tester/history${qs ? `?${qs}` : ''}`);
  },
  clearTesterHistory: (projectId?: string) => {
    const params = new URLSearchParams();
    if (projectId) params.set('projectId', projectId);
    const qs = params.toString();
    return fetchJson<{ count: number; message: string }>(`/api-tester/history${qs ? `?${qs}` : ''}`, {
      method: 'DELETE',
    });
  },
  getCollections: (projectId: string) =>
    fetchJson<ApiCollection[]>(`/api-tester/collections?projectId=${projectId}`),
  createCollection: (data: { projectId: string; name: string; description?: string }) =>
    fetchJson<ApiCollection>('/api-tester/collections', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateCollection: (id: string, data: { name?: string; description?: string }) =>
    fetchJson<ApiCollection>(`/api-tester/collections/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  deleteCollection: (id: string) =>
    fetchJson<{ message: string }>(`/api-tester/collections/${id}`, { method: 'DELETE' }),
  saveTesterRequest: (data: any) =>
    fetchJson<SavedApiRequest>('/api-tester/requests', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  getSavedTesterRequest: (id: string) =>
    fetchJson<SavedApiRequest>(`/api-tester/requests/${id}`),
  updateSavedTesterRequest: (id: string, data: any) =>
    fetchJson<SavedApiRequest>(`/api-tester/requests/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  deleteSavedTesterRequest: (id: string) =>
    fetchJson<{ message: string }>(`/api-tester/requests/${id}`, { method: 'DELETE' }),
  // -------------------------------------------------------------
  // Contract & Schema Monitoring APIs
  // -------------------------------------------------------------
  getAllSchemas: () => fetchJson<ApiSchemaSummary[]>('/schemas'),
  getAllSchemaChanges: (query?: { severity?: string; apiId?: string; limit?: number }) => {
    const params = new URLSearchParams();
    if (query?.severity) params.set('severity', query.severity);
    if (query?.apiId) params.set('apiId', query.apiId);
    if (query?.limit) params.set('limit', String(query.limit));
    const qs = params.toString();
    return fetchJson<SchemaChangeItem[]>(`/schemas/changes/all${qs ? `?${qs}` : ''}`);
  },
  getSchemaById: (schemaId: string) => fetchJson<ApiSchemaSummary>(`/schemas/${schemaId}`),
  approveBaseline: (schemaId: string, versionId: string) =>
    fetchJson<any>(`/schemas/${schemaId}/approve-baseline/${versionId}`, {
      method: 'POST',
    }),
  checkResponseContract: (
    apiId: string,
    data: {
      endpoint: string;
      method?: string;
      environmentId?: string;
      statusCode?: number;
      responseBody: any;
      autoBaselineIfMissing?: boolean;
    },
  ) =>
    fetchJson<any>(`/apis/${apiId}/schemas/check`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  setBaseSchema: (data: {
    apiId: string;
    endpoint: string;
    method?: string;
    environmentId?: string;
    samplePayload?: any;
    headers?: Record<string, string>;
    body?: any;
    queryParams?: Record<string, any>;
    fetchLive?: boolean;
  }) =>
    fetchJson<{
      schema: ApiSchemaSummary;
      version: any;
      samplePayload: any;
      normalizedSchema: any;
    }>('/schemas/set-baseline', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  verifySchema: (
    schemaId: string,
    data?: {
      headers?: Record<string, string>;
      body?: any;
      queryParams?: Record<string, any>;
    },
  ) =>
    fetchJson<{
      hasChanges: boolean;
      hasBreakingChanges: boolean;
      changeCount: number;
      changes: SchemaChangeItem[];
      summary: string;
      statusCode?: number;
      durationMs?: number;
      endpoint?: string;
      method?: string;
    }>(`/schemas/${schemaId}/verify`, {
      method: 'POST',
      body: JSON.stringify(data || {}),
    }),
  acknowledgeSchemaChange: (changeId: string) =>
    fetchJson<{ success: boolean; change: SchemaChangeItem }>(
      `/schemas/changes/${changeId}/acknowledge`,
      { method: 'POST' },
    ),
  acknowledgeAllSchemaChanges: (schemaId: string) =>
    fetchJson<{ success: boolean; count: number }>(
      `/schemas/${schemaId}/acknowledge-all`,
      { method: 'POST' },
    ),
  modifyBaseSchema: (
    schemaId: string,
    data: { schemaJson?: any; samplePayload?: any },
  ) =>
    fetchJson<{ success: boolean; schema: ApiSchemaSummary; version: any }>(
      `/schemas/${schemaId}/baseline`,
      {
        method: 'PUT',
        body: JSON.stringify(data),
      },
    ),
  setCurrentAsBaseline: (schemaId: string) =>
    fetchJson<{
      success: boolean;
      schemaId: string;
      versionId: string;
      versionNumber: number;
      message: string;
    }>(`/schemas/${schemaId}/set-current-as-baseline`, {
      method: 'POST',
    }),
};

export interface ApiSchemaSummary {
  id: string;
  endpoint: string;
  method: string;
  organizationId: string;
  apiId: string;
  environmentId: string | null;
  activeBaselineVersionId: string | null;
  createdAt: string;
  updatedAt: string;
  api?: { id: string; name: string };
  environment?: { id: string; name: string; baseUrl?: string } | null;
  versions?: Array<{
    id: string;
    versionNumber: number;
    isBaseline: boolean;
    checksum: string | null;
    normalizedSchema?: any;
    samplePayload?: any;
    createdAt: string;
  }>;
  changes?: Array<SchemaChangeItem>;
  _count?: {
    changes: number;
    versions: number;
  };
}

export interface SchemaChangeItem {
  id: string;
  schemaId: string;
  versionId: string | null;
  fieldPath: string;
  changeType: 'FIELD_ADDED' | 'FIELD_REMOVED' | 'TYPE_CHANGED' | 'STRUCTURE_CHANGED' | 'REQUIRED_FIELD_MISSING' | string;
  severity: 'INFO' | 'WARNING' | 'BREAKING';
  previousType?: string | null;
  currentType?: string | null;
  description: string;
  isBreaking: boolean;
  detectedAt: string;
  isAcknowledged: boolean;
  schema?: {
    id: string;
    endpoint: string;
    method: string;
    api?: { id: string; name: string };
    environment?: { id: string; name: string } | null;
  };
  version?: {
    versionNumber: number;
    createdAt: string;
  };
}

// -------------------------------------------------------------
// Phase 6 Notification Interfaces
// -------------------------------------------------------------

export type ContactPointType = 'EMAIL' | 'SLACK' | 'WEBHOOK';
export type NotificationDeliveryStatus = 'PENDING' | 'SENDING' | 'SENT' | 'FAILED' | 'CANCELLED';
export type NotificationEventType = 'FIRING' | 'RECOVERY' | 'REPEAT' | 'TEST';

export interface ContactPoint {
  id: string;
  organizationId: string;
  name: string;
  type: ContactPointType;
  configuration: Record<string, any>;
  isEnabled: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: {
    deliveries: number;
  };
}

export interface LabelMatcher {
  label: string;
  operator: '=' | '!=' | 'contains' | 'regex' | 'in';
  value: string;
}

export interface NotificationPolicy {
  id: string;
  organizationId: string;
  name: string;
  description?: string;
  isEnabled: boolean;
  priority: number;
  matchers: LabelMatcher[];
  contactPointIds: string[];
  notifyOnFiring: boolean;
  notifyOnRecovery: boolean;
  repeatInterval: number;
  createdAt: string;
  updatedAt: string;
  contactPoints?: Array<{ id: string; name: string; type: ContactPointType; isEnabled: boolean }>;
  _count?: {
    deliveries: number;
  };
}

export interface NotificationDelivery {
  id: string;
  organizationId: string;
  incidentId?: string;
  alertInstanceId?: string;
  alertRuleId?: string;
  recipient?: string;
  channel?: ContactPointType;
  contactPointId?: string;
  contactPoint?: {
    id: string;
    name: string;
    type: ContactPointType;
    isEnabled?: boolean;
    configuration?: Record<string, any>;
  };
  policyId?: string;
  policy?: {
    id: string;
    name: string;
    priority?: number;
  };
  incident?: {
    id: string;
    title: string;
    severity: string;
    status: string;
    startedAt: string;
  };
  eventType: NotificationEventType;
  status: NotificationDeliveryStatus;
  attemptCount: number;
  lastAttemptAt?: string;
  nextRetryAt?: string;
  errorMessage?: string;
  deduplicationKey: string;
  payload?: any;
  sentAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationSilence {
  id: string;
  organizationId: string;
  createdBy?: string;
  matchers: LabelMatcher[];
  startsAt: string;
  endsAt: string;
  reason?: string;
  createdAt: string;
  updatedAt: string;
}

// -------------------------------------------------------------
// Load Testing Interfaces
// -------------------------------------------------------------

export type LoadTestStatus = 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
export type LoadTestMode = 'DURATION' | 'REQUEST_COUNT';

export interface LoadTestResult {
  id: string;
  loadTestId: string;
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
  createdAt: string;
}

export interface LoadTestSample {
  id: string;
  loadTestId: string;
  timestamp: string;
  relativeSeconds: number;
  requestsPerSecond: number;
  activeUsers: number;
  avgLatency: number;
  p50Latency?: number | null;
  p95Latency: number;
  p99Latency?: number | null;
  errorRate: number;
  totalRequestsSoFar?: number | null;
  successCount?: number | null;
  failureCount?: number | null;
}

export interface LoadTest {
  id: string;
  name: string;
  description?: string | null;
  projectId: string;
  project?: { id: string; name: string };
  apiId?: string | null;
  api?: { id: string; name: string };
  environmentId?: string | null;
  environment?: { id: string; name: string; baseUrl?: string | null };
  createdBy?: string | null;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  url: string;
  headers?: Record<string, string>;
  queryParams?: Record<string, string>;
  body?: string | null;
  authentication?: {
    type: 'none' | 'bearer' | 'basic' | 'apiKey';
    token?: string;
    username?: string;
    password?: string;
    key?: string;
    value?: string;
    addTo?: 'header' | 'query';
  };
  virtualUsers: number;
  duration?: number | null;
  requestCount?: number | null;
  mode: LoadTestMode;
  timeout: number;
  status: LoadTestStatus;
  errorMessage?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  result?: LoadTestResult | null;
  samples?: LoadTestSample[];
  liveProgress?: {
    elapsedSeconds: number;
    currentRequests: number;
    currentRps: number;
    currentP95: number;
    currentErrorRate: number;
    activeUsers: number;
  } | null;
}

export interface CreateLoadTestPayload {
  name: string;
  description?: string;
  projectId: string;
  apiId?: string;
  environmentId?: string;
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  url: string;
  headers?: Record<string, string>;
  queryParams?: Record<string, string>;
  body?: string;
  authentication?: Record<string, any>;
  virtualUsers?: number;
  mode?: LoadTestMode;
  duration?: number;
  requestCount?: number;
  timeout?: number;
}

// -------------------------------------------------------------
// API Tester Interfaces
// -------------------------------------------------------------
export type ApiTesterAuthType = 'none' | 'bearer' | 'basic' | 'apiKey';

export interface ApiTesterAuth {
  type: ApiTesterAuthType;
  token?: string;
  username?: string;
  password?: string;
  apiKeyName?: string;
  apiKeyValue?: string;
  apiKeyPlacement?: 'header' | 'query';
}

export type ApiTesterBodyType = 'none' | 'json' | 'raw' | 'x-www-form-urlencoded' | 'form-data';

export type ApiAssertionType =
  | 'status_code_equals'
  | 'response_time_less_than'
  | 'response_contains_text'
  | 'json_property_exists'
  | 'json_property_equals';

export interface ApiTesterAssertion {
  id?: string;
  name?: string;
  type: ApiAssertionType;
  target?: string;
  expected?: any;
  enabled?: boolean;
}

export interface ApiAssertionResult {
  name: string;
  passed: boolean;
  type: ApiAssertionType;
  expected?: any;
  actual?: any;
  error?: string;
}

export interface ApiTimingBreakdown {
  totalMs: number;
  dnsMs?: number;
  tcpMs?: number;
  tlsMs?: number;
  ttfbMs?: number;
  downloadMs?: number;
}

export interface ApiExecutionResult {
  status: number | null;
  statusText: string | null;
  headers: Record<string, string>;
  cookies: Array<{ name: string; value: string; [key: string]: any }>;
  body: any;
  rawBody: string;
  contentType: string;
  size: number;
  durationMs: number;
  timing: ApiTimingBreakdown;
  testResults: ApiAssertionResult[];
  testsSummary: {
    total: number;
    passed: number;
    failed: number;
  };
  error?: string;
  finalUrl: string;
}

export interface ExecuteRequestPayload {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';
  url: string;
  queryParams?: Record<string, string | number | boolean>;
  headers?: Record<string, string>;
  body?: string;
  bodyType?: ApiTesterBodyType;
  auth?: ApiTesterAuth;
  timeout?: number;
  variables?: Record<string, string>;
  tests?: ApiTesterAssertion[];
  projectId?: string;
  apiId?: string;
  environmentId?: string;
  saveToHistory?: boolean;
}

export interface ApiCollection {
  id: string;
  projectId: string;
  name: string;
  description?: string | null;
  requests?: SavedApiRequest[];
  createdAt: string;
  updatedAt: string;
}

export interface SavedApiRequest {
  id: string;
  collectionId?: string | null;
  projectId: string;
  apiId?: string | null;
  environmentId?: string | null;
  name: string;
  description?: string | null;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';
  url: string;
  headers: Record<string, string>;
  queryParams: Record<string, any>;
  body?: string | null;
  bodyType: string;
  auth: any;
  tests: any[];
  timeout: number;
  createdAt: string;
  updatedAt: string;
  collection?: ApiCollection;
  api?: { id: string; name: string };
  environment?: { id: string; name: string; baseUrl?: string };
}

export interface ApiRequestHistory {
  id: string;
  projectId?: string | null;
  apiId?: string | null;
  environmentId?: string | null;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';
  url: string;
  status?: number | null;
  statusText?: string | null;
  durationMs?: number | null;
  sizeBytes?: number | null;
  error?: string | null;
  requestSummary?: any;
  createdAt: string;
  project?: { id: string; name: string };
  api?: { id: string; name: string };
  environment?: { id: string; name: string; baseUrl?: string };
}


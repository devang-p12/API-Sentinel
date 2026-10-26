export interface Project {
  id: string;
  name: string;
  description?: string;
  apis?: Api[];
}

export interface Api {
  id: string;
  name: string;
  description?: string;
  projectId: string;
  environments?: Environment[];
}

export interface Environment {
  id: string;
  name: string;
  baseUrl?: string;
  variables?: Record<string, any>;
  apiId: string;
  monitors?: Monitor[];
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
  enabled: boolean;
  createdBy?: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: { instances: number; evaluations: number };
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

const API_BASE = '/api/v1';

async function fetchJson<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
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
  getProjects: () => fetchJson<Project[]>('/projects'),
  getApis: (projectId?: string) =>
    fetchJson<Api[]>(`/apis${projectId ? `?projectId=${projectId}` : ''}`),
  getApi: (id: string) => fetchJson<Api>(`/apis/${id}`),
  createApi: (data: { name: string; description?: string; projectId: string }) =>
    fetchJson<Api>('/apis', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  getEnvironments: (apiId?: string) =>
    fetchJson<Environment[]>(`/environments${apiId ? `?apiId=${apiId}` : ''}`),
  getApiEnvironments: (apiId: string) =>
    fetchJson<Environment[]>(`/apis/${apiId}/environments`),
  createEnvironment: (apiId: string, data: { name: string; baseUrl: string }) =>
    fetchJson<Environment>(`/apis/${apiId}/environments`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateEnvironment: (id: string, data: { name?: string; baseUrl?: string }) =>
    fetchJson<Environment>(`/environments/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  deleteEnvironment: (id: string) =>
    fetchJson<Environment>(`/environments/${id}`, {
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
    fetchJson<{ message: string; monitorId: string; queued: boolean; timestamp: string }>(`/monitors/${id}/run`, { method: 'POST' }),
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
};

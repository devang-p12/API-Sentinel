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
  responseSize: number | null;
  errorMessage: string | null;
  assertionResults?: any[];
  executedAt: string;
}

export interface Incident {
  id: string;
  status: 'TRIGGERED' | 'ACKNOWLEDGED' | 'RESOLVED';
  summary: string;
  startedAt: string;
  resolvedAt: string | null;
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
  triggerMonitorRun: (id: string) =>
    fetchJson<{ message: string }>(`/monitors/${id}/run`, { method: 'POST' }),
  getMonitorExecutions: (id: string, limit: number = 30) =>
    fetchJson<MonitorExecution[]>(`/monitors/${id}/executions?limit=${limit}`),
  getMonitorAnalytics: (id: string, from?: string, to?: string) => {
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    return fetchJson<MonitorAnalyticsSummary>(`/monitors/${id}/analytics?${params.toString()}`);
  },
  getIncidents: (status?: string) =>
    fetchJson<Incident[]>(`/incidents${status ? `?status=${status}` : ''}`),
  acknowledgeIncident: (id: string) =>
    fetchJson<Incident>(`/incidents/${id}/acknowledge`, { method: 'PATCH' }),
  resolveIncident: (id: string) =>
    fetchJson<Incident>(`/incidents/${id}/resolve`, { method: 'PATCH' }),
};

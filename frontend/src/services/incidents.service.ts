import type {
  Incident,
  TimelineEvent,
  ListIncidentsQuery,
  AcknowledgePayload,
  ResolvePayload,
  AddNotePayload,
} from '../types/incidents';

interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data?: T;
  pagination?: {
    total: number;
    limit: number;
    offset: number;
  };
  error?: {
    code?: string;
    message?: string;
    details?: Array<{ message: string; path?: string[] }>;
  };
}

const BASE_URL = '/api/incidents';

export interface FetchIncidentsResult {
  incidents: Incident[];
  total: number;
  pagination?: {
    total: number;
    limit: number;
    offset: number;
  };
}

export async function fetchIncidents(
  filters?: ListIncidentsQuery
): Promise<FetchIncidentsResult> {
  const params = new URLSearchParams();

  if (filters?.api_id) {
    params.set('api_id', String(filters.api_id));
  }
  if (filters?.environment && filters.environment !== 'all') {
    params.set('environment', filters.environment);
  }
  if (filters?.status && filters.status !== 'all') {
    params.set('status', filters.status);
  }
  if (filters?.severity && filters.severity !== 'all') {
    params.set('severity', filters.severity);
  }
  if (filters?.limit !== undefined) {
    params.set('limit', String(filters.limit));
  }
  if (filters?.offset !== undefined) {
    params.set('offset', String(filters.offset));
  }

  const query = params.toString();
  const url = query ? `${BASE_URL}?${query}` : BASE_URL;

  const res = await fetch(url);
  const json: ApiResponse<Incident[]> = await res.json();

  if (!res.ok || !json.success) {
    const errorMsg =
      json.error?.message || json.message || 'Failed to fetch incidents';
    throw new Error(errorMsg);
  }

  const incidents = json.data || [];
  const total = json.pagination?.total ?? incidents.length;

  return {
    incidents,
    total,
    pagination: json.pagination,
  };
}

export async function fetchIncidentById(id: number): Promise<Incident> {
  const res = await fetch(`${BASE_URL}/${id}`);
  const json: ApiResponse<Incident> = await res.json();

  if (!res.ok || !json.success) {
    const errorMsg =
      json.error?.message || json.message || 'Failed to fetch incident details';
    throw new Error(errorMsg);
  }

  return json.data!;
}

export async function fetchIncidentTimeline(
  id: number
): Promise<TimelineEvent[]> {
  const res = await fetch(`${BASE_URL}/${id}/timeline`);
  const json: ApiResponse<TimelineEvent[]> = await res.json();

  if (!res.ok || !json.success) {
    const errorMsg =
      json.error?.message || json.message || 'Failed to fetch incident timeline';
    throw new Error(errorMsg);
  }

  return json.data || [];
}

export async function acknowledgeIncident(
  id: number,
  note?: string
): Promise<Incident> {
  const payload: AcknowledgePayload = note ? { note } : {};
  const res = await fetch(`${BASE_URL}/${id}/acknowledge`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const json: ApiResponse<Incident> = await res.json();

  if (!res.ok || !json.success) {
    const errorMsg =
      json.error?.message || json.message || 'Failed to acknowledge incident';
    throw new Error(errorMsg);
  }

  return json.data!;
}

export async function resolveIncident(
  id: number,
  note?: string
): Promise<Incident> {
  const payload: ResolvePayload = note ? { note } : {};
  const res = await fetch(`${BASE_URL}/${id}/resolve`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const json: ApiResponse<Incident> = await res.json();

  if (!res.ok || !json.success) {
    const errorMsg =
      json.error?.message || json.message || 'Failed to resolve incident';
    throw new Error(errorMsg);
  }

  return json.data!;
}

export async function addIncidentNote(
  id: number,
  note: string
): Promise<TimelineEvent> {
  const payload: AddNotePayload = { note };
  const res = await fetch(`${BASE_URL}/${id}/notes`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const json: ApiResponse<TimelineEvent> = await res.json();

  if (!res.ok || !json.success) {
    const errorMsg =
      json.error?.message || json.message || 'Failed to add incident note';
    throw new Error(errorMsg);
  }

  return json.data!;
}

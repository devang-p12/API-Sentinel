import type {
  AlertRule,
  CreateAlertRulePayload,
  UpdateAlertRulePayload,
} from '../types/alert-rules';

interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data?: T;
  error?: {
    code?: string;
    message?: string;
    details?: Array<{ message: string; path?: string[] }>;
  };
}

const BASE_URL = '/api/alert-rules';

export async function fetchAlertRules(filters?: {
  apiId?: number;
  environment?: string;
}): Promise<AlertRule[]> {
  const params = new URLSearchParams();
  if (filters?.apiId) {
    params.set('api_id', String(filters.apiId));
  }
  if (filters?.environment && filters.environment !== 'all') {
    params.set('environment', filters.environment);
  }

  const query = params.toString();
  const url = query ? `${BASE_URL}?${query}` : BASE_URL;

  const res = await fetch(url);
  const json: ApiResponse<AlertRule[]> = await res.json();

  if (!res.ok || !json.success) {
    const errorMsg =
      json.error?.message || json.message || 'Failed to fetch alert rules';
    throw new Error(errorMsg);
  }

  return json.data || [];
}

export async function createAlertRule(
  payload: CreateAlertRulePayload
): Promise<AlertRule> {
  const res = await fetch(BASE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const json: ApiResponse<AlertRule> = await res.json();

  if (!res.ok || !json.success) {
    const details = json.error?.details
      ? json.error.details.map((d) => d.message).join(', ')
      : null;
    const errorMsg =
      details ||
      json.error?.message ||
      json.message ||
      'Failed to create alert rule';
    throw new Error(errorMsg);
  }

  return json.data!;
}

export async function updateAlertRule(
  id: number,
  payload: UpdateAlertRulePayload
): Promise<AlertRule> {
  const res = await fetch(`${BASE_URL}/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const json: ApiResponse<AlertRule> = await res.json();

  if (!res.ok || !json.success) {
    const details = json.error?.details
      ? json.error.details.map((d) => d.message).join(', ')
      : null;
    const errorMsg =
      details ||
      json.error?.message ||
      json.message ||
      'Failed to update alert rule';
    throw new Error(errorMsg);
  }

  return json.data!;
}

export async function deleteAlertRule(id: number): Promise<void> {
  const res = await fetch(`${BASE_URL}/${id}`, {
    method: 'DELETE',
  });

  const json: ApiResponse<void> = await res.json();

  if (!res.ok || !json.success) {
    const errorMsg =
      json.error?.message || json.message || 'Failed to delete alert rule';
    throw new Error(errorMsg);
  }
}

export async function toggleAlertRule(
  id: number,
  isEnabled: boolean
): Promise<AlertRule> {
  const res = await fetch(`${BASE_URL}/${id}/toggle`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ is_enabled: isEnabled }),
  });

  const json: ApiResponse<AlertRule> = await res.json();

  if (!res.ok || !json.success) {
    const errorMsg =
      json.error?.message || json.message || 'Failed to toggle alert rule';
    throw new Error(errorMsg);
  }

  return json.data!;
}

import type {
  ApiSchema,
  SchemaVersionHistory,
  ApiSchemaChange,
} from '../types/schema';

interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data?: T;
  error?: {
    code?: string;
    message?: string;
    details?: any;
  };
}

const BASE_URL = '/api/schemas';

/**
 * Fetch the latest / current schema for an API and environment.
 * Returns null if no baseline / schema exists yet (HTTP 404).
 */
export async function getCurrentSchema(
  apiId: number,
  environment: string
): Promise<ApiSchema | null> {
  const url = `${BASE_URL}/${apiId}?environment=${encodeURIComponent(environment)}`;
  const res = await fetch(url);

  if (res.status === 404) {
    return null;
  }

  const json: ApiResponse<ApiSchema> = await res.json();
  if (!res.ok || !json.success) {
    const errorMsg = json.error?.message || json.message || 'Failed to fetch current schema';
    throw new Error(errorMsg);
  }

  return json.data || null;
}

/**
 * Fetch schema version history for an API and environment, newest-first.
 */
export async function getSchemaHistory(
  apiId: number,
  environment: string,
  limit?: number
): Promise<SchemaVersionHistory[]> {
  const params = new URLSearchParams({ environment });
  if (limit !== undefined) {
    params.set('limit', String(limit));
  }

  const res = await fetch(`${BASE_URL}/${apiId}/history?${params.toString()}`);
  const json: ApiResponse<SchemaVersionHistory[]> = await res.json();

  if (!res.ok || !json.success) {
    const errorMsg = json.error?.message || json.message || 'Failed to fetch schema history';
    throw new Error(errorMsg);
  }

  return json.data || [];
}

/**
 * Fetch paginated schema changes for an API and environment, newest-first.
 */
export async function getSchemaChanges(
  apiId: number,
  environment: string,
  limit?: number,
  offset?: number
): Promise<ApiSchemaChange[]> {
  const params = new URLSearchParams({ environment });
  if (limit !== undefined) {
    params.set('limit', String(limit));
  }
  if (offset !== undefined) {
    params.set('offset', String(offset));
  }

  const res = await fetch(`${BASE_URL}/${apiId}/changes?${params.toString()}`);
  const json: ApiResponse<ApiSchemaChange[]> = await res.json();

  if (!res.ok || !json.success) {
    const errorMsg = json.error?.message || json.message || 'Failed to fetch schema changes';
    throw new Error(errorMsg);
  }

  return json.data || [];
}

/**
 * Fetch recent schema changes within the last N minutes.
 */
export async function getRecentSchemaChanges(
  apiId: number,
  environment: string,
  minutes?: number
): Promise<ApiSchemaChange[]> {
  const params = new URLSearchParams({ environment });
  if (minutes !== undefined) {
    params.set('minutes', String(minutes));
  }

  const res = await fetch(`${BASE_URL}/${apiId}/changes/recent?${params.toString()}`);
  const json: ApiResponse<ApiSchemaChange[]> = await res.json();

  if (!res.ok || !json.success) {
    const errorMsg = json.error?.message || json.message || 'Failed to fetch recent schema changes';
    throw new Error(errorMsg);
  }

  return json.data || [];
}

/**
 * Acknowledge a schema change event.
 */
export async function acknowledgeSchemaChange(changeId: number): Promise<ApiSchemaChange> {
  const res = await fetch(`${BASE_URL}/changes/${changeId}/acknowledge`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  const json: ApiResponse<ApiSchemaChange> = await res.json();

  if (!res.ok || !json.success) {
    const errorMsg = json.error?.message || json.message || 'Failed to acknowledge schema change';
    throw new Error(errorMsg);
  }

  return json.data!;
}

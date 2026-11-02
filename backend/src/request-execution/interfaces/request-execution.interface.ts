export type ExecutionHttpMethod =
  | 'GET'
  | 'POST'
  | 'PUT'
  | 'PATCH'
  | 'DELETE'
  | 'HEAD'
  | 'OPTIONS';

export interface RequestAuthConfig {
  type?: 'none' | 'bearer' | 'basic' | 'apiKey';
  token?: string;
  username?: string;
  password?: string;
  apiKeyName?: string;
  apiKeyValue?: string;
  apiKeyPlacement?: 'header' | 'query';
}

export interface HttpRequestOptions {
  method: ExecutionHttpMethod | string;
  url: string;
  queryParams?: Record<string, any>;
  headers?: Record<string, string>;
  auth?: RequestAuthConfig;
  body?: any;
  bodyType?: 'none' | 'json' | 'raw' | 'x-www-form-urlencoded' | 'form-data';
  timeoutMs?: number;
  maxTimeoutMs?: number;
  maxResponseSizeBytes?: number;
  allowPrivateIps?: boolean;
  followRedirects?: boolean;
  maxRedirects?: number;
}

export interface TimingBreakdown {
  totalMs: number;
  ttfbMs: number;
  downloadMs: number;
}

export interface HttpResponseResult {
  success: boolean;
  statusCode: number | null;
  statusText: string | null;
  headers: Record<string, string>;
  cookies: Array<{ name: string; value: string }>;
  body: any;
  rawBody: string;
  contentType: string | null;
  sizeBytes: number;
  durationMs: number;
  timing: TimingBreakdown;
  finalUrl: string;
  error?: string | null;
  isTimeout: boolean;
  isNetworkError: boolean;
  isMalformedUrl: boolean;
}

import { HttpMethod } from '@prisma/client';

export type AuthType = 'none' | 'bearer' | 'basic' | 'apiKey';

export interface ApiAuth {
  type: AuthType;
  token?: string;
  username?: string;
  password?: string;
  apiKeyName?: string;
  apiKeyValue?: string;
  apiKeyPlacement?: 'header' | 'query';
}

export type BodyType = 'none' | 'json' | 'raw' | 'x-www-form-urlencoded' | 'form-data';

export type AssertionType =
  | 'status_code_equals'
  | 'response_time_less_than'
  | 'response_contains_text'
  | 'json_property_exists'
  | 'json_property_equals';

export interface ApiAssertion {
  id?: string;
  name?: string;
  type: AssertionType;
  target?: string; // property path e.g. "data.id"
  expected?: any;
  enabled?: boolean;
}

export interface AssertionResult {
  name: string;
  passed: boolean;
  type: AssertionType;
  expected?: any;
  actual?: any;
  error?: string;
}

export interface ApiRequestConfig {
  method: HttpMethod;
  url: string;
  queryParams?: Record<string, string | number | boolean>;
  headers?: Record<string, string>;
  auth?: ApiAuth;
  body?: string | null;
  bodyType?: BodyType;
  timeout?: number;
  variables?: Record<string, string>;
  tests?: ApiAssertion[];
  projectId?: string;
  apiId?: string;
  environmentId?: string;
}

export interface TimingBreakdown {
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
  timing: TimingBreakdown;
  testResults: AssertionResult[];
  testsSummary: {
    total: number;
    passed: number;
    failed: number;
  };
  error?: string;
  finalUrl: string;
}

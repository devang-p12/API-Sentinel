export type APIEnvironment = 'Production' | 'Staging' | 'Development';
export type APIStatus = 'Active' | 'Inactive';
export type APIGroup = 'Payments' | 'Authentication' | 'Users' | 'Orders' | 'Notifications' | 'Other';
export type APIAuthType = 'None' | 'API Key' | 'Bearer Token' | 'OAuth 2.0';

export interface AuthConfig {
  apiKeyName?: string;
  apiHeaderName?: string;
  tokenValue?: string;
  clientId?: string;
  clientSecret?: string;
  tokenUrl?: string;
}

export interface API {
  id: string;
  name: string;
  description: string;
  version: string;
  baseUrl: string;
  environment: APIEnvironment;
  status: APIStatus;
  healthEndpoint: string;
  healthMethod: 'GET' | 'POST';
  healthEnabled: boolean;
  authType: APIAuthType;
  authConfig?: AuthConfig;
  documentationUrl?: string;
  tags: string[];
  createdAt: string;
  group: APIGroup;
}

import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';

interface RunTestPayload {
  method: string;
  url: string;
  headers?: Array<{ key: string; value: string; enabled: boolean }>;
  params?: Array<{ key: string; value: string; enabled: boolean }>;
  body?: string;
  authType?: string;
  credentials?: {
    token?: string;
    username?: string;
    password?: string;
    apiKeyKey?: string;
    apiKeyValue?: string;
  };
  timeout?: number;
}

function formatBytes(bytes: number, decimals = 2) {
  if (!+bytes) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

export class TestService {
  async runTest(data: RunTestPayload) {
    const config: AxiosRequestConfig = {
      method: data.method,
      url: data.url,
      timeout: data.timeout || 5000,
      headers: {},
      params: {},
      // We want to resolve the promise even if the API returns a 4xx or 5xx error
      // so we can display it to the user as a successful test run with a failing status code.
      validateStatus: () => true 
    };

    // 1. Process Headers
    if (data.headers) {
      data.headers.forEach(h => {
        if (h.enabled && h.key.trim()) {
          (config.headers as Record<string, string>)[h.key] = h.value;
        }
      });
    }

    // 2. Process Params
    if (data.params) {
      data.params.forEach(p => {
        if (p.enabled && p.key.trim()) {
          config.params[p.key] = p.value;
        }
      });
    }

    // 3. Process Authentication
    if (data.authType && data.credentials) {
      if (data.authType === 'bearer' && data.credentials.token) {
        (config.headers as Record<string, string>)['Authorization'] = `Bearer ${data.credentials.token}`;
      } else if (data.authType === 'basic' && data.credentials.username && data.credentials.password) {
        const encoded = Buffer.from(`${data.credentials.username}:${data.credentials.password}`).toString('base64');
        (config.headers as Record<string, string>)['Authorization'] = `Basic ${encoded}`;
      } else if (data.authType === 'api-key' && data.credentials.apiKeyKey && data.credentials.apiKeyValue) {
        (config.headers as Record<string, string>)[data.credentials.apiKeyKey] = data.credentials.apiKeyValue;
      }
    }

    // 4. Process Body
    if (data.body && ['POST', 'PUT', 'PATCH'].includes(data.method.toUpperCase())) {
      try {
        // Attempt to parse as JSON if content-type isn't explicitly set to something else
        config.data = JSON.parse(data.body);
      } catch (e) {
        // If it's not valid JSON, send as raw string
        config.data = data.body;
      }
    }

    // 5. Execute Request with Timing
    const startTime = Date.now();
    let response: AxiosResponse;
    
    try {
      response = await axios(config);
    } catch (error: any) {
      // This catches network errors (e.g. ENOTFOUND, timeout), NOT HTTP 404s/500s because validateStatus is true
      throw new Error(`Request failed: ${error.message}`);
    }
    
    const endTime = Date.now();
    const timeTakenMs = endTime - startTime;

    // 6. Calculate Size
    // Stringify the response data to estimate size, or use content-length if available
    let sizeBytes = 0;
    if (response.headers['content-length']) {
      sizeBytes = parseInt(response.headers['content-length'], 10);
    } else {
      sizeBytes = Buffer.byteLength(typeof response.data === 'string' ? response.data : JSON.stringify(response.data || ''));
    }

    return {
      status: response.status,
      statusText: response.statusText,
      time: timeTakenMs,
      size: formatBytes(sizeBytes),
      headers: Object.entries(response.headers).map(([key, value]) => ({ key, value: String(value) })),
      data: response.data
    };
  }
}

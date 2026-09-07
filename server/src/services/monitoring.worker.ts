import axios, { AxiosError } from 'axios';
import { MonitoringRepository, CreateMonitoringLogDTO, UpdateApiMonitoringStatusDTO } from '../repositories/monitoring.repository';
import { AlertEvaluatorService } from './alert-evaluator.service';

export class MonitoringWorker {
  private repository: MonitoringRepository;
  private alertEvaluator: AlertEvaluatorService;
  private timer: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;
  
  constructor() {
    this.repository = new MonitoringRepository();
    this.alertEvaluator = new AlertEvaluatorService();
  }

  start(intervalMs: number = 10000) {
    if (this.timer) {
      clearInterval(this.timer);
    }
    
    console.log(`⏱️ Starting Continuous Monitoring Worker (Interval: ${intervalMs}ms)`);
    
    this.timer = setInterval(async () => {
      if (this.isRunning) return; // Prevent overlap
      this.isRunning = true;
      
      try {
        await this.runChecks();
      } catch (err) {
        console.error('Monitoring Worker Error:', err);
      } finally {
        this.isRunning = false;
      }
    }, intervalMs);
  }
  
  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      console.log('⏱️ Stopped Continuous Monitoring Worker');
    }
  }

  private resolveHeadersAndAuth(api: any): Record<string, string> {
    const headersMap: Record<string, string> = {};

    if (Array.isArray(api.headers)) {
      api.headers.forEach((h: any) => {
        if (h && h.key && h.key.trim() && h.value !== undefined) {
          headersMap[h.key.trim()] = String(h.value);
        }
      });
    }

    const authType = (api.authentication || '').toLowerCase();
    const authConfig = api.authConfig || {};

    if (authType === 'bearer' || authType === 'token') {
      const token = authConfig.token || authConfig.bearerToken || api.apiKey || '';
      if (token) headersMap['Authorization'] = `Bearer ${token}`;
    } else if (authType === 'api-key' || authType === 'apikey') {
      const keyName = authConfig.apiKeyName || authConfig.apiHeaderName || authConfig.key || 'X-API-Key';
      const keyValue = api.apiKey || authConfig.apiKeyValue || authConfig.value || '';
      if (keyValue) headersMap[keyName] = keyValue;
    } else if (authType === 'basic') {
      const username = authConfig.username || '';
      const password = authConfig.password || '';
      if (username || password) {
        const encoded = Buffer.from(`${username}:${password}`).toString('base64');
        headersMap['Authorization'] = `Basic ${encoded}`;
      }
    }

    return headersMap;
  }

  private async runChecks() {
    const apisDue = await this.repository.findApisDueForMonitoring();
    
    if (!apisDue || apisDue.length === 0) {
      return;
    }
    
    // Execute checks concurrently
    const promises = apisDue.map(api => this.checkApi(api));
    await Promise.allSettled(promises);
  }

  private async checkApi(api: any) {
    const startTime = Date.now();
    let statusCode: number | null = null;
    let success = false;
    let errorType: string | null = null;
    let errorMessage: string | null = null;
    let responseSize: number | null = null;

    try {
      const headers = this.resolveHeadersAndAuth(api);
      const method = (api.requestBody ? 'POST' : 'GET').toUpperCase();
      
      const response = await axios({
        url: api.baseUrl,
        method: method,
        headers: headers,
        data: api.requestBody || undefined,
        timeout: api.timeout || 5000,
        validateStatus: () => true // Resolve on any HTTP status so we can measure it
      });

      statusCode = response.status;
      responseSize = response.headers['content-length'] ? parseInt(String(response.headers['content-length']), 10) : (response.data ? JSON.stringify(response.data).length : null);
      
      const expectedStatus = api.expectedStatus || 200;
      if (statusCode === expectedStatus || (statusCode >= 200 && statusCode < 300 && expectedStatus === 200)) {
        success = true;
      } else {
        success = false;
        errorType = 'HTTP_ERROR';
        errorMessage = `Received status ${statusCode}, expected ${expectedStatus}`;
      }

    } catch (error: any) {
      success = false;
      if (axios.isAxiosError(error)) {
        if (error.code === 'ECONNABORTED') {
          errorType = 'TIMEOUT';
          errorMessage = `Request timed out after ${api.timeout || 5000}ms`;
        } else {
          errorType = error.code || 'NETWORK_ERROR';
          errorMessage = error.message;
        }
      } else {
        errorType = 'UNKNOWN_ERROR';
        errorMessage = error.message || String(error);
      }
    }

    const responseTime = Date.now() - startTime;
    
    // Create Log
    await this.repository.createLog({
      apiId: api.id,
      statusCode,
      responseTime,
      success,
      errorType,
      errorMessage,
      responseSize
    });

    // Calculate Health Status
    let healthStatus: 'HEALTHY' | 'DEGRADED' | 'DOWN' = 'HEALTHY';
    let consecutiveFailures = api.consecutiveFailures || 0;
    const degradedThreshold = api.degradedThresholdMs || 1000;

    if (success) {
      consecutiveFailures = 0;
      if (responseTime > degradedThreshold) {
        healthStatus = 'DEGRADED';
      } else {
        healthStatus = 'HEALTHY';
      }
    } else {
      consecutiveFailures += 1;
      // After 3 consecutive failures, mark as DOWN
      if (consecutiveFailures >= 3) {
        healthStatus = 'DOWN';
      } else {
        // Keep previous status or set to DEGRADED if it was HEALTHY
        healthStatus = api.healthStatus === 'DOWN' ? 'DOWN' : 'DEGRADED';
      }
    }

    await this.repository.updateHealthStatus(api.id, {
      healthStatus,
      consecutiveFailures
    });

    try {
      await this.alertEvaluator.evaluateApi({
        apiId: api.id,
        environment: api.environment,
        statusCode,
        responseTime,
        success,
        consecutiveFailures,
      });
    } catch (evalError) {
      console.error(
        `[AlertEvaluator] Evaluation failed for API ${api.id}:`,
        evalError
      );
    }
  }
}

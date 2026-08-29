import { ApiRepository } from '../repositories/api.repository';
import { LoadTestRepository, CreateLoadTestRunDTO } from '../repositories/load-test.repository';
import { K6Service, RunK6Options } from './k6.service';
import { RunSingleLoadTestInput, RunAllLoadTestsInput } from '../validators/load-test.validator';
import crypto from 'crypto';

export interface BatchRunProgress {
  batchId: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  triggerType: string;
  totalApis: number;
  completedApis: number;
  successfulApis: number;
  failedApis: number;
  virtualUsers: number;
  duration: string;
  concurrency: number;
  startedAt: string;
  completedAt?: string;
  results: Array<{
    apiId: number;
    apiName: string;
    status: 'completed' | 'failed';
    testRunId?: number;
    metrics?: any;
    error?: string;
  }>;
}

export class LoadTestService {
  private apiRepo: ApiRepository;
  private loadTestRepo: LoadTestRepository;
  private k6Service: K6Service;
  private batchRuns: Map<string, BatchRunProgress>;

  constructor() {
    this.apiRepo = new ApiRepository();
    this.loadTestRepo = new LoadTestRepository();
    this.k6Service = new K6Service();
    this.batchRuns = new Map();
  }

  /**
   * Builds headers and authentication from registered API database record
   */
  private resolveHeadersAndAuth(api: any): Record<string, string> {
    const headersMap: Record<string, string> = {};

    // 1. Process custom headers
    if (Array.isArray(api.headers)) {
      api.headers.forEach((h: any) => {
        if (h && h.key && h.key.trim() && h.value !== undefined) {
          headersMap[h.key.trim()] = String(h.value);
        }
      });
    }

    // 2. Process authentication
    const authType = (api.authentication || '').toLowerCase();
    const authConfig = api.authConfig || {};

    if (authType === 'bearer' || authType === 'token') {
      const token = authConfig.token || authConfig.bearerToken || api.apiKey || '';
      if (token) {
        headersMap['Authorization'] = `Bearer ${token}`;
      }
    } else if (authType === 'api-key' || authType === 'apikey') {
      const keyName =
        authConfig.apiKeyName || authConfig.apiHeaderName || authConfig.key || 'X-API-Key';
      const keyValue = api.apiKey || authConfig.apiKeyValue || authConfig.value || '';
      if (keyValue) {
        headersMap[keyName] = keyValue;
      }
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

  /**
   * Runs a load test for a single registered API
   */
  async runSingleApiLoadTest(
    input: {
      apiId: number;
      virtualUsers: number;
      duration: string;
      timeout?: string;
      expectedStatus?: number;
    },
    triggerType: 'manual' | 'batch' | 'scheduled' = 'manual',
    batchId?: string
  ) {
    // 1. Retrieve registered API
    const api = await this.apiRepo.findById(input.apiId);
    if (!api) {
      throw new Error(`API with ID ${input.apiId} does not exist`);
    }

    if (api.status && api.status.toLowerCase() === 'inactive') {
      throw new Error(`API '${api.name}' (ID: ${api.id}) is marked as Inactive and cannot be tested`);
    }

    if (!api.baseUrl || !/^https?:\/\//i.test(api.baseUrl)) {
      throw new Error(`API '${api.name}' does not have a valid HTTP/HTTPS URL: ${api.baseUrl}`);
    }

    // 2. Create initial DB record
    const runRecord = await this.loadTestRepo.create({
      apiId: api.id,
      batchId: batchId || undefined,
      triggerType,
      virtualUsers: input.virtualUsers,
      duration: input.duration,
    });

    const runId = runRecord.id;

    // 3. Resolve execution parameters
    const headers = this.resolveHeadersAndAuth(api);
    const method = (api.method || (api.requestBody ? 'POST' : 'GET')).toUpperCase();

    const k6Options: RunK6Options = {
      url: api.baseUrl,
      method: method,
      headers: headers,
      body: api.requestBody || undefined,
      virtualUsers: input.virtualUsers,
      duration: input.duration,
      expectedStatus: input.expectedStatus || api.expectedStatus || 200,
      timeout: input.timeout || '10s',
      apiName: api.name,
    };

    // 4. Run k6
    try {
      const metrics = await this.k6Service.executeLoadTest(k6Options);
      // 5. Update database record with success metrics
      const updated = await this.loadTestRepo.updateSuccess(runId, metrics);
      return updated;
    } catch (err: any) {
      // 6. Update database record with failure
      await this.loadTestRepo.updateFailure(runId, err.message);
      throw err;
    }
  }

  /**
   * Runs load tests for all registered active APIs asynchronously with controlled concurrency
   */
  async runAllApisLoadTestAsync(
    input: RunAllLoadTestsInput,
    triggerType: 'batch' | 'scheduled' = 'batch'
  ) {
    // 1. Fetch eligible APIs
    const apis = await this.apiRepo.findAll({
      environment: input.environment && input.environment !== 'all' ? input.environment : undefined,
      status: 'Active',
    });

    if (!apis || apis.length === 0) {
      throw new Error('No active registered APIs found to test');
    }

    const batchId = `batch_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const concurrencyLimit = Math.max(1, Math.min(input.concurrency || 2, 10));

    const progress: BatchRunProgress = {
      batchId,
      status: 'running',
      triggerType,
      totalApis: apis.length,
      completedApis: 0,
      successfulApis: 0,
      failedApis: 0,
      virtualUsers: input.virtualUsers,
      duration: input.duration,
      concurrency: concurrencyLimit,
      startedAt: new Date().toISOString(),
      results: [],
    };

    this.batchRuns.set(batchId, progress);

    // 2. Launch background execution using worker queue
    this.executeBatchQueue(apis, input, triggerType, batchId, concurrencyLimit).catch((err) => {
      console.error(`Batch ${batchId} failed with critical error:`, err);
      const current = this.batchRuns.get(batchId);
      if (current) {
        current.status = 'failed';
        current.completedAt = new Date().toISOString();
      }
    });

    return {
      success: true,
      message: `Batch load testing initiated for ${apis.length} APIs with concurrency limit ${concurrencyLimit}`,
      batchId,
      totalApis: apis.length,
      virtualUsers: input.virtualUsers,
      duration: input.duration,
      concurrency: concurrencyLimit,
    };
  }

  /**
   * Internal queue runner with concurrency control
   */
  private async executeBatchQueue(
    apis: any[],
    input: RunAllLoadTestsInput,
    triggerType: 'batch' | 'scheduled',
    batchId: string,
    concurrency: number
  ) {
    const queue = [...apis];
    const progress = this.batchRuns.get(batchId)!;

    const worker = async () => {
      while (queue.length > 0) {
        const api = queue.shift();
        if (!api) break;

        try {
          const result = await this.runSingleApiLoadTest(
            {
              apiId: api.id,
              virtualUsers: input.virtualUsers,
              duration: input.duration,
            },
            triggerType,
            batchId
          );

          progress.completedApis++;
          progress.successfulApis++;
          progress.results.push({
            apiId: api.id,
            apiName: api.name,
            status: 'completed',
            testRunId: result.id,
            metrics: {
              throughput: result.throughput,
              avgLatency: result.avgLatency,
              p95Latency: result.p95Latency,
              errorRate: result.errorRate,
            },
          });
        } catch (err: any) {
          progress.completedApis++;
          progress.failedApis++;
          progress.results.push({
            apiId: api.id,
            apiName: api.name,
            status: 'failed',
            error: err.message,
          });
        }
      }
    };

    // Spawn workers up to concurrency limit
    const workers = Array.from({ length: concurrency }, () => worker());
    await Promise.all(workers);

    progress.status = 'completed';
    progress.completedAt = new Date().toISOString();
  }

  /**
   * Retrieves batch progress and results
   */
  async getBatchStatus(batchId: string) {
    // 1. Check in-memory active batches
    const inMemory = this.batchRuns.get(batchId);
    if (inMemory) {
      return inMemory;
    }

    // 2. Query database for historical batch runs
    const dbRuns = await this.loadTestRepo.findByBatchId(batchId);
    if (!dbRuns || dbRuns.length === 0) {
      return null;
    }

    const completed = dbRuns.filter((r) => r.status === 'completed').length;
    const failed = dbRuns.filter((r) => r.status === 'failed').length;

    return {
      batchId,
      status: 'completed',
      totalApis: dbRuns.length,
      completedApis: dbRuns.length,
      successfulApis: completed,
      failedApis: failed,
      startedAt: dbRuns[0].startedAt,
      completedAt: dbRuns[dbRuns.length - 1].completedAt || dbRuns[dbRuns.length - 1].createdAt,
      results: dbRuns.map((r) => ({
        apiId: r.apiId,
        apiName: r.apiName || `API #${r.apiId}`,
        status: r.status,
        testRunId: r.id,
        metrics: {
          throughput: r.throughput,
          avgLatency: r.avgLatency,
          p95Latency: r.p95Latency,
          errorRate: r.errorRate,
        },
        error: r.errorMessage || undefined,
      })),
    };
  }

  /**
   * Retrieves historical load test runs
   */
  async getHistory(filters?: {
    apiId?: number;
    batchId?: string;
    status?: string;
    triggerType?: string;
    limit?: number;
    offset?: number;
  }) {
    return await this.loadTestRepo.findAll(filters);
  }

  /**
   * Retrieves a single load test run by ID
   */
  async getById(id: number) {
    return await this.loadTestRepo.findById(id);
  }

  /**
   * Retrieves load test history for a specific API
   */
  async getByApiId(apiId: number, limit = 20, offset = 0) {
    return await this.loadTestRepo.findByApiId(apiId, limit, offset);
  }
}

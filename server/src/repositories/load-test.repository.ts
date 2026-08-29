import { query } from '../config/database';

export interface CreateLoadTestRunDTO {
  apiId: number;
  batchId?: string;
  triggerType?: 'manual' | 'batch' | 'scheduled';
  virtualUsers: number;
  duration: string;
}

export interface LoadTestMetricsDTO {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  errorRate: number;
  throughput: number;
  avgLatency: number;
  minLatency: number;
  maxLatency: number;
  p50Latency: number;
  p90Latency: number;
  p95Latency: number;
  p99Latency: number;
  statusCodes?: Record<string, number>;
  rawMetrics?: Record<string, any>;
}

export class LoadTestRepository {
  async create(data: CreateLoadTestRunDTO) {
    const text = `
      INSERT INTO load_test_runs (
        api_id,
        batch_id,
        status,
        trigger_type,
        virtual_users,
        duration,
        started_at
      )
      VALUES ($1, $2, 'running', $3, $4, $5, CURRENT_TIMESTAMP)
      RETURNING 
        id,
        api_id AS "apiId",
        batch_id AS "batchId",
        status,
        trigger_type AS "triggerType",
        virtual_users AS "virtualUsers",
        duration,
        started_at AS "startedAt",
        created_at AS "createdAt"
    `;

    const values = [
      data.apiId,
      data.batchId || null,
      data.triggerType || 'manual',
      data.virtualUsers,
      data.duration,
    ];

    const result = await query(text, values);
    return result.rows[0];
  }

  async updateSuccess(id: number, metrics: LoadTestMetricsDTO) {
    const text = `
      UPDATE load_test_runs
      SET 
        status = 'completed',
        completed_at = CURRENT_TIMESTAMP,
        total_requests = $2,
        successful_requests = $3,
        failed_requests = $4,
        error_rate = $5,
        throughput = $6,
        avg_latency = $7,
        min_latency = $8,
        max_latency = $9,
        p50_latency = $10,
        p90_latency = $11,
        p95_latency = $12,
        p99_latency = $13,
        status_codes = $14,
        raw_metrics = $15
      WHERE id = $1
      RETURNING 
        id,
        api_id AS "apiId",
        batch_id AS "batchId",
        status,
        trigger_type AS "triggerType",
        virtual_users AS "virtualUsers",
        duration,
        started_at AS "startedAt",
        completed_at AS "completedAt",
        total_requests AS "totalRequests",
        successful_requests AS "successfulRequests",
        failed_requests AS "failedRequests",
        error_rate AS "errorRate",
        throughput,
        avg_latency AS "avgLatency",
        min_latency AS "minLatency",
        max_latency AS "maxLatency",
        p50_latency AS "p50Latency",
        p90_latency AS "p90Latency",
        p95_latency AS "p95Latency",
        p99_latency AS "p99Latency",
        status_codes AS "statusCodes",
        created_at AS "createdAt"
    `;

    const values = [
      id,
      metrics.totalRequests,
      metrics.successfulRequests,
      metrics.failedRequests,
      metrics.errorRate,
      metrics.throughput,
      metrics.avgLatency,
      metrics.minLatency,
      metrics.maxLatency,
      metrics.p50Latency,
      metrics.p90Latency,
      metrics.p95Latency,
      metrics.p99Latency,
      JSON.stringify(metrics.statusCodes || {}),
      JSON.stringify(metrics.rawMetrics || {}),
    ];

    const result = await query(text, values);
    return result.rows[0];
  }

  async updateFailure(id: number, errorMessage: string) {
    const text = `
      UPDATE load_test_runs
      SET 
        status = 'failed',
        completed_at = CURRENT_TIMESTAMP,
        error_message = $2
      WHERE id = $1
      RETURNING 
        id,
        api_id AS "apiId",
        batch_id AS "batchId",
        status,
        trigger_type AS "triggerType",
        virtual_users AS "virtualUsers",
        duration,
        started_at AS "startedAt",
        completed_at AS "completedAt",
        error_message AS "errorMessage",
        created_at AS "createdAt"
    `;

    const result = await query(text, [id, errorMessage]);
    return result.rows[0];
  }

  async findById(id: number) {
    const text = `
      SELECT 
        l.id,
        l.api_id AS "apiId",
        l.batch_id AS "batchId",
        l.status,
        l.trigger_type AS "triggerType",
        l.virtual_users AS "virtualUsers",
        l.duration,
        l.started_at AS "startedAt",
        l.completed_at AS "completedAt",
        l.total_requests AS "totalRequests",
        l.successful_requests AS "successfulRequests",
        l.failed_requests AS "failedRequests",
        l.error_rate AS "errorRate",
        l.throughput,
        l.avg_latency AS "avgLatency",
        l.min_latency AS "minLatency",
        l.max_latency AS "maxLatency",
        l.p50_latency AS "p50Latency",
        l.p90_latency AS "p90Latency",
        l.p95_latency AS "p95Latency",
        l.p99_latency AS "p99Latency",
        l.status_codes AS "statusCodes",
        l.error_message AS "errorMessage",
        l.raw_metrics AS "rawMetrics",
        l.created_at AS "createdAt",
        a.name AS "apiName",
        a.base_url AS "baseUrl",
        a.environment AS "environment"
      FROM load_test_runs l
      LEFT JOIN apis a ON l.api_id = a.id
      WHERE l.id = $1
    `;

    const result = await query(text, [id]);
    return result.rows[0] || null;
  }

  async findByApiId(apiId: number, limit = 20, offset = 0) {
    const text = `
      SELECT 
        l.id,
        l.api_id AS "apiId",
        l.batch_id AS "batchId",
        l.status,
        l.trigger_type AS "triggerType",
        l.virtual_users AS "virtualUsers",
        l.duration,
        l.started_at AS "startedAt",
        l.completed_at AS "completedAt",
        l.total_requests AS "totalRequests",
        l.successful_requests AS "successfulRequests",
        l.failed_requests AS "failedRequests",
        l.error_rate AS "errorRate",
        l.throughput,
        l.avg_latency AS "avgLatency",
        l.min_latency AS "minLatency",
        l.max_latency AS "maxLatency",
        l.p50_latency AS "p50Latency",
        l.p90_latency AS "p90Latency",
        l.p95_latency AS "p95Latency",
        l.p99_latency AS "p99Latency",
        l.status_codes AS "statusCodes",
        l.error_message AS "errorMessage",
        l.created_at AS "createdAt",
        a.name AS "apiName",
        a.base_url AS "baseUrl",
        a.environment AS "environment"
      FROM load_test_runs l
      LEFT JOIN apis a ON l.api_id = a.id
      WHERE l.api_id = $1
      ORDER BY l.created_at DESC
      LIMIT $2 OFFSET $3
    `;

    const result = await query(text, [apiId, limit, offset]);
    return result.rows;
  }

  async findAll(filters?: {
    apiId?: number;
    batchId?: string;
    status?: string;
    triggerType?: string;
    limit?: number;
    offset?: number;
  }) {
    let text = `
      SELECT 
        l.id,
        l.api_id AS "apiId",
        l.batch_id AS "batchId",
        l.status,
        l.trigger_type AS "triggerType",
        l.virtual_users AS "virtualUsers",
        l.duration,
        l.started_at AS "startedAt",
        l.completed_at AS "completedAt",
        l.total_requests AS "totalRequests",
        l.successful_requests AS "successfulRequests",
        l.failed_requests AS "failedRequests",
        l.error_rate AS "errorRate",
        l.throughput,
        l.avg_latency AS "avgLatency",
        l.min_latency AS "minLatency",
        l.max_latency AS "maxLatency",
        l.p50_latency AS "p50Latency",
        l.p90_latency AS "p90Latency",
        l.p95_latency AS "p95Latency",
        l.p99_latency AS "p99Latency",
        l.status_codes AS "statusCodes",
        l.error_message AS "errorMessage",
        l.created_at AS "createdAt",
        a.name AS "apiName",
        a.base_url AS "baseUrl",
        a.environment AS "environment"
      FROM load_test_runs l
      LEFT JOIN apis a ON l.api_id = a.id
      WHERE 1=1
    `;

    const values: any[] = [];
    let paramIndex = 1;

    if (filters?.apiId) {
      text += ` AND l.api_id = $${paramIndex++}`;
      values.push(filters.apiId);
    }

    if (filters?.batchId) {
      text += ` AND l.batch_id = $${paramIndex++}`;
      values.push(filters.batchId);
    }

    if (filters?.status && filters.status !== 'all') {
      text += ` AND LOWER(l.status) = LOWER($${paramIndex++})`;
      values.push(filters.status);
    }

    if (filters?.triggerType && filters.triggerType !== 'all') {
      text += ` AND LOWER(l.trigger_type) = LOWER($${paramIndex++})`;
      values.push(filters.triggerType);
    }

    text += ` ORDER BY l.created_at DESC`;

    const limit = filters?.limit || 50;
    const offset = filters?.offset || 0;

    text += ` LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    values.push(limit, offset);

    const result = await query(text, values);
    return result.rows;
  }

  async findByBatchId(batchId: string) {
    const text = `
      SELECT 
        l.id,
        l.api_id AS "apiId",
        l.batch_id AS "batchId",
        l.status,
        l.trigger_type AS "triggerType",
        l.virtual_users AS "virtualUsers",
        l.duration,
        l.started_at AS "startedAt",
        l.completed_at AS "completedAt",
        l.total_requests AS "totalRequests",
        l.successful_requests AS "successfulRequests",
        l.failed_requests AS "failedRequests",
        l.error_rate AS "errorRate",
        l.throughput,
        l.avg_latency AS "avgLatency",
        l.min_latency AS "minLatency",
        l.max_latency AS "maxLatency",
        l.p50_latency AS "p50Latency",
        l.p90_latency AS "p90Latency",
        l.p95_latency AS "p95Latency",
        l.p99_latency AS "p99Latency",
        l.status_codes AS "statusCodes",
        l.error_message AS "errorMessage",
        l.created_at AS "createdAt",
        a.name AS "apiName",
        a.base_url AS "baseUrl",
        a.environment AS "environment"
      FROM load_test_runs l
      LEFT JOIN apis a ON l.api_id = a.id
      WHERE l.batch_id = $1
      ORDER BY l.id ASC
    `;

    const result = await query(text, [batchId]);
    return result.rows;
  }
}

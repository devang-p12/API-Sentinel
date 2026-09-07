import { query } from '../config/database';

export interface CreateMonitoringLogDTO {
  apiId: number;
  statusCode: number | null;
  responseTime: number;
  success: boolean;
  errorType?: string | null;
  errorMessage?: string | null;
  responseSize?: number | null;
}

export interface UpdateApiMonitoringStatusDTO {
  healthStatus: 'HEALTHY' | 'DEGRADED' | 'DOWN';
  consecutiveFailures: number;
}

export class MonitoringRepository {
  /**
   * Log a monitoring check result
   */
  async createLog(data: CreateMonitoringLogDTO) {
    const text = `
      INSERT INTO monitoring_logs (
        api_id,
        status_code,
        response_time,
        success,
        error_type,
        error_message,
        response_size
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;

    const values = [
      data.apiId,
      data.statusCode,
      data.responseTime,
      data.success,
      data.errorType || null,
      data.errorMessage || null,
      data.responseSize || null,
    ];

    const result = await query(text, values);
    return result.rows[0];
  }

  /**
   * Update API monitoring configuration
   */
  async updateConfig(apiId: number, config: { monitoringEnabled: boolean; monitoringInterval: number; timeout: number; degradedThresholdMs: number }) {
    const text = `
      UPDATE apis
      SET 
        monitoring_enabled = $1,
        monitoring_interval = $2,
        timeout = $3,
        degraded_threshold_ms = $4,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $5
      RETURNING *
    `;

    const values = [
      config.monitoringEnabled,
      config.monitoringInterval,
      config.timeout,
      config.degradedThresholdMs,
      apiId
    ];

    const result = await query(text, values);
    return result.rows[0];
  }

  /**
   * Update API health status and consecutive failures
   */
  async updateHealthStatus(apiId: number, data: UpdateApiMonitoringStatusDTO) {
    const text = `
      UPDATE apis
      SET 
        health_status = $1,
        consecutive_failures = $2,
        last_monitored_at = CURRENT_TIMESTAMP
      WHERE id = $3
    `;

    const values = [
      data.healthStatus,
      data.consecutiveFailures,
      apiId
    ];

    await query(text, values);
  }

  /**
   * Find APIs that are due for monitoring
   */
  async findApisDueForMonitoring() {
    const text = `
      SELECT 
        id,
        name,
        environment,
        base_url AS "baseUrl",
        headers,
        authentication,
        auth_config AS "authConfig",
        api_key AS "apiKey",
        request_body AS "requestBody",
        expected_status AS "expectedStatus",
        monitoring_interval AS "monitoringInterval",
        timeout,
        degraded_threshold_ms AS "degradedThresholdMs",
        health_status AS "healthStatus",
        consecutive_failures AS "consecutiveFailures",
        last_monitored_at AS "lastMonitoredAt"
      FROM apis
      WHERE monitoring_enabled = true
        AND status = 'Active'
        AND (
          last_monitored_at IS NULL 
          OR last_monitored_at <= CURRENT_TIMESTAMP - (monitoring_interval || ' seconds')::interval
        )
    `;

    // Note: The method column might not exist natively on the apis table based on my earlier check.
    // Let me check if 'method' column exists. Actually, looking at `api.repository.ts`, there is no `method` column!
    // The previous implementation inferred method from requestBody. I will fix this in a moment.

    const result = await query(text, []);
    return result.rows;
  }

  /**
   * Get monitoring logs for a specific API
   */
  async getLogsByApiId(apiId: number, limit = 50) {
    const text = `
      SELECT * 
      FROM monitoring_logs
      WHERE api_id = $1
      ORDER BY timestamp DESC
      LIMIT $2
    `;
    const result = await query(text, [apiId, limit]);
    return result.rows;
  }

  /**
   * Get overall dashboard statistics
   */
  async getDashboardStats() {
    const apisQuery = `
      SELECT 
        COUNT(*) as total_apis,
        SUM(CASE WHEN health_status = 'HEALTHY' THEN 1 ELSE 0 END) as healthy_apis,
        SUM(CASE WHEN health_status = 'DEGRADED' THEN 1 ELSE 0 END) as degraded_apis,
        SUM(CASE WHEN health_status = 'DOWN' THEN 1 ELSE 0 END) as down_apis,
        SUM(CASE WHEN monitoring_enabled = true THEN 1 ELSE 0 END) as monitored_apis
      FROM apis
    `;
    
    const uptimeQuery = `
      SELECT 
        COALESCE(SUM(CASE WHEN success THEN 1 ELSE 0 END) * 100.0 / NULLIF(COUNT(*), 0), 100) as overall_availability
      FROM monitoring_logs
      WHERE timestamp >= NOW() - INTERVAL '24 hours'
    `;

    const [apisRes, uptimeRes] = await Promise.all([
      query(apisQuery, []),
      query(uptimeQuery, [])
    ]);

    return {
      ...apisRes.rows[0],
      overall_availability: uptimeRes.rows[0]?.overall_availability || 100
    };
  }

  /**
   * Get API health list with aggregated metrics
   */
  async getApiHealthList(filters?: { environment?: string, status?: string }) {
    let text = `
      SELECT 
        a.id, a.name, a.application_id, a.environment, a.health_status as "healthStatus", 
        a.last_monitored_at as "lastMonitoredAt", a.monitoring_enabled as "monitoringEnabled",
        COALESCE(ROUND(s.uptime, 2), 100) AS uptime,
        COALESCE(ROUND(s.error_rate, 2), 0) AS "errorRate",
        ROUND(s.avg_response_time) AS "avgResponseTime",
        s.last_status_code AS "lastStatusCode"
      FROM apis a
      LEFT JOIN LATERAL (
        SELECT 
          (SUM(CASE WHEN m.success THEN 1 ELSE 0 END) * 100.0 / NULLIF(COUNT(m.id), 0)) AS uptime,
          (SUM(CASE WHEN NOT m.success THEN 1 ELSE 0 END) * 100.0 / NULLIF(COUNT(m.id), 0)) AS error_rate,
          AVG(m.response_time) AS avg_response_time,
          (SELECT status_code FROM monitoring_logs m2 WHERE m2.api_id = a.id ORDER BY timestamp DESC LIMIT 1) AS last_status_code
        FROM monitoring_logs m
        WHERE m.api_id = a.id AND m.timestamp >= NOW() - INTERVAL '24 hours'
      ) s ON true
      WHERE 1=1
    `;
    
    const values: any[] = [];
    
    if (filters?.environment && filters.environment !== 'all') {
      values.push(filters.environment);
      text += ` AND a.environment = $${values.length}`;
    }
    
    if (filters?.status && filters.status !== 'all') {
      values.push(filters.status);
      text += ` AND a.health_status = $${values.length}`;
    }
    
    const result = await query(text, values);
    return result.rows;
  }

  /**
   * Get specific API health details including recent failures
   */
  async getApiHealthDetails(apiId: number) {
    const statsQuery = `
      SELECT 
        COALESCE(ROUND(SUM(CASE WHEN success THEN 1 ELSE 0 END) * 100.0 / NULLIF(COUNT(id), 0), 2), 100) AS uptime,
        COALESCE(ROUND(SUM(CASE WHEN NOT success THEN 1 ELSE 0 END) * 100.0 / NULLIF(COUNT(id), 0), 2), 0) AS "errorRate",
        ROUND(AVG(response_time)) AS "avgResponseTime"
      FROM monitoring_logs
      WHERE api_id = $1 AND timestamp >= NOW() - INTERVAL '24 hours'
    `;

    const recentFailuresQuery = `
      SELECT * 
      FROM monitoring_logs
      WHERE api_id = $1 AND success = false
      ORDER BY timestamp DESC
      LIMIT 10
    `;

    const [statsRes, failuresRes] = await Promise.all([
      query(statsQuery, [apiId]),
      query(recentFailuresQuery, [apiId])
    ]);

    return {
      stats: statsRes.rows[0],
      recentFailures: failuresRes.rows
    };
  }
}

import { Pool } from 'pg';

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  user: process.env.DB_USER || 'postgres',
  password: String(process.env.DB_PASSWORD || ''),
  database: process.env.DB_NAME || 'api_sentinel',
});

export interface AnalyticsFilters {
  apiId?: number;
  environment?: string;
  applicationId?: number;
  startDate: Date;
  endDate: Date;
}

export class AnalyticsRepository {
  private buildWhereClause(filters: AnalyticsFilters) {
    const conditions = ['timestamp >= $1', 'timestamp <= $2'];
    const values: any[] = [filters.startDate, filters.endDate];
    let paramIndex = 3;

    if (filters.apiId) {
      conditions.push(`api_id = $${paramIndex}`);
      values.push(filters.apiId);
      paramIndex++;
    }

    if (filters.environment) {
      conditions.push(`api_id IN (SELECT id FROM apis WHERE environment = $${paramIndex})`);
      values.push(filters.environment);
      paramIndex++;
    }

    if (filters.applicationId) {
      conditions.push(`api_id IN (SELECT id FROM apis WHERE application_id = $${paramIndex})`);
      values.push(filters.applicationId);
      paramIndex++;
    }

    return {
      where: conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '',
      values
    };
  }

  async getOverallMetrics(filters: AnalyticsFilters) {
    const { where, values } = this.buildWhereClause(filters);

    const query = `
      SELECT 
        COUNT(*) as total_checks,
        SUM(CASE WHEN success THEN 1 ELSE 0 END) as successful_checks,
        SUM(CASE WHEN NOT success THEN 1 ELSE 0 END) as failed_checks,
        AVG(response_time) as avg_latency,
        MIN(response_time) as min_latency,
        MAX(response_time) as max_latency,
        PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY response_time) as p50_latency,
        PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY response_time) as p95_latency,
        PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY response_time) as p99_latency
      FROM monitoring_logs
      ${where}
    `;

    const result = await pool.query(query, values);
    const row = result.rows[0];

    const total = parseInt(row.total_checks || '0', 10);
    const successful = parseInt(row.successful_checks || '0', 10);
    const failed = parseInt(row.failed_checks || '0', 10);
    const uptime = total > 0 ? (successful / total) * 100 : 100;
    const errorRate = total > 0 ? (failed / total) * 100 : 0;

    // Estimate total downtime (in seconds) based on error rate * total duration
    const durationMs = filters.endDate.getTime() - filters.startDate.getTime();
    const totalDowntimeSeconds = Math.round((durationMs / 1000) * (errorRate / 100));

    return {
      totalChecks: total,
      successfulChecks: successful,
      failedChecks: failed,
      uptime: parseFloat(uptime.toFixed(2)),
      errorRate: parseFloat(errorRate.toFixed(2)),
      avgLatency: Math.round(parseFloat(row.avg_latency || '0')),
      minLatency: Math.round(parseFloat(row.min_latency || '0')),
      maxLatency: Math.round(parseFloat(row.max_latency || '0')),
      p50Latency: Math.round(parseFloat(row.p50_latency || '0')),
      p95Latency: Math.round(parseFloat(row.p95_latency || '0')),
      p99Latency: Math.round(parseFloat(row.p99_latency || '0')),
      totalDowntimeSeconds
    };
  }

  async getTimeseriesData(filters: AnalyticsFilters, bucketInterval: string) {
    const { where, values } = this.buildWhereClause(filters);

    // Using PostgreSQL's date_bin (if PG 14+) or date_trunc. We'll use date_trunc for standard intervals (hour, day).
    // For specific intervals like '5 minutes', we can use date_bin or fallback to generic grouping.
    // Assuming standard bucket intervals like 'minute', 'hour', 'day' are passed here.
    
    const query = `
      SELECT 
        DATE_TRUNC('${bucketInterval}', timestamp) as bucket_time,
        COUNT(*) as check_volume,
        AVG(response_time) as avg_latency,
        PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY response_time) as p95_latency,
        (SUM(CASE WHEN success THEN 1 ELSE 0 END)::FLOAT / NULLIF(COUNT(*), 0)) * 100 as uptime,
        (SUM(CASE WHEN NOT success THEN 1 ELSE 0 END)::FLOAT / NULLIF(COUNT(*), 0)) * 100 as error_rate
      FROM monitoring_logs
      ${where}
      GROUP BY bucket_time
      ORDER BY bucket_time ASC
    `;

    const result = await pool.query(query, values);
    return result.rows.map(row => ({
      timestamp: row.bucket_time,
      checkVolume: parseInt(row.check_volume, 10),
      avgLatency: Math.round(parseFloat(row.avg_latency || '0')),
      p95Latency: Math.round(parseFloat(row.p95_latency || '0')),
      uptime: parseFloat(parseFloat(row.uptime || '100').toFixed(2)),
      errorRate: parseFloat(parseFloat(row.error_rate || '0').toFixed(2))
    }));
  }

  async getStatusDistribution(filters: AnalyticsFilters) {
    const { where, values } = this.buildWhereClause(filters);

    const query = `
      SELECT 
        COALESCE(status_code, 0) as status_code,
        COUNT(*) as count
      FROM monitoring_logs
      ${where}
      GROUP BY status_code
      ORDER BY count DESC
    `;

    const result = await pool.query(query, values);
    return result.rows.map(row => ({
      statusCode: parseInt(row.status_code, 10) || 0,
      count: parseInt(row.count, 10)
    }));
  }
}

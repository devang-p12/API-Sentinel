import pg from 'pg';
import { query, pool } from '../config/database';

export interface IncidentListItem {
  id: number;
  apiId: number;
  apiName: string | null;
  ruleId: number;
  ruleMetric: string | null;
  ruleOperator: string | null;
  ruleThreshold: number | null;
  environment: string;
  severity: string;
  status: string;
  triggerDetails: string | null;
  startedAt: Date;
  resolvedAt: Date | null;
  failedChecksCount: number;
  errorInfo: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface TimelineEvent {
  id: number;
  incidentId: number;
  eventType: string;
  description: string | null;
  timestamp: Date;
}

export interface ListIncidentsFilters {
  api_id?: number;
  environment?: string;
  status?: string;
  severity?: string;
  limit: number;
  offset: number;
}

const SELECT_INCIDENT_FIELDS = `
  i.id,
  i.api_id AS "apiId",
  a.name AS "apiName",
  i.rule_id AS "ruleId",
  r.metric AS "ruleMetric",
  r.operator AS "ruleOperator",
  r.threshold AS "ruleThreshold",
  i.environment,
  i.severity,
  i.status,
  i.trigger_details AS "triggerDetails",
  i.started_at AS "startedAt",
  i.resolved_at AS "resolvedAt",
  i.failed_checks_count AS "failedChecksCount",
  i.error_info AS "errorInfo",
  i.created_at AS "createdAt",
  i.updated_at AS "updatedAt"
`;

export class IncidentsRepository {
  /**
   * List incidents with filters, joins, pagination, and total count.
   */
  async findAll(filters: ListIncidentsFilters): Promise<{ incidents: IncidentListItem[]; total: number }> {
    const conditions: string[] = ['1=1'];
    const values: any[] = [];
    let paramIdx = 1;

    if (filters.api_id) {
      conditions.push(`i.api_id = $${paramIdx++}`);
      values.push(filters.api_id);
    }

    if (filters.environment && filters.environment !== 'all') {
      conditions.push(`LOWER(i.environment) = LOWER($${paramIdx++})`);
      values.push(filters.environment);
    }

    if (filters.status && filters.status !== 'all') {
      conditions.push(`i.status = $${paramIdx++}`);
      values.push(filters.status);
    }

    if (filters.severity && filters.severity !== 'all') {
      conditions.push(`i.severity = $${paramIdx++}`);
      values.push(filters.severity);
    }

    const whereClause = conditions.join(' AND ');

    // Total count query
    const countQuery = `
      SELECT COUNT(*) AS total
      FROM incidents i
      WHERE ${whereClause}
    `;
    const countResult = await query(countQuery, values);
    const total = parseInt(countResult.rows[0]?.total || '0', 10);

    // Data query with pagination
    const dataValues = [...values, filters.limit, filters.offset];
    const dataQuery = `
      SELECT ${SELECT_INCIDENT_FIELDS}
      FROM incidents i
      LEFT JOIN apis a ON i.api_id = a.id
      LEFT JOIN alert_rules r ON i.rule_id = r.id
      WHERE ${whereClause}
      ORDER BY i.started_at DESC
      LIMIT $${paramIdx++} OFFSET $${paramIdx++}
    `;
    const dataResult = await query(dataQuery, dataValues);

    return {
      incidents: dataResult.rows,
      total,
    };
  }

  /**
   * Find single incident by ID with joined API and rule details.
   */
  async findById(id: number, client?: pg.PoolClient): Promise<IncidentListItem | null> {
    const text = `
      SELECT ${SELECT_INCIDENT_FIELDS}
      FROM incidents i
      LEFT JOIN apis a ON i.api_id = a.id
      LEFT JOIN alert_rules r ON i.rule_id = r.id
      WHERE i.id = $1
    `;
    const result = client ? await client.query(text, [id]) : await query(text, [id]);
    return result.rows[0] || null;
  }

  /**
   * Conditionally transition incident status to ACKNOWLEDGED if current status is 'OPEN'.
   */
  async transitionToAcknowledged(id: number, client?: pg.PoolClient): Promise<IncidentListItem | null> {
    const text = `
      UPDATE incidents
      SET status = 'ACKNOWLEDGED',
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND status = 'OPEN'
      RETURNING id
    `;
    const result = client ? await client.query(text, [id]) : await query(text, [id]);
    if (!result.rows || result.rows.length === 0) {
      return null;
    }
    return this.findById(id, client);
  }

  /**
   * Conditionally transition incident status to RESOLVED if status is 'OPEN' or 'ACKNOWLEDGED'.
   */
  async transitionToResolved(id: number, client?: pg.PoolClient): Promise<IncidentListItem | null> {
    const text = `
      UPDATE incidents
      SET status = 'RESOLVED',
          resolved_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND status IN ('OPEN', 'ACKNOWLEDGED')
      RETURNING id
    `;
    const result = client ? await client.query(text, [id]) : await query(text, [id]);
    if (!result.rows || result.rows.length === 0) {
      return null;
    }
    return this.findById(id, client);
  }

  /**
   * Insert a timeline event for an incident.
   */
  async createTimelineEvent(
    incidentId: number,
    eventType: string,
    description: string,
    client?: pg.PoolClient
  ): Promise<TimelineEvent> {
    const text = `
      INSERT INTO incident_timeline (incident_id, event_type, description, timestamp)
      VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
      RETURNING 
        id,
        incident_id AS "incidentId",
        event_type AS "eventType",
        description,
        timestamp
    `;
    const result = client
      ? await client.query(text, [incidentId, eventType, description])
      : await query(text, [incidentId, eventType, description]);
    return result.rows[0];
  }

  /**
   * Get timeline entries for an incident ordered by timestamp ASC.
   */
  async getTimeline(incidentId: number): Promise<TimelineEvent[]> {
    const text = `
      SELECT 
        id,
        incident_id AS "incidentId",
        event_type AS "eventType",
        description,
        timestamp
      FROM incident_timeline
      WHERE incident_id = $1
      ORDER BY timestamp ASC
    `;
    const result = await query(text, [incidentId]);
    return result.rows;
  }

  /**
   * Execute callback within an atomic PostgreSQL transaction.
   */
  async executeInTransaction<T>(callback: (client: pg.PoolClient) => Promise<T>): Promise<T> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}

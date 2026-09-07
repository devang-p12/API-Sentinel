import { query } from '../config/database';

export interface CreateAlertRuleDTO {
  apiId: number;
  environment: string;
  metric: string;
  operator: string;
  threshold: number;
  evaluationWindowMins: number;
  consecutiveFailuresCount: number;
  severity: string;
  cooldownMins: number;
  isEnabled: boolean;
}

export interface UpdateAlertRuleDTO {
  apiId?: number;
  environment?: string;
  metric?: string;
  operator?: string;
  threshold?: number;
  evaluationWindowMins?: number;
  consecutiveFailuresCount?: number;
  severity?: string;
  cooldownMins?: number;
  isEnabled?: boolean;
}

const SELECT_COLUMNS = `
  id,
  api_id AS "apiId",
  environment,
  metric,
  operator,
  threshold,
  evaluation_window_mins AS "evaluationWindowMins",
  consecutive_failures_count AS "consecutiveFailuresCount",
  severity,
  cooldown_mins AS "cooldownMins",
  last_triggered_at AS "lastTriggeredAt",
  is_enabled AS "isEnabled",
  created_at AS "createdAt",
  updated_at AS "updatedAt"
`;

export class AlertRulesRepository {
  async create(data: CreateAlertRuleDTO) {
    const text = `
      INSERT INTO alert_rules (
        api_id,
        environment,
        metric,
        operator,
        threshold,
        evaluation_window_mins,
        consecutive_failures_count,
        severity,
        cooldown_mins,
        is_enabled
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING ${SELECT_COLUMNS}
    `;

    const values = [
      data.apiId,
      data.environment,
      data.metric,
      data.operator,
      data.threshold,
      data.evaluationWindowMins,
      data.consecutiveFailuresCount,
      data.severity,
      data.cooldownMins,
      data.isEnabled,
    ];

    const result = await query(text, values);
    return result.rows[0];
  }

  async findAll(filters?: { apiId?: number; environment?: string }) {
    let text = `SELECT ${SELECT_COLUMNS} FROM alert_rules WHERE 1=1`;
    const values: any[] = [];
    let paramIndex = 1;

    if (filters?.apiId) {
      text += ` AND api_id = $${paramIndex++}`;
      values.push(filters.apiId);
    }

    if (filters?.environment && filters.environment !== 'all') {
      text += ` AND LOWER(environment) = LOWER($${paramIndex++})`;
      values.push(filters.environment);
    }

    text += ` ORDER BY created_at DESC`;

    const result = await query(text, values);
    return result.rows;
  }

  async findById(id: number) {
    const text = `SELECT ${SELECT_COLUMNS} FROM alert_rules WHERE id = $1`;
    const result = await query(text, [id]);
    return result.rows[0] || null;
  }

  async update(id: number, data: UpdateAlertRuleDTO) {
    const fieldMap: Record<string, { column: string; value: any }> = {
      apiId: { column: 'api_id', value: data.apiId },
      environment: { column: 'environment', value: data.environment },
      metric: { column: 'metric', value: data.metric },
      operator: { column: 'operator', value: data.operator },
      threshold: { column: 'threshold', value: data.threshold },
      evaluationWindowMins: { column: 'evaluation_window_mins', value: data.evaluationWindowMins },
      consecutiveFailuresCount: { column: 'consecutive_failures_count', value: data.consecutiveFailuresCount },
      severity: { column: 'severity', value: data.severity },
      cooldownMins: { column: 'cooldown_mins', value: data.cooldownMins },
      isEnabled: { column: 'is_enabled', value: data.isEnabled },
    };

    const setClauses: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    for (const [key, mapping] of Object.entries(fieldMap)) {
      if (mapping.value !== undefined) {
        setClauses.push(`${mapping.column} = $${paramIndex++}`);
        values.push(mapping.value);
      }
    }

    if (setClauses.length === 0) {
      return this.findById(id);
    }

    setClauses.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);

    const text = `
      UPDATE alert_rules
      SET ${setClauses.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING ${SELECT_COLUMNS}
    `;

    const result = await query(text, values);
    return result.rows[0] || null;
  }

  async delete(id: number) {
    const text = `DELETE FROM alert_rules WHERE id = $1 RETURNING id`;
    const result = await query(text, [id]);
    return result.rowCount ? result.rowCount > 0 : false;
  }

  async updateEnabled(id: number, isEnabled: boolean) {
    const text = `
      UPDATE alert_rules
      SET is_enabled = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING ${SELECT_COLUMNS}
    `;
    const result = await query(text, [isEnabled, id]);
    return result.rows[0] || null;
  }
}

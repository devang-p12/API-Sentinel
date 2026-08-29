import { query } from '../config/database';

export interface CreateApiDTO {
  name: string;
  description?: string;
  baseUrl: string;
  version?: string;
  environment?: string;
  authentication?: string;
  authConfig?: Record<string, any>;
  scopes?: { read?: boolean; write?: boolean; delete?: boolean };
  apiKey?: string;
  status?: string;
  headers?: Array<{ key: string; value: string }>;
  requestBody?: any;
  expectedStatus?: number;
  applicationId?: number;
}

export class ApiRepository {
  async create(data: CreateApiDTO) {
    const text = `
      INSERT INTO apis (
        name,
        description,
        base_url,
        version,
        environment,
        authentication,
        auth_config,
        scopes,
        api_key,
        status,
        headers,
        request_body,
        expected_status,
        application_id
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING 
        id,
        name,
        description,
        base_url AS "baseUrl",
        version,
        environment,
        authentication,
        auth_config AS "authConfig",
        scopes,
        api_key AS "apiKey",
        status,
        headers,
        request_body AS "requestBody",
        expected_status AS "expectedStatus",
        application_id AS "applicationId",
        created_at AS "createdAt",
        updated_at AS "updatedAt"
    `;

    const values = [
      data.name,
      data.description || '',
      data.baseUrl,
      data.version || 'v1',
      data.environment || 'development',
      data.authentication || 'api-key',
      JSON.stringify(data.authConfig || {}),
      JSON.stringify(data.scopes || { read: true, write: false, delete: false }),
      data.apiKey || null,
      data.status || 'Active',
      JSON.stringify(data.headers || []),
      data.requestBody ? JSON.stringify(data.requestBody) : null,
      data.expectedStatus || 200,
      data.applicationId || null,
    ];

    const result = await query(text, values);
    return result.rows[0];
  }

  async findAll(filters?: { environment?: string; status?: string; search?: string }) {
    let text = `
      SELECT 
        id,
        name,
        description,
        base_url AS "baseUrl",
        version,
        environment,
        authentication,
        auth_config AS "authConfig",
        scopes,
        api_key AS "apiKey",
        status,
        headers,
        request_body AS "requestBody",
        expected_status AS "expectedStatus",
        application_id AS "applicationId",
        created_at AS "createdAt",
        updated_at AS "updatedAt"
      FROM apis
      WHERE 1=1
    `;

    const values: any[] = [];
    let paramIndex = 1;

    if (filters?.environment && filters.environment !== 'all') {
      text += ` AND LOWER(environment) = LOWER($${paramIndex++})`;
      values.push(filters.environment);
    }

    if (filters?.status && filters.status !== 'all') {
      text += ` AND LOWER(status) = LOWER($${paramIndex++})`;
      values.push(filters.status);
    }

    if (filters?.search && filters.search.trim()) {
      text += ` AND (name ILIKE $${paramIndex} OR description ILIKE $${paramIndex} OR base_url ILIKE $${paramIndex})`;
      values.push(`%${filters.search.trim()}%`);
      paramIndex++;
    }

    text += ` ORDER BY created_at DESC`;

    const result = await query(text, values);
    return result.rows;
  }

  async findById(id: number) {
    const text = `
      SELECT 
        id,
        name,
        description,
        base_url AS "baseUrl",
        version,
        environment,
        authentication,
        auth_config AS "authConfig",
        scopes,
        api_key AS "apiKey",
        status,
        headers,
        request_body AS "requestBody",
        expected_status AS "expectedStatus",
        application_id AS "applicationId",
        created_at AS "createdAt",
        updated_at AS "updatedAt"
      FROM apis
      WHERE id = $1
    `;
    const result = await query(text, [id]);
    return result.rows[0] || null;
  }

  async delete(id: number) {
    const text = `DELETE FROM apis WHERE id = $1 RETURNING id`;
    const result = await query(text, [id]);
    return result.rowCount ? result.rowCount > 0 : false;
  }
}

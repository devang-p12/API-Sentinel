/**
 * Schema Repository
 *
 * Provides typed data access for:
 * - api_schemas (schema versions, baselines, and history)
 * - api_schema_changes (detected schema change events)
 *
 * Uses parameterized queries to ensure SQL injection protection and
 * transaction utilities for concurrency and atomicity.
 */

import pg from 'pg';
import { query, pool } from '../config/database';
import { NormalizedSchema } from '../services/schema-normalizer.service';
import { ChangedFieldType, DiffSeverity } from '../services/schema-diff.service';

export interface ApiSchemaRecord {
  id: number;
  apiId: number;
  environment: string;
  version: number;
  isBaseline: boolean;
  schemaDefinition: NormalizedSchema;
  sampleResponse: unknown | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ApiSchemaChangeRecord {
  id: number;
  apiId: number;
  environment: string;
  detectedAt: Date;
  previousSchema: NormalizedSchema;
  newSchema: NormalizedSchema;
  addedFields: string[];
  removedFields: string[];
  changedFieldTypes: ChangedFieldType[];
  severity: DiffSeverity;
  statusCode: number;
  isAcknowledged: boolean;
}

export interface CreateSchemaVersionDTO {
  apiId: number;
  environment: string;
  version: number;
  isBaseline: boolean;
  schemaDefinition: NormalizedSchema;
  sampleResponse?: unknown;
}

export interface CreateSchemaChangeDTO {
  apiId: number;
  environment: string;
  previousSchema: NormalizedSchema;
  newSchema: NormalizedSchema;
  addedFields: string[];
  removedFields: string[];
  changedFieldTypes: ChangedFieldType[];
  severity: DiffSeverity;
  statusCode?: number;
  isAcknowledged?: boolean;
}

const SELECT_SCHEMA_FIELDS = `
  id,
  api_id AS "apiId",
  environment,
  version,
  is_baseline AS "isBaseline",
  schema_definition AS "schemaDefinition",
  sample_response AS "sampleResponse",
  created_at AS "createdAt",
  updated_at AS "updatedAt"
`;

const SELECT_CHANGE_FIELDS = `
  id,
  api_id AS "apiId",
  environment,
  detected_at AS "detectedAt",
  previous_schema AS "previousSchema",
  new_schema AS "newSchema",
  added_fields AS "addedFields",
  removed_fields AS "removedFields",
  changed_field_types AS "changedFieldTypes",
  severity,
  status_code AS "statusCode",
  is_acknowledged AS "isAcknowledged"
`;

export class SchemaRepository {
  /**
   * Acquire a transaction-scoped advisory lock for an API + environment combination.
   * Ensures concurrent monitoring tasks process schema evaluations sequentially.
   */
  async acquireAdvisoryLock(apiId: number, environment: string, client: pg.PoolClient): Promise<void> {
    const lockKey = `api_schema_${apiId}_${environment}`;
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [lockKey]);
  }

  /**
   * Retrieves the current (highest version) schema for an API in a specific environment.
   */
  async getLatestSchema(
    apiId: number,
    environment: string,
    client?: pg.PoolClient
  ): Promise<ApiSchemaRecord | null> {
    const text = `
      SELECT ${SELECT_SCHEMA_FIELDS}
      FROM api_schemas
      WHERE api_id = $1 AND environment = $2
      ORDER BY version DESC, created_at DESC
      LIMIT 1
    `;
    const exec = client ? client.query.bind(client) : query;
    const res = await exec(text, [apiId, environment]);
    return res.rows[0] || null;
  }

  /**
   * Retrieves a specific schema version for an API and environment.
   */
  async getSchemaByVersion(
    apiId: number,
    environment: string,
    version: number,
    client?: pg.PoolClient
  ): Promise<ApiSchemaRecord | null> {
    const text = `
      SELECT ${SELECT_SCHEMA_FIELDS}
      FROM api_schemas
      WHERE api_id = $1 AND environment = $2 AND version = $3
      LIMIT 1
    `;
    const exec = client ? client.query.bind(client) : query;
    const res = await exec(text, [apiId, environment, version]);
    return res.rows[0] || null;
  }

  /**
   * Inserts a new schema version record for an API and environment.
   */
  async createSchemaVersion(
    data: CreateSchemaVersionDTO,
    client?: pg.PoolClient
  ): Promise<ApiSchemaRecord> {
    const text = `
      INSERT INTO api_schemas (
        api_id,
        environment,
        version,
        is_baseline,
        schema_definition,
        sample_response
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING ${SELECT_SCHEMA_FIELDS}
    `;
    const values = [
      data.apiId,
      data.environment,
      data.version,
      data.isBaseline,
      JSON.stringify(data.schemaDefinition),
      data.sampleResponse !== undefined ? JSON.stringify(data.sampleResponse) : null,
    ];
    const exec = client ? client.query.bind(client) : query;
    const res = await exec(text, values);
    return res.rows[0];
  }

  /**
   * Retrieves the schema version history for an API + environment, ordered newest first.
   */
  async getSchemaHistory(
    apiId: number,
    environment: string,
    limit: number = 50
  ): Promise<ApiSchemaRecord[]> {
    const text = `
      SELECT ${SELECT_SCHEMA_FIELDS}
      FROM api_schemas
      WHERE api_id = $1 AND environment = $2
      ORDER BY version DESC, created_at DESC
      LIMIT $3
    `;
    const res = await query(text, [apiId, environment, limit]);
    return res.rows;
  }

  /**
   * Inserts a new schema change event record.
   */
  async createSchemaChange(
    data: CreateSchemaChangeDTO,
    client?: pg.PoolClient
  ): Promise<ApiSchemaChangeRecord> {
    const text = `
      INSERT INTO api_schema_changes (
        api_id,
        environment,
        previous_schema,
        new_schema,
        added_fields,
        removed_fields,
        changed_field_types,
        severity,
        status_code,
        is_acknowledged
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING ${SELECT_CHANGE_FIELDS}
    `;
    const values = [
      data.apiId,
      data.environment,
      JSON.stringify(data.previousSchema),
      JSON.stringify(data.newSchema),
      JSON.stringify(data.addedFields || []),
      JSON.stringify(data.removedFields || []),
      JSON.stringify(data.changedFieldTypes || []),
      data.severity,
      data.statusCode ?? 200,
      Boolean(data.isAcknowledged),
    ];
    const exec = client ? client.query.bind(client) : query;
    const res = await exec(text, values);
    return res.rows[0];
  }

  /**
   * Retrieves schema change history for an API and environment, ordered newest first.
   */
  async getSchemaChanges(
    apiId: number,
    environment: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<ApiSchemaChangeRecord[]> {
    const text = `
      SELECT ${SELECT_CHANGE_FIELDS}
      FROM api_schema_changes
      WHERE api_id = $1 AND environment = $2
      ORDER BY detected_at DESC, id DESC
      LIMIT $3 OFFSET $4
    `;
    const res = await query(text, [apiId, environment, limit, offset]);
    return res.rows;
  }

  /**
   * Retrieves globally recent schema changes across all APIs and environments.
   */
  async getRecentSchemaChanges(limit: number = 20): Promise<ApiSchemaChangeRecord[]> {
    const text = `
      SELECT ${SELECT_CHANGE_FIELDS}
      FROM api_schema_changes
      ORDER BY detected_at DESC, id DESC
      LIMIT $1
    `;
    const res = await query(text, [limit]);
    return res.rows;
  }

  /**
   * Marks a schema change event as acknowledged.
   */
  async acknowledgeSchemaChange(id: number): Promise<ApiSchemaChangeRecord | null> {
    const text = `
      UPDATE api_schema_changes
      SET is_acknowledged = true
      WHERE id = $1
      RETURNING ${SELECT_CHANGE_FIELDS}
    `;
    const res = await query(text, [id]);
    return res.rows[0] || null;
  }

  /**
   * Executes a callback within a managed PostgreSQL transaction.
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

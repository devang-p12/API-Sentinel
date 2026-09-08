/**
 * Schema Detection Service
 *
 * Orchestrates API response baselining and schema change detection:
 * 1. Validates and guards against non-JSON payloads (HTML, plain text, binary).
 * 2. Normalizes the JSON structure via schema-normalizer.service.ts.
 * 3. Retrieves the current baseline for the specific api_id + environment.
 * 4. Compares schemas via schema-diff.service.ts.
 * 5. Safely creates version 1 (baseline) on first observation.
 * 6. Records new versions and schema-change events when differences are detected.
 * 7. Ignores identical schemas to prevent false positives and unnecessary database writes.
 */

import {
  NormalizedSchema,
  normalizeResponseSchema,
} from './schema-normalizer.service';
import {
  SchemaDiffResult,
  diffSchemas,
} from './schema-diff.service';
import {
  SchemaRepository,
  ApiSchemaRecord,
  ApiSchemaChangeRecord,
} from '../repositories/schema.repository';

export type SchemaDetectionStatus =
  | 'BASELINE_CREATED'
  | 'UNCHANGED'
  | 'CHANGED'
  | 'UNSUPPORTED';

export interface SchemaDetectionResult {
  status: SchemaDetectionStatus;
  apiId: number;
  environment: string;
  version: number;
  normalizedSchema: NormalizedSchema | null;
  diff: SchemaDiffResult | null;
  changeEvent: ApiSchemaChangeRecord | null;
  schemaRecord: ApiSchemaRecord | null;
  message?: string;
}

/**
 * Determines whether a response payload is a supported JSON structure (object or array)
 * rather than HTML, raw text, or binary data.
 */
export function isSupportedJsonResponse(response: unknown): boolean {
  if (response === undefined || response === null) {
    return false;
  }

  // Guard against Buffer or binary data
  if (typeof Buffer !== 'undefined' && Buffer.isBuffer(response)) {
    return false;
  }
  if (response instanceof ArrayBuffer || ArrayBuffer.isView(response)) {
    return false;
  }

  // If response is a string, only accept valid JSON object/array representations
  if (typeof response === 'string') {
    const trimmed = response.trim();
    if (trimmed.startsWith('<')) {
      // HTML or XML payload
      return false;
    }
    if (
      (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
      (trimmed.startsWith('[') && trimmed.endsWith(']'))
    ) {
      try {
        JSON.parse(trimmed);
        return true;
      } catch {
        return false;
      }
    }
    // Plain text is not treated as a JSON schema
    return false;
  }

  // Parsed JavaScript object or array
  if (typeof response === 'object') {
    return true;
  }

  return false;
}

export class SchemaDetectionService {
  private repository: SchemaRepository;

  constructor(repository?: SchemaRepository) {
    this.repository = repository || new SchemaRepository();
  }

  /**
   * Evaluates an API response against its current baseline schema for a given environment.
   *
   * @param apiId ID of the API
   * @param environment Deployment environment (e.g. 'development', 'staging', 'production')
   * @param response Raw response body from monitoring check
   * @param statusCode HTTP status code (defaults to 200)
   * @returns SchemaDetectionResult describing action taken
   */
  async detectSchemaChange(
    apiId: number,
    environment: string,
    response: unknown,
    statusCode: number = 200
  ): Promise<SchemaDetectionResult> {
    // 1. Guard against non-JSON / unsupported responses
    if (!isSupportedJsonResponse(response)) {
      return {
        status: 'UNSUPPORTED',
        apiId,
        environment,
        version: 0,
        normalizedSchema: null,
        diff: null,
        changeEvent: null,
        schemaRecord: null,
        message: 'Response is not a supported JSON object or array payload',
      };
    }

    // 2. Normalize the schema (dynamic values are stripped away)
    const normalizedSchema = normalizeResponseSchema(response);
    if (normalizedSchema.isUnsupported) {
      return {
        status: 'UNSUPPORTED',
        apiId,
        environment,
        version: 0,
        normalizedSchema: null,
        diff: null,
        changeEvent: null,
        schemaRecord: null,
        message: 'Normalized schema was flagged as unsupported',
      };
    }

    // 3. Atomically evaluate and persist within an environment-isolated transaction
    return await this.repository.executeInTransaction(async (client) => {
      // Acquire transaction-level advisory lock to serialize concurrent monitoring checks for this API/env
      await this.repository.acquireAdvisoryLock(apiId, environment, client);

      // Fetch the latest schema for this API and environment
      const currentSchema = await this.repository.getLatestSchema(apiId, environment, client);

      // Case A: First successful JSON response -> Establish baseline version 1
      if (!currentSchema) {
        const createdRecord = await this.repository.createSchemaVersion(
          {
            apiId,
            environment,
            version: 1,
            isBaseline: true,
            schemaDefinition: normalizedSchema,
            sampleResponse: response,
          },
          client
        );

        return {
          status: 'BASELINE_CREATED',
          apiId,
          environment,
          version: 1,
          normalizedSchema,
          diff: null,
          changeEvent: null,
          schemaRecord: createdRecord,
          message: 'Initial response baseline schema created as version 1',
        };
      }

      // Case B: Compare new schema with the current latest schema
      const diff = diffSchemas(currentSchema.schemaDefinition, normalizedSchema);

      // If unchanged: perform zero database writes
      if (!diff.hasChanges) {
        return {
          status: 'UNCHANGED',
          apiId,
          environment,
          version: currentSchema.version,
          normalizedSchema,
          diff,
          changeEvent: null,
          schemaRecord: currentSchema,
          message: `Response schema matches current baseline (version ${currentSchema.version})`,
        };
      }

      // Case C: Schema has changed -> Increment version and record change event
      const nextVersion = currentSchema.version + 1;

      const newSchemaRecord = await this.repository.createSchemaVersion(
        {
          apiId,
          environment,
          version: nextVersion,
          isBaseline: false,
          schemaDefinition: normalizedSchema,
          sampleResponse: response,
        },
        client
      );

      const changeEventRecord = await this.repository.createSchemaChange(
        {
          apiId,
          environment,
          previousSchema: currentSchema.schemaDefinition,
          newSchema: normalizedSchema,
          addedFields: diff.addedFields,
          removedFields: diff.removedFields,
          changedFieldTypes: diff.changedFieldTypes,
          severity: diff.severity,
          statusCode,
          isAcknowledged: false,
        },
        client
      );

      return {
        status: 'CHANGED',
        apiId,
        environment,
        version: nextVersion,
        normalizedSchema,
        diff,
        changeEvent: changeEventRecord,
        schemaRecord: newSchemaRecord,
        message: `Schema change detected. Advanced to version ${nextVersion}`,
      };
    });
  }

  /**
   * Retrieves the current active schema for an API and environment.
   */
  async getLatestSchema(apiId: number, environment: string): Promise<ApiSchemaRecord | null> {
    return await this.repository.getLatestSchema(apiId, environment);
  }

  /**
   * Retrieves the versioned schema history for an API and environment.
   */
  async getSchemaHistory(apiId: number, environment: string, limit: number = 50): Promise<ApiSchemaRecord[]> {
    return await this.repository.getSchemaHistory(apiId, environment, limit);
  }

  /**
   * Retrieves detected schema change events for an API and environment.
   */
  async getSchemaChanges(
    apiId: number,
    environment: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<ApiSchemaChangeRecord[]> {
    return await this.repository.getSchemaChanges(apiId, environment, limit, offset);
  }

  /**
   * Retrieves recent schema changes across all APIs.
   */
  async getRecentSchemaChanges(limit: number = 20): Promise<ApiSchemaChangeRecord[]> {
    return await this.repository.getRecentSchemaChanges(limit);
  }

  /**
   * Acknowledges a specific schema change event.
   */
  async acknowledgeChange(changeId: number): Promise<ApiSchemaChangeRecord | null> {
    return await this.repository.acknowledgeSchemaChange(changeId);
  }
}

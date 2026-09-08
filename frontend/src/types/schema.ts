/**
 * Schema Detection Types
 * Corresponds to the Phase 5.7 backend schema REST API responses.
 */

export type SchemaDiffSeverity = 'INFO' | 'WARNING' | 'CRITICAL';

export interface ChangedFieldType {
  path: string;
  previousType: string;
  newType: string;
}

export interface ApiSchema {
  apiId: number;
  environment: string;
  version: number;
  isBaseline: boolean;
  schemaDefinition: Record<string, any>;
  sampleResponse?: unknown | null;
  createdAt: string;
  updatedAt: string;
}

export interface SchemaVersionHistory {
  version: number;
  isBaseline: boolean;
  schemaDefinition: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface ApiSchemaChange {
  id: number;
  apiId: number;
  environment: string;
  detectedAt: string;
  previousSchema: Record<string, any>;
  newSchema: Record<string, any>;
  addedFields: string[];
  removedFields: string[];
  changedFieldTypes: ChangedFieldType[];
  severity: SchemaDiffSeverity;
  statusCode: number;
  isAcknowledged: boolean;
}

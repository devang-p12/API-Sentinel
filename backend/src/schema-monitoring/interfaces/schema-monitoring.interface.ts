/**
 * Phase 7: API Contract and Schema Monitoring Interfaces
 */

export type NormalizedSchemaType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'null'
  | 'object'
  | 'array'
  | 'any';

export interface NormalizedSchemaNode {
  type: NormalizedSchemaType;
  nullable?: boolean;
  properties?: Record<string, NormalizedSchemaNode>;
  required?: string[];
  itemType?: NormalizedSchemaNode;
}

export type SchemaChangeSeverity = 'INFO' | 'WARNING' | 'BREAKING';

export type SchemaChangeType =
  | 'FIELD_ADDED'
  | 'FIELD_REMOVED'
  | 'TYPE_CHANGED'
  | 'STRUCTURE_CHANGED'
  | 'REQUIRED_FIELD_MISSING';

export interface DetectedSchemaChange {
  fieldPath: string;
  changeType: SchemaChangeType;
  severity: SchemaChangeSeverity;
  previousType?: string;
  currentType?: string;
  description: string;
  isBreaking: boolean;
}

export interface SchemaComparisonResult {
  hasChanges: boolean;
  hasBreakingChanges: boolean;
  changeCount: number;
  changes: DetectedSchemaChange[];
  summary: string;
  normalizedCurrent: NormalizedSchemaNode;
  normalizedBaseline?: NormalizedSchemaNode;
}

export interface ProcessResponseOptions {
  organizationId: string;
  apiId: string;
  environmentId?: string;
  monitorConfigId?: string;
  endpoint: string;
  method?: string;
  statusCode: number;
  responseBody: any;
  autoBaselineIfMissing?: boolean;
}

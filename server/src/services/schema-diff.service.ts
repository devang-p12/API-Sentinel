/**
 * Response Schema Diff Engine Service
 *
 * Compares two NormalizedSchema objects and identifies structural differences:
 * - Added fields
 * - Removed fields
 * - Type changes (primitive, object, array, union, root-level)
 *
 * Operates purely on normalized schemas without inspecting or comparing raw dynamic values.
 */

import { NormalizedSchema, SchemaType } from './schema-normalizer.service';

export interface ChangedFieldType {
  path: string;
  previousType: string;
  newType: string;
}

export type DiffSeverity = 'CRITICAL' | 'WARNING' | 'INFO';

export interface SchemaDiffResult {
  hasChanges: boolean;
  addedFields: string[];
  removedFields: string[];
  changedFieldTypes: ChangedFieldType[];
  severity: DiffSeverity;
  totalChanges: number;
}

/**
 * Converts a SchemaType into a normalized, canonical string.
 * Deduplicates and sorts union types alphabetically to avoid false positives.
 * E.g., ['string', 'number'] -> '[number, string]'
 */
export function normalizeTypeString(type: SchemaType | undefined): string {
  if (type === undefined) {
    return 'unknown';
  }
  if (Array.isArray(type)) {
    const uniqueSorted = Array.from(new Set(type)).sort();
    if (uniqueSorted.length === 1) {
      return uniqueSorted[0];
    }
    return `[${uniqueSorted.join(', ')}]`;
  }
  return String(type);
}

/**
 * Recursively collects all field paths contained within a schema.
 * Collects both container paths and nested leaf paths.
 */
function collectAllPaths(schema: NormalizedSchema, prefix: string, target: Set<string>): void {
  if (prefix) {
    target.add(prefix);
  }

  if (schema.type === 'object' && schema.properties) {
    for (const key of Object.keys(schema.properties)) {
      const childPath = prefix ? `${prefix}.${key}` : key;
      collectAllPaths(schema.properties[key], childPath, target);
    }
  } else if (schema.type === 'array' && schema.items) {
    const itemPath = prefix ? `${prefix}[*]` : '[*]';
    if (schema.items.type === 'object' && schema.items.properties) {
      for (const key of Object.keys(schema.items.properties)) {
        const childPath = `${itemPath}.${key}`;
        collectAllPaths(schema.items.properties[key], childPath, target);
      }
    } else {
      collectAllPaths(schema.items, itemPath, target);
    }
  }
}

/**
 * Calculates a change severity level based on the nature of schema differences.
 * Breaking changes (removed fields, altered types) indicate CRITICAL severity,
 * additive changes indicate WARNING, and identical schemas indicate INFO.
 */
function calculateSeverity(
  removedFields: string[],
  changedFieldTypes: ChangedFieldType[],
  addedFields: string[]
): DiffSeverity {
  if (removedFields.length > 0 || changedFieldTypes.length > 0) {
    return 'CRITICAL';
  }
  if (addedFields.length > 0) {
    return 'WARNING';
  }
  return 'INFO';
}

/**
 * Internal recursive comparison between previous and new normalized schemas.
 */
function compareRecursive(
  prev: NormalizedSchema,
  next: NormalizedSchema,
  path: string,
  addedSet: Set<string>,
  removedSet: Set<string>,
  typeChanges: ChangedFieldType[]
): void {
  const prevTypeStr = normalizeTypeString(prev.type);
  const nextTypeStr = normalizeTypeString(next.type);

  // 1. Detect type changes
  if (prevTypeStr !== nextTypeStr) {
    typeChanges.push({
      path: path || '$',
      previousType: prevTypeStr,
      newType: nextTypeStr,
    });
    // When a fundamental type change occurs, do not report subfields as added or removed
    return;
  }

  // 2. Both schemas share the same type
  // Case A: Objects
  if (prev.type === 'object' && next.type === 'object') {
    const prevProps = prev.properties || {};
    const nextProps = next.properties || {};

    const prevKeys = new Set(Object.keys(prevProps));
    const nextKeys = new Set(Object.keys(nextProps));

    // Removed properties (in previous but not new)
    for (const key of Object.keys(prevProps)) {
      if (!nextKeys.has(key)) {
        const fieldPath = path ? `${path}.${key}` : key;
        collectAllPaths(prevProps[key], fieldPath, removedSet);
      }
    }

    // Added properties (in new but not previous)
    for (const key of Object.keys(nextProps)) {
      if (!prevKeys.has(key)) {
        const fieldPath = path ? `${path}.${key}` : key;
        collectAllPaths(nextProps[key], fieldPath, addedSet);
      }
    }

    // Properties in both: recurse
    for (const key of Object.keys(prevProps)) {
      if (nextKeys.has(key)) {
        const fieldPath = path ? `${path}.${key}` : key;
        compareRecursive(
          prevProps[key],
          nextProps[key],
          fieldPath,
          addedSet,
          removedSet,
          typeChanges
        );
      }
    }
    return;
  }

  // Case B: Arrays
  if (prev.type === 'array' && next.type === 'array') {
    const prevItem = prev.items || { type: 'unknown' };
    const nextItem = next.items || { type: 'unknown' };

    const itemPath = path ? `${path}[*]` : '[*]';
    compareRecursive(prevItem, nextItem, itemPath, addedSet, removedSet, typeChanges);
    return;
  }

  // Case C: Same primitive types (string, number, boolean, null)
  // No differences to record
}

/**
 * Compares two NormalizedSchema objects and returns a deterministic, structured diff result.
 *
 * @param previousSchema The previous baseline or reference schema
 * @param newSchema The new schema to evaluate
 * @returns SchemaDiffResult containing added fields, removed fields, and changed field types
 */
export function diffSchemas(
  previousSchema: NormalizedSchema,
  newSchema: NormalizedSchema
): SchemaDiffResult {
  // Guard against missing schemas
  if (!previousSchema || !newSchema) {
    const hasChanges = Boolean(previousSchema !== newSchema);
    return {
      hasChanges,
      addedFields: [],
      removedFields: [],
      changedFieldTypes: hasChanges
        ? [
            {
              path: '$',
              previousType: previousSchema ? normalizeTypeString(previousSchema.type) : 'none',
              newType: newSchema ? normalizeTypeString(newSchema.type) : 'none',
            },
          ]
        : [],
      severity: hasChanges ? 'CRITICAL' : 'INFO',
      totalChanges: hasChanges ? 1 : 0,
    };
  }

  const addedSet = new Set<string>();
  const removedSet = new Set<string>();
  const typeChanges: ChangedFieldType[] = [];

  compareRecursive(previousSchema, newSchema, '', addedSet, removedSet, typeChanges);

  // Deterministically sort all results
  const addedFields = Array.from(addedSet).sort();
  const removedFields = Array.from(removedSet).sort();

  typeChanges.sort((a, b) => {
    if (a.path !== b.path) return a.path.localeCompare(b.path);
    if (a.previousType !== b.previousType) return a.previousType.localeCompare(b.previousType);
    return a.newType.localeCompare(b.newType);
  });

  const totalChanges = addedFields.length + removedFields.length + typeChanges.length;
  const hasChanges = totalChanges > 0;
  const severity = calculateSeverity(removedFields, typeChanges, addedFields);

  return {
    hasChanges,
    addedFields,
    removedFields,
    changedFieldTypes: typeChanges,
    severity,
    totalChanges,
  };
}

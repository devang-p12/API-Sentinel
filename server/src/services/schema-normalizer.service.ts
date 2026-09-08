/**
 * Response Schema Normalizer Service
 * 
 * Converts JSON API responses into a deterministic, normalized schema representation.
 * Encodes data types, object properties, and array item structures without capturing
 * actual dynamic values (IDs, timestamps, tokens, names, etc.).
 */

export type PrimitiveSchemaType = 'string' | 'number' | 'boolean' | 'null' | 'unknown';
export type ComplexSchemaType = 'object' | 'array';
export type SingleSchemaType = PrimitiveSchemaType | ComplexSchemaType;
export type SchemaType = SingleSchemaType | SingleSchemaType[];

export interface NormalizedSchema {
  type: SchemaType;
  properties?: Record<string, NormalizedSchema>;
  items?: NormalizedSchema;
  isUnsupported?: boolean;
}

const MAX_RECURSION_DEPTH = 50;
const MAX_ARRAY_SAMPLE_SIZE = 50;

/**
 * Merges two NormalizedSchema definitions into a unified schema.
 * Handles identical types, structural merges for objects and arrays,
 * and deterministic union types for mixed structures.
 */
export function mergeSchemas(a: NormalizedSchema, b: NormalizedSchema): NormalizedSchema {
  if (a.type === 'unknown') return b;
  if (b.type === 'unknown') return a;

  // Case 1: Both schemas share the exact same single type
  if (a.type === b.type) {
    if (a.type === 'object') {
      const aProps = a.properties || {};
      const bProps = b.properties || {};
      const allKeys = Array.from(new Set([...Object.keys(aProps), ...Object.keys(bProps)])).sort();
      const mergedProps: Record<string, NormalizedSchema> = {};

      for (const key of allKeys) {
        if (aProps[key] && bProps[key]) {
          mergedProps[key] = mergeSchemas(aProps[key], bProps[key]);
        } else if (aProps[key]) {
          mergedProps[key] = aProps[key];
        } else {
          mergedProps[key] = bProps[key];
        }
      }

      return {
        type: 'object',
        properties: mergedProps,
      };
    }

    if (a.type === 'array') {
      const mergedItem = (a.items && b.items)
        ? mergeSchemas(a.items, b.items)
        : (a.items || b.items || { type: 'unknown' });

      return {
        type: 'array',
        items: mergedItem,
      };
    }

    // Both are the same primitive type (string, number, boolean, null)
    return { type: a.type };
  }

  // Case 2: Types differ - form a sorted, deduplicated union of types
  const typesA: SingleSchemaType[] = Array.isArray(a.type) ? a.type : [a.type as SingleSchemaType];
  const typesB: SingleSchemaType[] = Array.isArray(b.type) ? b.type : [b.type as SingleSchemaType];

  const combinedTypes = Array.from(new Set([...typesA, ...typesB])).filter((t) => t !== 'unknown');
  combinedTypes.sort();

  if (combinedTypes.length === 1) {
    return {
      type: combinedTypes[0],
      properties: a.properties || b.properties,
      items: a.items || b.items,
    };
  }

  // Merge nested properties if present
  let mergedProps: Record<string, NormalizedSchema> | undefined;
  if (a.properties || b.properties) {
    const aProps = a.properties || {};
    const bProps = b.properties || {};
    const allKeys = Array.from(new Set([...Object.keys(aProps), ...Object.keys(bProps)])).sort();
    mergedProps = {};
    for (const key of allKeys) {
      if (aProps[key] && bProps[key]) {
        mergedProps[key] = mergeSchemas(aProps[key], bProps[key]);
      } else {
        mergedProps[key] = aProps[key] || bProps[key];
      }
    }
  }

  // Merge array items if present
  let mergedItems: NormalizedSchema | undefined;
  if (a.items || b.items) {
    mergedItems = (a.items && b.items) ? mergeSchemas(a.items, b.items) : (a.items || b.items);
  }

  const result: NormalizedSchema = {
    type: combinedTypes,
  };

  if (mergedProps && Object.keys(mergedProps).length > 0) {
    result.properties = mergedProps;
  }
  if (mergedItems) {
    result.items = mergedItems;
  }

  return result;
}

/**
 * Normalizes an array value into a schema representation.
 * Examines array elements up to MAX_ARRAY_SAMPLE_SIZE to infer a unified item schema.
 */
function normalizeArray(
  arr: unknown[],
  seen: WeakSet<object>,
  depth: number
): NormalizedSchema {
  if (arr.length === 0) {
    return {
      type: 'array',
      items: { type: 'unknown' },
    };
  }

  const sampleSize = Math.min(arr.length, MAX_ARRAY_SAMPLE_SIZE);
  let unifiedItemSchema: NormalizedSchema = { type: 'unknown' };

  for (let i = 0; i < sampleSize; i++) {
    const itemSchema = normalizeInternal(arr[i], seen, depth + 1);
    unifiedItemSchema = mergeSchemas(unifiedItemSchema, itemSchema);
  }

  return {
    type: 'array',
    items: unifiedItemSchema,
  };
}

/**
 * Normalizes an object into a schema representation.
 * Sorts property keys alphabetically for deterministic schema generation.
 */
function normalizeObject(
  obj: Record<string, unknown>,
  seen: WeakSet<object>,
  depth: number
): NormalizedSchema {
  const keys = Object.keys(obj).sort();
  const properties: Record<string, NormalizedSchema> = {};

  for (const key of keys) {
    const value = obj[key];
    // Skip functions and symbols (invalid in JSON)
    if (typeof value === 'function' || typeof value === 'symbol') {
      continue;
    }
    properties[key] = normalizeInternal(value, seen, depth + 1);
  }

  return {
    type: 'object',
    properties,
  };
}

/**
 * Internal recursive normalization helper.
 */
function normalizeInternal(
  value: unknown,
  seen: WeakSet<object>,
  depth: number
): NormalizedSchema {
  // Prevent stack overflow on pathological nesting
  if (depth > MAX_RECURSION_DEPTH) {
    return { type: 'unknown' };
  }

  // 1. Primitive: null
  if (value === null) {
    return { type: 'null' };
  }

  // 2. Primitive: undefined / function / symbol (unsupported in JSON)
  if (value === undefined || typeof value === 'function' || typeof value === 'symbol') {
    return { type: 'unknown', isUnsupported: true };
  }

  // 3. Primitive: boolean
  if (typeof value === 'boolean') {
    return { type: 'boolean' };
  }

  // 4. Primitive: number (distinguished from string)
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      return { type: 'null' }; // In JSON, NaN and Infinity serialize to null
    }
    return { type: 'number' };
  }

  // 5. Primitive: bigint (treat as number in schema)
  if (typeof value === 'bigint') {
    return { type: 'number' };
  }

  // 6. Primitive: string
  if (typeof value === 'string') {
    return { type: 'string' };
  }

  // 7. Date instances (serialize to string in JSON)
  if (value instanceof Date) {
    return { type: 'string' };
  }

  // 8. Complex reference types (Array / Object)
  if (typeof value === 'object') {
    // Detect circular references
    if (seen.has(value)) {
      return { type: Array.isArray(value) ? 'array' : 'object' };
    }
    seen.add(value);

    if (Array.isArray(value)) {
      return normalizeArray(value, seen, depth);
    }

    return normalizeObject(value as Record<string, unknown>, seen, depth);
  }

  return { type: 'unknown', isUnsupported: true };
}

/**
 * Normalizes an API response (parsed object, array, primitive, or JSON string)
 * into a structured, deterministic NormalizedSchema.
 * 
 * Actual values are completely ignored; only structures and data types are captured.
 *
 * @param response The API response payload to normalize
 * @returns The normalized schema representation
 */
export function normalizeResponseSchema(response: unknown): NormalizedSchema {
  if (response === undefined) {
    return { type: 'unknown', isUnsupported: true };
  }

  // If response is passed as a string, check if it's a JSON-encoded object or array
  if (typeof response === 'string') {
    const trimmed = response.trim();
    if (
      (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
      (trimmed.startsWith('[') && trimmed.endsWith(']'))
    ) {
      try {
        const parsed = JSON.parse(trimmed);
        return normalizeInternal(parsed, new WeakSet<object>(), 0);
      } catch {
        // String was not valid JSON, treat as a primitive string
        return { type: 'string' };
      }
    }
    return { type: 'string' };
  }

  return normalizeInternal(response, new WeakSet<object>(), 0);
}

/**
 * Returns a canonical, deterministically serialized JSON string representation
 * of a NormalizedSchema with sorted keys at every nesting level.
 */
export function canonicalizeSchema(schema: NormalizedSchema): string {
  const sortKeys = (obj: any): any => {
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }
    if (Array.isArray(obj)) {
      return obj.map(sortKeys);
    }
    const sorted: Record<string, any> = {};
    for (const key of Object.keys(obj).sort()) {
      sorted[key] = sortKeys(obj[key]);
    }
    return sorted;
  };

  return JSON.stringify(sortKeys(schema));
}

/**
 * Checks structural equality between two schemas deterministically.
 */
export function isSchemaEqual(a: NormalizedSchema, b: NormalizedSchema): boolean {
  return canonicalizeSchema(a) === canonicalizeSchema(b);
}

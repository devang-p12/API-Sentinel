import * as crypto from 'crypto';
import {
  NormalizedSchemaNode,
  NormalizedSchemaType,
} from './interfaces/schema-monitoring.interface';

export class SchemaNormalizer {
  /**
   * Deterministically extracts a normalized structural schema representation from any JSON value.
   */
  public static extractSchema(payload: any): NormalizedSchemaNode {
    if (payload === null || payload === undefined) {
      return { type: 'null', nullable: true };
    }

    if (Array.isArray(payload)) {
      if (payload.length === 0) {
        return {
          type: 'array',
          itemType: { type: 'any' },
        };
      }

      // Merge schemas of array items to discover representative structure and required fields
      const itemSchemas = payload.map((item) => this.extractSchema(item));
      const mergedItemSchema = this.mergeItemSchemas(itemSchemas);

      return {
        type: 'array',
        itemType: mergedItemSchema,
      };
    }

    if (typeof payload === 'object') {
      const properties: Record<string, NormalizedSchemaNode> = {};
      const required: string[] = [];

      // Sort property keys deterministically
      const sortedKeys = Object.keys(payload).sort();

      for (const key of sortedKeys) {
        const val = payload[key];
        properties[key] = this.extractSchema(val);
        if (val !== null && val !== undefined) {
          required.push(key);
        }
      }

      return {
        type: 'object',
        properties,
        required,
      };
    }

    const primitiveType = typeof payload;
    if (primitiveType === 'string') {
      return { type: 'string' };
    }
    if (primitiveType === 'number') {
      return { type: 'number' };
    }
    if (primitiveType === 'boolean') {
      return { type: 'boolean' };
    }

    return { type: 'any' };
  }

  /**
   * Computes deterministic SHA-256 checksum of normalized schema.
   */
  public static computeChecksum(node: NormalizedSchemaNode): string {
    const serialized = JSON.stringify(this.sortSchemaNode(node));
    return crypto.createHash('sha256').update(serialized).digest('hex');
  }

  private static sortSchemaNode(node: NormalizedSchemaNode): any {
    const sorted: any = { type: node.type };
    if (node.nullable !== undefined) sorted.nullable = node.nullable;
    if (node.required) sorted.required = [...node.required].sort();
    if (node.itemType) sorted.itemType = this.sortSchemaNode(node.itemType);
    if (node.properties) {
      sorted.properties = {};
      const keys = Object.keys(node.properties).sort();
      for (const k of keys) {
        sorted.properties[k] = this.sortSchemaNode(node.properties[k]);
      }
    }
    return sorted;
  }

  private static mergeItemSchemas(schemas: NormalizedSchemaNode[]): NormalizedSchemaNode {
    if (schemas.length === 0) return { type: 'any' };
    if (schemas.length === 1) return schemas[0];

    // Check if all items share the exact same type
    const firstType = schemas[0].type;
    const allSameType = schemas.every((s) => s.type === firstType);

    if (!allSameType) {
      return { type: 'any' };
    }

    if (firstType === 'object') {
      const mergedProps: Record<string, NormalizedSchemaNode> = {};
      const allPropKeys = new Set<string>();

      for (const s of schemas) {
        if (s.properties) {
          Object.keys(s.properties).forEach((k) => allPropKeys.add(k));
        }
      }

      const commonRequired: string[] = [];
      for (const key of Array.from(allPropKeys).sort()) {
        const itemPropSchemas = schemas
          .map((s) => s.properties?.[key])
          .filter((p): p is NormalizedSchemaNode => !!p);

        mergedProps[key] = this.mergeItemSchemas(itemPropSchemas);

        // Required only if present in every item's required list
        const isPresentInAll = schemas.every((s) => s.required?.includes(key));
        if (isPresentInAll) {
          commonRequired.push(key);
        }
      }

      return {
        type: 'object',
        properties: mergedProps,
        required: commonRequired,
      };
    }

    return schemas[0];
  }
}

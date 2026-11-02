import {
  DetectedSchemaChange,
  NormalizedSchemaNode,
  SchemaComparisonResult,
} from './interfaces/schema-monitoring.interface';

export class SchemaDiffEngine {
  /**
   * Compares a baseline schema against a current response schema.
   * Deterministically finds all structural changes and categorizes severity:
   * - INFO: backward-compatible field additions
   * - WARNING: optional field alterations, nullable changes
   * - BREAKING: removed fields, type mutations, structure shifts, missing required fields
   */
  public static compare(
    baseline: NormalizedSchemaNode,
    current: NormalizedSchemaNode,
  ): SchemaComparisonResult {
    const changes: DetectedSchemaChange[] = [];
    this.diffNodes('', baseline, current, changes);

    const breakingChanges = changes.filter((c) => c.isBreaking);
    const hasBreakingChanges = breakingChanges.length > 0;
    const hasChanges = changes.length > 0;

    let summary = 'No schema contract changes detected. Response conforms to baseline.';
    if (hasBreakingChanges) {
      const breakingCount = breakingChanges.length;
      summary = `BREAKING contract change: ${breakingCount} breaking violation(s) detected (${breakingChanges.map((b) => b.fieldPath).slice(0, 3).join(', ')}${breakingCount > 3 ? '...' : ''}).`;
    } else if (hasChanges) {
      summary = `Non-breaking contract updates: ${changes.length} change(s) detected (backward-compatible).`;
    }

    return {
      hasChanges,
      hasBreakingChanges,
      changeCount: changes.length,
      changes,
      summary,
      normalizedBaseline: baseline,
      normalizedCurrent: current,
    };
  }

  private static diffNodes(
    path: string,
    baseline: NormalizedSchemaNode,
    current: NormalizedSchemaNode,
    changes: DetectedSchemaChange[],
  ): void {
    const displayPath = path || '(root)';

    // 1. Check Top-Level Type Mismatch
    if (baseline.type !== current.type) {
      // Check if this is an array/object structural change vs primitive type change
      const isStructureChange =
        (baseline.type === 'object' && current.type !== 'object') ||
        (baseline.type === 'array' && current.type !== 'array') ||
        (baseline.type !== 'object' && current.type === 'object') ||
        (baseline.type !== 'array' && current.type === 'array');

      changes.push({
        fieldPath: displayPath,
        changeType: isStructureChange ? 'STRUCTURE_CHANGED' : 'TYPE_CHANGED',
        severity: 'BREAKING',
        previousType: baseline.type,
        currentType: current.type,
        description: isStructureChange
          ? `Structural contract change at '${displayPath}': expected '${baseline.type}', received '${current.type}'.`
          : `Field '${displayPath}' type changed from '${baseline.type}' to '${current.type}'.`,
        isBreaking: true,
      });
      return;
    }

    // 2. Check Nullability (when null is not permitted by baseline)
    if (baseline.nullable === false && current.nullable === true) {
      changes.push({
        fieldPath: displayPath,
        changeType: 'REQUIRED_FIELD_MISSING',
        severity: 'BREAKING',
        previousType: baseline.type,
        currentType: 'null',
        description: `Field '${displayPath}' is non-nullable in baseline but received null.`,
        isBreaking: true,
      });
    }

    // 3. Object Properties Comparison
    if (baseline.type === 'object' && current.type === 'object') {
      const baselineProps = baseline.properties || {};
      const currentProps = current.properties || {};

      const baselineKeys = Object.keys(baselineProps);
      const currentKeys = Object.keys(currentProps);

      // A. Check for REMOVED fields (Breaking)
      for (const key of baselineKeys) {
        const subPath = path ? `${path}.${key}` : key;
        if (!(key in currentProps)) {
          const isRequired = baseline.required?.includes(key);
          changes.push({
            fieldPath: subPath,
            changeType: isRequired ? 'REQUIRED_FIELD_MISSING' : 'FIELD_REMOVED',
            severity: 'BREAKING',
            previousType: baselineProps[key].type,
            currentType: undefined,
            description: `${isRequired ? 'Required field' : 'Field'} '${subPath}' (type '${baselineProps[key].type}') was removed.`,
            isBreaking: true,
          });
        }
      }

      // B. Check for ADDED fields (Non-breaking INFO)
      for (const key of currentKeys) {
        const subPath = path ? `${path}.${key}` : key;
        if (!(key in baselineProps)) {
          changes.push({
            fieldPath: subPath,
            changeType: 'FIELD_ADDED',
            severity: 'INFO',
            previousType: undefined,
            currentType: currentProps[key].type,
            description: `Field '${subPath}' (type '${currentProps[key].type}') was added.`,
            isBreaking: false,
          });
        }
      }

      // C. Recursively Diff COMMON fields
      for (const key of baselineKeys) {
        if (key in currentProps) {
          const subPath = path ? `${path}.${key}` : key;
          this.diffNodes(subPath, baselineProps[key], currentProps[key], changes);
        }
      }
    }

    // 4. Array Item Type Comparison
    if (baseline.type === 'array' && current.type === 'array') {
      const arrayItemPath = `${path || '(root)'}[]`;

      if (baseline.itemType && current.itemType) {
        // If current array is empty, we don't have new items to violate unless baseline was strict
        if (current.itemType.type === 'any') {
          return;
        }

        if (baseline.itemType.type !== current.itemType.type) {
          changes.push({
            fieldPath: arrayItemPath,
            changeType: 'STRUCTURE_CHANGED',
            severity: 'BREAKING',
            previousType: baseline.itemType.type,
            currentType: current.itemType.type,
            description: `Array element type in '${arrayItemPath}' changed from '${baseline.itemType.type}' to '${current.itemType.type}'.`,
            isBreaking: true,
          });
        } else {
          // Recursively diff array elements
          this.diffNodes(arrayItemPath, baseline.itemType, current.itemType, changes);
        }
      }
    }
  }
}

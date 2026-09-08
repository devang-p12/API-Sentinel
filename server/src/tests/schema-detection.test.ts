/**
 * Phase 5.9: Automated Response Schema Detection Tests
 *
 * Verifies the 10 required test scenarios:
 * 1. HTTP 200 — unchanged response (baseline created, second response unchanged, dynamic values ignored)
 * 2. HTTP 200 — added field (detected as CHANGED, exactly one added field, history created)
 * 3. HTTP 200 — removed field (detected as CHANGED, exactly one removed field)
 * 4. HTTP 200 — field type changed (detected as CHANGED, previousType vs newType)
 * 5. HTTP 200 — nested object change (detected as CHANGED, identifies nested path, e.g. user.profile.phone)
 * 6. HTTP 200 — nested type change (detected as CHANGED, identifies nested path, e.g. user.profile.age)
 * 7. Array structure (identifies array item changes, e.g. users[*].email)
 * 8. Dynamic values / false-positive protection (numeric IDs, names, emails, timestamps, tokens)
 * 9. Multiple schema changes over versions (version increments, ordering, previous vs new)
 * 10. Schema-change alert integration regression (thresholds, deduplication safety, backward compatibility)
 */

import { SchemaDetectionService } from '../services/schema-detection.service';
import {
  SchemaRepository,
  ApiSchemaRecord,
  ApiSchemaChangeRecord,
  CreateSchemaVersionDTO,
  CreateSchemaChangeDTO,
} from '../repositories/schema.repository';
import { AlertEvaluatorService, SchemaChangeAlertContext } from '../services/alert-evaluator.service';
import { pool } from '../config/database';

// Stub database query to prevent unconfigured connection attempts during tests
pool.query = (async () => {
  return { rows: [], rowCount: 0 };
}) as any;

/**
 * In-memory test repository implementing SchemaRepository.
 * Provides deterministic stateful persistence for schema detection testing
 * without external database dependencies or flakiness.
 */
class InMemorySchemaRepository extends SchemaRepository {
  public schemas: ApiSchemaRecord[] = [];
  public changes: ApiSchemaChangeRecord[] = [];
  private schemaIdCounter = 1;
  private changeIdCounter = 1;

  async acquireAdvisoryLock(_apiId: number, _environment: string, _client?: any): Promise<void> {
    // No-op for test environment
  }

  async executeInTransaction<T>(callback: (client: any) => Promise<T>): Promise<T> {
    return await callback({} as any);
  }

  async getLatestSchema(apiId: number, environment: string, _client?: any): Promise<ApiSchemaRecord | null> {
    const matching = this.schemas.filter(
      (s) => s.apiId === apiId && s.environment.toLowerCase() === environment.toLowerCase()
    );
    if (matching.length === 0) return null;
    matching.sort((a, b) => b.version - a.version);
    return matching[0];
  }

  async getSchemaByVersion(apiId: number, environment: string, version: number, _client?: any): Promise<ApiSchemaRecord | null> {
    return (
      this.schemas.find(
        (s) =>
          s.apiId === apiId &&
          s.environment.toLowerCase() === environment.toLowerCase() &&
          s.version === version
      ) || null
    );
  }

  async createSchemaVersion(data: CreateSchemaVersionDTO, _client?: any): Promise<ApiSchemaRecord> {
    const record: ApiSchemaRecord = {
      id: this.schemaIdCounter++,
      apiId: data.apiId,
      environment: data.environment,
      version: data.version,
      isBaseline: data.isBaseline,
      schemaDefinition: data.schemaDefinition,
      sampleResponse: data.sampleResponse ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.schemas.push(record);
    return record;
  }

  async getSchemaHistory(apiId: number, environment: string, limit: number = 50): Promise<ApiSchemaRecord[]> {
    const matching = this.schemas.filter(
      (s) => s.apiId === apiId && s.environment.toLowerCase() === environment.toLowerCase()
    );
    matching.sort((a, b) => b.version - a.version);
    return matching.slice(0, limit);
  }

  async createSchemaChange(data: CreateSchemaChangeDTO, _client?: any): Promise<ApiSchemaChangeRecord> {
    const record: ApiSchemaChangeRecord = {
      id: this.changeIdCounter++,
      apiId: data.apiId,
      environment: data.environment,
      detectedAt: new Date(),
      previousSchema: data.previousSchema,
      newSchema: data.newSchema,
      addedFields: data.addedFields,
      removedFields: data.removedFields,
      changedFieldTypes: data.changedFieldTypes,
      severity: data.severity,
      statusCode: data.statusCode ?? 200,
      isAcknowledged: Boolean(data.isAcknowledged),
    };
    this.changes.push(record);
    return record;
  }

  async getSchemaChanges(apiId: number, environment: string, limit: number = 50, offset: number = 0): Promise<ApiSchemaChangeRecord[]> {
    const matching = this.changes.filter(
      (c) => c.apiId === apiId && c.environment.toLowerCase() === environment.toLowerCase()
    );
    matching.sort((a, b) => b.detectedAt.getTime() - a.detectedAt.getTime() || b.id - a.id);
    return matching.slice(offset, offset + limit);
  }

  async getRecentSchemaChanges(limit: number = 20): Promise<ApiSchemaChangeRecord[]> {
    const sorted = [...this.changes].sort((a, b) => b.detectedAt.getTime() - a.detectedAt.getTime() || b.id - a.id);
    return sorted.slice(0, limit);
  }

  async acknowledgeSchemaChange(id: number): Promise<ApiSchemaChangeRecord | null> {
    const record = this.changes.find((c) => c.id === id);
    if (!record) return null;
    record.isAcknowledged = true;
    return record;
  }
}

async function runTests() {
  console.log('🧪 Starting Phase 5.9 Automated Schema Detection Tests...\n');
  let passedTests = 0;
  let failedTests = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`  ✅ PASS: ${testName}`);
      passedTests++;
    } else {
      console.error(`  ❌ FAIL: ${testName} ${detail ? `(${detail})` : ''}`);
      failedTests++;
    }
  }

  // =========================================================================
  // Scenario 1: HTTP 200 — unchanged response
  // =========================================================================
  console.log('Scenario 1: HTTP 200 — unchanged response (baseline & value invariance)');
  {
    const repo = new InMemorySchemaRepository();
    const service = new SchemaDetectionService(repo);
    const apiId = 101;
    const env = 'production';

    const baselineResponse = {
      id: 1,
      name: 'John',
      email: 'john@example.com',
    };

    const secondResponse = {
      id: 99,
      name: 'Alice',
      email: 'alice@example.com',
    };

    // First response -> creates baseline version 1
    const res1 = await service.detectSchemaChange(apiId, env, baselineResponse, 200);
    assert(res1.status === 'BASELINE_CREATED', 'First response status is BASELINE_CREATED');
    assert(res1.version === 1, 'First response establishes version 1');
    assert(res1.diff === null, 'First response has null diff');
    assert(res1.changeEvent === null, 'First response has null changeEvent');
    assert(repo.schemas.length === 1, 'Repository contains exactly 1 schema record');
    assert(repo.changes.length === 0, 'No change events created for initial baseline');

    // Second response with different dynamic values -> UNCHANGED
    const res2 = await service.detectSchemaChange(apiId, env, secondResponse, 200);
    assert(res2.status === 'UNCHANGED', 'Second response status is UNCHANGED');
    assert(res2.version === 1, 'Schema version remains version 1');
    assert(res2.diff !== null && res2.diff.hasChanges === false, 'Diff reports hasChanges is false');
    assert(res2.changeEvent === null, 'No changeEvent created on unchanged response');
    assert(repo.schemas.length === 1, 'No new schema version created in repository');
    assert(repo.changes.length === 0, 'No schema changes recorded in repository');
  }

  // =========================================================================
  // Scenario 2: HTTP 200 — added field
  // =========================================================================
  console.log('\nScenario 2: HTTP 200 — added field');
  {
    const repo = new InMemorySchemaRepository();
    const service = new SchemaDetectionService(repo);
    const apiId = 102;
    const env = 'production';

    const baselineResponse = {
      id: 1,
      name: 'John',
    };

    const newResponse = {
      id: 2,
      name: 'John',
      email: 'john@example.com',
    };

    await service.detectSchemaChange(apiId, env, baselineResponse, 200);

    const res = await service.detectSchemaChange(apiId, env, newResponse, 200);
    assert(res.status === 'CHANGED', 'Status is CHANGED');
    assert(res.version === 2, 'Version increments to 2');
    assert(res.diff !== null && res.diff.hasChanges === true, 'Diff reports hasChanges is true');
    assert(res.diff?.addedFields.length === 1, 'Exactly 1 field added');
    assert(res.diff?.addedFields.includes('email') === true, 'Added field correctly identifies "email"');
    assert(res.diff?.removedFields.length === 0, 'No removed fields');
    assert(res.diff?.changedFieldTypes.length === 0, 'No changed field types');
    assert(repo.schemas.length === 2, 'New schema version persisted in repository');
    assert(repo.changes.length === 1, 'Schema-change event persisted in repository');
    assert(repo.changes[0].addedFields.includes('email') === true, 'Persisted change record contains "email" in addedFields');
  }

  // =========================================================================
  // Scenario 3: HTTP 200 — removed field
  // =========================================================================
  console.log('\nScenario 3: HTTP 200 — removed field');
  {
    const repo = new InMemorySchemaRepository();
    const service = new SchemaDetectionService(repo);
    const apiId = 103;
    const env = 'production';

    const baselineResponse = {
      id: 1,
      name: 'John',
      email: 'john@example.com',
    };

    const newResponse = {
      id: 2,
      name: 'John',
    };

    await service.detectSchemaChange(apiId, env, baselineResponse, 200);

    const res = await service.detectSchemaChange(apiId, env, newResponse, 200);
    assert(res.status === 'CHANGED', 'Status is CHANGED');
    assert(res.version === 2, 'Version increments to 2');
    assert(res.diff?.removedFields.length === 1, 'Exactly 1 field removed');
    assert(res.diff?.removedFields.includes('email') === true, 'Removed field correctly identifies "email"');
    assert(res.diff?.addedFields.length === 0, 'No added fields');
    assert(res.diff?.changedFieldTypes.length === 0, 'No changed field types');
    assert(repo.changes.length === 1, 'Schema-change event persisted');
    assert(repo.changes[0].removedFields.includes('email') === true, 'Persisted change record contains "email" in removedFields');
  }

  // =========================================================================
  // Scenario 4: HTTP 200 — field type changed
  // =========================================================================
  console.log('\nScenario 4: HTTP 200 — field type changed');
  {
    const repo = new InMemorySchemaRepository();
    const service = new SchemaDetectionService(repo);
    const apiId = 104;
    const env = 'production';

    const baselineResponse = {
      id: 1,
      age: 25,
    };

    const newResponse = {
      id: 2,
      age: '25',
    };

    await service.detectSchemaChange(apiId, env, baselineResponse, 200);

    const res = await service.detectSchemaChange(apiId, env, newResponse, 200);
    assert(res.status === 'CHANGED', 'Status is CHANGED');
    assert(res.diff?.changedFieldTypes.length === 1, 'Exactly 1 changed field type');
    assert(res.diff?.changedFieldTypes[0].path === 'age', 'Changed field path is "age"');
    assert(res.diff?.changedFieldTypes[0].previousType === 'number', 'Previous type was "number"');
    assert(res.diff?.changedFieldTypes[0].newType === 'string', 'New type is "string"');
    assert(res.diff?.addedFields.length === 0, 'No added fields');
    assert(res.diff?.removedFields.length === 0, 'No removed fields');
    assert(repo.changes[0].changedFieldTypes[0].path === 'age', 'Persisted record contains type shift for "age"');
  }

  // =========================================================================
  // Scenario 5: HTTP 200 — nested object change
  // =========================================================================
  console.log('\nScenario 5: HTTP 200 — nested object change');
  {
    const repo = new InMemorySchemaRepository();
    const service = new SchemaDetectionService(repo);
    const apiId = 105;
    const env = 'production';

    const baselineResponse = {
      user: {
        id: 1,
        profile: {
          name: 'John',
        },
      },
    };

    const newResponse = {
      user: {
        id: 2, // Changed dynamic ID must not trigger a change
        profile: {
          name: 'John',
          phone: '1234567890',
        },
      },
    };

    await service.detectSchemaChange(apiId, env, baselineResponse, 200);

    const res = await service.detectSchemaChange(apiId, env, newResponse, 200);
    assert(res.status === 'CHANGED', 'Status is CHANGED');
    assert(res.diff?.addedFields.length === 1, 'Exactly 1 nested field added');
    assert(res.diff?.addedFields.includes('user.profile.phone') === true, 'Added field correctly identifies nested path "user.profile.phone"');
    assert(!res.diff?.addedFields.includes('user.id'), 'user.id is not marked as added');
    assert(res.diff?.removedFields.length === 0, 'No removed fields');
    assert(res.diff?.changedFieldTypes.length === 0, 'No changed field types');
  }

  // =========================================================================
  // Scenario 6: HTTP 200 — nested type change
  // =========================================================================
  console.log('\nScenario 6: HTTP 200 — nested type change');
  {
    const repo = new InMemorySchemaRepository();
    const service = new SchemaDetectionService(repo);
    const apiId = 106;
    const env = 'production';

    const baselineResponse = {
      user: {
        profile: {
          age: 25,
        },
      },
    };

    const newResponse = {
      user: {
        profile: {
          age: '25',
        },
      },
    };

    await service.detectSchemaChange(apiId, env, baselineResponse, 200);

    const res = await service.detectSchemaChange(apiId, env, newResponse, 200);
    assert(res.status === 'CHANGED', 'Status is CHANGED');
    assert(res.diff?.changedFieldTypes.length === 1, 'Exactly 1 changed field type');
    assert(res.diff?.changedFieldTypes[0].path === 'user.profile.age', 'Path correctly identifies "user.profile.age"');
    assert(res.diff?.changedFieldTypes[0].previousType === 'number', 'Previous type was "number"');
    assert(res.diff?.changedFieldTypes[0].newType === 'string', 'New type is "string"');
  }

  // =========================================================================
  // Scenario 7: Array structure
  // =========================================================================
  console.log('\nScenario 7: Array structure');
  {
    const repo = new InMemorySchemaRepository();
    const service = new SchemaDetectionService(repo);
    const apiId = 107;
    const env = 'production';

    const baselineResponse = {
      users: [
        {
          id: 1,
          name: 'John',
        },
      ],
    };

    const newResponse = {
      users: [
        {
          id: 2,
          name: 'Alice',
          email: 'alice@example.com',
        },
      ],
    };

    await service.detectSchemaChange(apiId, env, baselineResponse, 200);

    const res = await service.detectSchemaChange(apiId, env, newResponse, 200);
    assert(res.status === 'CHANGED', 'Status is CHANGED');
    assert(res.diff?.addedFields.length === 1, 'Exactly 1 field added to array items');
    assert(res.diff?.addedFields.includes('users[*].email') === true, 'Added field correctly identifies "users[*].email"');
    assert(res.diff?.removedFields.length === 0, 'No removed fields from array items');
    assert(res.diff?.changedFieldTypes.length === 0, 'No changed types in array items');
  }

  // =========================================================================
  // Scenario 8: Dynamic values / false-positive protection
  // =========================================================================
  console.log('\nScenario 8: Dynamic values / false-positive protection');
  {
    const repo = new InMemorySchemaRepository();
    const service = new SchemaDetectionService(repo);
    const apiId = 108;
    const env = 'production';

    const baselineResponse = {
      id: 100,
      name: 'Alice Smith',
      email: 'test1@corp.com',
      timestamp: '2026-09-08T10:00:00Z',
      token: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
      active: true,
      score: 98.6,
      tags: ['alpha', 'beta'],
      meta: {
        sessionId: 'sess_12345abc',
        requestId: 'req_0001',
      },
    };

    const dynamicValueResponse = {
      id: 9999,
      name: 'Bob Jones',
      email: 'admin@dev.io',
      timestamp: '2026-09-08T18:00:00Z',
      token: 'Bearer dW5pY29ybi1zZWNyZXQtdG9rZW4...',
      active: false,
      score: 12.4,
      tags: ['gamma', 'delta'],
      meta: {
        sessionId: 'sess_99999xyz',
        requestId: 'req_9999',
      },
    };

    // First response creates baseline
    const res1 = await service.detectSchemaChange(apiId, env, baselineResponse, 200);
    assert(res1.status === 'BASELINE_CREATED', 'Baseline established');

    // Second response with completely different dynamic values
    const res2 = await service.detectSchemaChange(apiId, env, dynamicValueResponse, 200);
    assert(res2.status === 'UNCHANGED', 'Dynamic values do NOT trigger schema change');
    assert(res2.diff?.hasChanges === false, 'Diff hasChanges is false');
    assert(res2.changeEvent === null, 'No change event created for dynamic values');
    assert(repo.schemas.length === 1, 'No new version persisted for dynamic values');
    assert(repo.changes.length === 0, 'No changes in repository for dynamic values');
  }

  // =========================================================================
  // Scenario 9: Multiple schema changes over versions
  // =========================================================================
  console.log('\nScenario 9: Multiple schema changes over versions');
  {
    const repo = new InMemorySchemaRepository();
    const service = new SchemaDetectionService(repo);
    const apiId = 109;
    const env = 'production';

    // Version 1: Baseline { id: number, name: string }
    const v1 = await service.detectSchemaChange(apiId, env, { id: 1, name: 'John' }, 200);
    assert(v1.version === 1 && v1.status === 'BASELINE_CREATED', 'Version 1 created as baseline');

    // Version 2: Added field { id: number, name: string, email: string }
    const v2 = await service.detectSchemaChange(apiId, env, { id: 2, name: 'John', email: 'john@example.com' }, 200);
    assert(v2.version === 2 && v2.status === 'CHANGED', 'Version 2 created on added field');
    assert(v2.diff?.addedFields.includes('email') === true, 'Version 2 identifies added email');

    // Version 3: Removed field and type change { id: string } (name and email removed, id changed from number to string)
    const v3 = await service.detectSchemaChange(apiId, env, { id: '3' }, 200);
    assert(v3.version === 3 && v3.status === 'CHANGED', 'Version 3 created on removal and type change');
    assert(v3.diff?.removedFields.includes('name') === true, 'Version 3 identifies removed name');
    assert(v3.diff?.removedFields.includes('email') === true, 'Version 3 identifies removed email');
    assert(v3.diff?.changedFieldTypes.some((c) => c.path === 'id' && c.previousType === 'number' && c.newType === 'string') === true, 'Version 3 identifies id type change');

    // Verify history and version ordering
    const history = await repo.getSchemaHistory(apiId, env, 10);
    assert(history.length === 3, 'History contains all 3 versions');
    assert(history[0].version === 3, 'First in history is version 3');
    assert(history[1].version === 2, 'Second in history is version 2');
    assert(history[2].version === 1, 'Third in history is version 1');

    // Verify change events
    const changeEvents = await repo.getSchemaChanges(apiId, env, 10, 0);
    assert(changeEvents.length === 2, 'Exactly 2 change events recorded (v1->v2 and v2->v3)');
    assert(changeEvents[0].addedFields.length === 0, 'Latest change (v2->v3) has 0 added fields');
    assert(changeEvents[1].addedFields.includes('email') === true, 'Earlier change (v1->v2) has added email');
  }

  // =========================================================================
  // Scenario 10: Schema-change alert integration regression
  // =========================================================================
  console.log('\nScenario 10: Schema-change alert integration regression & deduplication');
  {
    const evaluator = new AlertEvaluatorService();
    let createdIncidentId: number | null = null;
    let incidentDetails: string | null = null;
    let openIncidentState: any = null;
    let incrementCalls = 0;

    const mockRule = {
      id: 501,
      apiId: 110,
      environment: 'production',
      metric: 'SCHEMA_CHANGE',
      operator: 'GREATER_THAN_OR_EQUAL',
      threshold: 1,
      evaluationWindowMins: 0,
      consecutiveFailuresCount: 1,
      severity: 'WARNING',
      cooldownMins: 0,
      lastTriggeredAt: null,
      isEnabled: true,
    };

    (evaluator as any).getActiveSchemaRules = async () => [mockRule];
    (evaluator as any).findOpenIncident = async () => openIncidentState;
    (evaluator as any).createIncident = async (_r: any, details: string) => {
      createdIncidentId = 7001;
      incidentDetails = details;
      openIncidentState = {
        id: 7001,
        failedChecksCount: 1,
        startedAt: new Date(),
        triggerDetails: details,
      };
      return 7001;
    };
    (evaluator as any).incrementIncidentFailedChecks = async () => {
      incrementCalls++;
    };
    (evaluator as any).updateIncidentTriggerDetails = async (_id: number, details: string) => {
      if (openIncidentState) {
        openIncidentState.triggerDetails = details;
      }
    };

    const changeEvent1 = {
      id: 801,
      apiId: 110,
      environment: 'production',
      detectedAt: new Date(),
      previousSchema: { type: 'object' },
      newSchema: { type: 'object' },
      addedFields: ['newField'],
      removedFields: [],
      changedFieldTypes: [],
      severity: 'WARNING' as const,
      statusCode: 200,
      isAcknowledged: false,
    };

    const context1: SchemaChangeAlertContext = {
      apiId: 110,
      environment: 'production',
      changeEvent: changeEvent1,
      previousVersion: 1,
      newVersion: 2,
    };

    // 10a: First evaluation creates incident
    const report1 = await evaluator.evaluateSchemaChangeRules(context1);
    assert(report1.results[0].action === 'INCIDENT_CREATED', 'First evaluation creates incident');
    assert(createdIncidentId === 7001, 'Incident created with ID 7001');
    assert(Boolean((incidentDetails as any)?.includes('"changeId":801')), 'Incident details includes changeId 801');
    assert(Boolean((incidentDetails as any)?.includes('"changeIds":[801]')), 'Incident details includes changeIds array [801]');

    // 10b: Duplicate evaluation of the SAME change event yields NO_ACTION
    const reportDuplicate = await evaluator.evaluateSchemaChangeRules(context1);
    assert(reportDuplicate.results[0].action === 'NO_ACTION', 'Duplicate change evaluation yields NO_ACTION');
    assert(incrementCalls === 0, 'No count increment on duplicate change event');

    // 10c: Second distinct schema change updates existing open incident and appends changeId
    const changeEvent2 = {
      id: 802,
      apiId: 110,
      environment: 'production',
      detectedAt: new Date(),
      previousSchema: { type: 'object' },
      newSchema: { type: 'object' },
      addedFields: ['anotherField'],
      removedFields: [],
      changedFieldTypes: [],
      severity: 'WARNING' as const,
      statusCode: 200,
      isAcknowledged: false,
    };

    const context2: SchemaChangeAlertContext = {
      apiId: 110,
      environment: 'production',
      changeEvent: changeEvent2,
      previousVersion: 2,
      newVersion: 3,
    };

    const reportUpdate = await evaluator.evaluateSchemaChangeRules(context2);
    assert(reportUpdate.results[0].action === 'INCIDENT_UPDATED', 'New distinct change event updates incident');
    assert(openIncidentState.triggerDetails.includes('"changeId":801'), 'Original changeId 801 preserved');
    assert(openIncidentState.triggerDetails.includes('802'), 'New changeId 802 appended to changeIds array');

    // 10d: Evaluating changeEvent2 again is now recognized as duplicate
    const reportDuplicate2 = await evaluator.evaluateSchemaChangeRules(context2);
    assert(reportDuplicate2.results[0].action === 'NO_ACTION', 'Second change event is now deduplicated');
  }

  // =========================================================================
  // Test Summary
  // =========================================================================
  console.log('\n----------------------------------------');
  console.log(`Results: ${passedTests} passed, ${failedTests} failed`);
  console.log('----------------------------------------\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});

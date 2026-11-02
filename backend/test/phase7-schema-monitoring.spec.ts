/**
 * ==============================================================================
 * Phase 7: API Contract and Schema Monitoring Test Suite
 * ==============================================================================
 *
 * Verifies:
 * 1. Initial Baseline Creation (Requirement 1)
 * 2. Compare subsequent responses against baseline (Requirement 2)
 * 3. Schema versions storage and retrieval (Requirement 3)
 * 4. Schema changes storage and tracking (Requirement 4)
 * 5. Change severity classification: INFO, WARNING, BREAKING (Requirement 5)
 * 6. User approval of new contract baseline (Requirement 6)
 * 7. Do not mark HTTP 200 as fully healthy when breaking contract change exists (Requirement 7)
 * 8. Nested JSON structures, deep dot-notation paths, and type mutations (Requirement 8)
 * 9. Array/Object structural shifts (Requirement 8)
 * 10. User's exact example: Previous { id, name, email } -> Current { id, name } => 'email' removed
 * 11. Multi-tenant isolation and end-to-end REST API integration
 */

import { PrismaClient } from '@prisma/client';
import { SchemaNormalizer } from '../src/schema-monitoring/schema-normalizer';
import { SchemaDiffEngine } from '../src/schema-monitoring/schema-diff-engine';
import { SchemaMonitoringService } from '../src/schema-monitoring/schema-monitoring.service';
import { HealthEvaluationService } from '../src/health-evaluation/health-evaluation.service';
import { HealthState } from '../src/health-evaluation/interfaces/health-evaluation.interface';

const prisma = new PrismaClient();
const BASE_URL = process.env.API_URL || 'http://localhost:3001/api/v1';

interface TestResult {
  suite: string;
  name: string;
  passed: boolean;
  error?: string;
}

const testResults: TestResult[] = [];

function recordTest(suite: string, name: string, passed: boolean, error?: string) {
  testResults.push({ suite, name, passed, error });
  const status = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`${status} [${suite}] ${name}`);
  if (error && !passed) {
    console.error(`       Error: ${error}`);
  }
}

async function apiRequest(
  path: string,
  options: {
    method?: string;
    token?: string;
    headers?: Record<string, string>;
    body?: any;
  } = {},
) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  if (options.token) {
    headers['Authorization'] = `Bearer ${options.token}`;
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  let data: any;
  const text = await res.text();
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }

  return { status: res.status, data };
}

async function runTests() {
  console.log('\n======================================================');
  console.log('🚀 RUNNING PHASE 7: API CONTRACT & SCHEMA TEST SUITE');
  console.log('======================================================\n');

  const schemaService = new SchemaMonitoringService(prisma as any);
  const healthService = new HealthEvaluationService(prisma as any);

  // --------------------------------------------------------------------------
  // Suite 1: User's Example Verification (Field Removed)
  // --------------------------------------------------------------------------
  console.log('--- Suite 1: User Example - Field Removed ---');
  {
    const previous = {
      id: 123,
      name: 'John',
      email: 'john@example.com',
    };
    const current = {
      id: 123,
      name: 'John',
    };

    const previousSchema = SchemaNormalizer.extractSchema(previous);
    const currentSchema = SchemaNormalizer.extractSchema(current);
    const diff = SchemaDiffEngine.compare(previousSchema, currentSchema);

    const emailRemovedChange = diff.changes.find(
      (c) => c.fieldPath === 'email' && (c.changeType === 'FIELD_REMOVED' || c.changeType === 'REQUIRED_FIELD_MISSING'),
    );

    recordTest(
      'User Example Removal Detection',
      'Detects email removed from response payload',
      !!emailRemovedChange && emailRemovedChange.previousType === 'string',
      `Changes: ${JSON.stringify(diff.changes)}`,
    );

    recordTest(
      'User Example Breaking Severity',
      'Marks field removal as BREAKING severity',
      !!emailRemovedChange && emailRemovedChange.severity === 'BREAKING' && emailRemovedChange.isBreaking === true,
      `Severity: ${emailRemovedChange?.severity}`,
    );

    recordTest(
      'Overall Breaking Flag',
      'Marks entire comparison result as hasBreakingChanges = true',
      diff.hasBreakingChanges === true && diff.hasChanges === true,
      `hasBreakingChanges: ${diff.hasBreakingChanges}`,
    );
  }

  // --------------------------------------------------------------------------
  // Suite 2: Field Added (Backward-Compatible Extension)
  // --------------------------------------------------------------------------
  console.log('\n--- Suite 2: Field Added (INFO / Non-Breaking) ---');
  {
    const baseline = {
      id: 1,
      name: 'Alice',
    };
    const current = {
      id: 1,
      name: 'Alice',
      role: 'admin',
    };

    const baselineSchema = SchemaNormalizer.extractSchema(baseline);
    const currentSchema = SchemaNormalizer.extractSchema(current);
    const diff = SchemaDiffEngine.compare(baselineSchema, currentSchema);

    const roleAdded = diff.changes.find((c) => c.fieldPath === 'role');

    recordTest(
      'Field Added Detection',
      'Detects newly added field with correct currentType',
      !!roleAdded && roleAdded.changeType === 'FIELD_ADDED' && roleAdded.currentType === 'string',
      `roleAdded: ${JSON.stringify(roleAdded)}`,
    );

    recordTest(
      'Field Added Non-Breaking Severity',
      'Marks added field as INFO severity and isBreaking = false',
      !!roleAdded && roleAdded.severity === 'INFO' && roleAdded.isBreaking === false,
      `Severity: ${roleAdded?.severity}`,
    );

    recordTest(
      'Non-Breaking Summary Flag',
      'Result flags hasChanges = true but hasBreakingChanges = false',
      diff.hasChanges === true && diff.hasBreakingChanges === false,
      `hasBreaking: ${diff.hasBreakingChanges}`,
    );
  }

  // --------------------------------------------------------------------------
  // Suite 3: Field Type Changed
  // --------------------------------------------------------------------------
  console.log('\n--- Suite 3: Field Type Changed ---');
  {
    const baseline = { id: 123, active: true };
    const current = { id: '123', active: true }; // number -> string

    const diff = SchemaDiffEngine.compare(
      SchemaNormalizer.extractSchema(baseline),
      SchemaNormalizer.extractSchema(current),
    );

    const typeChange = diff.changes.find((c) => c.fieldPath === 'id');

    recordTest(
      'Type Mutation Detection',
      'Detects primitive type change from number to string',
      !!typeChange &&
        typeChange.changeType === 'TYPE_CHANGED' &&
        typeChange.previousType === 'number' &&
        typeChange.currentType === 'string',
      `typeChange: ${JSON.stringify(typeChange)}`,
    );

    recordTest(
      'Type Mutation Breaking Severity',
      'Type mutation flagged as BREAKING severity',
      !!typeChange && typeChange.severity === 'BREAKING' && typeChange.isBreaking === true,
      `Severity: ${typeChange?.severity}`,
    );
  }

  // --------------------------------------------------------------------------
  // Suite 4: Nested JSON Structures & Deep Dot-Notation
  // --------------------------------------------------------------------------
  console.log('\n--- Suite 4: Nested JSON Structures ---');
  {
    const baseline = {
      orderId: 'ord-999',
      customer: {
        profile: {
          fullName: 'Jane Doe',
          addresses: [
            {
              street: '100 Market St',
              city: 'San Francisco',
              geo: {
                lat: 37.77,
                lng: -122.41,
              },
            },
          ],
        },
      },
    };

    // Deep removal: customer.profile.addresses[].geo.lat removed
    const currentWithDeepRemoval = {
      orderId: 'ord-999',
      customer: {
        profile: {
          fullName: 'Jane Doe',
          addresses: [
            {
              street: '100 Market St',
              city: 'San Francisco',
              geo: {
                lng: -122.41,
              },
            },
          ],
        },
      },
    };

    const diff1 = SchemaDiffEngine.compare(
      SchemaNormalizer.extractSchema(baseline),
      SchemaNormalizer.extractSchema(currentWithDeepRemoval),
    );

    const latRemoved = diff1.changes.find((c) =>
      c.fieldPath.includes('customer.profile.addresses[].geo.lat'),
    );

    recordTest(
      'Deep Nested Property Removal',
      'Detects nested field removal with dot-notation path',
      !!latRemoved && latRemoved.severity === 'BREAKING',
      `latRemoved: ${JSON.stringify(latRemoved)}`,
    );

    // Deep type mutation: customer.profile.addresses[].geo.lat changed from number to string
    const currentWithDeepTypeMutation = {
      orderId: 'ord-999',
      customer: {
        profile: {
          fullName: 'Jane Doe',
          addresses: [
            {
              street: '100 Market St',
              city: 'San Francisco',
              geo: {
                lat: '37.77',
                lng: -122.41,
              },
            },
          ],
        },
      },
    };

    const diff2 = SchemaDiffEngine.compare(
      SchemaNormalizer.extractSchema(baseline),
      SchemaNormalizer.extractSchema(currentWithDeepTypeMutation),
    );

    const latTypeChange = diff2.changes.find(
      (c) =>
        c.fieldPath.includes('customer.profile.addresses[].geo.lat') &&
        c.changeType === 'TYPE_CHANGED',
    );

    recordTest(
      'Deep Nested Type Mutation',
      'Detects type change inside nested array of objects',
      !!latTypeChange &&
        latTypeChange.previousType === 'number' &&
        latTypeChange.currentType === 'string' &&
        latTypeChange.severity === 'BREAKING',
      `latTypeChange: ${JSON.stringify(latTypeChange)}`,
    );
  }

  // --------------------------------------------------------------------------
  // Suite 5: Array / Object Structural Changes
  // --------------------------------------------------------------------------
  console.log('\n--- Suite 5: Array / Object Structural Changes ---');
  {
    // Object turned into Array
    const baselineObj = {
      data: { id: 1, title: 'Item 1' },
    };
    const currentArray = {
      data: [{ id: 1, title: 'Item 1' }],
    };

    const diffObjToArray = SchemaDiffEngine.compare(
      SchemaNormalizer.extractSchema(baselineObj),
      SchemaNormalizer.extractSchema(currentArray),
    );

    const structureChange = diffObjToArray.changes.find((c) => c.fieldPath === 'data');

    recordTest(
      'Object to Array Structural Shift',
      'Detects object-to-array change as STRUCTURE_CHANGED with BREAKING severity',
      !!structureChange &&
        structureChange.changeType === 'STRUCTURE_CHANGED' &&
        structureChange.severity === 'BREAKING',
      `Change: ${JSON.stringify(structureChange)}`,
    );

    // Array of Objects turned into Array of Primitives
    const baselineObjArray = {
      tags: [{ id: 1, name: 'tech' }],
    };
    const currentPrimitiveArray = {
      tags: ['tech', 'news'],
    };

    const diffArrayItems = SchemaDiffEngine.compare(
      SchemaNormalizer.extractSchema(baselineObjArray),
      SchemaNormalizer.extractSchema(currentPrimitiveArray),
    );

    const itemTypeShift = diffArrayItems.changes.find((c) => c.fieldPath.includes('tags[]'));

    recordTest(
      'Array Item Structure Mutation',
      'Detects mutation of array element schema from object to primitive string',
      !!itemTypeShift && itemTypeShift.severity === 'BREAKING',
      `itemTypeShift: ${JSON.stringify(itemTypeShift)}`,
    );
  }

  // --------------------------------------------------------------------------
  // Suite 6: Required Field Missing / Nullability
  // --------------------------------------------------------------------------
  console.log('\n--- Suite 6: Required Field Nullability ---');
  {
    const baseline = {
      accountId: 'acc-1',
      status: 'ACTIVE', // non-null
    };
    const current = {
      accountId: 'acc-1',
      status: null, // violates non-null requirement
    };

    const diff = SchemaDiffEngine.compare(
      SchemaNormalizer.extractSchema(baseline),
      SchemaNormalizer.extractSchema(current),
    );

    const nullViolation = diff.changes.find((c) => c.fieldPath === 'status');

    recordTest(
      'Required Field Nullability Violation',
      'Detects null in place of non-nullable field as BREAKING change',
      !!nullViolation && nullViolation.severity === 'BREAKING',
      `nullViolation: ${JSON.stringify(nullViolation)}`,
    );
  }

  // --------------------------------------------------------------------------
  // Suite 7: Health Evaluation Integration (Requirement 7)
  // --------------------------------------------------------------------------
  console.log('\n--- Suite 7: Health Evaluation Integration with Contract Monitoring ---');
  {
    const now = Date.now();

    // Check with HTTP 200, low latency, but breaking schema change
    const checkWithBreakingContract = {
      timestamp: new Date(now).toISOString(),
      statusCode: 200,
      latencyMs: 110,
      success: true,
      timeout: false,
      schemaValid: false, // Contract violation!
      hasBreakingSchemaChange: true,
    };

    const healthResult = healthService.evaluate([checkWithBreakingContract]);

    recordTest(
      'Contract Violation Prevents HEALTHY State',
      'HTTP 200 check with breaking schema change must NOT evaluate to HEALTHY',
      healthResult.currentState !== HealthState.HEALTHY,
      `State: ${healthResult.currentState}`,
    );

    recordTest(
      'Contract Violation Marks DEGRADED State',
      'HTTP 200 check with breaking schema change evaluates to DEGRADED',
      healthResult.currentState === HealthState.DEGRADED,
      `State: ${healthResult.currentState}`,
    );

    recordTest(
      'Contract Violation Explanatory Reason',
      'Reason explicitly mentions breaking schema contract change',
      healthResult.reason.toLowerCase().includes('contract') ||
        healthResult.reason.toLowerCase().includes('schema'),
      `Reason: ${healthResult.reason}`,
    );
  }

  // --------------------------------------------------------------------------
  // Suite 8: Service-Level Baseline Lifecycle & Approval (Requirements 1, 2, 3, 4, 6)
  // --------------------------------------------------------------------------
  console.log('\n--- Suite 8: Baseline Lifecycle & Approval ---');
  {
    const timestamp = Date.now();

    // Register user and create API
    const regRes = await apiRequest('/auth/register', {
      method: 'POST',
      body: {
        email: `contract-${timestamp}@sentinel.io`,
        password: 'Password123!',
        firstName: 'Contract',
        lastName: 'Tester',
        organizationName: `Contract-Org-${timestamp}`,
      },
    });
    const token = regRes.data?.accessToken;
    const orgId = regRes.data?.user?.organizationId || regRes.data?.organizationId;

    const apiRes = await apiRequest('/apis', {
      method: 'POST',
      token,
      body: {
        name: `User-Service-${timestamp}`,
        service: 'user-service',
      },
    });
    const apiId = apiRes.data?.id;

    // Step 1: Initial check establishes baseline v1 (Requirement 1)
    const initialPayload = {
      id: 101,
      username: 'johndoe',
      email: 'john@example.com',
    };

    const step1 = await schemaService.processResponse({
      organizationId: orgId,
      apiId,
      endpoint: '/api/v1/users',
      method: 'GET',
      statusCode: 200,
      responseBody: initialPayload,
    });

    recordTest(
      'Initial Baseline Creation',
      'Creates new ApiSchema and sets initial response as active baseline version',
      step1.isNewBaseline === true &&
        step1.hasBreakingChanges === false &&
        typeof step1.schemaId === 'string' &&
        typeof step1.versionId === 'string',
      `schemaId: ${step1.schemaId}, versionId: ${step1.versionId}`,
    );

    // Verify database record
    const schemaDb = await prisma.apiSchema.findUnique({
      where: { id: step1.schemaId },
      include: { versions: true },
    });

    recordTest(
      'Baseline Database Record',
      'Database stores schema with activeBaselineVersionId and isBaseline = true',
      schemaDb !== null &&
        schemaDb.activeBaselineVersionId === step1.versionId &&
        schemaDb.versions.length === 1 &&
        schemaDb.versions[0].isBaseline === true,
      `activeBaseline: ${schemaDb?.activeBaselineVersionId}`,
    );

    // Step 2: Identical response conforms to baseline with zero changes
    const step2 = await schemaService.processResponse({
      organizationId: orgId,
      apiId,
      endpoint: '/api/v1/users',
      method: 'GET',
      statusCode: 200,
      responseBody: {
        id: 102,
        username: 'janedoe',
        email: 'jane@example.com',
      },
    });

    recordTest(
      'Identical Response Conformance',
      'Recognizes identical schema structure without changes',
      step2.hasChanges === false && step2.hasBreakingChanges === false && step2.changeCount === 0,
      `Summary: ${step2.summary}`,
    );

    // Step 3: Response with Breaking Change (email removed)
    const payloadWithEmailRemoved = {
      id: 103,
      username: 'bobsmith',
      // email is missing!
    };

    const step3 = await schemaService.processResponse({
      organizationId: orgId,
      apiId,
      endpoint: '/api/v1/users',
      method: 'GET',
      statusCode: 200,
      responseBody: payloadWithEmailRemoved,
    });

    recordTest(
      'Subsequent Breaking Change Detected',
      'Detects breaking change against active baseline and records new version',
      step3.hasBreakingChanges === true &&
        step3.changes.some((c) => c.fieldPath === 'email') &&
        typeof step3.versionId === 'string',
      `versionId: ${step3.versionId}, summary: ${step3.summary}`,
    );

    // Verify stored SchemaChange records in PostgreSQL
    const changesDb = await prisma.schemaChange.findMany({
      where: { schemaId: step1.schemaId },
    });

    recordTest(
      'PostgreSQL SchemaChange Persistence',
      'Stores detected schema changes in database table schema_changes',
      changesDb.length >= 1 && changesDb.some((c) => c.fieldPath === 'email' && c.isBreaking),
      `Stored changes count: ${changesDb.length}`,
    );

    // Step 4: User Approves New Baseline (Requirement 6)
    const approved = await schemaService.approveNewBaseline(
      step1.schemaId,
      step3.versionId!,
      orgId,
    );

    recordTest(
      'Approve New Baseline',
      'Sets version 2 as the new active baseline',
      approved.id === step3.versionId && approved.isBaseline === true,
      `Approved Version ID: ${approved.id}`,
    );

    // Step 5: Verify subsequent check with the new schema is now completely healthy against approved baseline
    const step5 = await schemaService.processResponse({
      organizationId: orgId,
      apiId,
      endpoint: '/api/v1/users',
      method: 'GET',
      statusCode: 200,
      responseBody: {
        id: 104,
        username: 'alice',
      },
    });

    recordTest(
      'Conformance to Approved New Baseline',
      'Payload matching newly approved baseline now conforms with 0 changes',
      step5.hasChanges === false && step5.hasBreakingChanges === false,
      `Summary: ${step5.summary}`,
    );

    // ------------------------------------------------------------------------
    // Suite 9: End-to-End REST Controller & Multi-Tenant Isolation
    // ------------------------------------------------------------------------
    console.log('\n--- Suite 9: End-to-End REST Endpoints & Tenant Isolation ---');

    // 1. GET /api/v1/apis/:id/schemas
    const getSchemasRes = await apiRequest(`/apis/${apiId}/schemas`, {
      method: 'GET',
      token,
    });

    recordTest(
      'GET /apis/:id/schemas Endpoint',
      'Returns 200 OK with list of API schemas',
      getSchemasRes.status === 200 &&
        Array.isArray(getSchemasRes.data) &&
        getSchemasRes.data.length >= 1,
      `Status: ${getSchemasRes.status}, count: ${getSchemasRes.data?.length}`,
    );

    // 2. GET /api/v1/schemas/:id
    const getSchemaRes = await apiRequest(`/schemas/${step1.schemaId}`, {
      method: 'GET',
      token,
    });

    recordTest(
      'GET /schemas/:id Endpoint',
      'Returns 200 OK with schema details, versions, and changes',
      getSchemaRes.status === 200 &&
        getSchemaRes.data?.id === step1.schemaId &&
        Array.isArray(getSchemaRes.data?.versions),
      `Status: ${getSchemaRes.status}`,
    );

    // 3. GET /api/v1/schemas/:id/changes
    const getChangesRes = await apiRequest(`/schemas/${step1.schemaId}/changes`, {
      method: 'GET',
      token,
    });

    recordTest(
      'GET /schemas/:id/changes Endpoint',
      'Returns 200 OK with list of recorded schema changes',
      getChangesRes.status === 200 && Array.isArray(getChangesRes.data),
      `Status: ${getChangesRes.status}, changes: ${getChangesRes.data?.length}`,
    );

    // 4. POST /api/v1/apis/:id/schemas/check
    const checkRes = await apiRequest(`/apis/${apiId}/schemas/check`, {
      method: 'POST',
      token,
      body: {
        endpoint: '/api/v1/products',
        method: 'GET',
        responseBody: { sku: 'PROD-1', price: 99.99 },
      },
    });

    recordTest(
      'POST /apis/:id/schemas/check Endpoint',
      'Allows dynamic on-demand contract evaluation via REST API',
      checkRes.status === 201 || checkRes.status === 200,
      `Status: ${checkRes.status}, isNewBaseline: ${checkRes.data?.isNewBaseline}`,
    );

    // 5. Multi-Tenant Protection
    const org2Reg = await apiRequest('/auth/register', {
      method: 'POST',
      body: {
        email: `intruder-schema-${timestamp}@sentinel.io`,
        password: 'Password123!',
        firstName: 'Intruder',
        lastName: 'Tenant',
        organizationName: `Intruder-Org-${timestamp}`,
      },
    });
    const org2Token = org2Reg.data?.accessToken;

    const intruderGetRes = await apiRequest(`/schemas/${step1.schemaId}`, {
      method: 'GET',
      token: org2Token,
    });

    recordTest(
      'Cross-Tenant Schema Protection',
      'Tenant B cannot access Tenant A schema (returns 404 Not Found)',
      intruderGetRes.status === 404,
      `Status: ${intruderGetRes.status}`,
    );
  }

  // --------------------------------------------------------------------------
  // Summary
  // --------------------------------------------------------------------------
  console.log('\n======================================================');
  console.log('📊 PHASE 7 TEST RESULTS SUMMARY');
  console.log('======================================================');
  const passed = testResults.filter((t) => t.passed).length;
  const failed = testResults.filter((t) => !t.passed).length;
  const total = testResults.length;

  console.log(`Total Tests:  ${total}`);
  console.log(`Passed:       ${passed} ✅`);
  console.log(`Failed:       ${failed} ❌`);
  console.log(`Success Rate: ${((passed / total) * 100).toFixed(1)}%`);

  if (failed > 0) {
    console.error('\n❌ FAILED TESTS:');
    testResults
      .filter((t) => !t.passed)
      .forEach((t) => console.error(` - [${t.suite}] ${t.name}: ${t.error}`));
    process.exit(1);
  } else {
    console.log('\n✨ ALL PHASE 7 API CONTRACT & SCHEMA TESTS PASSED CLEANLY!\n');
    process.exit(0);
  }
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});

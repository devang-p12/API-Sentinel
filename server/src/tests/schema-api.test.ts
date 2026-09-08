/**
 * Phase 5.7: Schema Detection REST API Tests
 *
 * Verifies the 8 required test scenarios:
 * 1. Valid environment returns current schema
 * 2. Missing schema returns 404
 * 3. History returns versions in newest-first order
 * 4. Changes returns newest-first changes
 * 5. Recent changes respects minutes cutoff window
 * 6. Invalid limit/offset/minutes return 400
 * 7. Acknowledge endpoint works (and 404 when missing)
 * 8. Invalid apiId/changeId returns 400
 */

import express from 'express';
import { SchemaController } from '../controllers/schema.controller';
import { SchemaRepository, ApiSchemaRecord, ApiSchemaChangeRecord } from '../repositories/schema.repository';
import schemaRoutes from '../routes/schema.routes';

function createMockRes() {
  const res: any = {
    statusCode: 200,
    body: null,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(data: any) {
      this.body = data;
      return this;
    },
  };
  return res;
}

async function runTests() {
  console.log('🧪 Starting Phase 5.7 Schema Detection REST API Tests...\n');
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

  // Sample data factories
  const sampleSchemaRecord: ApiSchemaRecord = {
    id: 1,
    apiId: 10,
    environment: 'production',
    version: 3,
    isBaseline: false,
    schemaDefinition: { type: 'object', properties: { id: { type: 'number' }, name: { type: 'string' } } },
    sampleResponse: { id: 1, name: 'Alice' },
    createdAt: new Date('2026-09-08T10:00:00Z'),
    updatedAt: new Date('2026-09-08T10:00:00Z'),
  };

  const sampleChangeRecord: ApiSchemaChangeRecord = {
    id: 101,
    apiId: 10,
    environment: 'production',
    detectedAt: new Date(Date.now() - 10 * 60 * 1000), // 10 minutes ago
    previousSchema: { type: 'object', properties: { id: { type: 'number' } } },
    newSchema: { type: 'object', properties: { id: { type: 'number' }, name: { type: 'string' } } },
    addedFields: ['name'],
    removedFields: [],
    changedFieldTypes: [],
    severity: 'WARNING',
    statusCode: 200,
    isAcknowledged: false,
  };

  // =========================================================================
  // Test 1: GET /api/schemas/:apiId - Valid environment returns current schema
  // =========================================================================
  console.log('Test 1: Valid environment returns current schema');
  {
    const mockRepo = new SchemaRepository();
    mockRepo.getLatestSchema = async (apiId: number, env: string) => {
      if (apiId === 10 && env === 'production') return sampleSchemaRecord;
      return null;
    };

    const controller = new SchemaController(mockRepo);
    const req: any = { params: { apiId: '10' }, query: { environment: 'production' } };
    const res = createMockRes();

    await controller.getCurrentSchema(req, res, () => {});

    assert(res.statusCode === 200, 'Returns HTTP 200');
    assert(res.body.success === true, 'Response body success is true');
    assert(res.body.data.apiId === 10, 'Response contains correct apiId');
    assert(res.body.data.environment === 'production', 'Response contains correct environment');
    assert(res.body.data.version === 3, 'Response contains correct version');
    assert(res.body.data.isBaseline === false, 'Response contains correct isBaseline flag');
    assert(res.body.data.schemaDefinition?.type === 'object', 'Response contains schemaDefinition');
    assert(res.body.data.sampleResponse?.name === 'Alice', 'Response contains sampleResponse');
    assert(res.body.data.createdAt !== undefined, 'Response contains createdAt');
    assert(res.body.data.updatedAt !== undefined, 'Response contains updatedAt');
  }

  // =========================================================================
  // Test 2: GET /api/schemas/:apiId - Missing schema returns 404
  // =========================================================================
  console.log('\nTest 2: Missing schema returns 404');
  {
    const mockRepo = new SchemaRepository();
    mockRepo.getLatestSchema = async () => null;

    const controller = new SchemaController(mockRepo);
    const req: any = { params: { apiId: '999' }, query: { environment: 'staging' } };
    const res = createMockRes();

    await controller.getCurrentSchema(req, res, () => {});

    assert(res.statusCode === 404, 'Returns HTTP 404 when no schema exists');
    assert(res.body.success === false, 'Response success is false');
    assert(res.body.error?.code === 'NOT_FOUND', 'Error code is NOT_FOUND');
  }

  // =========================================================================
  // Test 3: GET /api/schemas/:apiId/history - History returns versions in newest-first order
  // =========================================================================
  console.log('\nTest 3: History returns versions in newest-first order');
  {
    const mockRepo = new SchemaRepository();
    const historyList: ApiSchemaRecord[] = [
      { ...sampleSchemaRecord, version: 3, createdAt: new Date('2026-09-08T12:00:00Z') },
      { ...sampleSchemaRecord, version: 2, createdAt: new Date('2026-09-08T11:00:00Z') },
      { ...sampleSchemaRecord, version: 1, isBaseline: true, createdAt: new Date('2026-09-08T10:00:00Z') },
    ];
    mockRepo.getSchemaHistory = async (apiId: number, env: string, limit: number) => {
      return historyList.slice(0, limit);
    };

    const controller = new SchemaController(mockRepo);
    const req: any = { params: { apiId: '10' }, query: { environment: 'production', limit: '10' } };
    const res = createMockRes();

    await controller.getHistory(req, res, () => {});

    assert(res.statusCode === 200, 'Returns HTTP 200');
    assert(Array.isArray(res.body.data), 'Returns data array');
    assert(res.body.data.length === 3, 'Returns all 3 versions');
    assert(res.body.data[0].version === 3, 'First element is newest version 3');
    assert(res.body.data[1].version === 2, 'Second element is version 2');
    assert(res.body.data[2].version === 1, 'Third element is version 1');
    assert(res.body.data[2].isBaseline === true, 'Baseline version properly indicated');
    assert(res.body.data[0].schemaDefinition !== undefined, 'Contains schemaDefinition');
    assert(res.body.data[0].createdAt !== undefined, 'Contains createdAt');
    assert(res.body.data[0].updatedAt !== undefined, 'Contains updatedAt');
  }

  // =========================================================================
  // Test 4: GET /api/schemas/:apiId/changes - Changes returns newest-first changes
  // =========================================================================
  console.log('\nTest 4: Changes returns newest-first changes');
  {
    const mockRepo = new SchemaRepository();
    const changesList: ApiSchemaChangeRecord[] = [
      { ...sampleChangeRecord, id: 102, detectedAt: new Date('2026-09-08T12:00:00Z') },
      { ...sampleChangeRecord, id: 101, detectedAt: new Date('2026-09-08T11:00:00Z') },
    ];
    mockRepo.getSchemaChanges = async (_apiId: number, _env: string, limit: number, offset: number) => {
      return changesList.slice(offset, offset + limit);
    };

    const controller = new SchemaController(mockRepo);
    const req: any = { params: { apiId: '10' }, query: { environment: 'production', limit: '50', offset: '0' } };
    const res = createMockRes();

    await controller.getChanges(req, res, () => {});

    assert(res.statusCode === 200, 'Returns HTTP 200');
    assert(Array.isArray(res.body.data), 'Returns data array');
    assert(res.body.data.length === 2, 'Returns 2 changes');
    assert(res.body.data[0].id === 102, 'Newest change is first');
    assert(res.body.data[0].addedFields.includes('name'), 'Contains addedFields');
    assert(res.body.data[0].severity === 'WARNING', 'Contains severity');
    assert(res.body.data[0].statusCode === 200, 'Contains statusCode');
    assert(res.body.data[0].isAcknowledged === false, 'Contains isAcknowledged');
  }

  // =========================================================================
  // Test 5: GET /api/schemas/:apiId/changes/recent - Respects minutes cutoff window
  // =========================================================================
  console.log('\nTest 5: Recent changes respects minutes cutoff window');
  {
    const mockRepo = new SchemaRepository();
    const now = Date.now();
    const recentList: ApiSchemaChangeRecord[] = [
      { ...sampleChangeRecord, id: 201, apiId: 10, environment: 'production', detectedAt: new Date(now - 15 * 60 * 1000) }, // 15 mins ago
      { ...sampleChangeRecord, id: 202, apiId: 10, environment: 'production', detectedAt: new Date(now - 45 * 60 * 1000) }, // 45 mins ago
      { ...sampleChangeRecord, id: 203, apiId: 10, environment: 'production', detectedAt: new Date(now - 90 * 60 * 1000) }, // 90 mins ago (older than 60m)
      { ...sampleChangeRecord, id: 204, apiId: 99, environment: 'production', detectedAt: new Date(now - 5 * 60 * 1000) },  // Different API
      { ...sampleChangeRecord, id: 205, apiId: 10, environment: 'staging', detectedAt: new Date(now - 5 * 60 * 1000) },     // Different environment
    ];
    mockRepo.getRecentSchemaChanges = async () => recentList;

    const controller = new SchemaController(mockRepo);

    // Case 5a: Default 60 minutes window
    {
      const req: any = { params: { apiId: '10' }, query: { environment: 'production', minutes: '60' } };
      const res = createMockRes();
      await controller.getRecentChanges(req, res, () => {});

      assert(res.statusCode === 200, 'Returns HTTP 200 for 60-minute window');
      assert(res.body.data.length === 2, 'Filters to exactly the 2 changes within 60 minutes for API 10 in production');
      assert(res.body.data.some((c: any) => c.id === 201), 'Includes 15-minute-old change');
      assert(res.body.data.some((c: any) => c.id === 202), 'Includes 45-minute-old change');
      assert(!res.body.data.some((c: any) => c.id === 203), 'Excludes 90-minute-old change');
      assert(!res.body.data.some((c: any) => c.id === 204), 'Excludes change from different API');
      assert(!res.body.data.some((c: any) => c.id === 205), 'Excludes change from different environment');
    }

    // Case 5b: 30 minutes window
    {
      const req: any = { params: { apiId: '10' }, query: { environment: 'production', minutes: '30' } };
      const res = createMockRes();
      await controller.getRecentChanges(req, res, () => {});

      assert(res.body.data.length === 1, 'Filters to exactly 1 change within 30 minutes');
      assert(res.body.data[0].id === 201, 'Includes only change 201 (15 mins ago)');
    }
  }

  // =========================================================================
  // Test 6: Invalid limit/offset/minutes return 400
  // =========================================================================
  console.log('\nTest 6: Invalid limit/offset/minutes return 400');
  {
    const controller = new SchemaController(new SchemaRepository());

    // 6a: Limit > 100
    {
      const req: any = { params: { apiId: '10' }, query: { environment: 'production', limit: '101' } };
      const res = createMockRes();
      await controller.getChanges(req, res, () => {});
      assert(res.statusCode === 400, 'Limit > 100 returns 400');
      assert(res.body.error?.code === 'VALIDATION_ERROR', 'Error code is VALIDATION_ERROR');
    }

    // 6b: Limit < 1
    {
      const req: any = { params: { apiId: '10' }, query: { environment: 'production', limit: '0' } };
      const res = createMockRes();
      await controller.getChanges(req, res, () => {});
      assert(res.statusCode === 400, 'Limit < 1 returns 400');
    }

    // 6c: Negative offset
    {
      const req: any = { params: { apiId: '10' }, query: { environment: 'production', offset: '-5' } };
      const res = createMockRes();
      await controller.getChanges(req, res, () => {});
      assert(res.statusCode === 400, 'Negative offset returns 400');
    }

    // 6d: Minutes > 1440
    {
      const req: any = { params: { apiId: '10' }, query: { environment: 'production', minutes: '1441' } };
      const res = createMockRes();
      await controller.getRecentChanges(req, res, () => {});
      assert(res.statusCode === 400, 'Minutes > 1440 returns 400');
    }

    // 6e: Minutes < 1
    {
      const req: any = { params: { apiId: '10' }, query: { environment: 'production', minutes: '0' } };
      const res = createMockRes();
      await controller.getRecentChanges(req, res, () => {});
      assert(res.statusCode === 400, 'Minutes < 1 returns 400');
    }

    // 6f: Missing environment
    {
      const req: any = { params: { apiId: '10' }, query: {} };
      const res = createMockRes();
      await controller.getCurrentSchema(req, res, () => {});
      assert(res.statusCode === 400, 'Missing environment returns 400');
    }

    // 6g: Empty string environment
    {
      const req: any = { params: { apiId: '10' }, query: { environment: '   ' } };
      const res = createMockRes();
      await controller.getCurrentSchema(req, res, () => {});
      assert(res.statusCode === 400, 'Whitespace environment returns 400');
    }
  }

  // =========================================================================
  // Test 7: Acknowledge endpoint works (and 404 when missing)
  // =========================================================================
  console.log('\nTest 7: Acknowledge endpoint works and returns 404 when missing');
  {
    const mockRepo = new SchemaRepository();
    mockRepo.acknowledgeSchemaChange = async (id: number) => {
      if (id === 101) {
        return { ...sampleChangeRecord, id: 101, isAcknowledged: true };
      }
      return null;
    };

    const controller = new SchemaController(mockRepo);

    // 7a: Existing change acknowledged
    {
      const req: any = { params: { changeId: '101' } };
      const res = createMockRes();
      await controller.acknowledgeChange(req, res, () => {});

      assert(res.statusCode === 200, 'Returns HTTP 200 on successful acknowledgment');
      assert(res.body.success === true, 'Success is true');
      assert(res.body.data.isAcknowledged === true, 'isAcknowledged flag is true');
      assert(res.body.data.id === 101, 'Returns updated change record');
    }

    // 7b: Non-existent change returns 404
    {
      const req: any = { params: { changeId: '9999' } };
      const res = createMockRes();
      await controller.acknowledgeChange(req, res, () => {});

      assert(res.statusCode === 404, 'Returns HTTP 404 for missing change ID');
      assert(res.body.error?.code === 'NOT_FOUND', 'Error code is NOT_FOUND');
    }
  }

  // =========================================================================
  // Test 8: Invalid apiId/changeId returns 400
  // =========================================================================
  console.log('\nTest 8: Invalid apiId and changeId return 400');
  {
    const controller = new SchemaController(new SchemaRepository());

    // 8a: Non-numeric apiId
    {
      const req: any = { params: { apiId: 'not-a-number' }, query: { environment: 'production' } };
      const res = createMockRes();
      await controller.getCurrentSchema(req, res, () => {});
      assert(res.statusCode === 400, 'Non-numeric apiId returns 400');
      assert(res.body.error?.code === 'VALIDATION_ERROR', 'Error code is VALIDATION_ERROR');
    }

    // 8b: Negative apiId
    {
      const req: any = { params: { apiId: '-10' }, query: { environment: 'production' } };
      const res = createMockRes();
      await controller.getCurrentSchema(req, res, () => {});
      assert(res.statusCode === 400, 'Negative apiId returns 400');
    }

    // 8c: Zero apiId
    {
      const req: any = { params: { apiId: '0' }, query: { environment: 'production' } };
      const res = createMockRes();
      await controller.getCurrentSchema(req, res, () => {});
      assert(res.statusCode === 400, 'Zero apiId returns 400');
    }

    // 8d: Floating-point apiId
    {
      const req: any = { params: { apiId: '3.14' }, query: { environment: 'production' } };
      const res = createMockRes();
      await controller.getCurrentSchema(req, res, () => {});
      assert(res.statusCode === 400, 'Floating-point apiId returns 400');
    }

    // 8e: Non-numeric changeId
    {
      const req: any = { params: { changeId: 'abc' } };
      const res = createMockRes();
      await controller.acknowledgeChange(req, res, () => {});
      assert(res.statusCode === 400, 'Non-numeric changeId returns 400');
    }

    // 8f: Negative changeId
    {
      const req: any = { params: { changeId: '-5' } };
      const res = createMockRes();
      await controller.acknowledgeChange(req, res, () => {});
      assert(res.statusCode === 400, 'Negative changeId returns 400');
    }
  }

  // =========================================================================
  // Test 9: Router Route Mounting Structure Verification
  // =========================================================================
  console.log('\nTest 9: Verify Express Router Mounting Structure');
  {
    const app = express();
    app.use(express.json());
    app.use('/api/schemas', schemaRoutes);

    // Inspect stack of mounted routes
    const routes: { method: string; path: string }[] = [];
    schemaRoutes.stack.forEach((layer: any) => {
      if (layer.route) {
        const methods = Object.keys(layer.route.methods).map((m) => m.toUpperCase());
        routes.push({ method: methods.join(','), path: layer.route.path });
      }
    });

    assert(routes.some((r) => r.method === 'PATCH' && r.path === '/changes/:changeId/acknowledge'), 'PATCH /changes/:changeId/acknowledge is mounted');
    assert(routes.some((r) => r.method === 'GET' && r.path === '/:apiId/changes/recent'), 'GET /:apiId/changes/recent is mounted');
    assert(routes.some((r) => r.method === 'GET' && r.path === '/:apiId/changes'), 'GET /:apiId/changes is mounted');
    assert(routes.some((r) => r.method === 'GET' && r.path === '/:apiId/history'), 'GET /:apiId/history is mounted');
    assert(routes.some((r) => r.method === 'GET' && r.path === '/:apiId'), 'GET /:apiId is mounted');

    // Verify ordering: /:apiId/changes/recent must appear BEFORE /:apiId/changes
    const recentIndex = routes.findIndex((r) => r.path === '/:apiId/changes/recent');
    const changesIndex = routes.findIndex((r) => r.path === '/:apiId/changes');
    assert(recentIndex !== -1 && changesIndex !== -1 && recentIndex < changesIndex, '/:apiId/changes/recent is registered BEFORE /:apiId/changes');
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

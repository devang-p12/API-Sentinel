/**
 * Phase 5.6: Schema Change Alerting Integration Tests
 *
 * Tests the 5 key scenarios required by Phase 5.6:
 * A. No SCHEMA_CHANGE rule: schema change occurs, no incident created
 * B. SCHEMA_CHANGE rule threshold >= 1: one field added, incident created
 * C. Threshold >= 3: 1-2 differences -> no incident; 3+ differences -> incident created
 * D. Duplicate polling: same change event evaluated repeatedly -> single incident only
 * E. Existing alert regression: existing alert metrics remain unchanged
 */

import { AlertEvaluatorService, SchemaChangeAlertContext } from '../services/alert-evaluator.service';
import { SUPPORTED_METRICS, createAlertRuleSchema } from '../validators/alert-rules.validator';

async function runTests() {
  console.log('🧪 Starting Phase 5.6 Schema-Change Alerting Tests...\n');
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
  // Test A: No SCHEMA_CHANGE rule configured
  // =========================================================================
  console.log('Test Scenario A: No SCHEMA_CHANGE rule configured');
  {
    const evaluator = new AlertEvaluatorService();
    let incidentCreated = false;

    // Mock getActiveSchemaRules to return empty array (user has not configured a schema rule)
    (evaluator as any).getActiveSchemaRules = async () => [];
    (evaluator as any).createIncident = async () => {
      incidentCreated = true;
      return 1;
    };

    const context: SchemaChangeAlertContext = {
      apiId: 10,
      environment: 'production',
      changeEvent: {
        id: 101,
        apiId: 10,
        environment: 'production',
        detectedAt: new Date(),
        previousSchema: { type: 'object', properties: { id: { type: 'number' } } },
        newSchema: { type: 'object', properties: { id: { type: 'number' }, name: { type: 'string' } } },
        addedFields: ['name'],
        removedFields: [],
        changedFieldTypes: [],
        severity: 'WARNING',
        statusCode: 200,
        isAcknowledged: false,
      },
      previousVersion: 1,
      newVersion: 2,
    };

    const report = await evaluator.evaluateSchemaChangeRules(context);

    assert(report.rulesEvaluated === 0, 'Report indicates 0 rules evaluated');
    assert(report.results.length === 0, 'No rule evaluation results generated');
    assert(!incidentCreated, 'No incident is created when no SCHEMA_CHANGE rule exists');
  }

  // =========================================================================
  // Test B: SCHEMA_CHANGE rule with threshold >= 1 (1 field added -> incident created)
  // =========================================================================
  console.log('\nTest Scenario B: SCHEMA_CHANGE rule with threshold >= 1');
  {
    const evaluator = new AlertEvaluatorService();
    let createdIncidentRule: any = null;
    let createdIncidentDetails: any = null;

    (evaluator as any).getActiveSchemaRules = async () => [
      {
        id: 42,
        apiId: 10,
        environment: 'production',
        metric: 'SCHEMA_CHANGE',
        operator: 'GREATER_THAN_OR_EQUAL',
        threshold: 1,
        evaluationWindowMins: 0,
        consecutiveFailuresCount: 1,
        severity: 'CRITICAL',
        cooldownMins: 0,
        lastTriggeredAt: null,
        isEnabled: true,
      },
    ];

    (evaluator as any).findOpenIncident = async () => null;

    (evaluator as any).createIncident = async (rule: any, details: string) => {
      createdIncidentRule = rule;
      createdIncidentDetails = details;
      return 777; // Newly created incident ID
    };

    const context: SchemaChangeAlertContext = {
      apiId: 10,
      environment: 'production',
      changeEvent: {
        id: 202,
        apiId: 10,
        environment: 'production',
        detectedAt: new Date(),
        previousSchema: { type: 'object' },
        newSchema: { type: 'object' },
        addedFields: ['email'],
        removedFields: [],
        changedFieldTypes: [],
        severity: 'WARNING',
        statusCode: 200,
        isAcknowledged: false,
      },
      previousVersion: 1,
      newVersion: 2,
    };

    const report = await evaluator.evaluateSchemaChangeRules(context);

    assert(report.results.length === 1, 'Exactly one rule evaluated');
    assert(report.results[0].action === 'INCIDENT_CREATED', 'Action is INCIDENT_CREATED');
    assert(report.results[0].incidentId === 777, 'Report references newly created incident ID');
    assert(createdIncidentRule?.severity === 'CRITICAL', 'Incident respects rule severity (CRITICAL)');
    assert(
      createdIncidentDetails?.includes('"changeId":202') === true,
      'Trigger details includes changeId 202'
    );
    assert(
      createdIncidentDetails?.includes('"totalChanges":1') === true,
      'Trigger details includes totalChanges = 1'
    );
  }

  // =========================================================================
  // Test C: Threshold >= 3 (1-2 differences -> no incident; 3+ differences -> incident created)
  // =========================================================================
  console.log('\nTest Scenario C: Threshold >= 3 semantics');
  {
    const evaluator = new AlertEvaluatorService();
    let incidentCreated = false;

    (evaluator as any).getActiveSchemaRules = async () => [
      {
        id: 43,
        apiId: 10,
        environment: 'production',
        metric: 'SCHEMA_CHANGE',
        operator: 'GREATER_THAN_OR_EQUAL',
        threshold: 3,
        evaluationWindowMins: 0,
        consecutiveFailuresCount: 1,
        severity: 'WARNING',
        cooldownMins: 0,
        lastTriggeredAt: null,
        isEnabled: true,
      },
    ];
    (evaluator as any).findOpenIncident = async () => null;
    (evaluator as any).createIncident = async () => {
      incidentCreated = true;
      return 888;
    };

    // Subcase C1: Only 2 differences (1 added, 1 removed)
    const contextMinor: SchemaChangeAlertContext = {
      apiId: 10,
      environment: 'production',
      changeEvent: {
        id: 301,
        apiId: 10,
        environment: 'production',
        detectedAt: new Date(),
        previousSchema: { type: 'object' },
        newSchema: { type: 'object' },
        addedFields: ['newField'],
        removedFields: ['oldField'],
        changedFieldTypes: [],
        severity: 'WARNING',
        statusCode: 200,
        isAcknowledged: false,
      },
      previousVersion: 1,
      newVersion: 2,
    };

    const reportMinor = await evaluator.evaluateSchemaChangeRules(contextMinor);
    assert(reportMinor.results[0].action === 'NO_ACTION', 'Action is NO_ACTION when differences (2) < threshold (3)');
    assert(!incidentCreated, 'No incident created for 2 differences when threshold is 3');

    // Subcase C2: 3 differences (2 added, 1 removed)
    const contextThresholdMet: SchemaChangeAlertContext = {
      apiId: 10,
      environment: 'production',
      changeEvent: {
        id: 302,
        apiId: 10,
        environment: 'production',
        detectedAt: new Date(),
        previousSchema: { type: 'object' },
        newSchema: { type: 'object' },
        addedFields: ['field1', 'field2'],
        removedFields: ['oldField'],
        changedFieldTypes: [],
        severity: 'WARNING',
        statusCode: 200,
        isAcknowledged: false,
      },
      previousVersion: 2,
      newVersion: 3,
    };

    const reportMajor = await evaluator.evaluateSchemaChangeRules(contextThresholdMet);
    assert(reportMajor.results[0].action === 'INCIDENT_CREATED', 'Action is INCIDENT_CREATED when differences (3) >= threshold (3)');
    assert(incidentCreated, 'Incident created when threshold 3 is met');
  }

  // =========================================================================
  // Test D: Duplicate polling (same schema change event evaluated repeatedly)
  // =========================================================================
  console.log('\nTest Scenario D: Duplicate polling safety');
  {
    const evaluator = new AlertEvaluatorService();
    let createIncidentCalls = 0;
    let incrementCalls = 0;

    const changeEvent = {
      id: 404,
      apiId: 10,
      environment: 'production',
      detectedAt: new Date(),
      previousSchema: { type: 'object' },
      newSchema: { type: 'object' },
      addedFields: ['f1'],
      removedFields: [],
      changedFieldTypes: [],
      severity: 'WARNING',
      statusCode: 200,
      isAcknowledged: false,
    };

    const rule = {
      id: 44,
      apiId: 10,
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

    (evaluator as any).getActiveSchemaRules = async () => [rule];

    let openIncidentState: any = null;

    (evaluator as any).findOpenIncident = async () => openIncidentState;

    (evaluator as any).createIncident = async (_r: any, details: string) => {
      createIncidentCalls++;
      openIncidentState = {
        id: 999,
        failedChecksCount: 1,
        startedAt: new Date(),
        triggerDetails: details,
      };
      return 999;
    };

    (evaluator as any).incrementIncidentFailedChecks = async () => {
      incrementCalls++;
    };

    const context: SchemaChangeAlertContext = {
      apiId: 10,
      environment: 'production',
      changeEvent,
      previousVersion: 1,
      newVersion: 2,
    };

    // First evaluation: creates incident
    const report1 = await evaluator.evaluateSchemaChangeRules(context);
    assert(report1.results[0].action === 'INCIDENT_CREATED', 'First evaluation creates incident');
    assert(createIncidentCalls === 1, 'createIncident called exactly once');

    // Second evaluation with the SAME change event: must NOT create another incident or increment
    const report2 = await evaluator.evaluateSchemaChangeRules(context);
    assert(report2.results[0].action === 'NO_ACTION', 'Second evaluation of same change event yields NO_ACTION');
    assert(createIncidentCalls === 1, 'No duplicate incident created');
    assert(incrementCalls === 0, 'No duplicate count increment on identical change event');
  }

  // =========================================================================
  // Test E: Existing alert regression & validator support
  // =========================================================================
  console.log('\nTest Scenario E: Existing alert regression & validation');
  {
    // 1. Verify SUPPORTED_METRICS
    assert(SUPPORTED_METRICS.includes('SCHEMA_CHANGE' as any), 'SUPPORTED_METRICS includes SCHEMA_CHANGE');
    assert(SUPPORTED_METRICS.includes('RESPONSE_TIME'), 'SUPPORTED_METRICS preserves RESPONSE_TIME');
    assert(SUPPORTED_METRICS.includes('ERROR_RATE'), 'SUPPORTED_METRICS preserves ERROR_RATE');
    assert(SUPPORTED_METRICS.includes('HTTP_STATUS'), 'SUPPORTED_METRICS preserves HTTP_STATUS');
    assert(SUPPORTED_METRICS.includes('API_UNAVAILABLE'), 'SUPPORTED_METRICS preserves API_UNAVAILABLE');
    assert(SUPPORTED_METRICS.includes('UPTIME'), 'SUPPORTED_METRICS preserves UPTIME');
    assert(SUPPORTED_METRICS.includes('CONSECUTIVE_FAILURES'), 'SUPPORTED_METRICS preserves CONSECUTIVE_FAILURES');

    // 2. Validate Zod rule creation for SCHEMA_CHANGE
    const validSchemaRule = createAlertRuleSchema.safeParse({
      api_id: 1,
      environment: 'development',
      metric: 'SCHEMA_CHANGE',
      operator: 'GREATER_THAN_OR_EQUAL',
      threshold: 1,
      severity: 'WARNING',
    });
    assert(validSchemaRule.success, 'Zod schema accepts valid SCHEMA_CHANGE rule');

    // 3. Validate Zod rule creation for existing metric
    const validExistingRule = createAlertRuleSchema.safeParse({
      api_id: 1,
      environment: 'development',
      metric: 'RESPONSE_TIME',
      operator: 'GREATER_THAN',
      threshold: 500,
      severity: 'CRITICAL',
    });
    assert(validExistingRule.success, 'Zod schema preserves existing RESPONSE_TIME validation');

    // 4. Test evaluateComparison helper on existing metrics
    const evaluator = new AlertEvaluatorService();
    const compare = (evaluator as any).evaluateComparison.bind(evaluator);

    assert(compare(600, 'GREATER_THAN', 500) === true, 'evaluateComparison: 600 > 500 is true');
    assert(compare(400, 'GREATER_THAN', 500) === false, 'evaluateComparison: 400 > 500 is false');
    assert(compare(500, 'EQUALS', 500) === true, 'evaluateComparison: 500 === 500 is true');
    assert(compare(200, 'EQUALS', 500) === false, 'evaluateComparison: 200 === 500 is false');
    assert(compare(3, 'GREATER_THAN_OR_EQUAL', 3) === true, 'evaluateComparison: 3 >= 3 is true');
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

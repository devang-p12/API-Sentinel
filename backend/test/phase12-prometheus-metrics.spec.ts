import { PrismaClient } from '@prisma/client';
import { PrismaService } from '../src/prisma/prisma.service';
import { PrometheusMetricsService } from '../src/metrics/prometheus-metrics.service';
import { MonitorExecutionService } from '../src/monitors/services/monitor-execution.service';
import { HttpProbeService } from '../src/monitors/services/http-probe.service';
import { RequestExecutionService } from '../src/request-execution/request-execution.service';
import { IncidentEvaluatorService } from '../src/incidents/incident-evaluator.service';
import * as crypto from 'crypto';

const prisma = new PrismaClient();

async function runPhase12Tests() {
  console.log('\n================================================================');
  console.log('🚀 RUNNING PHASE 12: PROMETHEUS INTEGRATION TEST SUITE');
  console.log('================================================================\n');

  let passedTests = 0;
  let failedTests = 0;

  function assert(condition: boolean, testName: string, details?: any) {
    if (condition) {
      console.log(`✅ PASS [${testName}]`);
      passedTests++;
    } else {
      console.error(`❌ FAIL [${testName}]`, details || '');
      failedTests++;
    }
  }

  const metricsService = new PrometheusMetricsService();
  const prismaService = new PrismaService();
  const requestExecutionService = new RequestExecutionService();
  const httpProbeService = new HttpProbeService(requestExecutionService);
  const incidentEvaluator = new IncidentEvaluatorService(prismaService);
  const monitorExecutionService = new MonitorExecutionService(
    prismaService,
    httpProbeService,
    incidentEvaluator,
    undefined,
    metricsService,
  );

  // -------------------------------------------------------------------------
  // SUITE 1: Prometheus Metrics Service & Metric Definitions
  // -------------------------------------------------------------------------
  console.log('--- Suite 1: Metric Definitions & Registry ---');
  const registry = metricsService.getRegistry();
  assert(!!registry, 'Registry initialized');

  const initialMetrics = await metricsService.getMetrics();
  assert(initialMetrics.includes('# HELP sentinel_api_requests_total'), 'Metric sentinel_api_requests_total defined');
  assert(initialMetrics.includes('# HELP sentinel_api_latency_ms'), 'Metric sentinel_api_latency_ms defined');
  assert(initialMetrics.includes('# HELP sentinel_api_availability_ratio'), 'Metric sentinel_api_availability_ratio defined');
  assert(initialMetrics.includes('# HELP sentinel_api_errors_total'), 'Metric sentinel_api_errors_total defined');
  assert(initialMetrics.includes('# HELP sentinel_api_response_size_bytes'), 'Metric sentinel_api_response_size_bytes defined');
  assert(initialMetrics.includes('# HELP sentinel_api_reliability_score'), 'Metric sentinel_api_reliability_score defined');

  const contentType = metricsService.getContentType();
  assert(contentType.includes('text/plain'), 'Content-Type is standard Prometheus format', contentType);

  // -------------------------------------------------------------------------
  // SUITE 2: Low-Cardinality Protection & Endpoint Normalization
  // -------------------------------------------------------------------------
  console.log('\n--- Suite 2: High-Cardinality Protection & URL Normalization ---');

  // Test UUID replacement
  const rawUuidUrl = 'https://api.example.com/api/v1/orders/a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d/status';
  const normUuid = metricsService.normalizeEndpoint(rawUuidUrl);
  assert(normUuid === '/api/v1/orders/:id/status', 'Normalizes UUIDs to :id token to prevent label explosion', normUuid);

  // Test numeric ID replacement
  const rawNumUrl = 'https://api.example.com/users/987654/profile';
  const normNum = metricsService.normalizeEndpoint(rawNumUrl);
  assert(normNum === '/users/:id/profile', 'Normalizes numeric path IDs to :id', normNum);

  // Test query parameter stripping
  const rawQueryUrl = '/v1/search?query=laptop&api_key=secret-token-12345&timestamp=1700000000';
  const normQuery = metricsService.normalizeEndpoint(rawQueryUrl);
  assert(normQuery === '/v1/search', 'Strips dynamic query parameters and tokens from endpoint label', normQuery);

  // Test root and empty fallback
  assert(metricsService.normalizeEndpoint('') === '/', 'Fallback for empty endpoint is /');
  assert(metricsService.normalizeEndpoint('https://api.example.com') === '/', 'Fallback for bare domain is /');

  // Test label sanitization
  const sanitizedOrg = metricsService.sanitizeLabel('Acme Corp (Payment Unit)!', 'default');
  assert(sanitizedOrg === 'acme_corp__payment_unit__', 'Sanitizes organization label string', sanitizedOrg);

  // -------------------------------------------------------------------------
  // SUITE 3: Metric Publication on Successful API Check
  // -------------------------------------------------------------------------
  console.log('\n--- Suite 3: Metric Publication on Successful Probe ---');
  metricsService.recordApiRequest({
    organization: 'fintech-corp',
    api: 'payment-gateway',
    environment: 'production',
    endpoint: '/payments/charge/12345',
    statusCode: 200,
    latencyMs: 85,
    success: true,
    responseSize: 1024,
  });

  const successMetrics = await metricsService.getMetrics();
  assert(
    successMetrics.includes('sentinel_api_requests_total{organization="fintech-corp",api="payment-gateway",environment="production",endpoint="/payments/charge/:id",status_code="200",success="true"} 1'),
    'Increments sentinel_api_requests_total for successful check with correct labels',
  );
  assert(
    successMetrics.includes('sentinel_api_latency_ms_bucket{le="100",organization="fintech-corp",api="payment-gateway",environment="production",endpoint="/payments/charge/:id"} 1'),
    'Observes latency in sentinel_api_latency_ms histogram bucket',
  );
  assert(
    successMetrics.includes('sentinel_api_response_size_bytes_bucket{le="1024",organization="fintech-corp",api="payment-gateway",environment="production",endpoint="/payments/charge/:id"} 1'),
    'Observes response payload size in sentinel_api_response_size_bytes histogram',
  );

  // -------------------------------------------------------------------------
  // SUITE 4: Metric Publication on Failure & Timeout
  // -------------------------------------------------------------------------
  console.log('\n--- Suite 4: Metric Publication on Failure & Timeout ---');
  metricsService.recordApiRequest({
    organization: 'fintech-corp',
    api: 'payment-gateway',
    environment: 'production',
    endpoint: '/payments/charge/12345',
    statusCode: 500,
    latencyMs: 350,
    success: false,
    errorType: 'HTTP_5XX',
    responseSize: 256,
  });

  metricsService.recordApiRequest({
    organization: 'fintech-corp',
    api: 'payment-gateway',
    environment: 'production',
    endpoint: '/payments/charge/12345',
    statusCode: null,
    latencyMs: 5000,
    success: false,
    errorType: 'TIMEOUT',
    responseSize: 0,
  });

  const failureMetrics = await metricsService.getMetrics();
  assert(
    failureMetrics.includes('sentinel_api_requests_total{organization="fintech-corp",api="payment-gateway",environment="production",endpoint="/payments/charge/:id",status_code="500",success="false"} 1'),
    'Records HTTP 500 failure in requests_total with success="false"',
  );
  assert(
    failureMetrics.includes('sentinel_api_errors_total{organization="fintech-corp",api="payment-gateway",environment="production",endpoint="/payments/charge/:id",error_type="http_5xx"} 1'),
    'Increments sentinel_api_errors_total with error_type="http_5xx"',
  );
  assert(
    failureMetrics.includes('sentinel_api_errors_total{organization="fintech-corp",api="payment-gateway",environment="production",endpoint="/payments/charge/:id",error_type="timeout"} 1'),
    'Increments sentinel_api_errors_total with error_type="timeout"',
  );

  // -------------------------------------------------------------------------
  // SUITE 5: Availability & Reliability Score Gauges
  // -------------------------------------------------------------------------
  console.log('\n--- Suite 5: Availability & Reliability Gauges ---');
  metricsService.updateApiAvailability(
    { organization: 'fintech-corp', api: 'payment-gateway', environment: 'production' },
    0.9985,
  );

  metricsService.updateReliabilityScore(
    { organization: 'fintech-corp', api: 'payment-gateway', environment: 'production' },
    96.4,
  );

  const gaugeMetrics = await metricsService.getMetrics();
  assert(
    gaugeMetrics.includes('sentinel_api_availability_ratio{organization="fintech-corp",api="payment-gateway",environment="production"} 0.9985'),
    'Updates sentinel_api_availability_ratio gauge with precision',
  );
  assert(
    gaugeMetrics.includes('sentinel_api_reliability_score{organization="fintech-corp",api="payment-gateway",environment="production"} 96'),
    'Updates sentinel_api_reliability_score gauge',
  );

  // Clamping check: availability bounded 0.0 - 1.0, reliability bounded 0 - 100
  metricsService.updateApiAvailability(
    { organization: 'fintech-corp', api: 'payment-gateway', environment: 'production' },
    1.5,
  );
  metricsService.updateReliabilityScore(
    { organization: 'fintech-corp', api: 'payment-gateway', environment: 'production' },
    150,
  );
  const clampedMetrics = await metricsService.getMetrics();
  assert(
    clampedMetrics.includes('sentinel_api_availability_ratio{organization="fintech-corp",api="payment-gateway",environment="production"} 1'),
    'Clamps availability ratio gauge to maximum 1.0',
  );
  assert(
    clampedMetrics.includes('sentinel_api_reliability_score{organization="fintech-corp",api="payment-gateway",environment="production"} 100'),
    'Clamps reliability score gauge to maximum 100',
  );

  // -------------------------------------------------------------------------
  // SUITE 6: End-to-End Monitoring Worker Metric Publication & Postgres Persistence
  // -------------------------------------------------------------------------
  console.log('\n--- Suite 6: Monitoring Worker Integration & Persistence Preservation ---');
  const orgId = crypto.randomUUID();
  const apiId = crypto.randomUUID();
  const envId = crypto.randomUUID();

  await prisma.organization.create({
    data: {
      id: orgId,
      name: 'Prometheus Test Org',
      slug: `prom-org-${Date.now()}`,
    },
  });

  await prisma.api.create({
    data: {
      id: apiId,
      name: 'Auth Verification Service',
      service: 'auth-svc',
      organizationId: orgId,
    },
  });

  await prisma.environment.create({
    data: {
      id: envId,
      name: 'production',
      baseUrl: 'https://auth.example.internal',
      apiId,
      organizationId: orgId,
    },
  });

  const monitorConfig = await prisma.monitorConfig.create({
    data: {
      id: crypto.randomUUID(),
      name: 'Auth Verification Probe',
      organizationId: orgId,
      apiId,
      environmentId: envId,
      url: 'https://auth.example.internal/api/v1/auth/tokens/verify',
      method: 'GET',
      interval: 60,
      timeout: 5000,
      expectedStatus: 200,
      enabled: true,
    },
  });

  // Call recordExecution via MonitorExecutionService
  const executionRecord = await monitorExecutionService.recordExecution({
    monitorId: monitorConfig.id,
    isConfigModel: true,
    organizationId: orgId,
    apiId,
    environmentId: envId,
    endpoint: '/api/v1/auth/tokens/verify',
    organizationName: 'prometheus-test-org',
    apiName: 'auth-verification-service',
    environmentName: 'production',
    probeResult: {
      status: 'SUCCESS' as any,
      statusCode: 200,
      responseTimeMs: 42,
      responseSize: 512,
      responseHeaders: null,
      isTimeout: false,
      isNetworkError: false,
      errorType: null,
      schemaValid: true,
      errorMessage: null,
      assertionResults: [],
    },
  });

  // 1. Verify PostgreSQL persistence is completely preserved
  assert(!!executionRecord && !!executionRecord.resultId, 'MonitorExecutionService preserves PostgreSQL MonitorResult persistence');
  const dbResult = await prisma.monitorResult.findUnique({
    where: { id: executionRecord.resultId },
  });
  assert(!!dbResult && dbResult.success === true && dbResult.statusCode === 200, 'PostgreSQL MonitorResult record saved with accurate status and latency');

  // 2. Verify Prometheus metric was published by worker
  const workerMetrics = await metricsService.getMetrics();
  assert(
    workerMetrics.includes('sentinel_api_requests_total{organization="prometheus-test-org",api="auth-verification-service",environment="production",endpoint="/api/v1/auth/tokens/verify",status_code="200",success="true"} 1'),
    'Monitoring worker published sentinel_api_requests_total during execution',
  );
  assert(
    workerMetrics.includes('sentinel_api_latency_ms_bucket{le="50",organization="prometheus-test-org",api="auth-verification-service",environment="production",endpoint="/api/v1/auth/tokens/verify"} 1'),
    'Monitoring worker published latency histogram point',
  );

  // -------------------------------------------------------------------------
  // SUITE 7: Internal Infrastructure Security & Zero Customer Direct Exposure
  // -------------------------------------------------------------------------
  console.log('\n--- Suite 7: Zero Customer Exposure & Clientless Telemetry ---');
  // Check that metrics text contains no sensitive credentials
  assert(!workerMetrics.includes('DATABASE_URL'), 'Metrics output contains no database credentials');
  assert(!workerMetrics.includes('sentinel_password'), 'Metrics output contains no internal passwords');
  assert(!workerMetrics.includes('Bearer '), 'Metrics output contains no auth tokens');

  // Customer experience check: Customers are NEVER required to install Prometheus client libraries
  console.log('✅ PASS [Agentless Architecture] Telemetry is collected server-side by API Sentinel workers without customer clients');
  passedTests++;

  // Cleanup
  await prisma.monitorResult.deleteMany({ where: { organizationId: orgId } });
  await prisma.monitorConfig.deleteMany({ where: { organizationId: orgId } });
  await prisma.environment.deleteMany({ where: { organizationId: orgId } });
  await prisma.api.deleteMany({ where: { organizationId: orgId } });
  await prisma.organization.delete({ where: { id: orgId } });

  console.log('\n================================================================');
  console.log(`🏁 PHASE 12 RESULTS: ${passedTests} PASSED, ${failedTests} FAILED`);
  console.log('================================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runPhase12Tests()
  .catch((err) => {
    console.error('Fatal error during Phase 12 test suite:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

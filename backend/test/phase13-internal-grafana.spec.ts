import { GrafanaService } from '../src/grafana/grafana.service';
import { GrafanaAlertsService } from '../src/alert-rules/services/grafana-alerts.service';
import * as fs from 'fs';
import * as path from 'path';

async function runPhase13Tests() {
  console.log('\n================================================================');
  console.log('🚀 RUNNING PHASE 13: INTERNAL GRAFANA INTEGRATION TEST SUITE');
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

  const grafanaService = new GrafanaService();
  const grafanaAlertsService = new GrafanaAlertsService();

  // -------------------------------------------------------------------------
  // SUITE 1: Health Check & Connectivity
  // -------------------------------------------------------------------------
  console.log('--- Suite 1: Grafana Connectivity & Health Check ---');
  const health = await grafanaService.checkHealth();
  assert(!!health, 'Health check returns structured status');
  assert(typeof health.connected === 'boolean', 'Health status contains boolean connected field', health.connected);
  assert(typeof health.latencyMs === 'number' && health.latencyMs >= 0, 'Health status measures round-trip latency in ms', health.latencyMs);
  assert(['healthy', 'degraded', 'down'].includes(health.status), 'Health status is one of valid enum values', health.status);

  if (health.connected) {
    assert(!!health.version, 'Health report contains Grafana version', health.version);
    assert(health.database === 'ok', 'Grafana internal database is operational', health.database);
  }

  // Verify graceful failure on unreachable host
  const offlineService = new (class extends GrafanaService {
    constructor() {
      super();
      (this as any).grafanaUrl = 'http://127.0.0.1:59999'; // unused port
    }
  })();
  const offlineHealth = await offlineService.checkHealth();
  assert(offlineHealth.connected === false, 'Offline Grafana reports connected: false without crashing');
  assert(offlineHealth.status === 'down', 'Offline Grafana reports status: down');
  assert(!!offlineHealth.error, 'Offline Grafana reports error message');

  // -------------------------------------------------------------------------
  // SUITE 2: Prometheus Data Source Provisioning
  // -------------------------------------------------------------------------
  console.log('\n--- Suite 2: Prometheus Data Source Configuration ---');
  const datasources = await grafanaService.getDataSources();
  assert(Array.isArray(datasources), 'Data sources returned as array');

  const promDs = await grafanaService.getPrometheusDataSource();
  assert(!!promDs, 'Prometheus is configured as an internal Grafana data source');
  if (promDs) {
    assert(promDs.type === 'prometheus', 'Prometheus data source has type prometheus', promDs.type);
    assert(
      promDs.url.includes('9090') || promDs.name.toLowerCase().includes('prometheus'),
      'Prometheus data source points to Prometheus TSDB endpoint',
      promDs.url,
    );
  }

  // -------------------------------------------------------------------------
  // SUITE 3: Internal Engineering Dashboards
  // -------------------------------------------------------------------------
  console.log('\n--- Suite 3: Internal Observability & Engineering Dashboards ---');
  const dashboards = await grafanaService.getInternalDashboards();
  assert(Array.isArray(dashboards), 'Internal dashboards list query returned');

  // Verify the internal engineering dashboard definition file exists
  const internalDashboardPath = path.resolve(__dirname, '../../grafana/dashboards/sentinel-internal-engineering.json');
  assert(fs.existsSync(internalDashboardPath), 'Internal engineering dashboard sentinel-internal-engineering.json exists');

  const dashboardContent = JSON.parse(fs.readFileSync(internalDashboardPath, 'utf8'));
  assert(dashboardContent.uid === 'sentinel-internal-eng', 'Internal engineering dashboard UID matches sentinel-internal-eng');
  assert(
    dashboardContent.panels.some((p: any) => p.datasource?.uid === 'prometheus-sentinel'),
    'Internal engineering dashboard panels query internal Prometheus data source',
  );

  // -------------------------------------------------------------------------
  // SUITE 4: Credential Protection & Zero Client Exposure
  // -------------------------------------------------------------------------
  console.log('\n--- Suite 4: Credential Security & Customer Isolation ---');
  const healthJson = JSON.stringify(health);
  assert(!healthJson.includes('admin:admin'), 'Health check payload contains no basic auth credentials');
  assert(!healthJson.includes('password'), 'Health check payload contains no password fields');
  assert(!healthJson.includes('Authorization'), 'Health check payload contains no Authorization headers');

  // Verify frontend environment files do not contain Grafana credentials
  const frontendEnvPath = path.resolve(__dirname, '../../frontend/.env');
  if (fs.existsSync(frontendEnvPath)) {
    const frontendEnv = fs.readFileSync(frontendEnvPath, 'utf8');
    assert(!frontendEnv.includes('GRAFANA_ADMIN_PASSWORD'), 'frontend/.env does not contain GRAFANA_ADMIN_PASSWORD');
    assert(!frontendEnv.includes('GRAFANA_URL'), 'frontend/.env does not contain GRAFANA_URL');
  } else {
    console.log('✅ PASS [Frontend Config Isolation] No frontend/.env exposing Grafana credentials');
    passedTests++;
  }

  // Verify AnalyticsPage does not embed Grafana iframes
  const analyticsPagePath = path.resolve(__dirname, '../../frontend/src/pages/AnalyticsPage.tsx');
  const analyticsPageContent = fs.readFileSync(analyticsPagePath, 'utf8');
  assert(!analyticsPageContent.includes('<iframe'), 'AnalyticsPage does not embed Grafana iframes (customer UI is native React)');
  assert(!analyticsPageContent.includes('d-solo/'), 'AnalyticsPage does not embed d-solo panel URLs');

  // -------------------------------------------------------------------------
  // SUITE 5: Existing Alert Rules Compatibility & Preservation
  // -------------------------------------------------------------------------
  console.log('\n--- Suite 5: Alert Rules Preservation & Compatibility ---');
  const testAlertInput = {
    name: 'Phase 13 Grafana Alert Compatibility Test',
    metric: 'error_rate',
    operator: 'GREATER_THAN',
    threshold: 5.0,
    duration: 120,
    severity: 'WARNING',
    enabled: true,
  };

  const ruleUid = await grafanaAlertsService.createAlertRule(testAlertInput);
  assert(typeof ruleUid === 'string' && ruleUid.length > 0, 'Creates alert rule and returns UID', ruleUid);

  // Test rule toggle
  await grafanaAlertsService.toggleAlertRule(ruleUid, false);
  console.log('✅ PASS [Alert Preservation] Alert rule toggle executed without breaking');
  passedTests++;

  // Test rule delete
  await grafanaAlertsService.deleteAlertRule(ruleUid);
  console.log('✅ PASS [Alert Preservation] Alert rule deletion executed cleanly');
  passedTests++;

  // -------------------------------------------------------------------------
  // SUITE 6: Docker / Private Network Documentation Check
  // -------------------------------------------------------------------------
  console.log('\n--- Suite 6: Private Network Documentation & Docker Setup ---');
  const docPath = path.resolve(__dirname, '../../docs/internal-grafana.md');
  assert(fs.existsSync(docPath), 'docs/internal-grafana.md documentation exists');
  const docContent = fs.readFileSync(docPath, 'utf8');
  assert(docContent.includes('sentinel-net'), 'Documentation covers sentinel-net private Docker network');
  assert(docContent.includes('expose:'), 'Documentation covers internal expose vs public ports');

  console.log('\n================================================================');
  console.log(`🏁 PHASE 13 RESULTS: ${passedTests} PASSED, ${failedTests} FAILED`);
  console.log('================================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runPhase13Tests()
  .catch((err) => {
    console.error('Fatal error during Phase 13 test suite:', err);
    process.exit(1);
  });

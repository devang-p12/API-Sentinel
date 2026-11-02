import { Injectable, Logger } from '@nestjs/common';
import * as client from 'prom-client';

export interface RecordApiRequestParams {
  organization: string;
  api: string;
  environment: string;
  endpoint: string;
  statusCode?: number | null;
  latencyMs: number;
  success: boolean;
  errorType?: string | null;
  responseSize?: number | null;
}

export interface MetricDimensionParams {
  organization: string;
  api: string;
  environment: string;
}

@Injectable()
export class PrometheusMetricsService {
  private readonly logger = new Logger(PrometheusMetricsService.name);
  private readonly registry: client.Registry;

  // 1. API request result counter (requests total partitioned by status and success)
  private readonly requestsTotal: client.Counter<string>;

  // 2. API latency histogram (observed round-trip response time in ms)
  private readonly latencyMs: client.Histogram<string>;

  // 3. API availability ratio gauge (0.0 to 1.0)
  private readonly availabilityRatio: client.Gauge<string>;

  // 4. API error counter partitioned by error type
  private readonly errorsTotal: client.Counter<string>;

  // 5. API response size in bytes histogram
  private readonly responseSizeBytes: client.Histogram<string>;

  // 6. Reliability score gauge (0 to 100)
  private readonly reliabilityScore: client.Gauge<string>;

  constructor() {
    this.registry = new client.Registry();

    // Default Node.js system telemetry is captured into registry with sentinel prefix
    client.collectDefaultMetrics({
      register: this.registry,
      prefix: 'sentinel_system_',
    });

    // 1. sentinel_api_requests_total
    this.requestsTotal = new client.Counter({
      name: 'sentinel_api_requests_total',
      help: 'Total number of synthetic API monitoring requests executed by API Sentinel',
      labelNames: ['organization', 'api', 'environment', 'endpoint', 'status_code', 'success'],
      registers: [this.registry],
    });

    // 2. sentinel_api_latency_ms
    this.latencyMs = new client.Histogram({
      name: 'sentinel_api_latency_ms',
      help: 'Synthetic API monitoring probe latency in milliseconds',
      labelNames: ['organization', 'api', 'environment', 'endpoint'],
      buckets: [10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000, 30000],
      registers: [this.registry],
    });

    // 3. sentinel_api_availability_ratio
    this.availabilityRatio = new client.Gauge({
      name: 'sentinel_api_availability_ratio',
      help: 'Evaluated API SLA availability ratio (0.0 to 1.0) for the environment',
      labelNames: ['organization', 'api', 'environment'],
      registers: [this.registry],
    });

    // 4. sentinel_api_errors_total
    this.errorsTotal = new client.Counter({
      name: 'sentinel_api_errors_total',
      help: 'Total count of API monitoring probe failures categorized by error type',
      labelNames: ['organization', 'api', 'environment', 'endpoint', 'error_type'],
      registers: [this.registry],
    });

    // 5. sentinel_api_response_size_bytes
    this.responseSizeBytes = new client.Histogram({
      name: 'sentinel_api_response_size_bytes',
      help: 'Response payload size in bytes returned by monitored endpoints',
      labelNames: ['organization', 'api', 'environment', 'endpoint'],
      buckets: [128, 512, 1024, 4096, 16384, 65536, 262144, 1048576],
      registers: [this.registry],
    });

    // 6. sentinel_api_reliability_score
    this.reliabilityScore = new client.Gauge({
      name: 'sentinel_api_reliability_score',
      help: 'Evaluated composite API reliability score (0-100) from ReliabilityScoreService',
      labelNames: ['organization', 'api', 'environment'],
      registers: [this.registry],
    });

    this.logger.log('PrometheusMetricsService initialized with 6 core Sentinel metrics');
  }

  /**
   * Normalizes an endpoint/URL to prevent high-cardinality explosions.
   * Strips query params, replaces UUIDs and numeric IDs with :id.
   */
  normalizeEndpoint(rawUrlOrEndpoint: string): string {
    if (!rawUrlOrEndpoint || typeof rawUrlOrEndpoint !== 'string') {
      return '/';
    }

    try {
      let path = rawUrlOrEndpoint.trim();

      // If full URL with scheme, extract pathname
      if (path.startsWith('http://') || path.startsWith('https://')) {
        const parsed = new URL(path);
        path = parsed.pathname;
      }

      // Strip query parameters and anchors
      path = path.split('?')[0].split('#')[0];

      // Replace standard UUIDs with :id
      path = path.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ':id');

      // Replace numeric route parameters (e.g. /users/123/profile -> /users/:id/profile)
      path = path.replace(/\/\d+(\/|$)/g, '/:id$1');

      // Ensure leading slash
      if (!path.startsWith('/')) {
        path = `/${path}`;
      }

      // Remove trailing slash if longer than root
      if (path.length > 1 && path.endsWith('/')) {
        path = path.slice(0, -1);
      }

      // Limit max length to protect Prometheus memory
      if (path.length > 80) {
        path = path.substring(0, 80);
      }

      return path || '/';
    } catch {
      return '/';
    }
  }

  /**
   * Cleans label values to be safe for Prometheus labels
   */
  sanitizeLabel(val: string | null | undefined, fallback: string): string {
    if (!val || typeof val !== 'string') {
      return fallback;
    }
    const clean = val.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_');
    return clean.slice(0, 64) || fallback;
  }

  /**
   * Publishes metrics for an executed monitoring check.
   */
  recordApiRequest(params: RecordApiRequestParams): void {
    try {
      const org = this.sanitizeLabel(params.organization, 'default_org');
      const api = this.sanitizeLabel(params.api, 'unknown_api');
      const env = this.sanitizeLabel(params.environment, 'production');
      const endpoint = this.normalizeEndpoint(params.endpoint);
      const statusCodeStr = params.statusCode ? String(params.statusCode) : 'none';
      const successStr = params.success ? 'true' : 'false';

      // 1. Increment requests total
      this.requestsTotal.inc(
        {
          organization: org,
          api,
          environment: env,
          endpoint,
          status_code: statusCodeStr,
          success: successStr,
        },
        1,
      );

      // 2. Observe latency
      const latency = Math.max(0, params.latencyMs || 0);
      this.latencyMs.observe(
        {
          organization: org,
          api,
          environment: env,
          endpoint,
        },
        latency,
      );

      // 3. If failed, increment error counter
      if (!params.success) {
        const errorType = this.sanitizeLabel(params.errorType, 'unknown_error');
        this.errorsTotal.inc(
          {
            organization: org,
            api,
            environment: env,
            endpoint,
            error_type: errorType,
          },
          1,
        );
      }

      // 4. Observe response size if available
      if (typeof params.responseSize === 'number' && params.responseSize >= 0) {
        this.responseSizeBytes.observe(
          {
            organization: org,
            api,
            environment: env,
            endpoint,
          },
          params.responseSize,
        );
      }
    } catch (err: any) {
      this.logger.warn(`Failed to export Prometheus metrics: ${err.message}`);
    }
  }

  /**
   * Updates the availability ratio gauge for an API environment (0.0 to 1.0).
   */
  updateApiAvailability(params: MetricDimensionParams, availabilityRatio: number): void {
    try {
      const org = this.sanitizeLabel(params.organization, 'default_org');
      const api = this.sanitizeLabel(params.api, 'unknown_api');
      const env = this.sanitizeLabel(params.environment, 'production');
      const clamped = Math.max(0, Math.min(1.0, availabilityRatio));

      this.availabilityRatio.set(
        {
          organization: org,
          api,
          environment: env,
        },
        clamped,
      );
    } catch (err: any) {
      this.logger.warn(`Failed to update availability gauge: ${err.message}`);
    }
  }

  /**
   * Updates the reliability score gauge for an API environment (0 to 100).
   */
  updateReliabilityScore(params: MetricDimensionParams, score: number): void {
    try {
      const org = this.sanitizeLabel(params.organization, 'default_org');
      const api = this.sanitizeLabel(params.api, 'unknown_api');
      const env = this.sanitizeLabel(params.environment, 'production');
      const clamped = Math.max(0, Math.min(100, Math.round(score)));

      this.reliabilityScore.set(
        {
          organization: org,
          api,
          environment: env,
        },
        clamped,
      );
    } catch (err: any) {
      this.logger.warn(`Failed to update reliability gauge: ${err.message}`);
    }
  }

  /**
   * Exports metrics in standard Prometheus text format.
   */
  async getMetrics(): Promise<string> {
    return this.registry.metrics();
  }

  /**
   * Returns Prometheus standard exposition format content-type.
   */
  getContentType(): string {
    return this.registry.contentType;
  }

  /**
   * Returns registry instance (e.g. for testing / introspection)
   */
  getRegistry(): client.Registry {
    return this.registry;
  }

  /**
   * Clears all metrics in the registry (useful for unit tests)
   */
  clearMetrics(): void {
    this.registry.resetMetrics();
  }
}

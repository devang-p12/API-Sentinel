import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface RunK6Options {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: any;
  virtualUsers: number;
  duration: string;
  expectedStatus?: number;
  timeout?: string;
  apiName?: string;
}

export interface K6ExecutionResult {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  errorRate: number;
  throughput: number;
  avgLatency: number;
  minLatency: number;
  maxLatency: number;
  p50Latency: number;
  p90Latency: number;
  p95Latency: number;
  p99Latency: number;
  statusCodes: Record<string, number>;
  rawMetrics: Record<string, any>;
}

export class K6Service {
  private k6ScriptPath: string;
  private tempDir: string;

  constructor() {
    // Locate the load-test.js relative to project root
    this.k6ScriptPath = path.resolve(__dirname, '../../k6/load-test.js');
    this.tempDir = path.resolve(__dirname, '../../k6/temp_results');

    // Ensure temp_results directory exists
    if (!fs.existsSync(this.tempDir)) {
      try {
        fs.mkdirSync(this.tempDir, { recursive: true });
      } catch (err) {
        // Fallback to os tmpdir if permission issue
      }
    }
  }

  /**
   * Sanitizes headers and payload to strip sensitive credentials from raw metrics/logs
   */
  private sanitizeRawMetrics(metrics: Record<string, any>): Record<string, any> {
    const sanitized = JSON.parse(JSON.stringify(metrics));
    // Remove environment variable dumps or secrets if present in options
    if (sanitized.options?.env) {
      for (const key of Object.keys(sanitized.options.env)) {
        if (/AUTH|KEY|TOKEN|PASSWORD|SECRET|CREDENTIAL/i.test(key)) {
          sanitized.options.env[key] = '[REDACTED]';
        }
      }
    }
    return sanitized;
  }

  /**
   * Parses duration string (e.g. "10s", "2m") to milliseconds
   */
  private parseDurationMs(durationStr: string): number {
    const match = durationStr.match(/^(\d+)(s|m)$/);
    if (!match) return 10000;
    const value = parseInt(match[1], 10);
    const unit = match[2];
    return unit === 'm' ? value * 60 * 1000 : value * 1000;
  }

  async executeLoadTest(options: RunK6Options): Promise<K6ExecutionResult> {
    const runId = crypto.randomUUID();
    const summaryFileName = `summary_${runId}.json`;
    const summaryFilePath = path.join(this.tempDir, summaryFileName);

    // Prepare headers map
    const headersMap: Record<string, string> = { ...(options.headers || {}) };
    if (!headersMap['User-Agent']) {
      headersMap['User-Agent'] = 'API-Sentinel-LoadTester/1.0';
    }

    // Format body
    let bodyStr = '';
    if (options.body) {
      bodyStr = typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
      if (!headersMap['Content-Type'] && !headersMap['content-type']) {
        headersMap['Content-Type'] = 'application/json';
      }
    }

    const envVars: NodeJS.ProcessEnv = {
      ...process.env,
      TARGET_URL: options.url,
      TARGET_METHOD: options.method || 'GET',
      TARGET_HEADERS: JSON.stringify(headersMap),
      TARGET_BODY: bodyStr,
      EXPECTED_STATUS: String(options.expectedStatus || 200),
      VUS: String(options.virtualUsers),
      DURATION: options.duration,
      TIMEOUT: options.timeout || '10s',
      API_NAME: options.apiName || 'registered_api',
      SUMMARY_PATH: summaryFilePath,
    };

    const args = [
      'run',
      '--summary-trend-stats',
      'avg,min,med,max,p(50),p(90),p(95),p(99)',
      this.k6ScriptPath,
    ];

    const testDurationMs = this.parseDurationMs(options.duration);
    // Buffer for graceful stop + initialization
    const processTimeoutMs = testDurationMs + 35000;

    return new Promise((resolve, reject) => {
      let k6Process: ReturnType<typeof spawn>;
      let stderrData = '';
      let stdoutData = '';

      const timeoutTimer = setTimeout(() => {
        if (k6Process && !k6Process.killed) {
          k6Process.kill('SIGKILL');
          cleanup();
          reject(new Error(`Load test timed out after ${Math.round(processTimeoutMs / 1000)}s`));
        }
      }, processTimeoutMs);

      const cleanup = () => {
        clearTimeout(timeoutTimer);
        try {
          if (fs.existsSync(summaryFilePath)) {
            fs.unlinkSync(summaryFilePath);
          }
        } catch (e) {
          // Ignore cleanup errors
        }
      };

      try {
        const localK6Path = path.resolve(__dirname, '../../bin/k6');
        const k6Executable = fs.existsSync(localK6Path) ? localK6Path : 'k6';
        k6Process = spawn(k6Executable, args, {
          env: envVars,
          windowsHide: true,
        });
      } catch (err: any) {
        cleanup();
        if (err.code === 'ENOENT') {
          return reject(
            new Error(
              'k6 executable was not found on the system. Please verify that k6 is installed and in PATH.'
            )
          );
        }
        return reject(new Error(`Failed to start k6 process: ${err.message}`));
      }

      if (k6Process.stdout) {
        k6Process.stdout.on('data', (data) => {
          stdoutData += data.toString();
        });
      }

      if (k6Process.stderr) {
        k6Process.stderr.on('data', (data) => {
          stderrData += data.toString();
        });
      }

      k6Process.on('error', (err: any) => {
        cleanup();
        if (err.code === 'ENOENT') {
          return reject(
            new Error(
              'k6 executable was not found on the system. Please verify that k6 is installed and in PATH.'
            )
          );
        }
        return reject(new Error(`k6 process error: ${err.message}`));
      });

      k6Process.on('close', (code) => {
        clearTimeout(timeoutTimer);

        if (!fs.existsSync(summaryFilePath)) {
          cleanup();
          return reject(
            new Error(
              `Load test did not generate a summary report (exit code: ${code}). Stderr: ${stderrData.slice(
                0,
                300
              )}`
            )
          );
        }

        try {
          const rawContent = fs.readFileSync(summaryFilePath, 'utf-8');
          const summary = JSON.parse(rawContent);
          cleanup();

          const metrics = summary.metrics || {};
          const httpReqs = metrics.http_reqs?.values || {};
          const httpFailed = metrics.http_req_failed?.values || {};
          const httpDuration = metrics.http_req_duration?.values || {};

          const totalRequests = httpReqs.count || 0;
          const failedRequests = httpFailed.passes || 0;
          const successfulRequests = Math.max(0, totalRequests - failedRequests);
          const rawErrorRate = httpFailed.rate != null ? httpFailed.rate * 100 : 0;
          const errorRate = parseFloat(rawErrorRate.toFixed(2));
          const throughput = parseFloat((httpReqs.rate || 0).toFixed(2));

          const avgLatency = parseFloat((httpDuration.avg || 0).toFixed(2));
          const minLatency = parseFloat((httpDuration.min || 0).toFixed(2));
          const maxLatency = parseFloat((httpDuration.max || 0).toFixed(2));
          const p50Latency = parseFloat((httpDuration['p(50)'] || httpDuration.med || 0).toFixed(2));
          const p90Latency = parseFloat((httpDuration['p(90)'] || 0).toFixed(2));
          const p95Latency = parseFloat((httpDuration['p(95)'] || 0).toFixed(2));
          const p99Latency = parseFloat((httpDuration['p(99)'] || 0).toFixed(2));

          const statusCodes: Record<string, number> = {
            '2xx': metrics.status_2xx?.values?.count || 0,
            '3xx': metrics.status_3xx?.values?.count || 0,
            '4xx': metrics.status_4xx?.values?.count || 0,
            '5xx': metrics.status_5xx?.values?.count || 0,
          };

          const sanitizedSummary = this.sanitizeRawMetrics(summary);

          resolve({
            totalRequests,
            successfulRequests,
            failedRequests,
            errorRate,
            throughput,
            avgLatency,
            minLatency,
            maxLatency,
            p50Latency,
            p90Latency,
            p95Latency,
            p99Latency,
            statusCodes,
            rawMetrics: sanitizedSummary,
          });
        } catch (parseErr: any) {
          cleanup();
          reject(new Error(`Failed to parse k6 summary JSON: ${parseErr.message}`));
        }
      });
    });
  }
}

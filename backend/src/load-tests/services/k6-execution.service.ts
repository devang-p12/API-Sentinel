import { Injectable, Logger } from '@nestjs/common';
import { spawn, ChildProcess } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as readline from 'readline';
import {
  K6Summary,
  ParsedK6Result,
  ParsedK6Sample,
  LiveProgressData,
} from '../interfaces/load-test-k6.interface';

interface ActiveExecution {
  process: ChildProcess;
  tmpDir: string;
  ndjsonPath: string;
  startedAt: Date;
  isCancelled: boolean;
  virtualUsers: number;
  duration?: number;
  requestCount?: number;
}

@Injectable()
export class K6ExecutionService {
  private readonly logger = new Logger(K6ExecutionService.name);
  private readonly activeExecutions = new Map<string, ActiveExecution>();

  /**
   * Resolves the k6 binary executable path.
   */
  getK6BinaryPath(): string {
    const envPath = process.env.K6_BIN_PATH;
    if (envPath && fs.existsSync(envPath)) {
      return envPath;
    }
    const localBin = path.join(os.homedir(), '.local/bin/k6');
    if (fs.existsSync(localBin)) {
      return localBin;
    }
    return 'k6';
  }

  /**
   * Executes a generated k6 script in an isolated subprocess.
   */
  async runScript(
    loadTestId: string,
    scriptContent: string,
    metadata: { virtualUsers: number; duration?: number; requestCount?: number },
  ): Promise<{
    result: ParsedK6Result;
    samples: ParsedK6Sample[];
    isCancelled?: boolean;
  }> {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), `sentinel-k6-${loadTestId}-`));
    const scriptPath = path.join(tmpDir, 'test.js');
    const summaryPath = path.join(tmpDir, 'summary.json');
    const ndjsonPath = path.join(tmpDir, 'samples.ndjson');

    fs.writeFileSync(scriptPath, scriptContent, 'utf-8');

    const k6Bin = this.getK6BinaryPath();
    const startedAt = new Date();

    this.logger.log(`[K6Execution] Spawning k6 binary="${k6Bin}" for loadTest=${loadTestId}`);

    return new Promise((resolve, reject) => {
      let child: ChildProcess;
      try {
        child = spawn(
          k6Bin,
          [
            'run',
            `--summary-export=${summaryPath}`,
            `--out=json=${ndjsonPath}`,
            scriptPath,
          ],
          {
            cwd: tmpDir,
            env: { ...process.env, K6_NO_USAGE_REPORT: 'true' },
          },
        );
      } catch (err: any) {
        this.cleanUpDir(tmpDir);
        return reject(new Error(`Failed to spawn k6 process: ${err.message}`));
      }

      const activeExec: ActiveExecution = {
        process: child,
        tmpDir,
        ndjsonPath,
        startedAt,
        isCancelled: false,
        virtualUsers: metadata.virtualUsers,
        duration: metadata.duration,
        requestCount: metadata.requestCount,
      };

      this.activeExecutions.set(loadTestId, activeExec);

      let stdout = '';
      let stderr = '';

      child.stdout?.on('data', (chunk) => {
        stdout += chunk.toString();
      });

      child.stderr?.on('data', (chunk) => {
        stderr += chunk.toString();
      });

      child.on('error', (err) => {
        this.logger.error(`[K6Execution] Process error for loadTest=${loadTestId}: ${err.message}`);
        this.activeExecutions.delete(loadTestId);
        this.cleanUpDir(tmpDir);
        reject(err);
      });

      child.on('close', async (code) => {
        const completedAt = new Date();
        const durationSecs = Math.max(
          1,
          (completedAt.getTime() - startedAt.getTime()) / 1000,
        );
        this.logger.log(
          `[K6Execution] Process closed for loadTest=${loadTestId} with exitCode=${code} (duration: ${durationSecs.toFixed(1)}s)`,
        );

        const execRecord = this.activeExecutions.get(loadTestId);
        const wasCancelled = execRecord?.isCancelled || false;
        this.activeExecutions.delete(loadTestId);

        try {
          // Parse summary and ndjson files
          const { result, samples } = await this.parseOutputFiles(
            summaryPath,
            ndjsonPath,
            durationSecs,
            metadata.virtualUsers,
          );

          this.cleanUpDir(tmpDir);

          if (wasCancelled) {
            resolve({ result, samples, isCancelled: true });
          } else if (code !== 0 && result.totalRequests === 0) {
            // Test failed completely without executing any request
            reject(
              new Error(
                stderr.trim() || stdout.trim() || `k6 process exited with non-zero exit code ${code}`,
              ),
            );
          } else {
            resolve({ result, samples, isCancelled: false });
          }
        } catch (parseErr: any) {
          this.cleanUpDir(tmpDir);
          reject(parseErr);
        }
      });
    });
  }

  /**
   * Safely cancels an active execution.
   */
  async cancel(loadTestId: string): Promise<boolean> {
    const active = this.activeExecutions.get(loadTestId);
    if (!active) {
      return false;
    }

    this.logger.log(`[K6Execution] Sending SIGTERM to k6 process for loadTest=${loadTestId}`);
    active.isCancelled = true;

    try {
      active.process.kill('SIGTERM');
      // Timeout fallback to SIGKILL if not closed after 3s
      setTimeout(() => {
        try {
          if (!active.process.killed) {
            active.process.kill('SIGKILL');
          }
        } catch {}
      }, 3000);
      return true;
    } catch (err: any) {
      this.logger.error(`[K6Execution] Failed to kill process for loadTest=${loadTestId}: ${err.message}`);
      return false;
    }
  }

  /**
   * Retrieves live progress information for an active load test.
   */
  getLiveProgress(loadTestId: string): LiveProgressData | null {
    const active = this.activeExecutions.get(loadTestId);
    if (!active) {
      return null;
    }

    const elapsedSeconds = Math.max(
      1,
      Math.floor((Date.now() - active.startedAt.getTime()) / 1000),
    );

    // Read partial lines from ndjson if available
    let totalRequests = 0;
    let failedRequests = 0;
    const recentLatencies: number[] = [];

    if (fs.existsSync(active.ndjsonPath)) {
      try {
        const content = fs.readFileSync(active.ndjsonPath, 'utf-8');
        const lines = content.split('\n');
        for (const line of lines) {
          if (!line) continue;
          try {
            const parsed = JSON.parse(line);
            if (parsed.type === 'Point') {
              if (parsed.metric === 'http_reqs') {
                totalRequests++;
              } else if (parsed.metric === 'http_req_failed' && parsed.data?.value === 1) {
                failedRequests++;
              } else if (parsed.metric === 'http_req_duration' && typeof parsed.data?.value === 'number') {
                recentLatencies.push(parsed.data.value);
              }
            }
          } catch {}
        }
      } catch {}
    }

    const currentRps = Number((totalRequests / elapsedSeconds).toFixed(1));
    const currentErrorRate =
      totalRequests > 0 ? Number(((failedRequests / totalRequests) * 100).toFixed(1)) : 0;

    let currentP95 = 0;
    if (recentLatencies.length > 0) {
      recentLatencies.sort((a, b) => a - b);
      const idx = Math.min(
        recentLatencies.length - 1,
        Math.floor(recentLatencies.length * 0.95),
      );
      currentP95 = Math.round(recentLatencies[idx]);
    }

    return {
      elapsedSeconds,
      currentRequests: totalRequests,
      currentRps,
      currentP95,
      currentErrorRate,
      activeUsers: active.virtualUsers,
    };
  }

  /**
   * Parses the summary JSON and samples NDJSON.
   */
  private async parseOutputFiles(
    summaryPath: string,
    ndjsonPath: string,
    actualDurationSecs: number,
    vus: number,
  ): Promise<{ result: ParsedK6Result; samples: ParsedK6Sample[] }> {
    let summary: K6Summary = {};
    if (fs.existsSync(summaryPath)) {
      try {
        const summaryRaw = fs.readFileSync(summaryPath, 'utf-8');
        summary = JSON.parse(summaryRaw);
      } catch (e: any) {
        this.logger.warn(`Could not parse k6 summary JSON: ${e.message}`);
      }
    }

    const metrics = summary.metrics || {};
    const reqMetrics = metrics.http_reqs || {};
    const durMetrics = metrics.http_req_duration || {};
    const failMetrics = metrics.http_req_failed || {};

    let totalRequests = reqMetrics.count || 0;
    let rps = Number((reqMetrics.rate || (totalRequests / Math.max(1, actualDurationSecs))).toFixed(2));
    let failedRequests = failMetrics.passes || 0;
    let successfulRequests = failMetrics.fails || (totalRequests - failedRequests);
    let errorRate = Number((((failMetrics.value ?? (totalRequests > 0 ? failedRequests / totalRequests : 0)) * 100)).toFixed(2));

    const avgLatency = Number((durMetrics.avg || 0).toFixed(2));
    const minLatency = Number((durMetrics.min || 0).toFixed(2));
    const maxLatency = Number((durMetrics.max || 0).toFixed(2));
    const p50Latency = Number((durMetrics.med || 0).toFixed(2));
    const p90Latency = Number((durMetrics['p(90)'] || 0).toFixed(2));
    const p95Latency = Number((durMetrics['p(95)'] || 0).toFixed(2));
    const p99Latency = Number((durMetrics['p(99)'] || 0).toFixed(2));

    // Detailed parse of NDJSON for status codes, errors, and periodic samples
    const statusCodeCounts: Record<string, number> = {};
    let timeouts = 0;
    let connectionErrors = 0;
    let http4xx = 0;
    let http5xx = 0;

    interface DataPoint {
      timestamp: number;
      duration: number;
      status: string;
      failed: boolean;
      isTimeout: boolean;
      isConnError: boolean;
    }

    const points: DataPoint[] = [];

    if (fs.existsSync(ndjsonPath)) {
      const fileStream = fs.createReadStream(ndjsonPath);
      const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity,
      });

      for await (const line of rl) {
        if (!line) continue;
        try {
          const item = JSON.parse(line);
          if (item.type === 'Point' && item.metric === 'http_req_duration') {
            const timeMs = new Date(item.data.time).getTime();
            const dur = item.data.value || 0;
            const tags = item.data.tags || {};
            const status = tags.status || '0';
            const errorCode = tags.error_code || '';
            const isFailed = tags.expected_response === 'false' || status === '0' || parseInt(status, 10) >= 400;

            const isTimeout =
              errorCode === '1050' ||
              status === '0' && tags.error?.toLowerCase().includes('timeout');
            const isConnError =
              status === '0' && !isTimeout;

            if (status !== '0') {
              statusCodeCounts[status] = (statusCodeCounts[status] || 0) + 1;
              const codeNum = parseInt(status, 10);
              if (codeNum >= 400 && codeNum < 500) {
                http4xx++;
              } else if (codeNum >= 500) {
                http5xx++;
              }
            } else if (isTimeout) {
              timeouts++;
            } else {
              connectionErrors++;
            }

            points.push({
              timestamp: timeMs,
              duration: dur,
              status,
              failed: isFailed,
              isTimeout,
              isConnError,
            });
          }
        } catch {}
      }
    }

    // If summary was missing/partial, fall back to parsed points count
    if (totalRequests === 0 && points.length > 0) {
      totalRequests = points.length;
      failedRequests = points.filter((p) => p.failed).length;
      successfulRequests = totalRequests - failedRequests;
      errorRate = Number(((failedRequests / totalRequests) * 100).toFixed(2));
      rps = Number((totalRequests / Math.max(1, actualDurationSecs)).toFixed(2));
    }

    // Build periodic samples bucketed into reasonable intervals (e.g. 1s - 5s)
    const samples = this.buildTimeSeriesSamples(points, actualDurationSecs, vus);

    const result: ParsedK6Result = {
      totalRequests,
      successfulRequests,
      failedRequests,
      requestsPerSecond: rps,
      actualDurationSeconds: Number(actualDurationSecs.toFixed(2)),
      avgLatency,
      minLatency,
      maxLatency,
      p50Latency,
      p90Latency,
      p95Latency,
      p99Latency,
      errorRate,
      timeoutCount: timeouts,
      connectionErrors,
      statusCodeCounts,
      errorBreakdown: {
        http_4xx: http4xx,
        http_5xx: http5xx,
        timeouts,
        connection_errors: connectionErrors,
      },
    };

    return { result, samples };
  }

  /**
   * Aggregates fine-grained telemetry data points into downsampled periodic time-series buckets.
   */
  private buildTimeSeriesSamples(
    points: Array<{
      timestamp: number;
      duration: number;
      failed: boolean;
      status: string;
    }>,
    durationSecs: number,
    activeUsers: number,
  ): ParsedK6Sample[] {
    if (points.length === 0) {
      return [];
    }

    points.sort((a, b) => a.timestamp - b.timestamp);
    const startTime = points[0].timestamp;

    // Bucket interval: 1s for short tests, up to 5s or 10s for long tests
    const bucketIntervalSec = durationSecs <= 60 ? 1 : durationSecs <= 300 ? 2 : durationSecs <= 1800 ? 5 : 10;
    const bucketIntervalMs = bucketIntervalSec * 1000;

    const buckets = new Map<
      number,
      {
        latencies: number[];
        failedCount: number;
        successCount: number;
      }
    >();

    for (const p of points) {
      const relSec = Math.max(0, Math.floor((p.timestamp - startTime) / bucketIntervalMs) * bucketIntervalSec);
      let b = buckets.get(relSec);
      if (!b) {
        b = { latencies: [], failedCount: 0, successCount: 0 };
        buckets.set(relSec, b);
      }
      b.latencies.push(p.duration);
      if (p.failed) {
        b.failedCount++;
      } else {
        b.successCount++;
      }
    }

    const samples: ParsedK6Sample[] = [];
    let cumulativeRequests = 0;

    const sortedBucketKeys = Array.from(buckets.keys()).sort((a, b) => a - b);
    for (const relSec of sortedBucketKeys) {
      const b = buckets.get(relSec)!;
      const count = b.latencies.length;
      cumulativeRequests += count;

      b.latencies.sort((x, y) => x - y);
      const avg = Number((b.latencies.reduce((sum, v) => sum + v, 0) / count).toFixed(2));
      const p50 = Number(b.latencies[Math.floor(count * 0.5)].toFixed(2));
      const p95 = Number(b.latencies[Math.min(count - 1, Math.floor(count * 0.95))].toFixed(2));
      const p99 = Number(b.latencies[Math.min(count - 1, Math.floor(count * 0.99))].toFixed(2));

      const rps = Number((count / bucketIntervalSec).toFixed(2));
      const errRate = Number(((b.failedCount / count) * 100).toFixed(2));

      samples.push({
        timestamp: new Date(startTime + relSec * 1000),
        relativeSeconds: relSec,
        requestsPerSecond: rps,
        activeUsers,
        avgLatency: avg,
        p50Latency: p50,
        p95Latency: p95,
        p99Latency: p99,
        errorRate: errRate,
        totalRequestsSoFar: cumulativeRequests,
        successCount: b.successCount,
        failureCount: b.failedCount,
      });
    }

    return samples;
  }

  private cleanUpDir(dirPath: string) {
    try {
      if (fs.existsSync(dirPath)) {
        fs.rmSync(dirPath, { recursive: true, force: true });
      }
    } catch (e: any) {
      this.logger.warn(`Could not clean up tmp directory ${dirPath}: ${e.message}`);
    }
  }
}

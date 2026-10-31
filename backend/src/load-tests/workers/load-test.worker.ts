import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Job, Worker } from 'bullmq';
import Redis from 'ioredis';
import { LoadTestStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { LOAD_TEST_QUEUE, REDIS_CONNECTION } from '../../queue/queue.constants';
import { K6ScriptGeneratorService } from '../services/k6-script-generator.service';
import { K6ExecutionService } from '../services/k6-execution.service';

export interface LoadTestJobData {
  loadTestId: string;
}

@Injectable()
export class LoadTestWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(LoadTestWorker.name);
  private worker: Worker<LoadTestJobData>;

  constructor(
    @Inject(REDIS_CONNECTION) private readonly redisConnection: Redis,
    private readonly prisma: PrismaService,
    private readonly scriptGenerator: K6ScriptGeneratorService,
    private readonly executionService: K6ExecutionService,
  ) {}

  onModuleInit() {
    const concurrency = parseInt(
      process.env.LOAD_TEST_WORKER_CONCURRENCY || '2',
      10,
    );

    this.worker = new Worker<LoadTestJobData>(
      LOAD_TEST_QUEUE,
      async (job: Job<LoadTestJobData>) => {
        return this.process(job);
      },
      {
        connection: this.redisConnection,
        concurrency,
      },
    );

    this.worker.on('ready', () => {
      this.logger.log(
        `[LoadTestWorker] Initialized BullMQ worker on queue "${LOAD_TEST_QUEUE}". Concurrency: ${concurrency}`,
      );
    });

    this.worker.on('error', (err) => {
      this.logger.error(
        `[LoadTestWorker] Worker error: ${err.message}`,
        err.stack,
      );
    });

    this.worker.on('failed', (job, err) => {
      this.logger.warn(
        `[LoadTestWorker] Job ${job?.id} failed with error: ${err.message}`,
      );
    });
  }

  async process(job: Job<LoadTestJobData>): Promise<void> {
    const { loadTestId } = job.data;
    this.logger.log(`[LoadTestWorker] Starting job for loadTest=${loadTestId}`);

    const loadTest = await this.prisma.loadTest.findUnique({
      where: { id: loadTestId },
      include: {
        environment: true,
      },
    });

    if (!loadTest) {
      this.logger.warn(`[LoadTestWorker] LoadTest ${loadTestId} not found, skipping.`);
      return;
    }

    if (loadTest.status === LoadTestStatus.CANCELLED) {
      this.logger.log(`[LoadTestWorker] LoadTest ${loadTestId} was already cancelled.`);
      return;
    }

    // Mark test as RUNNING
    const startedAt = new Date();
    await this.prisma.loadTest.update({
      where: { id: loadTestId },
      data: {
        status: LoadTestStatus.RUNNING,
        startedAt,
        errorMessage: null,
      },
    });

    try {
      // 1. Generate k6 script
      const scriptContent = this.scriptGenerator.generateScript(
        loadTest,
        loadTest.environment?.baseUrl,
      );

      // 2. Execute k6 script
      const { result, samples, isCancelled } = await this.executionService.runScript(
        loadTestId,
        scriptContent,
        {
          virtualUsers: loadTest.virtualUsers,
          duration: loadTest.duration ?? undefined,
          requestCount: loadTest.requestCount ?? undefined,
        },
      );

      // Re-check status from DB in case user cancelled via API
      const freshTest = await this.prisma.loadTest.findUnique({
        where: { id: loadTestId },
      });

      if (isCancelled || freshTest?.status === LoadTestStatus.CANCELLED) {
        this.logger.log(`[LoadTestWorker] LoadTest ${loadTestId} cancelled.`);
        await this.prisma.loadTest.update({
          where: { id: loadTestId },
          data: {
            status: LoadTestStatus.CANCELLED,
            completedAt: new Date(),
          },
        });
        return;
      }

      // 3. Persist results in transaction
      await this.prisma.$transaction(async (tx) => {
        // Upsert result
        await tx.loadTestResult.upsert({
          where: { loadTestId },
          create: {
            loadTestId,
            totalRequests: result.totalRequests,
            successfulRequests: result.successfulRequests,
            failedRequests: result.failedRequests,
            requestsPerSecond: result.requestsPerSecond,
            actualDurationSeconds: result.actualDurationSeconds,
            avgLatency: result.avgLatency,
            minLatency: result.minLatency,
            maxLatency: result.maxLatency,
            p50Latency: result.p50Latency,
            p90Latency: result.p90Latency,
            p95Latency: result.p95Latency,
            p99Latency: result.p99Latency,
            errorRate: result.errorRate,
            timeoutCount: result.timeoutCount,
            connectionErrors: result.connectionErrors,
            statusCodeCounts: result.statusCodeCounts as Prisma.InputJsonValue,
            errorBreakdown: result.errorBreakdown as Prisma.InputJsonValue,
          },
          update: {
            totalRequests: result.totalRequests,
            successfulRequests: result.successfulRequests,
            failedRequests: result.failedRequests,
            requestsPerSecond: result.requestsPerSecond,
            actualDurationSeconds: result.actualDurationSeconds,
            avgLatency: result.avgLatency,
            minLatency: result.minLatency,
            maxLatency: result.maxLatency,
            p50Latency: result.p50Latency,
            p90Latency: result.p90Latency,
            p95Latency: result.p95Latency,
            p99Latency: result.p99Latency,
            errorRate: result.errorRate,
            timeoutCount: result.timeoutCount,
            connectionErrors: result.connectionErrors,
            statusCodeCounts: result.statusCodeCounts as Prisma.InputJsonValue,
            errorBreakdown: result.errorBreakdown as Prisma.InputJsonValue,
          },
        });

        // Insert samples
        if (samples.length > 0) {
          // Delete existing samples if any
          await tx.loadTestSample.deleteMany({
            where: { loadTestId },
          });

          await tx.loadTestSample.createMany({
            data: samples.map((s) => ({
              loadTestId,
              timestamp: s.timestamp,
              relativeSeconds: s.relativeSeconds,
              requestsPerSecond: s.requestsPerSecond,
              activeUsers: s.activeUsers,
              avgLatency: s.avgLatency,
              p50Latency: s.p50Latency,
              p95Latency: s.p95Latency,
              p99Latency: s.p99Latency,
              errorRate: s.errorRate,
              totalRequestsSoFar: s.totalRequestsSoFar,
              successCount: s.successCount,
              failureCount: s.failureCount,
            })),
          });
        }

        // Mark as COMPLETED
        await tx.loadTest.update({
          where: { id: loadTestId },
          data: {
            status: LoadTestStatus.COMPLETED,
            completedAt: new Date(),
            errorMessage: null,
          },
        });
      });

      this.logger.log(
        `[LoadTestWorker] LoadTest ${loadTestId} COMPLETED: ${result.totalRequests} reqs, ${result.requestsPerSecond} rps, P95=${result.p95Latency}ms, ErrorRate=${result.errorRate}%`,
      );
    } catch (err: any) {
      this.logger.error(
        `[LoadTestWorker] Execution failed for loadTest=${loadTestId}: ${err.message}`,
        err.stack,
      );

      await this.prisma.loadTest.update({
        where: { id: loadTestId },
        data: {
          status: LoadTestStatus.FAILED,
          completedAt: new Date(),
          errorMessage: err.message || 'Load test execution failed',
        },
      });
    }
  }

  async onModuleDestroy() {
    if (this.worker) {
      await this.worker.close();
    }
  }
}

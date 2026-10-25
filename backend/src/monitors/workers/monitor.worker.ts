import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Job, Worker } from 'bullmq';
import Redis from 'ioredis';
import { MONITOR_QUEUE, REDIS_CONNECTION } from '../../queue/queue.constants';
import { MonitorExecutionService } from '../services/monitor-execution.service';

export interface MonitorJobData {
  monitorId: string;
}

@Injectable()
export class MonitorWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MonitorWorker.name);
  private worker: Worker;

  constructor(
    @Inject(REDIS_CONNECTION) private readonly redisConnection: Redis,
    private readonly executionService: MonitorExecutionService,
  ) {}

  onModuleInit() {
    const concurrency = parseInt(process.env.MONITOR_WORKER_CONCURRENCY || '10', 10);

    this.worker = new Worker<MonitorJobData>(
      MONITOR_QUEUE,
      async (job: Job<MonitorJobData>) => {
        return this.process(job);
      },
      {
        connection: this.redisConnection,
        concurrency,
      },
    );

    this.worker.on('ready', () => {
      this.logger.log(`MonitorWorker connected to Redis. Concurrency: ${concurrency}`);
    });

    this.worker.on('error', (err) => {
      this.logger.error(`MonitorWorker encountered an error: ${err.message}`, err.stack);
    });

    this.worker.on('failed', (job, err) => {
      this.logger.warn(`Job ${job?.id} failed with error: ${err.message}`);
    });
  }

  async process(job: Job<MonitorJobData>) {
    const { monitorId } = job.data;
    this.logger.log(`[MonitoringWorker] Starting monitor=${monitorId}`);

    try {
      const execution = await this.executionService.executeMonitor(monitorId);

      if (!execution) {
        this.logger.log(`[MonitoringWorker] Monitor ${monitorId} was inactive or skipped.`);
        return null;
      }

      this.logger.log(
        `[MonitoringWorker] Completed: monitor=${monitorId} status=${execution.statusCode ?? execution.status} duration=${execution.durationMs}ms`,
      );

      return {
        monitorId,
        status: execution.status,
        statusCode: execution.statusCode,
        responseTimeMs: execution.durationMs,
        executionId: execution.id,
      };
    } catch (err: any) {
      this.logger.error(
        `[MonitoringWorker] Unexpected worker exception for monitor ${monitorId}: ${err.message}`,
        err.stack,
      );
      // Even on unexpected exceptions, ensure worker stays alive
    }
  }

  async onModuleDestroy() {
    if (this.worker) {
      await this.worker.close();
      this.logger.log('MonitorWorker closed gracefully.');
    }
  }
}

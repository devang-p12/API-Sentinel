import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Job, Worker } from 'bullmq';
import Redis from 'ioredis';
import { REDIS_CONNECTION } from '../../queue/queue.constants';
import { ALERT_EVALUATION_QUEUE } from '../alert-rules.constants';
import { AlertEvaluationService } from '../services/alert-evaluation.service';

@Injectable()
export class AlertEvaluationWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AlertEvaluationWorker.name);
  private worker: Worker;

  constructor(
    @Inject(REDIS_CONNECTION) private readonly redisConnection: Redis,
    private readonly evaluationService: AlertEvaluationService,
  ) {}

  onModuleInit() {
    const concurrency = parseInt(process.env.ALERT_WORKER_CONCURRENCY || '5', 10);

    this.worker = new Worker(
      ALERT_EVALUATION_QUEUE,
      async (job: Job) => {
        return this.process(job);
      },
      {
        connection: this.redisConnection,
        concurrency,
      },
    );

    this.worker.on('ready', () => {
      this.logger.log(`AlertEvaluationWorker connected to Redis. Concurrency: ${concurrency}`);
    });

    this.worker.on('error', (err) => {
      this.logger.error(`AlertEvaluationWorker error: ${err.message}`, err.stack);
    });

    this.worker.on('failed', (job, err) => {
      this.logger.warn(`Alert job ${job?.id} failed: ${err.message}`);
    });
  }

  async process(job: Job) {
    if (job.name === 'evaluate-rule') {
      const { ruleId } = job.data;
      if (ruleId) {
        await this.evaluationService.evaluateRule(ruleId);
      }
    } else if (job.name === 'sweep-all-rules') {
      await this.evaluationService.evaluateAllDueRules();
    }
  }

  async onModuleDestroy() {
    if (this.worker) {
      await this.worker.close();
      this.logger.log('AlertEvaluationWorker closed gracefully.');
    }
  }
}

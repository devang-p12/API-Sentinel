import cron, { ScheduledTask } from 'node-cron';
import { LoadTestService } from './load-test.service';
import { validateMinimum24Hours, ScheduleConfigInput } from '../validators/load-test.validator';

export interface SchedulerConfig {
  enabled: boolean;
  cronExpression: string;
  virtualUsers: number;
  duration: string;
  concurrency: number;
}

export interface SchedulerStatus extends SchedulerConfig {
  isRunning: boolean;
  isJobActive: boolean;
  lastRunAt: string | null;
  lastBatchId: string | null;
  totalScheduledRuns: number;
}

export class SchedulerService {
  private loadTestService: LoadTestService;
  private cronTask: ScheduledTask | null = null;
  private isRunning: boolean = false;
  private lastRunAt: string | null = null;
  private lastBatchId: string | null = null;
  private totalScheduledRuns: number = 0;

  private config: SchedulerConfig;

  constructor(loadTestService?: LoadTestService) {
    this.loadTestService = loadTestService || new LoadTestService();

    // Default configuration from environment variables or safe defaults
    const rawCron = process.env.SCHEDULED_CRON_EXPRESSION || '0 0 * * *';
    const validCron = validateMinimum24Hours(rawCron) ? rawCron : '0 0 * * *';

    this.config = {
      enabled: process.env.SCHEDULED_TESTS_ENABLED === 'true',
      cronExpression: validCron,
      virtualUsers: Math.min(500, Math.max(1, parseInt(process.env.SCHEDULED_VUS || '10', 10))),
      duration: process.env.SCHEDULED_DURATION || '15s',
      concurrency: Math.min(5, Math.max(1, parseInt(process.env.SCHEDULED_CONCURRENCY || '2', 10))),
    };
  }

  /**
   * Initializes and starts the scheduler if enabled
   */
  init() {
    if (this.config.enabled) {
      this.startJob();
      console.log(
        `⏰ Scheduled Load Testing enabled: "${this.config.cronExpression}" (${this.config.virtualUsers} VUs, ${this.config.duration}, Concurrency: ${this.config.concurrency})`
      );
    } else {
      console.log('⏰ Scheduled Load Testing is currently disabled (can be enabled via config or API)');
    }
  }

  private startJob() {
    if (this.cronTask) {
      this.cronTask.stop();
      this.cronTask = null;
    }

    if (!cron.validate(this.config.cronExpression)) {
      console.error(`Invalid cron expression: ${this.config.cronExpression}`);
      return;
    }

    this.cronTask = cron.schedule(this.config.cronExpression, async () => {
      await this.runScheduledBatch();
    });
  }

  /**
   * Executes scheduled batch load test across all active registered APIs
   */
  async runScheduledBatch() {
    if (this.isRunning) {
      console.warn('⚠️ Scheduled load test skipped: A previous load test run is still in progress.');
      return;
    }

    this.isRunning = true;
    this.lastRunAt = new Date().toISOString();
    this.totalScheduledRuns++;

    console.log(
      `🚀 Starting scheduled batch load test [Run #${this.totalScheduledRuns}] at ${this.lastRunAt}...`
    );

    try {
      const batchResult = await this.loadTestService.runAllApisLoadTestAsync(
        {
          virtualUsers: this.config.virtualUsers,
          duration: this.config.duration,
          concurrency: this.config.concurrency,
          environment: 'all',
        },
        'scheduled'
      );

      this.lastBatchId = batchResult.batchId;
      console.log(
        `✅ Scheduled batch test initiated successfully with batch ID: ${batchResult.batchId}`
      );
    } catch (err: any) {
      console.error('❌ Scheduled load test encountered an error:', err.message);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Returns current scheduler status and configuration
   */
  getStatus(): SchedulerStatus {
    return {
      ...this.config,
      isRunning: this.isRunning,
      isJobActive: this.cronTask !== null,
      lastRunAt: this.lastRunAt,
      lastBatchId: this.lastBatchId,
      totalScheduledRuns: this.totalScheduledRuns,
    };
  }

  /**
   * Updates scheduler configuration dynamically
   */
  updateConfig(newConfig: ScheduleConfigInput): SchedulerStatus {
    if (!validateMinimum24Hours(newConfig.cronExpression)) {
      throw new Error(
        'Scheduled testing interval must be strictly at least 24 hours (e.g., "0 0 * * *" for once a day). Sub-daily intervals are prohibited.'
      );
    }

    if (!cron.validate(newConfig.cronExpression)) {
      throw new Error(`Invalid cron format: ${newConfig.cronExpression}`);
    }

    this.config = {
      enabled: newConfig.enabled,
      cronExpression: newConfig.cronExpression,
      virtualUsers: Math.min(500, Math.max(1, newConfig.virtualUsers)),
      duration: newConfig.duration,
      concurrency: Math.min(5, Math.max(1, newConfig.concurrency)),
    };

    if (this.config.enabled) {
      this.startJob();
    } else if (this.cronTask) {
      this.cronTask.stop();
      this.cronTask = null;
    }

    return this.getStatus();
  }

  /**
   * Stops the background scheduler
   */
  stop() {
    if (this.cronTask) {
      this.cronTask.stop();
      this.cronTask = null;
    }
  }
}

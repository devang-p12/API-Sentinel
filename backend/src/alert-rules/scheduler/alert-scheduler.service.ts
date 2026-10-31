import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Queue } from 'bullmq';
import { ALERT_BULL_QUEUE } from '../alert-rules.constants';

@Injectable()
export class AlertSchedulerService implements OnModuleInit {
  private readonly logger = new Logger(AlertSchedulerService.name);

  constructor(@Inject(ALERT_BULL_QUEUE) private readonly alertQueue: Queue) {}

  onModuleInit() {
    // Register global recurring alert evaluation sweep asynchronously in background
    // to prevent blocking HTTP server port binding
    this.registerGlobalSweep(30).catch((err) => {
      this.logger.warn(`Deferred global alert sweep registration: ${err.message}`);
    });
  }

  /**
   * Registers a global periodic sweep that ensures all enabled rules are evaluated.
   */
  async registerGlobalSweep(intervalSeconds = 30) {
    try {
      await this.alertQueue.add(
        'sweep-all-rules',
        {},
        {
          jobId: 'global-alert-sweep',
          repeat: {
            every: intervalSeconds * 1000,
          },
        },
      );
      this.logger.log(`Registered global alert evaluation sweep every ${intervalSeconds}s`);
    } catch (err: any) {
      this.logger.warn(`Could not register global alert sweep: ${err.message}`);
    }
  }

  /**
   * Schedules a recurring evaluation job for a specific rule.
   */
  async scheduleRule(ruleId: string, intervalSeconds: number) {
    await this.unscheduleRule(ruleId);

    const intervalMs = Math.max(intervalSeconds, 5) * 1000;

    await this.alertQueue.add(
      'evaluate-rule',
      { ruleId },
      {
        jobId: `rule-${ruleId}`,
        repeat: {
          every: intervalMs,
        },
      },
    );

    this.logger.log(`Scheduled recurring evaluation for rule ${ruleId} every ${intervalSeconds}s`);
  }

  /**
   * Unschedules recurring evaluation for a rule.
   */
  async unscheduleRule(ruleId: string) {
    try {
      const repeatableJobs = await this.alertQueue.getRepeatableJobs();
      for (const job of repeatableJobs) {
        if (job.id === `rule-${ruleId}` || job.key.includes(ruleId)) {
          await this.alertQueue.removeRepeatableByKey(job.key);
          this.logger.log(`Removed repeatable alert job for rule ${ruleId}`);
        }
      }
    } catch (err: any) {
      this.logger.warn(`Error unscheduling rule ${ruleId}: ${err.message}`);
    }
  }

  /**
   * Triggers an immediate one-off evaluation of a rule.
   */
  async triggerImmediateEvaluation(ruleId: string) {
    await this.alertQueue.add(
      'evaluate-rule',
      { ruleId },
      {
        jobId: `immediate-eval-${ruleId}-${Date.now()}`,
      },
    );
  }
}

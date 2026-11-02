import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit, Optional } from '@nestjs/common';
import { Queue } from 'bullmq';
import { ALERT_BULL_QUEUE } from '../alert-rules.constants';
import { AlertEvaluationService } from '../services/alert-evaluation.service';

@Injectable()
export class AlertSchedulerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AlertSchedulerService.name);
  private sweepInterval: NodeJS.Timeout | null = null;

  constructor(
    @Inject(ALERT_BULL_QUEUE) private readonly alertQueue: Queue,
    @Optional() private readonly evaluationService?: AlertEvaluationService,
  ) {}

  onModuleInit() {
    // 1. Register global recurring alert evaluation sweep with BullMQ
    this.registerGlobalSweep(30).catch((err) => {
      this.logger.warn(`Deferred global alert sweep registration: ${err.message}`);
    });

    // 2. Fallback periodic background interval (every 30s) to guarantee rules are evaluated
    // even if Redis/BullMQ repeat scheduler is delayed or experiencing network partitions
    if (this.evaluationService) {
      // Immediate kickstart after 3s
      setTimeout(() => {
        this.evaluationService?.evaluateAllDueRules().catch((e) => {
          this.logger.debug(`Initial alert sweep: ${e.message}`);
        });
      }, 3000);

      this.sweepInterval = setInterval(() => {
        this.evaluationService?.evaluateAllDueRules().catch((e) => {
          this.logger.debug(`Background alert sweep: ${e.message}`);
        });
      }, 30000);
    }
  }

  onModuleDestroy() {
    if (this.sweepInterval) {
      clearInterval(this.sweepInterval);
      this.sweepInterval = null;
    }
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

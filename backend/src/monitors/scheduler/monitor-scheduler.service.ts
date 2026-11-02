import { Inject, Injectable, Logger } from '@nestjs/common';
import { Queue } from 'bullmq';
import { MONITOR_BULL_QUEUE } from '../../queue/queue.constants';

export interface MonitorScheduleConfig {
  id: string;
  organizationId: string;
  apiId?: string;
  environmentId?: string;
  intervalSeconds?: number;
  interval?: number;
  isActive?: boolean;
  enabled?: boolean;
}

export interface MonitorJobData {
  monitorId: string;
  monitorConfigId?: string;
  organizationId: string;
  apiId?: string;
  environmentId?: string;
}

@Injectable()
export class MonitorSchedulerService {
  private readonly logger = new Logger(MonitorSchedulerService.name);

  constructor(@Inject(MONITOR_BULL_QUEUE) private readonly monitorQueue: Queue) {}

  /**
   * Schedules a recurring monitor job in BullMQ.
   * Enforces:
   * 1. Organization-awareness (organizationId stored in job data).
   * 2. Duplicate prevention (cleans any existing repeatable jobs for this monitor ID).
   * 3. Interval adherence (converts interval in seconds to milliseconds).
   * 4. Disabled monitor handling (removes schedule, skips scheduling if disabled/inactive).
   */
  async scheduleMonitor(monitor: MonitorScheduleConfig) {
    const isEnabled = (monitor.isActive ?? monitor.enabled ?? true) !== false;
    const intervalSeconds = monitor.intervalSeconds ?? monitor.interval ?? 60;
    const intervalMs = Math.max(5000, intervalSeconds * 1000);

    // 1. Always unschedule existing repeatable jobs for this monitor to prevent duplicates
    await this.unscheduleMonitor(monitor.id);

    if (!isEnabled) {
      this.logger.log(`Monitor ${monitor.id} is inactive/disabled; recurring schedule removed.`);
      return { scheduled: false, reason: 'disabled' };
    }

    const jobData: MonitorJobData = {
      monitorId: monitor.id,
      monitorConfigId: monitor.id,
      organizationId: monitor.organizationId,
      apiId: monitor.apiId,
      environmentId: monitor.environmentId,
    };

    // 2. Register recurring repeatable job with BullMQ
    const job = await this.monitorQueue.add(
      'execute-monitor',
      jobData,
      {
        jobId: `monitor-${monitor.id}`,
        repeat: {
          every: intervalMs,
        },
        removeOnComplete: 100,
        removeOnFail: 500,
      },
    );

    this.logger.log(
      `Scheduled recurring monitor ${monitor.id} (org: ${monitor.organizationId}) every ${intervalSeconds}s (${intervalMs}ms)`,
    );

    return {
      scheduled: true,
      jobId: job.id,
      intervalSeconds,
      intervalMs,
      organizationId: monitor.organizationId,
    };
  }

  /**
   * Triggers an immediate one-off execution of a monitor.
   * Prevents duplicates by verifying if an immediate job is already queued.
   */
  async triggerImmediateRun(config: {
    id: string;
    organizationId?: string;
    apiId?: string;
    environmentId?: string;
  }) {
    const monitorId = config.id;

    // Check if an immediate job for this monitor is already queued in BullMQ waiting state
    try {
      const waitingJobs = await this.monitorQueue.getJobs(['waiting', 'delayed']);
      const alreadyQueued = waitingJobs.some(
        (job) => job.data?.monitorId === monitorId && job.name === 'execute-monitor-immediate',
      );

      if (alreadyQueued) {
        this.logger.warn(`Immediate execution for monitor ${monitorId} is already queued. Skipping duplicate.`);
        return { queued: false, reason: 'duplicate_prevented', monitorId };
      }
    } catch (err: any) {
      this.logger.warn(`Could not check waiting jobs: ${err.message}`);
    }

    const jobData: MonitorJobData = {
      monitorId,
      monitorConfigId: monitorId,
      organizationId: config.organizationId || '',
      apiId: config.apiId,
      environmentId: config.environmentId,
    };

    const immediateJob = await this.monitorQueue.add(
      'execute-monitor-immediate',
      jobData,
      {
        jobId: `immediate-${monitorId}-${Date.now()}`,
        removeOnComplete: 50,
        removeOnFail: 100,
      },
    );

    this.logger.log(`Queued immediate execution for monitor ${monitorId} (job: ${immediateJob.id})`);

    return {
      queued: true,
      jobId: immediateJob.id,
      monitorId,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Completely unschedules all recurring jobs for a monitor.
   */
  async unscheduleMonitor(monitorId: string) {
    try {
      const repeatableJobs = await this.monitorQueue.getRepeatableJobs();
      let removedCount = 0;
      for (const job of repeatableJobs) {
        if (job.id === `monitor-${monitorId}` || job.key.includes(monitorId)) {
          await this.monitorQueue.removeRepeatableByKey(job.key);
          removedCount++;
          this.logger.log(`Removed repeatable job key ${job.key} for monitor ${monitorId}`);
        }
      }
      return { removedCount };
    } catch (err: any) {
      this.logger.warn(`Error removing repeatable jobs for monitor ${monitorId}: ${err.message}`);
      return { removedCount: 0, error: err.message };
    }
  }

  /**
   * Retrieves any active repeatable jobs for a given monitor ID.
   */
  async getScheduledJob(monitorId: string) {
    try {
      const repeatableJobs = await this.monitorQueue.getRepeatableJobs();
      return repeatableJobs.filter(
        (job) => job.id === `monitor-${monitorId}` || job.key.includes(monitorId),
      );
    } catch (err: any) {
      this.logger.warn(`Error inspecting repeatable jobs for ${monitorId}: ${err.message}`);
      return [];
    }
  }
}

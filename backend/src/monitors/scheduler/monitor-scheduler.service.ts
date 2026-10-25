import { Inject, Injectable, Logger } from '@nestjs/common';
import { Queue } from 'bullmq';
import { MONITOR_BULL_QUEUE } from '../../queue/queue.constants';

@Injectable()
export class MonitorSchedulerService {
  private readonly logger = new Logger(MonitorSchedulerService.name);

  constructor(@Inject(MONITOR_BULL_QUEUE) private readonly monitorQueue: Queue) {}

  async scheduleMonitor(monitor: { id: string; intervalSeconds: number; isActive: boolean }) {
    await this.unscheduleMonitor(monitor.id);

    if (!monitor.isActive) {
      this.logger.log(`Monitor ${monitor.id} is inactive; skipping recurring schedule.`);
      return;
    }

    const intervalMs = monitor.intervalSeconds * 1000;

    // 1. Register recurring repeatable job
    await this.monitorQueue.add(
      'execute-monitor',
      { monitorId: monitor.id },
      {
        jobId: `monitor-${monitor.id}`,
        repeat: {
          every: intervalMs,
        },
      },
    );

    this.logger.log(`Scheduled recurring monitor ${monitor.id} every ${monitor.intervalSeconds}s`);

    // 2. Immediately trigger an initial one-off execution
    await this.triggerImmediateRun(monitor.id);
  }

  async triggerImmediateRun(monitorId: string) {
    await this.monitorQueue.add(
      'execute-monitor',
      { monitorId },
      {
        jobId: `immediate-${monitorId}-${Date.now()}`,
      },
    );
    this.logger.log(`Queued immediate execution for monitor ${monitorId}`);
  }

  async unscheduleMonitor(monitorId: string) {
    try {
      const repeatableJobs = await this.monitorQueue.getRepeatableJobs();
      for (const job of repeatableJobs) {
        if (job.id === `monitor-${monitorId}` || job.key.includes(monitorId)) {
          await this.monitorQueue.removeRepeatableByKey(job.key);
          this.logger.log(`Removed repeatable job for monitor ${monitorId}`);
        }
      }
    } catch (err: any) {
      this.logger.warn(`Error removing repeatable jobs for monitor ${monitorId}: ${err.message}`);
    }
  }
}

import { Module } from '@nestjs/common';
import { MonitorsController } from './monitors.controller';
import { MonitorsService } from './monitors.service';
import { MonitorSchedulerService } from './scheduler/monitor-scheduler.service';
import { HttpProbeService } from './services/http-probe.service';
import { MonitorExecutionService } from './services/monitor-execution.service';
import { MonitorWorker } from './workers/monitor.worker';

import { AlertRulesModule } from '../alert-rules/alert-rules.module';

@Module({
  imports: [AlertRulesModule],
  controllers: [MonitorsController],
  providers: [
    MonitorsService,
    MonitorSchedulerService,
    HttpProbeService,
    MonitorExecutionService,
    MonitorWorker,
  ],
  exports: [MonitorsService, MonitorExecutionService],
})
export class MonitorsModule {}

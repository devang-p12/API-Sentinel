import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { DashboardsModule } from '../dashboards/dashboards.module';
import { AlertFingerprintService } from './services/alert-fingerprint.service';
import { AlertStateMachineService } from './services/alert-state-machine.service';
import { AlertEvaluationService } from './services/alert-evaluation.service';
import { AlertRulesService } from './services/alert-rules.service';
import { AlertInstancesService } from './services/alert-instances.service';
import { AlertSchedulerService } from './scheduler/alert-scheduler.service';
import { AlertEvaluationWorker } from './workers/alert-evaluation.worker';
import { AlertRulesController } from './alert-rules.controller';

@Module({
  imports: [PrismaModule, DashboardsModule],
  controllers: [AlertRulesController],
  providers: [
    AlertFingerprintService,
    AlertStateMachineService,
    AlertEvaluationService,
    AlertRulesService,
    AlertInstancesService,
    AlertSchedulerService,
    AlertEvaluationWorker,
  ],
  exports: [
    AlertRulesService,
    AlertInstancesService,
    AlertEvaluationService,
    AlertSchedulerService,
    AlertFingerprintService,
    AlertStateMachineService,
  ],
})
export class AlertRulesModule {}

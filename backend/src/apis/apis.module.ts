import { Module } from '@nestjs/common';
import { ApisController } from './apis.controller';
import { ApisService } from './apis.service';
import { EnvironmentsModule } from '../environments/environments.module';
import { HealthEvaluationModule } from '../health-evaluation/health-evaluation.module';
import { ReliabilityScoreModule } from '../reliability-score/reliability-score.module';

@Module({
  imports: [EnvironmentsModule, HealthEvaluationModule, ReliabilityScoreModule],
  controllers: [ApisController],
  providers: [ApisService],
  exports: [ApisService],
})
export class ApisModule {}

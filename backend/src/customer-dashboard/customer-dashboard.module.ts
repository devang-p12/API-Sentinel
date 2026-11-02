import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { HealthEvaluationModule } from '../health-evaluation/health-evaluation.module';
import { ReliabilityScoreModule } from '../reliability-score/reliability-score.module';
import { CustomerDashboardController } from './customer-dashboard.controller';
import { CustomerDashboardService } from './customer-dashboard.service';

@Module({
  imports: [PrismaModule, HealthEvaluationModule, ReliabilityScoreModule],
  controllers: [CustomerDashboardController],
  providers: [CustomerDashboardService],
  exports: [CustomerDashboardService],
})
export class CustomerDashboardModule {}

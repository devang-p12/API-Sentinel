import { Module } from '@nestjs/common';
import { HealthEvaluationService } from './health-evaluation.service';
import { HealthEvaluationController } from './health-evaluation.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [HealthEvaluationController],
  providers: [HealthEvaluationService],
  exports: [HealthEvaluationService],
})
export class HealthEvaluationModule {}

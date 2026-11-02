import { Module } from '@nestjs/common';
import { ReliabilityScoreService } from './reliability-score.service';
import { ReliabilityScoreController } from './reliability-score.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [ReliabilityScoreController],
  providers: [ReliabilityScoreService],
  exports: [ReliabilityScoreService],
})
export class ReliabilityScoreModule {}

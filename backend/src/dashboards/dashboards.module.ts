import { Module } from '@nestjs/common';
import { DashboardsController } from './dashboards.controller';
import { DashboardsService } from './dashboards.service';
import { MetricQueryService } from './services/metric-query.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [DashboardsController],
  providers: [DashboardsService, MetricQueryService],
  exports: [DashboardsService, MetricQueryService],
})
export class DashboardsModule {}

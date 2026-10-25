import { Module } from '@nestjs/common';
import { DashboardsController } from './dashboards.controller';
import { DashboardsService } from './dashboards.service';
import { MetricQueryService } from './services/metric-query.service';
import { PostgresMetricDataSource } from './data-sources/postgres-metric-data-source.service';
import { METRIC_DATA_SOURCE } from './data-sources/metric-data-source.interface';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [DashboardsController],
  providers: [
    DashboardsService,
    PostgresMetricDataSource,
    {
      provide: METRIC_DATA_SOURCE,
      useClass: PostgresMetricDataSource,
    },
    MetricQueryService,
  ],
  exports: [DashboardsService, MetricQueryService, METRIC_DATA_SOURCE],
})
export class DashboardsModule {}

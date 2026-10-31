import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { QueueModule } from './queue/queue.module';
import { ProjectsModule } from './projects/projects.module';
import { ApisModule } from './apis/apis.module';
import { EnvironmentsModule } from './environments/environments.module';
import { MonitorsModule } from './monitors/monitors.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { AlertsModule } from './alerts/alerts.module';
import { AlertRulesModule } from './alert-rules/alert-rules.module';
import { IncidentsModule } from './incidents/incidents.module';
import { DashboardsModule } from './dashboards/dashboards.module';
import { NotificationsModule } from './notifications/notifications.module';
import { LoadTestsModule } from './load-tests/load-tests.module';
import { ApiTesterModule } from './api-tester/api-tester.module';
import { BootstrapService } from './common/bootstrap.service';

@Module({
  imports: [
    PrismaModule,
    QueueModule,
    ProjectsModule,
    ApisModule,
    EnvironmentsModule,
    MonitorsModule,
    AnalyticsModule,
    AlertsModule,
    AlertRulesModule,
    IncidentsModule,
    DashboardsModule,
    NotificationsModule,
    LoadTestsModule,
    ApiTesterModule,
  ],
  providers: [BootstrapService],
})
export class AppModule {}

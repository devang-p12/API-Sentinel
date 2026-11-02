import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './prisma/prisma.module';
import { QueueModule } from './queue/queue.module';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { RolesGuard } from './auth/guards/roles.guard';
import { OrganizationsModule } from './organizations/organizations.module';
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
import { RequestExecutionModule } from './request-execution/request-execution.module';
import { HealthEvaluationModule } from './health-evaluation/health-evaluation.module';
import { ReliabilityScoreModule } from './reliability-score/reliability-score.module';
import { SchemaMonitoringModule } from './schema-monitoring/schema-monitoring.module';
import { CustomerDashboardModule } from './customer-dashboard/customer-dashboard.module';
import { MetricsModule } from './metrics/metrics.module';
import { GrafanaModule } from './grafana/grafana.module';
import { BootstrapService } from './common/bootstrap.service';

@Module({
  imports: [
    PrismaModule,
    QueueModule,
    AuthModule,
    OrganizationsModule,
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
    RequestExecutionModule,
    HealthEvaluationModule,
    ReliabilityScoreModule,
    SchemaMonitoringModule,
    CustomerDashboardModule,
    MetricsModule,
    GrafanaModule,
  ],
  providers: [
    BootstrapService,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
})
export class AppModule {}

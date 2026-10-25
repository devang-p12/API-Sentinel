import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { QueueModule } from './queue/queue.module';
import { ProjectsModule } from './projects/projects.module';
import { ApisModule } from './apis/apis.module';
import { EnvironmentsModule } from './environments/environments.module';
import { MonitorsModule } from './monitors/monitors.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { AlertsModule } from './alerts/alerts.module';
import { IncidentsModule } from './incidents/incidents.module';
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
    IncidentsModule,
  ],
  providers: [BootstrapService],
})
export class AppModule {}

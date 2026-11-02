import { Controller, Get, UseGuards } from '@nestjs/common';
import { GrafanaService } from './grafana.service';
import {
  GrafanaHealthStatus,
  GrafanaDataSource,
  GrafanaDashboardSummary,
} from './interfaces/grafana.interface';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('grafana')
@UseGuards(JwtAuthGuard)
export class GrafanaController {
  constructor(private readonly grafanaService: GrafanaService) {}

  /**
   * Health check for internal Grafana infrastructure connectivity.
   * Returns connectivity status and latency without leaking credentials.
   */
  @Get('health')
  async getHealth(): Promise<GrafanaHealthStatus> {
    return this.grafanaService.checkHealth();
  }

  /**
   * Lists internal Grafana data sources (e.g. Prometheus, PostgreSQL).
   */
  @Get('datasources')
  async getDataSources(): Promise<GrafanaDataSource[]> {
    return this.grafanaService.getDataSources();
  }

  /**
   * Lists internal engineering and infrastructure dashboards.
   */
  @Get('dashboards')
  async getInternalDashboards(): Promise<GrafanaDashboardSummary[]> {
    return this.grafanaService.getInternalDashboards();
  }
}

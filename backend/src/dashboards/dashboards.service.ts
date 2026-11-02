import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDashboardDto } from './dto/create-dashboard.dto';
import { UpdateDashboardDto } from './dto/update-dashboard.dto';
import { CreateWidgetDto } from './dto/create-widget.dto';
import { UpdateWidgetDto } from './dto/update-widget.dto';
import { WidgetLayoutItemDto } from './dto/update-layout.dto';
import { PreviewQueryDto } from './dto/preview-query.dto';
import { MetricQueryService } from './services/metric-query.service';
import { getMetricCatalog, getMetricDefinition } from './metric-registry';

@Injectable()
export class DashboardsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly metricQueryService: MetricQueryService,
  ) {}

  getCatalog() {
    return getMetricCatalog();
  }

  async create(dto: CreateDashboardDto, organizationId?: string) {
    if (!dto.name || !dto.name.trim()) {
      throw new BadRequestException('Dashboard name is required');
    }

    let projectId = dto.projectId;
    let project: any;
    if (!projectId) {
      project = await this.prisma.project.findFirst({
        where: organizationId ? { organizationId } : undefined,
      });
      if (!project) {
        throw new NotFoundException('No active project found to associate with the dashboard');
      }
      projectId = project.id;
    } else {
      project = await this.prisma.project.findFirst({
        where: {
          id: projectId,
          ...(organizationId ? { organizationId } : {}),
        },
      });
      if (!project) {
        throw new NotFoundException(`Project with ID ${projectId} not found`);
      }
    }

    return this.prisma.dashboard.create({
      data: {
        name: dto.name.trim(),
        description: dto.description?.trim(),
        projectId,
        organizationId: project.organizationId,
        layout: [],
      },
      include: {
        widgets: true,
        project: true,
      },
    });
  }

  async findAll(projectId?: string, organizationId?: string) {
    return this.prisma.dashboard.findMany({
      where: {
        ...(projectId ? { projectId } : {}),
        ...(organizationId ? { organizationId } : {}),
      },
      include: {
        project: {
          select: { id: true, name: true },
        },
        widgets: {
          select: { id: true, title: true, metric: true, visualizationType: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, organizationId?: string) {
    const dashboard = await this.prisma.dashboard.findFirst({
      where: {
        id,
        ...(organizationId ? { organizationId } : {}),
      },
      include: {
        project: true,
        widgets: {
          orderBy: [{ y: 'asc' }, { x: 'asc' }],
        },
      },
    });

    if (!dashboard) {
      throw new NotFoundException(`Dashboard with ID ${id} not found`);
    }

    return dashboard;
  }

  async update(id: string, dto: UpdateDashboardDto, organizationId?: string) {
    await this.findOne(id, organizationId);

    return this.prisma.dashboard.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.description !== undefined ? { description: dto.description?.trim() } : {}),
        ...(dto.layout !== undefined ? { layout: dto.layout } : {}),
      },
      include: {
        widgets: {
          orderBy: [{ y: 'asc' }, { x: 'asc' }],
        },
        project: true,
      },
    });
  }

  async delete(id: string, organizationId?: string) {
    await this.findOne(id, organizationId);
    return this.prisma.dashboard.delete({
      where: { id },
    });
  }

  // -------------------------------------------------------------
  // WIDGET OPERATIONS
  // -------------------------------------------------------------

  async addWidget(dashboardId: string, dto: CreateWidgetDto, organizationId?: string) {
    await this.findOne(dashboardId, organizationId);

    const metricDef = getMetricDefinition(dto.metric);
    if (!metricDef) {
      throw new BadRequestException(`Invalid metric: "${dto.metric}". Choose from metric catalog.`);
    }

    return this.prisma.dashboardWidget.create({
      data: {
        dashboardId,
        title: dto.title.trim(),
        metric: dto.metric,
        visualizationType: dto.visualizationType,
        configuration: dto.configuration || {},
        x: dto.x ?? 0,
        y: dto.y ?? 0,
        width: dto.width ?? 6,
        height: dto.height ?? 3,
      },
    });
  }

  async updateWidget(
    dashboardId: string,
    widgetId: string,
    dto: UpdateWidgetDto,
    organizationId?: string,
  ) {
    await this.findOne(dashboardId, organizationId);

    const widget = await this.prisma.dashboardWidget.findFirst({
      where: { id: widgetId, dashboardId },
    });

    if (!widget) {
      throw new NotFoundException(`Widget with ID ${widgetId} not found in this dashboard`);
    }

    if (dto.metric) {
      const metricDef = getMetricDefinition(dto.metric);
      if (!metricDef) {
        throw new BadRequestException(`Invalid metric: "${dto.metric}"`);
      }
    }

    return this.prisma.dashboardWidget.update({
      where: { id: widgetId },
      data: {
        ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
        ...(dto.metric !== undefined ? { metric: dto.metric } : {}),
        ...(dto.visualizationType !== undefined ? { visualizationType: dto.visualizationType } : {}),
        ...(dto.configuration !== undefined ? { configuration: dto.configuration } : {}),
        ...(dto.x !== undefined ? { x: dto.x } : {}),
        ...(dto.y !== undefined ? { y: dto.y } : {}),
        ...(dto.width !== undefined ? { width: dto.width } : {}),
        ...(dto.height !== undefined ? { height: dto.height } : {}),
      },
    });
  }

  async deleteWidget(dashboardId: string, widgetId: string, organizationId?: string) {
    await this.findOne(dashboardId, organizationId);

    const widget = await this.prisma.dashboardWidget.findFirst({
      where: { id: widgetId, dashboardId },
    });

    if (!widget) {
      throw new NotFoundException(`Widget with ID ${widgetId} not found in this dashboard`);
    }

    return this.prisma.dashboardWidget.delete({
      where: { id: widgetId },
    });
  }

  async updateLayout(
    dashboardId: string,
    layout: WidgetLayoutItemDto[],
    organizationId?: string,
  ) {
    await this.findOne(dashboardId, organizationId);

    // Update positions in a transaction
    await this.prisma.$transaction(
      layout.map((item) =>
        this.prisma.dashboardWidget.update({
          where: { id: item.id },
          data: {
            x: item.x,
            y: item.y,
            width: item.width,
            height: item.height,
          },
        }),
      ),
    );

    // Also persist snapshot to dashboard.layout
    await this.prisma.dashboard.update({
      where: { id: dashboardId },
      data: { layout: layout as any },
    });

    return { success: true, count: layout.length };
  }

  // -------------------------------------------------------------
  // DASHBOARD DATA & PREVIEW RESOLUTION
  // -------------------------------------------------------------

  async getDashboardData(
    dashboardId: string,
    timeRange?: string,
    fromStr?: string,
    toStr?: string,
    organizationId?: string,
    globalApiId?: string,
    globalEnvironmentId?: string,
    globalMonitorId?: string,
  ) {
    const dashboard = await this.findOne(dashboardId, organizationId);
    const { from, to, label } = this.resolveTimeWindow(timeRange, fromStr, toStr);

    const widgetsWithData = await Promise.all(
      dashboard.widgets.map(async (w) => {
        const config = (w.configuration as any) || {};

        const effectiveApiId = config.apiId || globalApiId;
        const effectiveEnvironmentId = config.environmentId || globalEnvironmentId;
        const effectiveMonitorId = config.monitorId || globalMonitorId;

        let widgetFrom = from;
        let widgetTo = to;
        if (config.timeRange && config.timeRange !== timeRange) {
          const resolved = this.resolveTimeWindow(config.timeRange);
          widgetFrom = resolved.from;
          widgetTo = resolved.to;
        }

        const queryFilters = {
          projectId: dashboard.projectId,
          apiId: effectiveApiId,
          environmentId: effectiveEnvironmentId,
          monitorId: effectiveMonitorId,
        };

        const metricData = await this.metricQueryService.query({
          metric: w.metric,
          filters: queryFilters,
          from: widgetFrom,
          to: widgetTo,
        });

        return {
          id: w.id,
          title: w.title,
          metric: w.metric,
          visualizationType: w.visualizationType,
          x: w.x,
          y: w.y,
          width: w.width,
          height: w.height,
          configuration: w.configuration,
          data: metricData,
          telemetry: metricData.summary,
        };
      }),
    );

    return {
      dashboard: {
        id: dashboard.id,
        name: dashboard.name,
        description: dashboard.description,
        projectId: dashboard.projectId,
        projectName: dashboard.project.name,
        layout: dashboard.layout,
      },
      timeRange: {
        from: from.toISOString(),
        to: to.toISOString(),
        preset: label,
      },
      widgets: widgetsWithData,
    };
  }

  async previewQuery(dto: PreviewQueryDto & { apiId?: string; environmentId?: string; monitorId?: string }) {
    const { from, to } = this.resolveTimeWindow(dto.timeRange, dto.from, dto.to);

    return this.metricQueryService.query({
      metric: dto.metric,
      filters: dto.filters,
      apiId: dto.apiId || dto.filters?.apiId,
      environmentId: dto.environmentId || dto.filters?.environmentId,
      monitorId: dto.monitorId || dto.filters?.monitorId,
      from,
      to,
    });
  }

  private resolveTimeWindow(preset?: string, fromStr?: string, toStr?: string) {
    if (fromStr && toStr) {
      return {
        from: new Date(fromStr),
        to: new Date(toStr),
        label: 'custom',
      };
    }

    const now = new Date();
    const p = preset || '24h';
    let durationMs = 24 * 60 * 60 * 1000;

    switch (p) {
      case '15m':
        durationMs = 15 * 60 * 1000;
        break;
      case '1h':
        durationMs = 60 * 60 * 1000;
        break;
      case '6h':
        durationMs = 6 * 60 * 60 * 1000;
        break;
      case '24h':
        durationMs = 24 * 60 * 60 * 1000;
        break;
      case '7d':
        durationMs = 7 * 24 * 60 * 60 * 1000;
        break;
      case '30d':
        durationMs = 30 * 24 * 60 * 60 * 1000;
        break;
      default:
        durationMs = 24 * 60 * 60 * 1000;
    }

    return {
      from: new Date(now.getTime() - durationMs),
      to: now,
      label: p,
    };
  }
}

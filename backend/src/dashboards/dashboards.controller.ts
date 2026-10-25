import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { DashboardsService } from './dashboards.service';
import { CreateDashboardDto } from './dto/create-dashboard.dto';
import { UpdateDashboardDto } from './dto/update-dashboard.dto';
import { CreateWidgetDto } from './dto/create-widget.dto';
import { UpdateWidgetDto } from './dto/update-widget.dto';
import { UpdateLayoutDto } from './dto/update-layout.dto';
import { PreviewQueryDto } from './dto/preview-query.dto';

@Controller('dashboards')
export class DashboardsController {
  constructor(private readonly dashboardsService: DashboardsService) {}

  @Get('metrics/catalog')
  getCatalog() {
    return this.dashboardsService.getCatalog();
  }

  @Post('preview')
  @HttpCode(HttpStatus.OK)
  previewQuery(@Body() dto: PreviewQueryDto) {
    return this.dashboardsService.previewQuery(dto);
  }

  @Post('metrics/query')
  @HttpCode(HttpStatus.OK)
  queryMetric(@Body() dto: PreviewQueryDto) {
    return this.dashboardsService.previewQuery(dto);
  }

  @Post()
  create(@Body() dto: CreateDashboardDto) {
    return this.dashboardsService.create(dto);
  }

  @Get()
  findAll(@Query('projectId') projectId?: string) {
    return this.dashboardsService.findAll(projectId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.dashboardsService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateDashboardDto) {
    return this.dashboardsService.update(id, dto);
  }

  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.dashboardsService.delete(id);
  }

  @Get(':id/data')
  getDashboardData(
    @Param('id') id: string,
    @Query('timeRange') timeRange?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('apiId') apiId?: string,
    @Query('environmentId') environmentId?: string,
    @Query('monitorId') monitorId?: string,
  ) {
    return this.dashboardsService.getDashboardData(
      id,
      timeRange,
      from,
      to,
      undefined,
      apiId,
      environmentId,
      monitorId,
    );
  }

  @Patch(':id/layout')
  updateLayout(@Param('id') id: string, @Body() dto: UpdateLayoutDto) {
    return this.dashboardsService.updateLayout(id, dto.layout);
  }

  @Post(':id/widgets')
  addWidget(@Param('id') id: string, @Body() dto: CreateWidgetDto) {
    return this.dashboardsService.addWidget(id, dto);
  }

  @Patch(':id/widgets/:widgetId')
  updateWidget(
    @Param('id') id: string,
    @Param('widgetId') widgetId: string,
    @Body() dto: UpdateWidgetDto,
  ) {
    return this.dashboardsService.updateWidget(id, widgetId, dto);
  }

  @Delete(':id/widgets/:widgetId')
  deleteWidget(@Param('id') id: string, @Param('widgetId') widgetId: string) {
    return this.dashboardsService.deleteWidget(id, widgetId);
  }
}

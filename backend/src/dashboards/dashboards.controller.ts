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
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@Controller('dashboards')
export class DashboardsController {
  constructor(private readonly dashboardsService: DashboardsService) {}

  @Get('metrics/catalog')
  getCatalog() {
    return this.dashboardsService.getCatalog();
  }

  @Post('preview')
  @HttpCode(HttpStatus.OK)
  previewQuery(@CurrentUser() user: any, @Body() dto: PreviewQueryDto) {
    return this.dashboardsService.previewQuery(dto);
  }

  @Post('metrics/query')
  @HttpCode(HttpStatus.OK)
  queryMetric(@CurrentUser() user: any, @Body() dto: PreviewQueryDto) {
    return this.dashboardsService.previewQuery(dto);
  }

  @Post()
  @Roles(UserRole.MEMBER)
  create(@CurrentUser() user: any, @Body() dto: CreateDashboardDto) {
    return this.dashboardsService.create(dto, user.organizationId);
  }

  @Get()
  findAll(
    @CurrentUser() user: any,
    @Query('projectId') projectId?: string,
  ) {
    return this.dashboardsService.findAll(projectId, user.organizationId);
  }

  @Get(':id')
  findOne(@CurrentUser() user: any, @Param('id') id: string) {
    return this.dashboardsService.findOne(id, user.organizationId);
  }

  @Patch(':id')
  @Roles(UserRole.MEMBER)
  update(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: UpdateDashboardDto,
  ) {
    return this.dashboardsService.update(id, dto, user.organizationId);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.OWNER)
  delete(@CurrentUser() user: any, @Param('id') id: string) {
    return this.dashboardsService.delete(id, user.organizationId);
  }

  @Get(':id/data')
  getDashboardData(
    @CurrentUser() user: any,
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
      user.organizationId,
      apiId,
      environmentId,
      monitorId,
    );
  }

  @Patch(':id/layout')
  @Roles(UserRole.MEMBER)
  updateLayout(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: UpdateLayoutDto,
  ) {
    return this.dashboardsService.updateLayout(id, dto.layout, user.organizationId);
  }

  @Post(':id/widgets')
  @Roles(UserRole.MEMBER)
  addWidget(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: CreateWidgetDto,
  ) {
    return this.dashboardsService.addWidget(id, dto, user.organizationId);
  }

  @Patch(':id/widgets/:widgetId')
  @Roles(UserRole.MEMBER)
  updateWidget(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Param('widgetId') widgetId: string,
    @Body() dto: UpdateWidgetDto,
  ) {
    return this.dashboardsService.updateWidget(id, widgetId, dto, user.organizationId);
  }

  @Delete(':id/widgets/:widgetId')
  @Roles(UserRole.MEMBER)
  deleteWidget(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Param('widgetId') widgetId: string,
  ) {
    return this.dashboardsService.deleteWidget(id, widgetId, user.organizationId);
  }
}

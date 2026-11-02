import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { MonitorsService } from './monitors.service';
import { CreateMonitorDto } from './dto/create-monitor.dto';
import { UpdateMonitorDto } from './dto/update-monitor.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@Controller('monitors')
export class MonitorsController {
  constructor(private readonly monitorsService: MonitorsService) {}

  // ==========================================
  // MonitorConfig Specific Endpoints
  // ==========================================

  @Post('configs')
  @Roles(UserRole.MEMBER)
  createConfig(@CurrentUser() user: any, @Body() dto: CreateMonitorDto) {
    return this.monitorsService.createConfig(dto, user.organizationId);
  }

  @Get('configs')
  findAllConfigs(
    @CurrentUser() user: any,
    @Query('environmentId') environmentId?: string,
    @Query('apiId') apiId?: string,
  ) {
    return this.monitorsService.findAllConfigs({
      organizationId: user.organizationId,
      apiId,
      environmentId,
    });
  }

  @Get('configs/:id')
  findOneConfig(@CurrentUser() user: any, @Param('id') id: string) {
    return this.monitorsService.findOneConfig(id, user.organizationId);
  }

  @Patch('configs/:id')
  @Roles(UserRole.MEMBER)
  updateConfig(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: UpdateMonitorDto,
  ) {
    return this.monitorsService.updateConfig(id, dto, user.organizationId);
  }

  @Delete('configs/:id')
  @Roles(UserRole.ADMIN, UserRole.OWNER)
  deleteConfig(@CurrentUser() user: any, @Param('id') id: string) {
    return this.monitorsService.deleteConfig(id, user.organizationId);
  }

  @Post('configs/:id/run')
  @Roles(UserRole.MEMBER)
  triggerConfigRun(@CurrentUser() user: any, @Param('id') id: string) {
    return this.monitorsService.triggerManualRun(id, user.organizationId);
  }

  @Get('configs/:id/results')
  getConfigResults(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.monitorsService.getResults({
      organizationId: user.organizationId,
      monitorConfigId: id,
      limit: limit ? parseInt(limit, 10) : 50,
      offset: offset ? parseInt(offset, 10) : 0,
    });
  }

  @Get('configs/:id/health')
  getConfigHealth(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Query('expectedStatus') expectedStatus?: string,
    @Query('latencyThreshold') latencyThreshold?: string,
  ) {
    const policy = {
      ...(expectedStatus ? { expectedStatus: parseInt(expectedStatus, 10) } : {}),
      ...(latencyThreshold ? { degradedLatencyThresholdMs: parseInt(latencyThreshold, 10) } : {}),
    };
    return this.monitorsService.getHealth(id, user.organizationId, policy);
  }

  // ==========================================
  // Monitor Results Endpoint
  // ==========================================

  @Get('results')
  getResults(
    @CurrentUser() user: any,
    @Query('apiId') apiId?: string,
    @Query('environmentId') environmentId?: string,
    @Query('monitorConfigId') monitorConfigId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.monitorsService.getResults({
      organizationId: user.organizationId,
      apiId,
      environmentId,
      monitorConfigId,
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
      limit: limit ? parseInt(limit, 10) : 50,
      offset: offset ? parseInt(offset, 10) : 0,
    });
  }

  // ==========================================
  // Standard / Legacy Monitor Endpoints
  // ==========================================

  @Post()
  @Roles(UserRole.MEMBER)
  create(@CurrentUser() user: any, @Body() dto: CreateMonitorDto) {
    return this.monitorsService.create(dto, user.organizationId);
  }

  @Get()
  findAll(
    @CurrentUser() user: any,
    @Query('environmentId') environmentId?: string,
    @Query('apiId') apiId?: string,
  ) {
    return this.monitorsService.findAll({
      environmentId,
      apiId,
      organizationId: user.organizationId,
    });
  }

  @Get(':id')
  findOne(@CurrentUser() user: any, @Param('id') id: string) {
    return this.monitorsService.findOne(id, user.organizationId);
  }

  @Get(':id/health')
  getHealth(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Query('expectedStatus') expectedStatus?: string,
    @Query('latencyThreshold') latencyThreshold?: string,
  ) {
    const policy = {
      ...(expectedStatus ? { expectedStatus: parseInt(expectedStatus, 10) } : {}),
      ...(latencyThreshold ? { degradedLatencyThresholdMs: parseInt(latencyThreshold, 10) } : {}),
    };
    return this.monitorsService.getHealth(id, user.organizationId, policy);
  }

  @Patch(':id')
  @Roles(UserRole.MEMBER)
  update(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: UpdateMonitorDto,
  ) {
    return this.monitorsService.update(id, dto, user.organizationId);
  }

  @Patch(':id/toggle')
  @Roles(UserRole.MEMBER)
  toggle(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body('enabled') enabled?: boolean,
  ) {
    return this.monitorsService.toggle(id, enabled, user.organizationId);
  }

  @Post(':id/enable')
  @Roles(UserRole.MEMBER)
  enable(@CurrentUser() user: any, @Param('id') id: string) {
    return this.monitorsService.toggle(id, true, user.organizationId);
  }

  @Post(':id/disable')
  @Roles(UserRole.MEMBER)
  disable(@CurrentUser() user: any, @Param('id') id: string) {
    return this.monitorsService.toggle(id, false, user.organizationId);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.OWNER)
  delete(@CurrentUser() user: any, @Param('id') id: string) {
    return this.monitorsService.delete(id, user.organizationId);
  }

  @Get(':id/executions')
  getExecutions(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('status') status?: any,
  ) {
    const parsedLimit = limit ? parseInt(limit, 10) : 50;
    const parsedOffset = offset ? parseInt(offset, 10) : 0;
    const fromDate = from ? new Date(from) : undefined;
    const toDate = to ? new Date(to) : undefined;
    return this.monitorsService.getExecutions(
      id,
      {
        limit: parsedLimit,
        offset: parsedOffset,
        from: fromDate,
        to: toDate,
        status,
      },
      0,
      user.organizationId,
    );
  }

  @Get(':id/executions/:executionId')
  getExecutionById(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Param('executionId') executionId: string,
  ) {
    return this.monitorsService.getExecutionById(
      id,
      executionId,
      user.organizationId,
    );
  }

  @Post(':id/run')
  @Roles(UserRole.MEMBER)
  triggerRun(@CurrentUser() user: any, @Param('id') id: string) {
    return this.monitorsService.triggerManualRun(id, user.organizationId);
  }
}

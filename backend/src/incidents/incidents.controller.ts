import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { IncidentsService } from './incidents.service';
import { IncidentManagerService } from './incident-manager.service';
import { QueryIncidentsDto } from './dto/query-incidents.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@Controller('incidents')
export class IncidentsController {
  constructor(
    private readonly incidentsService: IncidentsService,
    private readonly incidentManagerService: IncidentManagerService,
  ) {}

  @Post('process-check')
  @Roles(UserRole.MEMBER)
  processCheck(
    @CurrentUser() user: any,
    @Body()
    dto: {
      apiId: string;
      environmentId?: string;
      monitorConfigId?: string;
      projectId?: string;
      check: {
        statusCode?: number;
        success: boolean;
        timeout?: boolean;
        errorType?: string;
        errorMessage?: string;
        timestamp?: string;
      };
      recentChecks?: any[];
      policy?: {
        failureThreshold?: number;
        recoveryThreshold?: number;
        defaultSeverity?: any;
      };
    },
  ) {
    return this.incidentManagerService.processCheck({
      organizationId: user.organizationId,
      apiId: dto.apiId,
      environmentId: dto.environmentId,
      monitorConfigId: dto.monitorConfigId,
      projectId: dto.projectId,
      check: dto.check,
      recentChecks: dto.recentChecks,
      policy: dto.policy,
    });
  }

  @Get('summary')
  getSummary(
    @CurrentUser() user: any,
    @Query('projectId') projectId?: string,
  ) {
    return this.incidentsService.getSummary(user.organizationId, projectId);
  }

  @Get()
  findAll(@CurrentUser() user: any, @Query() query: QueryIncidentsDto) {
    return this.incidentsService.findAll(query, user.organizationId);
  }

  @Get(':id/timeline')
  getTimeline(@CurrentUser() user: any, @Param('id') id: string) {
    return this.incidentsService.getTimeline(id, user.organizationId);
  }

  @Get(':id/alerts')
  getAlerts(@CurrentUser() user: any, @Param('id') id: string) {
    return this.incidentsService.getAlerts(id, user.organizationId);
  }

  @Get(':id')
  findOne(@CurrentUser() user: any, @Param('id') id: string) {
    return this.incidentsService.findOne(id, user.organizationId);
  }

  @Post(':id/acknowledge')
  @Roles(UserRole.MEMBER)
  acknowledge(@CurrentUser() user: any, @Param('id') id: string) {
    return this.incidentsService.acknowledge(id, {
      id: user.id,
      name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email,
    }, user.organizationId);
  }

  @Patch(':id/acknowledge')
  @Roles(UserRole.MEMBER)
  acknowledgePatch(@CurrentUser() user: any, @Param('id') id: string) {
    return this.incidentsService.acknowledge(id, {
      id: user.id,
      name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email,
    }, user.organizationId);
  }

  @Post(':id/resolve')
  @Roles(UserRole.MEMBER)
  resolve(@CurrentUser() user: any, @Param('id') id: string) {
    return this.incidentsService.resolve(id, {
      id: user.id,
      name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email,
    }, user.organizationId);
  }

  @Patch(':id/resolve')
  @Roles(UserRole.MEMBER)
  resolvePatch(@CurrentUser() user: any, @Param('id') id: string) {
    return this.incidentsService.resolve(id, {
      id: user.id,
      name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email,
    }, user.organizationId);
  }
}

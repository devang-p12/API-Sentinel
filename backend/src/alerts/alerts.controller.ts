import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { AlertsService } from './alerts.service';
import { AlertInstancesService } from '../alert-rules/services/alert-instances.service';
import { AlertRulesService } from '../alert-rules/services/alert-rules.service';
import { QueryAlertsDto } from '../alert-rules/dto/query-alerts.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@Controller('alerts')
export class AlertsController {
  constructor(
    private readonly alertsService: AlertsService,
    private readonly alertInstancesService: AlertInstancesService,
    private readonly alertRulesService: AlertRulesService,
  ) {}

  @Post()
  @Roles(UserRole.MEMBER)
  create(@CurrentUser() user: any, @Body() dto: any) {
    if (dto.metric && dto.threshold !== undefined) {
      return this.alertRulesService.create(dto, user.organizationId);
    }
    return this.alertsService.create(dto);
  }

  @Get('summary')
  getSummary(
    @CurrentUser() user: any,
    @Query('projectId') projectId?: string,
  ) {
    return this.alertInstancesService.getSummary(projectId, user.organizationId);
  }

  @Get()
  findAll(@CurrentUser() user: any, @Query() query: QueryAlertsDto) {
    return this.alertInstancesService.findAll(query, user.organizationId);
  }

  @Get(':id/evaluations')
  findEvaluations(@Param('id') id: string) {
    return this.alertInstancesService.findEvaluations(id);
  }

  @Get(':id')
  async findOne(@CurrentUser() user: any, @Param('id') id: string) {
    try {
      return await this.alertInstancesService.findOne(id, user.organizationId);
    } catch {
      return this.alertsService.findOne(id);
    }
  }
}

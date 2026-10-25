import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { AlertsService } from './alerts.service';
import { AlertInstancesService } from '../alert-rules/services/alert-instances.service';
import { AlertRulesService } from '../alert-rules/services/alert-rules.service';
import { QueryAlertsDto } from '../alert-rules/dto/query-alerts.dto';

@Controller('alerts')
export class AlertsController {
  constructor(
    private readonly alertsService: AlertsService,
    private readonly alertInstancesService: AlertInstancesService,
    private readonly alertRulesService: AlertRulesService,
  ) {}

  @Post()
  create(@Body() dto: any) {
    if (dto.metric && dto.threshold !== undefined) {
      return this.alertRulesService.create(dto);
    }
    return this.alertsService.create(dto);
  }

  @Get('summary')
  getSummary(@Query('projectId') projectId?: string) {
    return this.alertInstancesService.getSummary(projectId);
  }

  @Get()
  findAll(@Query() query: QueryAlertsDto) {
    return this.alertInstancesService.findAll(query);
  }

  @Get(':id/evaluations')
  findEvaluations(@Param('id') id: string) {
    return this.alertInstancesService.findEvaluations(id);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    try {
      return await this.alertInstancesService.findOne(id);
    } catch {
      return this.alertsService.findOne(id);
    }
  }
}

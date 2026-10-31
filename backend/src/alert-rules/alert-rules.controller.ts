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
import { AlertRulesService } from './services/alert-rules.service';
import { AlertRuleNotificationService } from './services/alert-rule-notification.service';
import { CreateAlertRuleDto } from './dto/create-alert-rule.dto';
import { UpdateAlertRuleDto } from './dto/update-alert-rule.dto';
import { QueryAlertRulesDto } from './dto/query-alert-rules.dto';

@Controller('alert-rules')
export class AlertRulesController {
  constructor(
    private readonly alertRulesService: AlertRulesService,
    private readonly notificationService: AlertRuleNotificationService,
  ) {}

  @Post('test-email')
  @HttpCode(HttpStatus.OK)
  testEmail(
    @Body()
    dto: {
      recipients: string[];
      ruleName?: string;
      ruleId?: string;
    },
  ) {
    return this.notificationService.sendTestEmail(
      dto.recipients,
      dto.ruleName,
      dto.ruleId,
    );
  }

  @Post()
  create(@Body() dto: CreateAlertRuleDto) {
    return this.alertRulesService.create(dto);
  }

  @Get()
  findAll(@Query() query: QueryAlertRulesDto) {
    return this.alertRulesService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.alertRulesService.findOne(id);
  }

  @Get(':id/evaluations')
  findEvaluations(@Param('id') id: string) {
    return this.alertRulesService.findEvaluations(id);
  }

  @Get(':id/deliveries')
  findDeliveries(@Param('id') id: string) {
    return this.notificationService.getDeliveriesForRule(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateAlertRuleDto) {
    return this.alertRulesService.update(id, dto);
  }

  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.alertRulesService.delete(id);
  }

  @Post(':id/enable')
  @HttpCode(HttpStatus.OK)
  enable(@Param('id') id: string) {
    return this.alertRulesService.enable(id);
  }

  @Post(':id/disable')
  @HttpCode(HttpStatus.OK)
  disable(@Param('id') id: string) {
    return this.alertRulesService.disable(id);
  }

  @Post(':id/test')
  @HttpCode(HttpStatus.OK)
  test(@Param('id') id: string) {
    return this.alertRulesService.test(id);
  }
}

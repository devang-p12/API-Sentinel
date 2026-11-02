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
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@Controller('alert-rules')
export class AlertRulesController {
  constructor(
    private readonly alertRulesService: AlertRulesService,
    private readonly notificationService: AlertRuleNotificationService,
  ) {}

  @Post('test-email')
  @Roles(UserRole.MEMBER)
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
  @Roles(UserRole.MEMBER)
  create(@CurrentUser() user: any, @Body() dto: CreateAlertRuleDto) {
    return this.alertRulesService.create(dto, user?.organizationId);
  }

  @Get('events')
  findAllEvents(
    @CurrentUser() user: any,
    @Query('limit') limit?: string,
  ) {
    return this.alertRulesService.findAllEvents(
      user.organizationId,
      limit ? parseInt(limit, 10) : 50,
    );
  }

  @Get()
  findAll(@CurrentUser() user: any, @Query() query: QueryAlertRulesDto) {
    return this.alertRulesService.findAll(query, user?.organizationId);
  }

  @Get(':id')
  findOne(@CurrentUser() user: any, @Param('id') id: string) {
    return this.alertRulesService.findOne(id, user?.organizationId);
  }

  @Get(':id/events')
  findEvents(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Query('limit') limit?: string,
  ) {
    return this.alertRulesService.findEvents(
      id,
      user?.organizationId,
      limit ? parseInt(limit, 10) : 50,
    );
  }

  @Get(':id/evaluations')
  findEvaluations(@CurrentUser() user: any, @Param('id') id: string) {
    return this.alertRulesService.findEvaluations(id, 50, user?.organizationId);
  }

  @Get(':id/deliveries')
  findDeliveries(@CurrentUser() user: any, @Param('id') id: string) {
    return this.notificationService.getDeliveriesForRule(id);
  }

  @Patch(':id')
  @Roles(UserRole.MEMBER)
  update(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: UpdateAlertRuleDto,
  ) {
    return this.alertRulesService.update(id, dto, user?.organizationId);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.OWNER, UserRole.MEMBER)
  delete(@CurrentUser() user: any, @Param('id') id: string) {
    return this.alertRulesService.delete(id, user?.organizationId);
  }

  @Post(':id/enable')
  @Roles(UserRole.MEMBER)
  @HttpCode(HttpStatus.OK)
  enable(@CurrentUser() user: any, @Param('id') id: string) {
    return this.alertRulesService.enable(id, user?.organizationId);
  }

  @Post(':id/disable')
  @Roles(UserRole.MEMBER)
  @HttpCode(HttpStatus.OK)
  disable(@CurrentUser() user: any, @Param('id') id: string) {
    return this.alertRulesService.disable(id, user?.organizationId);
  }

  @Patch(':id/toggle')
  @Roles(UserRole.MEMBER)
  toggle(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body('enabled') enabled: boolean,
  ) {
    return enabled
      ? this.alertRulesService.enable(id, user?.organizationId)
      : this.alertRulesService.disable(id, user?.organizationId);
  }

  @Post(':id/evaluate')
  @Roles(UserRole.MEMBER)
  @HttpCode(HttpStatus.OK)
  evaluate(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body('metricValue') metricValue?: number,
  ) {
    return this.alertRulesService.evaluateRule(
      id,
      metricValue,
      user?.organizationId,
    );
  }

  @Post(':id/test')
  @Roles(UserRole.MEMBER)
  @HttpCode(HttpStatus.OK)
  test(@CurrentUser() user: any, @Param('id') id: string) {
    return this.alertRulesService.test(id, user?.organizationId);
  }
}

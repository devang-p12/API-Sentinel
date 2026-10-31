import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { NotificationPoliciesService } from '../services/notification-policies.service';
import {
  CreateNotificationPolicyDto,
  UpdateNotificationPolicyDto,
  PreviewPolicyDto,
} from '../dto/create-notification-policy.dto';

@Controller('notification-policies')
export class NotificationPoliciesController {
  constructor(private readonly policiesService: NotificationPoliciesService) {}

  @Post()
  create(
    @Body() dto: CreateNotificationPolicyDto,
    @Query('organizationId') organizationId?: string,
  ) {
    return this.policiesService.create(dto, organizationId);
  }

  @Get()
  findAll(@Query('organizationId') organizationId?: string) {
    return this.policiesService.findAll(organizationId);
  }

  @Post('preview')
  preview(@Body() dto: PreviewPolicyDto) {
    return this.policiesService.previewMatch(dto.matchers, dto.sampleLabels);
  }

  @Get(':id')
  findOne(
    @Param('id') id: string,
    @Query('organizationId') organizationId?: string,
  ) {
    return this.policiesService.findOne(id, organizationId);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateNotificationPolicyDto,
    @Query('organizationId') organizationId?: string,
  ) {
    return this.policiesService.update(id, dto, organizationId);
  }

  @Delete(':id')
  remove(
    @Param('id') id: string,
    @Query('organizationId') organizationId?: string,
  ) {
    return this.policiesService.remove(id, organizationId);
  }
}

import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
} from '@nestjs/common';
import { NotificationPoliciesService } from '../services/notification-policies.service';
import {
  CreateNotificationPolicyDto,
  UpdateNotificationPolicyDto,
  PreviewPolicyDto,
} from '../dto/create-notification-policy.dto';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@Controller('notification-policies')
export class NotificationPoliciesController {
  constructor(private readonly policiesService: NotificationPoliciesService) {}

  @Post()
  @Roles(UserRole.MEMBER)
  create(
    @CurrentUser() user: any,
    @Body() dto: CreateNotificationPolicyDto,
  ) {
    return this.policiesService.create(dto, user.organizationId);
  }

  @Get()
  findAll(@CurrentUser() user: any) {
    return this.policiesService.findAll(user.organizationId);
  }

  @Post('preview')
  preview(@Body() dto: PreviewPolicyDto) {
    return this.policiesService.previewMatch(dto.matchers, dto.sampleLabels);
  }

  @Get(':id')
  findOne(
    @CurrentUser() user: any,
    @Param('id') id: string,
  ) {
    return this.policiesService.findOne(id, user.organizationId);
  }

  @Patch(':id')
  @Roles(UserRole.MEMBER)
  update(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: UpdateNotificationPolicyDto,
  ) {
    return this.policiesService.update(id, dto, user.organizationId);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.OWNER)
  remove(
    @CurrentUser() user: any,
    @Param('id') id: string,
  ) {
    return this.policiesService.remove(id, user.organizationId);
  }
}

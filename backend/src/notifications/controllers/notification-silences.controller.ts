import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
} from '@nestjs/common';
import {
  NotificationSilencesService,
  CreateNotificationSilenceDto,
} from '../services/notification-silences.service';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@Controller('notification-silences')
export class NotificationSilencesController {
  constructor(private readonly silencesService: NotificationSilencesService) {}

  @Post()
  @Roles(UserRole.MEMBER)
  create(
    @CurrentUser() user: any,
    @Body() dto: CreateNotificationSilenceDto,
  ) {
    return this.silencesService.create(dto, user.organizationId);
  }

  @Get()
  findAll(@CurrentUser() user: any) {
    return this.silencesService.findAll(user.organizationId);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.OWNER)
  remove(
    @CurrentUser() user: any,
    @Param('id') id: string,
  ) {
    return this.silencesService.remove(id, user.organizationId);
  }
}

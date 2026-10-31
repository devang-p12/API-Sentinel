import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import {
  NotificationSilencesService,
  CreateNotificationSilenceDto,
} from '../services/notification-silences.service';

@Controller('notification-silences')
export class NotificationSilencesController {
  constructor(private readonly silencesService: NotificationSilencesService) {}

  @Post()
  create(
    @Body() dto: CreateNotificationSilenceDto,
    @Query('organizationId') organizationId?: string,
  ) {
    return this.silencesService.create(dto, organizationId);
  }

  @Get()
  findAll(@Query('organizationId') organizationId?: string) {
    return this.silencesService.findAll(organizationId);
  }

  @Delete(':id')
  remove(
    @Param('id') id: string,
    @Query('organizationId') organizationId?: string,
  ) {
    return this.silencesService.remove(id, organizationId);
  }
}

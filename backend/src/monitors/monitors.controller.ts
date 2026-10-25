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

@Controller('monitors')
export class MonitorsController {
  constructor(private readonly monitorsService: MonitorsService) {}

  @Post()
  create(@Body() dto: CreateMonitorDto) {
    return this.monitorsService.create(dto);
  }

  @Get()
  findAll(
    @Query('environmentId') environmentId?: string,
    @Query('apiId') apiId?: string,
  ) {
    return this.monitorsService.findAll({ environmentId, apiId });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.monitorsService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateMonitorDto) {
    return this.monitorsService.update(id, dto);
  }

  @Patch(':id/toggle')
  toggle(@Param('id') id: string, @Body('enabled') enabled?: boolean) {
    return this.monitorsService.toggle(id, enabled);
  }

  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.monitorsService.delete(id);
  }

  @Get(':id/executions')
  getExecutions(
    @Param('id') id: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const parsedLimit = limit ? parseInt(limit, 10) : 50;
    const parsedOffset = offset ? parseInt(offset, 10) : 0;
    return this.monitorsService.getExecutions(id, parsedLimit, parsedOffset);
  }

  @Post(':id/run')
  triggerRun(@Param('id') id: string) {
    return this.monitorsService.triggerManualRun(id);
  }
}

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

  @Post(':id/enable')
  enable(@Param('id') id: string) {
    return this.monitorsService.toggle(id, true);
  }

  @Post(':id/disable')
  disable(@Param('id') id: string) {
    return this.monitorsService.toggle(id, false);
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
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('status') status?: any,
  ) {
    const parsedLimit = limit ? parseInt(limit, 10) : 50;
    const parsedOffset = offset ? parseInt(offset, 10) : 0;
    const fromDate = from ? new Date(from) : undefined;
    const toDate = to ? new Date(to) : undefined;
    return this.monitorsService.getExecutions(id, {
      limit: parsedLimit,
      offset: parsedOffset,
      from: fromDate,
      to: toDate,
      status,
    });
  }

  @Get(':id/executions/:executionId')
  getExecutionById(
    @Param('id') id: string,
    @Param('executionId') executionId: string,
  ) {
    return this.monitorsService.getExecutionById(id, executionId);
  }

  @Post(':id/run')
  triggerRun(@Param('id') id: string) {
    return this.monitorsService.triggerManualRun(id);
  }
}

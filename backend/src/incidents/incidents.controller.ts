import { Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { IncidentStatus } from '@prisma/client';
import { IncidentsService } from './incidents.service';

@Controller('incidents')
export class IncidentsController {
  constructor(private readonly incidentsService: IncidentsService) {}

  @Get()
  findAll(
    @Query('status') status?: IncidentStatus,
    @Query('alertId') alertId?: string,
  ) {
    return this.incidentsService.findAll(status, alertId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.incidentsService.findOne(id);
  }

  @Patch(':id/acknowledge')
  acknowledge(@Param('id') id: string) {
    return this.incidentsService.acknowledge(id);
  }

  @Patch(':id/resolve')
  resolve(@Param('id') id: string) {
    return this.incidentsService.resolve(id);
  }
}

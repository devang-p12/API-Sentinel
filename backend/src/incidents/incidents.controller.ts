import { Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { IncidentsService } from './incidents.service';
import { QueryIncidentsDto } from './dto/query-incidents.dto';

@Controller('incidents')
export class IncidentsController {
  constructor(private readonly incidentsService: IncidentsService) {}

  @Get('summary')
  getSummary(@Query('projectId') projectId?: string) {
    return this.incidentsService.getSummary(projectId);
  }

  @Get()
  findAll(@Query() query: QueryIncidentsDto) {
    return this.incidentsService.findAll(query);
  }

  @Get(':id/timeline')
  getTimeline(@Param('id') id: string) {
    return this.incidentsService.getTimeline(id);
  }

  @Get(':id/alerts')
  getAlerts(@Param('id') id: string) {
    return this.incidentsService.getAlerts(id);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.incidentsService.findOne(id);
  }

  @Post(':id/acknowledge')
  acknowledge(@Param('id') id: string) {
    return this.incidentsService.acknowledge(id);
  }

  @Patch(':id/acknowledge')
  acknowledgePatch(@Param('id') id: string) {
    return this.incidentsService.acknowledge(id);
  }

  @Post(':id/resolve')
  resolve(@Param('id') id: string) {
    return this.incidentsService.resolve(id);
  }

  @Patch(':id/resolve')
  resolvePatch(@Param('id') id: string) {
    return this.incidentsService.resolve(id);
  }
}

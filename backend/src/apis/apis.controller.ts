import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApisService } from './apis.service';
import { CreateApiDto } from './dto/create-api.dto';
import { EnvironmentsService } from '../environments/environments.service';
import { CreateEnvironmentDto } from '../environments/dto/create-environment.dto';

@Controller('apis')
export class ApisController {
  constructor(
    private readonly apisService: ApisService,
    private readonly environmentsService: EnvironmentsService,
  ) {}

  @Post()
  create(@Body() dto: CreateApiDto) {
    return this.apisService.create(dto);
  }

  @Get()
  findAll(@Query('projectId') projectId?: string) {
    return this.apisService.findAll(projectId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.apisService.findOne(id);
  }

  @Post(':apiId/environments')
  createEnvironment(
    @Param('apiId') apiId: string,
    @Body() dto: CreateEnvironmentDto,
  ) {
    return this.environmentsService.create(dto, apiId);
  }

  @Get(':apiId/environments')
  findEnvironments(@Param('apiId') apiId: string) {
    return this.environmentsService.findAll(apiId);
  }
}

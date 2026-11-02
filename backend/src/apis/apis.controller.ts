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
import { ApisService } from './apis.service';
import { CreateApiDto } from './dto/create-api.dto';
import { UpdateApiDto } from './dto/update-api.dto';
import { EnvironmentsService } from '../environments/environments.service';
import { CreateEnvironmentDto } from '../environments/dto/create-environment.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@Controller('apis')
export class ApisController {
  constructor(
    private readonly apisService: ApisService,
    private readonly environmentsService: EnvironmentsService,
  ) {}

  @Post()
  @Roles(UserRole.MEMBER)
  create(@CurrentUser() user: any, @Body() dto: CreateApiDto) {
    return this.apisService.create(dto, user.organizationId);
  }

  @Get()
  findAll(
    @CurrentUser() user: any,
    @Query('projectId') projectId?: string,
    @Query('service') service?: string,
    @Query('search') search?: string,
  ) {
    return this.apisService.findAll(user.organizationId, {
      projectId,
      service,
      search,
    });
  }

  @Get(':id')
  findOne(@CurrentUser() user: any, @Param('id') id: string) {
    return this.apisService.findOne(id, user.organizationId);
  }

  @Get(':id/details')
  getDetails(@CurrentUser() user: any, @Param('id') id: string) {
    return this.apisService.getApiDetails(id, user.organizationId);
  }

  @Patch(':id')
  @Roles(UserRole.MEMBER)
  update(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: UpdateApiDto,
  ) {
    return this.apisService.update(id, dto, user.organizationId);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.OWNER)
  delete(@CurrentUser() user: any, @Param('id') id: string) {
    return this.apisService.delete(id, user.organizationId);
  }

  @Post(':apiId/environments')
  @Roles(UserRole.MEMBER)
  createEnvironment(
    @CurrentUser() user: any,
    @Param('apiId') apiId: string,
    @Body() dto: CreateEnvironmentDto,
  ) {
    return this.environmentsService.create(dto, user.organizationId, apiId);
  }

  @Get(':apiId/environments')
  findEnvironments(@CurrentUser() user: any, @Param('apiId') apiId: string) {
    return this.environmentsService.findAll(user.organizationId, apiId);
  }
}


import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { LoadTestsService } from './services/load-tests.service';
import { CreateLoadTestDto } from './dto/create-load-test.dto';
import { QueryLoadTestsDto } from './dto/query-load-tests.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@Controller('load-tests')
export class LoadTestsController {
  constructor(private readonly loadTestsService: LoadTestsService) {}

  @Post()
  @Roles(UserRole.MEMBER)
  @HttpCode(HttpStatus.CREATED)
  create(@CurrentUser() user: any, @Body() dto: CreateLoadTestDto) {
    return this.loadTestsService.create(dto, user.id, user.organizationId);
  }

  @Get()
  findAll(@CurrentUser() user: any, @Query() query: QueryLoadTestsDto) {
    return this.loadTestsService.findAll(query, user.organizationId);
  }

  @Get(':id')
  findOne(@CurrentUser() user: any, @Param('id') id: string) {
    return this.loadTestsService.findOne(id, user.organizationId);
  }

  @Post(':id/cancel')
  @Roles(UserRole.MEMBER)
  @HttpCode(HttpStatus.OK)
  cancel(@CurrentUser() user: any, @Param('id') id: string) {
    return this.loadTestsService.cancel(id, user.organizationId);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.OWNER)
  delete(@CurrentUser() user: any, @Param('id') id: string) {
    return this.loadTestsService.delete(id, user.organizationId);
  }
}

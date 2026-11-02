import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTesterService } from './services/api-tester.service';
import { ExecuteRequestDto } from './dto/execute-request.dto';
import { CreateCollectionDto, UpdateCollectionDto } from './dto/create-collection.dto';
import { SaveRequestDto, UpdateSavedRequestDto } from './dto/save-request.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@Controller('api-tester')
export class ApiTesterController {
  constructor(private readonly apiTesterService: ApiTesterService) {}

  @Post('execute')
  @HttpCode(HttpStatus.OK)
  async execute(@CurrentUser() user: any, @Body() dto: ExecuteRequestDto) {
    return this.apiTesterService.executeRequest(dto, user.organizationId);
  }

  @Get('history')
  async getHistory(
    @CurrentUser() user: any,
    @Query('projectId') projectId?: string,
    @Query('limit') limit?: string,
  ) {
    const parsedLimit = limit ? parseInt(limit, 10) : 50;
    return this.apiTesterService.getHistory(user.organizationId, projectId, parsedLimit);
  }

  @Delete('history')
  @Roles(UserRole.MEMBER)
  async clearHistory(
    @CurrentUser() user: any,
    @Query('projectId') projectId?: string,
  ) {
    return this.apiTesterService.clearHistory(user.organizationId, projectId);
  }

  @Get('collections')
  async getCollections(
    @CurrentUser() user: any,
    @Query('projectId') projectId?: string,
  ) {
    return this.apiTesterService.getCollections(user.organizationId, projectId);
  }

  @Post('collections')
  @Roles(UserRole.MEMBER)
  async createCollection(
    @CurrentUser() user: any,
    @Body() dto: CreateCollectionDto,
  ) {
    return this.apiTesterService.createCollection(dto, user.organizationId);
  }

  @Patch('collections/:id')
  @Roles(UserRole.MEMBER)
  async updateCollection(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: UpdateCollectionDto,
  ) {
    return this.apiTesterService.updateCollection(id, dto, user.organizationId);
  }

  @Delete('collections/:id')
  @Roles(UserRole.MEMBER)
  async deleteCollection(@CurrentUser() user: any, @Param('id') id: string) {
    return this.apiTesterService.deleteCollection(id, user.organizationId);
  }

  @Post('requests')
  @Roles(UserRole.MEMBER)
  async saveRequest(
    @CurrentUser() user: any,
    @Body() dto: SaveRequestDto,
  ) {
    return this.apiTesterService.saveRequest(dto, user.organizationId);
  }

  @Get('requests/:id')
  async getSavedRequest(@CurrentUser() user: any, @Param('id') id: string) {
    return this.apiTesterService.getSavedRequest(id, user.organizationId);
  }

  @Patch('requests/:id')
  @Roles(UserRole.MEMBER)
  async updateSavedRequest(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: UpdateSavedRequestDto,
  ) {
    return this.apiTesterService.updateSavedRequest(id, dto, user.organizationId);
  }

  @Delete('requests/:id')
  @Roles(UserRole.MEMBER)
  async deleteSavedRequest(@CurrentUser() user: any, @Param('id') id: string) {
    return this.apiTesterService.deleteSavedRequest(id, user.organizationId);
  }
}

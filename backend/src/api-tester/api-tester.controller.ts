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

@Controller('api-tester')
export class ApiTesterController {
  constructor(private readonly apiTesterService: ApiTesterService) {}

  @Post('execute')
  @HttpCode(HttpStatus.OK)
  async execute(@Body() dto: ExecuteRequestDto) {
    return this.apiTesterService.executeRequest(dto);
  }

  @Get('history')
  async getHistory(
    @Query('projectId') projectId?: string,
    @Query('limit') limit?: string,
  ) {
    const parsedLimit = limit ? parseInt(limit, 10) : 50;
    return this.apiTesterService.getHistory(projectId, parsedLimit);
  }

  @Delete('history')
  async clearHistory(@Query('projectId') projectId?: string) {
    return this.apiTesterService.clearHistory(projectId);
  }

  @Get('collections')
  async getCollections(@Query('projectId') projectId: string) {
    return this.apiTesterService.getCollections(projectId);
  }

  @Post('collections')
  async createCollection(@Body() dto: CreateCollectionDto) {
    return this.apiTesterService.createCollection(dto);
  }

  @Patch('collections/:id')
  async updateCollection(
    @Param('id') id: string,
    @Body() dto: UpdateCollectionDto,
  ) {
    return this.apiTesterService.updateCollection(id, dto);
  }

  @Delete('collections/:id')
  async deleteCollection(@Param('id') id: string) {
    return this.apiTesterService.deleteCollection(id);
  }

  @Post('requests')
  async saveRequest(@Body() dto: SaveRequestDto) {
    return this.apiTesterService.saveRequest(dto);
  }

  @Get('requests/:id')
  async getSavedRequest(@Param('id') id: string) {
    return this.apiTesterService.getSavedRequest(id);
  }

  @Patch('requests/:id')
  async updateSavedRequest(
    @Param('id') id: string,
    @Body() dto: UpdateSavedRequestDto,
  ) {
    return this.apiTesterService.updateSavedRequest(id, dto);
  }

  @Delete('requests/:id')
  async deleteSavedRequest(@Param('id') id: string) {
    return this.apiTesterService.deleteSavedRequest(id);
  }
}

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

@Controller('load-tests')
export class LoadTestsController {
  constructor(private readonly loadTestsService: LoadTestsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateLoadTestDto) {
    return this.loadTestsService.create(dto);
  }

  @Get()
  findAll(@Query() query: QueryLoadTestsDto) {
    return this.loadTestsService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.loadTestsService.findOne(id);
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  cancel(@Param('id') id: string) {
    return this.loadTestsService.cancel(id);
  }

  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.loadTestsService.delete(id);
  }
}

import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { ContactPointsService } from '../services/contact-points.service';
import {
  CreateContactPointDto,
  UpdateContactPointDto,
} from '../dto/create-contact-point.dto';

@Controller('contact-points')
export class ContactPointsController {
  constructor(private readonly contactPointsService: ContactPointsService) {}

  @Post()
  create(
    @Body() dto: CreateContactPointDto,
    @Query('organizationId') organizationId?: string,
  ) {
    return this.contactPointsService.create(dto, organizationId);
  }

  @Get()
  findAll(@Query('organizationId') organizationId?: string) {
    return this.contactPointsService.findAll(organizationId);
  }

  @Get(':id')
  findOne(
    @Param('id') id: string,
    @Query('organizationId') organizationId?: string,
  ) {
    return this.contactPointsService.findOne(id, organizationId);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateContactPointDto,
    @Query('organizationId') organizationId?: string,
  ) {
    return this.contactPointsService.update(id, dto, organizationId);
  }

  @Delete(':id')
  remove(
    @Param('id') id: string,
    @Query('organizationId') organizationId?: string,
  ) {
    return this.contactPointsService.remove(id, organizationId);
  }

  @Post(':id/test')
  testContactPoint(
    @Param('id') id: string,
    @Query('organizationId') organizationId?: string,
  ) {
    return this.contactPointsService.testContactPoint(id, organizationId);
  }
}

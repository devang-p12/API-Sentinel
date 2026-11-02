import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
} from '@nestjs/common';
import { ContactPointsService } from '../services/contact-points.service';
import {
  CreateContactPointDto,
  UpdateContactPointDto,
} from '../dto/create-contact-point.dto';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@Controller('contact-points')
export class ContactPointsController {
  constructor(private readonly contactPointsService: ContactPointsService) {}

  @Post()
  @Roles(UserRole.MEMBER)
  create(
    @CurrentUser() user: any,
    @Body() dto: CreateContactPointDto,
  ) {
    return this.contactPointsService.create(dto, user.organizationId);
  }

  @Get()
  findAll(@CurrentUser() user: any) {
    return this.contactPointsService.findAll(user.organizationId);
  }

  @Get(':id')
  findOne(
    @CurrentUser() user: any,
    @Param('id') id: string,
  ) {
    return this.contactPointsService.findOne(id, user.organizationId);
  }

  @Patch(':id')
  @Roles(UserRole.MEMBER)
  update(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: UpdateContactPointDto,
  ) {
    return this.contactPointsService.update(id, dto, user.organizationId);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.OWNER)
  remove(
    @CurrentUser() user: any,
    @Param('id') id: string,
  ) {
    return this.contactPointsService.remove(id, user.organizationId);
  }

  @Post(':id/test')
  @Roles(UserRole.MEMBER)
  testContactPoint(
    @CurrentUser() user: any,
    @Param('id') id: string,
  ) {
    return this.contactPointsService.testContactPoint(id, user.organizationId);
  }
}

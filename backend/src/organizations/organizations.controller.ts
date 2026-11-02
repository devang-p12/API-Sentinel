import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
} from '@nestjs/common';
import { OrganizationsService } from './organizations.service';
import { AddMemberDto } from './dto/add-member.dto';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@Controller('organizations')
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Get('me')
  getOrganization(@CurrentUser() user: any) {
    return this.organizationsService.getOrganization(user.organizationId);
  }

  @Get('me/members')
  getMembers(@CurrentUser() user: any) {
    return this.organizationsService.getMembers(user.organizationId);
  }

  @Post('me/members')
  @Roles(UserRole.ADMIN, UserRole.OWNER)
  addMember(@CurrentUser() user: any, @Body() dto: AddMemberDto) {
    return this.organizationsService.addMember(
      user.organizationId,
      dto,
      user.role,
    );
  }

  @Patch('me/members/:userId')
  @Roles(UserRole.ADMIN, UserRole.OWNER)
  updateMemberRole(
    @CurrentUser() user: any,
    @Param('userId') targetUserId: string,
    @Body() dto: UpdateMemberRoleDto,
  ) {
    return this.organizationsService.updateMemberRole(
      user.organizationId,
      targetUserId,
      dto,
      user.id,
      user.role,
    );
  }

  @Delete('me/members/:userId')
  @Roles(UserRole.ADMIN, UserRole.OWNER)
  removeMember(
    @CurrentUser() user: any,
    @Param('userId') targetUserId: string,
  ) {
    return this.organizationsService.removeMember(
      user.organizationId,
      targetUserId,
      user.id,
      user.role,
    );
  }
}

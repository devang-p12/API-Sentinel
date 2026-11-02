import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UserRole } from '@prisma/client';
import { AddMemberDto } from './dto/add-member.dto';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class OrganizationsService {
  constructor(private readonly prisma: PrismaService) {}

  async getOrganization(organizationId: string) {
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      include: {
        _count: {
          select: {
            memberships: true,
            projects: true,
            apis: true,
            monitors: true,
          },
        },
      },
    });

    if (!org) {
      throw new NotFoundException('Organization not found');
    }

    return org;
  }

  async getMembers(organizationId: string) {
    const memberships = await this.prisma.membership.findMany({
      where: { organizationId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return memberships.map((m) => ({
      id: m.id,
      userId: m.userId,
      role: m.role,
      joinedAt: m.createdAt,
      user: m.user,
    }));
  }

  async addMember(
    organizationId: string,
    dto: AddMemberDto,
    actorRole: UserRole,
  ) {
    if (actorRole !== UserRole.OWNER && actorRole !== UserRole.ADMIN) {
      throw new ForbiddenException(
        'Only Organization Owners and Admins can invite new members',
      );
    }

    if (dto.role === UserRole.OWNER && actorRole !== UserRole.OWNER) {
      throw new ForbiddenException('Only Organization Owners can assign OWNER role');
    }

    const email = dto.email.toLowerCase().trim();

    // Check if user already exists
    let user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (user) {
      const existingMembership = await this.prisma.membership.findUnique({
        where: {
          userId_organizationId: {
            userId: user.id,
            organizationId,
          },
        },
      });

      if (existingMembership) {
        throw new ConflictException(
          'User is already a member of this organization',
        );
      }
    } else {
      // Create user account with a temporary hashed password
      const tempHash = await bcrypt.hash(`sentinel-${Date.now()}`, 10);
      user = await this.prisma.user.create({
        data: {
          email,
          passwordHash: tempHash,
          firstName: dto.firstName?.trim() || email.split('@')[0],
          lastName: dto.lastName?.trim() || 'User',
          role: dto.role,
          organizationId,
        },
      });
    }

    const membership = await this.prisma.membership.create({
      data: {
        userId: user.id,
        organizationId,
        role: dto.role,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            createdAt: true,
          },
        },
      },
    });

    return {
      id: membership.id,
      userId: membership.userId,
      role: membership.role,
      joinedAt: membership.createdAt,
      user: membership.user,
    };
  }

  async updateMemberRole(
    organizationId: string,
    targetUserId: string,
    dto: UpdateMemberRoleDto,
    actorUserId: string,
    actorRole: UserRole,
  ) {
    if (actorRole !== UserRole.OWNER && actorRole !== UserRole.ADMIN) {
      throw new ForbiddenException(
        'Only Organization Owners and Admins can modify member roles',
      );
    }

    const targetMembership = await this.prisma.membership.findUnique({
      where: {
        userId_organizationId: {
          userId: targetUserId,
          organizationId,
        },
      },
    });

    if (!targetMembership) {
      throw new NotFoundException('Member not found in this organization');
    }

    // Protection: Admins cannot change an OWNER's role or promote to OWNER
    if (targetMembership.role === UserRole.OWNER && actorRole !== UserRole.OWNER) {
      throw new ForbiddenException('Cannot modify the role of an Organization Owner');
    }

    if (dto.role === UserRole.OWNER && actorRole !== UserRole.OWNER) {
      throw new ForbiddenException('Only Organization Owners can assign OWNER role');
    }

    // Protection: Owner cannot demote themselves if they are the only owner
    if (
      targetUserId === actorUserId &&
      targetMembership.role === UserRole.OWNER &&
      dto.role !== UserRole.OWNER
    ) {
      const ownerCount = await this.prisma.membership.count({
        where: {
          organizationId,
          role: UserRole.OWNER,
        },
      });
      if (ownerCount <= 1) {
        throw new BadRequestException(
          'Cannot demote yourself: The organization must have at least one OWNER',
        );
      }
    }

    const updated = await this.prisma.membership.update({
      where: { id: targetMembership.id },
      data: { role: dto.role },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    // Also update primary user.role if this is their primary organization
    await this.prisma.user.updateMany({
      where: { id: targetUserId, organizationId },
      data: { role: dto.role },
    });

    return updated;
  }

  async removeMember(
    organizationId: string,
    targetUserId: string,
    actorUserId: string,
    actorRole: UserRole,
  ) {
    if (actorRole !== UserRole.OWNER && actorRole !== UserRole.ADMIN) {
      throw new ForbiddenException(
        'Only Organization Owners and Admins can remove members',
      );
    }

    const targetMembership = await this.prisma.membership.findUnique({
      where: {
        userId_organizationId: {
          userId: targetUserId,
          organizationId,
        },
      },
    });

    if (!targetMembership) {
      throw new NotFoundException('Member not found in this organization');
    }

    if (targetMembership.role === UserRole.OWNER) {
      throw new ForbiddenException('Cannot remove an Organization Owner');
    }

    if (targetUserId === actorUserId) {
      throw new BadRequestException(
        'Cannot remove yourself via this endpoint; use leave organization',
      );
    }

    await this.prisma.membership.delete({
      where: { id: targetMembership.id },
    });

    return { success: true, message: 'Member removed from organization' };
  }
}

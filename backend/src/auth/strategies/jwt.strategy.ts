import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtPayload } from '../interfaces/jwt-payload.interface';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey:
        process.env.JWT_SECRET || 'sentinel-super-secret-jwt-key-2026',
      passReqToCallback: true,
    });
  }

  async validate(req: Request, payload: JwtPayload) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: {
        memberships: {
          include: {
            organization: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
          },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException(
        'User no longer exists or session has expired',
      );
    }

    if (!user.memberships || user.memberships.length === 0) {
      // Auto-heal: If user has organizationId but no membership row yet, create it safely
      if (user.organizationId) {
        const org = await this.prisma.organization.findUnique({
          where: { id: user.organizationId },
        });
        if (org) {
          const newMembership = await this.prisma.membership.create({
            data: {
              userId: user.id,
              organizationId: user.organizationId,
              role: user.role,
            },
            include: {
              organization: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                },
              },
            },
          });
          user.memberships = [newMembership];
        }
      }
    }

    if (!user.memberships || user.memberships.length === 0) {
      throw new UnauthorizedException(
        'User does not belong to any organization',
      );
    }

    // Determine active organization membership
    const requestedOrgId =
      (req.headers['x-organization-id'] as string) || payload.organizationId;
    let activeMembership = user.memberships.find(
      (m) => m.organizationId === requestedOrgId,
    );

    // If requested org is not valid for this user, fallback to primary or first membership
    if (!activeMembership) {
      activeMembership =
        user.memberships.find(
          (m) => m.organizationId === user.organizationId,
        ) || user.memberships[0];
    }

    const { passwordHash, ...safeUser } = user;

    return {
      ...safeUser,
      organizationId: activeMembership.organizationId,
      organization: activeMembership.organization,
      role: activeMembership.role,
      membershipId: activeMembership.id,
      memberships: user.memberships.map((m) => ({
        id: m.id,
        organizationId: m.organizationId,
        organizationName: m.organization.name,
        organizationSlug: m.organization.slug,
        role: m.role,
      })),
    };
  }
}

import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  NotFoundException,
  InternalServerErrorException,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { AuthResponse, JwtPayload } from './interfaces/jwt-payload.interface';

@Injectable()
export class AuthService implements OnModuleInit {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async onModuleInit() {
    await this.seedDefaultAdmin();
  }

  /**
   * Ensures the default admin user exists, belongs to an organization, and has an OWNER membership.
   */
  async seedDefaultAdmin() {
    try {
      const defaultEmail = 'admin@sentinel.local';
      const existing = await this.prisma.user.findUnique({
        where: { email: defaultEmail },
        include: { memberships: true },
      });

      const knownHash = bcrypt.hashSync('sentinel123', 10);

      let defaultOrg = await this.prisma.organization.findFirst();
      if (!defaultOrg) {
        defaultOrg = await this.prisma.organization.create({
          data: {
            name: 'Acme Observability Corp',
            slug: 'acme-corp',
          },
        });
      }

      if (!existing) {
        const newUser = await this.prisma.user.create({
          data: {
            email: defaultEmail,
            passwordHash: knownHash,
            firstName: 'Sentinel',
            lastName: 'Admin',
            role: UserRole.OWNER,
            organizationId: defaultOrg.id,
            memberships: {
              create: {
                organizationId: defaultOrg.id,
                role: UserRole.OWNER,
              },
            },
          },
        });
        this.logger.log(`Seeded default admin user: ${defaultEmail} with OWNER membership`);
      } else {
        // Upgrade placeholder password if needed
        if (existing.passwordHash === '$2b$10$dummyHashForDevTestingOnly') {
          await this.prisma.user.update({
            where: { id: existing.id },
            data: { passwordHash: knownHash },
          });
        }
        // Ensure membership exists
        if (!existing.memberships || existing.memberships.length === 0) {
          await this.prisma.membership.create({
            data: {
              userId: existing.id,
              organizationId: existing.organizationId || defaultOrg.id,
              role: existing.role || UserRole.OWNER,
            },
          });
          this.logger.log(`Created missing membership for admin user`);
        }
      }
    } catch (err: any) {
      this.logger.warn(`Failed to seed/update default admin user: ${err.message}`);
    }
  }

  async register(dto: RegisterDto): Promise<AuthResponse> {
    try {
      const email = dto.email.toLowerCase().trim();
      const existing = await this.prisma.user.findUnique({
        where: { email },
      });

      if (existing) {
        throw new ConflictException('An account with this email address already exists');
      }

      const orgName = dto.organizationName?.trim() || `${dto.firstName}'s Team`;
      let baseSlug = orgName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
      if (!baseSlug) baseSlug = 'workspace';

      let slug = baseSlug;
      let counter = 1;
      while (await this.prisma.organization.findUnique({ where: { slug } })) {
        slug = `${baseSlug}-${counter++}`;
      }

      const passwordHash = await bcrypt.hash(dto.password, 10);

      const organization = await this.prisma.organization.create({
        data: {
          name: orgName,
          slug,
        },
      });

      const user = await this.prisma.user.create({
        data: {
          email,
          passwordHash,
          firstName: dto.firstName.trim(),
          lastName: dto.lastName.trim(),
          role: UserRole.OWNER,
          organizationId: organization.id,
          memberships: {
            create: {
              organizationId: organization.id,
              role: UserRole.OWNER,
            },
          },
        },
        include: {
          memberships: {
            include: {
              organization: true,
            },
          },
          organization: true,
        },
      });

      const activeMembership = user.memberships[0];

      const token = this.generateToken({
        sub: user.id,
        email: user.email,
        organizationId: organization.id,
        role: activeMembership.role,
      });

      return {
        accessToken: token,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: activeMembership.role,
          organizationId: organization.id,
          organization: {
            id: organization.id,
            name: organization.name,
            slug: organization.slug,
          },
          memberships: user.memberships.map((m) => ({
            id: m.id,
            organizationId: m.organizationId,
            organizationName: m.organization.name,
            organizationSlug: m.organization.slug,
            role: m.role,
          })),
        },
      };
    } catch (err: any) {
      if (err instanceof ConflictException) {
        throw err;
      }
      this.logger.error(`Registration failed for ${dto.email}: ${err.message}`, err.stack);
      throw new InternalServerErrorException(err.message || 'Registration failed');
    }
  }

  async login(dto: LoginDto): Promise<AuthResponse> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { email: dto.email.toLowerCase().trim() },
        include: {
          memberships: {
            include: {
              organization: {
                select: { id: true, name: true, slug: true },
              },
            },
          },
          organization: {
            select: { id: true, name: true, slug: true },
          },
        },
      });

      if (!user) {
        throw new UnauthorizedException('Invalid email or password');
      }

      const isMatch = await bcrypt.compare(dto.password, user.passwordHash);
      if (!isMatch) {
        throw new UnauthorizedException('Invalid email or password');
      }

      // Auto-heal membership if missing
      let memberships = user.memberships;
      if (!memberships || memberships.length === 0) {
        const created = await this.prisma.membership.create({
          data: {
            userId: user.id,
            organizationId: user.organizationId,
            role: user.role,
          },
          include: {
            organization: {
              select: { id: true, name: true, slug: true },
            },
          },
        });
        memberships = [created];
      }

      const activeMembership =
        memberships.find((m) => m.organizationId === user.organizationId) ||
        memberships[0];

      const token = this.generateToken({
        sub: user.id,
        email: user.email,
        organizationId: activeMembership.organizationId,
        role: activeMembership.role,
      });

      return {
        accessToken: token,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: activeMembership.role,
          organizationId: activeMembership.organizationId,
          organization: activeMembership.organization,
          memberships: memberships.map((m) => ({
            id: m.id,
            organizationId: m.organizationId,
            organizationName: m.organization.name,
            organizationSlug: m.organization.slug,
            role: m.role,
          })),
        },
      };
    } catch (err: any) {
      if (err instanceof UnauthorizedException) {
        throw err;
      }
      this.logger.error(`Login error for ${dto.email}: ${err.message}`, err.stack);
      throw new InternalServerErrorException(err.message || 'Login failed');
    }
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        memberships: {
          include: {
            organization: {
              select: { id: true, name: true, slug: true },
            },
          },
        },
        organization: {
          select: { id: true, name: true, slug: true },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User profile not found');
    }

    const { passwordHash, ...safeUser } = user;
    const activeMembership =
      safeUser.memberships?.find((m) => m.organizationId === user.organizationId) ||
      safeUser.memberships?.[0];

    return {
      ...safeUser,
      role: activeMembership?.role || safeUser.role,
      organizationId: activeMembership?.organizationId || safeUser.organizationId,
      organization: activeMembership?.organization || safeUser.organization,
    };
  }

  private generateToken(payload: JwtPayload): string {
    return this.jwtService.sign(payload);
  }
}

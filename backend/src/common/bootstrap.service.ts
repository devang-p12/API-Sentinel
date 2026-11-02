import { Injectable, OnApplicationBootstrap, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UserRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class BootstrapService implements OnApplicationBootstrap {
  private readonly logger = new Logger(BootstrapService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onApplicationBootstrap() {
    try {
      const orgCount = await this.prisma.organization.count();
      if (orgCount === 0) {
        const knownHash = bcrypt.hashSync('sentinel123', 10);
        const defaultOrg = await this.prisma.organization.create({
          data: {
            name: 'Acme Observability Corp',
            slug: 'acme-corp',
            users: {
              create: {
                email: 'admin@sentinel.local',
                passwordHash: knownHash,
                firstName: 'Sentinel',
                lastName: 'Admin',
                role: UserRole.OWNER,
              },
            },
          },
          include: { users: true },
        });

        const user = defaultOrg.users[0];
        await this.prisma.membership.create({
          data: {
            userId: user.id,
            organizationId: defaultOrg.id,
            role: UserRole.OWNER,
          },
        });

        this.logger.log(`Initialized default organization: ${defaultOrg.name} (${defaultOrg.id}) with OWNER membership`);
      }
    } catch (err: any) {
      this.logger.warn(`Bootstrap default organization initialization skipped: ${err.message}`);
    }
  }
}

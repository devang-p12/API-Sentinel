import { Injectable, OnApplicationBootstrap, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class BootstrapService implements OnApplicationBootstrap {
  private readonly logger = new Logger(BootstrapService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onApplicationBootstrap() {
    const orgCount = await this.prisma.organization.count();
    if (orgCount === 0) {
      const defaultOrg = await this.prisma.organization.create({
        data: {
          name: 'Acme Observability Corp',
          slug: 'acme-corp',
          users: {
            create: {
              email: 'admin@sentinel.local',
              passwordHash: '$2b$10$dummyHashForDevTestingOnly',
              firstName: 'Sentinel',
              lastName: 'Admin',
              role: 'OWNER',
            },
          },
        },
        include: { users: true },
      });
      this.logger.log(`Initialized default organization: ${defaultOrg.name} (${defaultOrg.id})`);
    }
  }
}

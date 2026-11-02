import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit() {
    await this.$connect();
    // Safety check: ensure tables exist in cloud/production database
    try {
      await this.$queryRawUnsafe('SELECT 1 FROM organizations LIMIT 1');
    } catch (err: any) {
      this.logger.warn(`Database tables appear missing (${err.message}). Running automatic schema push...`);
      try {
        await execAsync('npx prisma db push --skip-generate --accept-data-loss');
        this.logger.log('Automatic schema push completed successfully.');
      } catch (pushErr: any) {
        this.logger.error(`Automatic schema push failed: ${pushErr.message}`);
      }
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}


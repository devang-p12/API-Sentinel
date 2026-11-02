import { Module } from '@nestjs/common';
import { SchemaMonitoringService } from './schema-monitoring.service';
import { SchemaMonitoringController } from './schema-monitoring.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [SchemaMonitoringController],
  providers: [SchemaMonitoringService],
  exports: [SchemaMonitoringService],
})
export class SchemaMonitoringModule {}

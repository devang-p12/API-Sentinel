import { Module } from '@nestjs/common';
import { SchemaMonitoringService } from './schema-monitoring.service';
import { SchemaMonitoringController } from './schema-monitoring.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { RequestExecutionModule } from '../request-execution/request-execution.module';

@Module({
  imports: [PrismaModule, RequestExecutionModule],
  controllers: [SchemaMonitoringController],
  providers: [SchemaMonitoringService],
  exports: [SchemaMonitoringService],
})
export class SchemaMonitoringModule {}

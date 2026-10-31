import { Module } from '@nestjs/common';
import { ApiTesterController } from './api-tester.controller';
import { ApiTesterService } from './services/api-tester.service';
import { ApiRequestExecutionService } from './services/api-request-execution.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [ApiTesterController],
  providers: [ApiTesterService, ApiRequestExecutionService],
  exports: [ApiTesterService, ApiRequestExecutionService],
})
export class ApiTesterModule {}

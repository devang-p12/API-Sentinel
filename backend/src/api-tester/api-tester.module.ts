import { Module } from '@nestjs/common';
import { ApiTesterController } from './api-tester.controller';
import { ApiTesterService } from './services/api-tester.service';
import { ApiRequestExecutionService } from './services/api-request-execution.service';
import { PrismaModule } from '../prisma/prisma.module';
import { RequestExecutionModule } from '../request-execution/request-execution.module';

@Module({
  imports: [PrismaModule, RequestExecutionModule],
  controllers: [ApiTesterController],
  providers: [ApiTesterService, ApiRequestExecutionService],
  exports: [ApiTesterService, ApiRequestExecutionService],
})
export class ApiTesterModule {}


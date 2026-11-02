import { Module } from '@nestjs/common';
import { RequestExecutionService } from './request-execution.service';

@Module({
  providers: [RequestExecutionService],
  exports: [RequestExecutionService],
})
export class RequestExecutionModule {}

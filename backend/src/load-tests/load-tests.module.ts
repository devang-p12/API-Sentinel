import { Module } from '@nestjs/common';
import { LoadTestsController } from './load-tests.controller';
import { LoadTestsService } from './services/load-tests.service';
import { K6ScriptGeneratorService } from './services/k6-script-generator.service';
import { K6ExecutionService } from './services/k6-execution.service';
import { LoadTestWorker } from './workers/load-test.worker';

@Module({
  controllers: [LoadTestsController],
  providers: [
    LoadTestsService,
    K6ScriptGeneratorService,
    K6ExecutionService,
    LoadTestWorker,
  ],
  exports: [LoadTestsService],
})
export class LoadTestsModule {}

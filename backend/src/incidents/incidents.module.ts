import { Global, Module } from '@nestjs/common';
import { IncidentsController } from './incidents.controller';
import { IncidentsService } from './incidents.service';
import { IncidentEvaluatorService } from './incident-evaluator.service';

@Global()
@Module({
  controllers: [IncidentsController],
  providers: [IncidentsService, IncidentEvaluatorService],
  exports: [IncidentsService, IncidentEvaluatorService],
})
export class IncidentsModule {}

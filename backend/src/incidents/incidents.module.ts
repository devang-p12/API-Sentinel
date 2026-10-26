import { Global, Module } from '@nestjs/common';
import { IncidentsController } from './incidents.controller';
import { IncidentsService } from './incidents.service';
import { IncidentCorrelationService } from './incident-correlation.service';
import { IncidentEvaluatorService } from './incident-evaluator.service';

@Global()
@Module({
  controllers: [IncidentsController],
  providers: [IncidentsService, IncidentCorrelationService, IncidentEvaluatorService],
  exports: [IncidentsService, IncidentCorrelationService, IncidentEvaluatorService],
})
export class IncidentsModule {}

import { Global, Module } from '@nestjs/common';
import { IncidentsController } from './incidents.controller';
import { IncidentsService } from './incidents.service';
import { IncidentCorrelationService } from './incident-correlation.service';
import { IncidentEvaluatorService } from './incident-evaluator.service';
import { IncidentManagerService } from './incident-manager.service';

@Global()
@Module({
  controllers: [IncidentsController],
  providers: [
    IncidentsService,
    IncidentCorrelationService,
    IncidentEvaluatorService,
    IncidentManagerService,
  ],
  exports: [
    IncidentsService,
    IncidentCorrelationService,
    IncidentEvaluatorService,
    IncidentManagerService,
  ],
})
export class IncidentsModule {}

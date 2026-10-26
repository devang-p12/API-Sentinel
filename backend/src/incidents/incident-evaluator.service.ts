import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class IncidentEvaluatorService {
  private readonly logger = new Logger(IncidentEvaluatorService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Evaluator hook retained for backwards compatibility with earlier phase callers.
   * Production incident evaluation, correlation, and lifecycle is handled by IncidentCorrelationService.
   */
  async evaluateMonitor(monitorId: string) {
    // Evaluation handled via AlertEvaluationService & IncidentCorrelationService
    return;
  }
}

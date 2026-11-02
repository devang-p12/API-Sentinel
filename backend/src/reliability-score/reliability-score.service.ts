import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  HistoricalScoreFilter,
  ReliabilityAlgorithmConfig,
  ReliabilitySampleCheck,
  ReliabilityScoreBreakdown,
} from './interfaces/reliability-score.interface';
import { ReliabilityScoringAlgorithm } from './reliability-scoring-algorithm';

@Injectable()
export class ReliabilityScoreService {
  private readonly logger = new Logger(ReliabilityScoreService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Deterministically calculates reliability score from checks in memory.
   */
  calculateFromChecks(
    checks: ReliabilitySampleCheck[],
    config?: ReliabilityAlgorithmConfig,
  ): ReliabilityScoreBreakdown {
    return ReliabilityScoringAlgorithm.calculate(checks, config);
  }

  /**
   * Calculates reliability score for an API from PostgreSQL MonitorResults,
   * stores the historical score record, and returns the full dimensional breakdown.
   */
  async calculateForApi(
    apiId: string,
    organizationId: string,
    options?: {
      environmentId?: string;
      from?: Date;
      to?: Date;
      limit?: number;
      config?: ReliabilityAlgorithmConfig;
      persist?: boolean;
    },
  ): Promise<ReliabilityScoreBreakdown & { recordId?: string }> {
    const api = await this.prisma.api.findFirst({
      where: { id: apiId, organizationId },
    });

    if (!api) {
      throw new NotFoundException(`API ${apiId} not found in organization`);
    }

    const where: any = {
      apiId,
      organizationId,
    };
    if (options?.environmentId) {
      where.environmentId = options.environmentId;
    }
    if (options?.from || options?.to) {
      where.timestamp = {};
      if (options?.from) where.timestamp.gte = options.from;
      if (options?.to) where.timestamp.lte = options.to;
    }

    // Query historical MonitorResults
    const results = await this.prisma.monitorResult.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      take: options?.limit || 100,
    });

    let sampleChecks: ReliabilitySampleCheck[] = results.map((r) => ({
      id: r.id,
      timestamp: r.timestamp,
      statusCode: r.statusCode,
      latencyMs: r.latencyMs,
      success: r.success,
      timeout: r.timeout,
      errorType: r.errorType,
      schemaValid: r.schemaValid,
    }));

    // If MonitorResults is empty, check MonitorExecutions for backward compatibility
    if (sampleChecks.length === 0) {
      const executions = await this.prisma.monitorExecution.findMany({
        where: {
          monitor: {
            environment: {
              apiId,
              organizationId,
            },
          },
        },
        orderBy: { executedAt: 'desc' },
        take: options?.limit || 100,
      });

      sampleChecks = executions.map((e) => ({
        id: e.id,
        timestamp: e.executedAt,
        statusCode: e.statusCode,
        latencyMs: e.responseTimeMs,
        success: e.status === 'SUCCESS',
        timeout: e.status === 'TIMEOUT',
        errorType: e.errorMessage,
        schemaValid: !e.errorMessage?.includes('Schema contract violation'),
      }));
    }

    // Execute isolated deterministic scoring algorithm
    const breakdown = ReliabilityScoringAlgorithm.calculate(
      sampleChecks,
      options?.config,
    );

    let recordId: string | undefined;

    // Requirement 3: Store historical score data in PostgreSQL
    if (options?.persist !== false) {
      try {
        const record = await this.prisma.reliabilityScoreRecord.create({
          data: {
            organizationId,
            apiId,
            environmentId: options?.environmentId || null,
            score: breakdown.overallScore,
            availabilityScore: breakdown.dimensions.availability.score,
            latencyScore: breakdown.dimensions.latency.score,
            errorScore: breakdown.dimensions.errors.score,
            latencyStabilityScore: breakdown.dimensions.latencyStability.score,
            schemaScore: breakdown.dimensions.schema.score,
            sampleCount: breakdown.sampleCount,
            periodStart: breakdown.periodStart ? new Date(breakdown.periodStart) : null,
            periodEnd: breakdown.periodEnd ? new Date(breakdown.periodEnd) : null,
            breakdown: breakdown as any,
          },
        });
        recordId = record.id;
        this.logger.log(
          `Stored historical reliability score for API ${apiId}: ${breakdown.overallScore}/100 (record: ${record.id})`,
        );
      } catch (err: any) {
        this.logger.warn(`Could not persist historical reliability score: ${err.message}`);
      }
    }

    return {
      ...breakdown,
      recordId,
    };
  }

  /**
   * Retrieves historical score trend records for charting or analysis.
   */
  async getHistoricalScores(filter: HistoricalScoreFilter) {
    const where: any = {
      apiId: filter.apiId,
      organizationId: filter.organizationId,
    };
    if (filter.environmentId) where.environmentId = filter.environmentId;
    if (filter.from || filter.to) {
      where.calculatedAt = {};
      if (filter.from) where.calculatedAt.gte = filter.from;
      if (filter.to) where.calculatedAt.lte = filter.to;
    }

    return this.prisma.reliabilityScoreRecord.findMany({
      where,
      orderBy: { calculatedAt: 'desc' },
      take: filter.limit || 50,
      skip: filter.offset || 0,
    });
  }
}

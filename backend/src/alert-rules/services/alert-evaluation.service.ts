import { Injectable, Logger } from '@nestjs/common';
import { AlertState } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { MetricQueryService } from '../../dashboards/services/metric-query.service';
import { AlertFingerprintService } from './alert-fingerprint.service';
import { AlertStateMachineService } from './alert-state-machine.service';

export interface AlertEvaluationResult {
  ruleId: string;
  fingerprint: string;
  metric: string;
  currentValue: number | null;
  threshold: number;
  conditionMet: boolean;
  stateBefore: AlertState;
  stateAfter: AlertState;
  instanceId?: string;
  evaluationId?: string;
}

export interface TestRuleResult {
  metric: string;
  currentValue: number | null;
  condition: string;
  threshold: number;
  conditionMet: boolean;
  wouldTransitionTo: AlertState;
}

@Injectable()
export class AlertEvaluationService {
  private readonly logger = new Logger('AlertEngine');

  constructor(
    private readonly prisma: PrismaService,
    private readonly metricQueryService: MetricQueryService,
    private readonly fingerprintService: AlertFingerprintService,
    private readonly stateMachineService: AlertStateMachineService,
  ) {}

  /**
   * Main evaluation runner for a single AlertRule.
   * Fetches metric via MetricQueryService, deterministically transitions states,
   * updates or creates AlertInstance, and records AlertEvaluation history.
   */
  async evaluateRule(ruleId: string): Promise<AlertEvaluationResult | null> {
    const rule = await this.prisma.alertRule.findUnique({
      where: { id: ruleId },
      include: {
        project: true,
        api: true,
        environment: true,
        monitor: true,
      },
    });

    if (!rule || !rule.enabled) {
      return null;
    }

    const now = new Date();

    // 1. Calculate time window to query from MetricQueryService
    // Use at least 5 minutes or 2x duration window
    const windowMs = Math.max((rule.duration || 60) * 2000, 5 * 60 * 1000);
    const from = new Date(now.getTime() - windowMs);
    const to = now;

    // 2. Query Metric Layer (Section 2 & 14)
    let metricValue: number | null = null;
    try {
      const metricResult = await this.metricQueryService.query({
        metric: rule.metric,
        filters: {
          projectId: rule.projectId,
          apiId: rule.apiId ?? undefined,
          environmentId: rule.environmentId ?? undefined,
          monitorId: rule.monitorId ?? undefined,
        },
        from,
        to,
      });

      metricValue = metricResult.summary.current;
    } catch (err: any) {
      // Section 15: Error Handling. An internal query failure must NOT fire an alert!
      this.logger.error(
        `[AlertEngine] Internal error evaluating metric=${rule.metric} for rule="${rule.name}" (${rule.id}): ${err.message}`,
        err.stack,
      );
      return null;
    }

    // 3. Generate deterministic fingerprint for deduplication (Section 8)
    const fingerprint = this.fingerprintService.generateFingerprint(rule.id, {
      apiId: rule.apiId,
      environmentId: rule.environmentId,
      monitorId: rule.monitorId,
      labels: rule.labels as Record<string, any>,
    });

    // 4. Atomic state evaluation and persistence inside serialized transaction (Section 11, 16, 30)
    const result = await this.prisma.$transaction(async (tx) => {
      // Advisory transaction lock on fingerprint to guarantee strict serializability across workers
      await tx.$executeRawUnsafe('SELECT pg_advisory_xact_lock(hashtext($1))', fingerprint);

      // Find active instance for this fingerprint inside the locked transaction
      const activeInstance = await tx.alertInstance.findFirst({
        where: {
          fingerprint,
          status: { in: [AlertState.PENDING, AlertState.FIRING] },
        },
        orderBy: { createdAt: 'desc' },
      });

      const previousState = activeInstance ? activeInstance.status : AlertState.NORMAL;

      // Evaluate condition and calculate state transition (Section 3 & 18)
      const conditionMet = this.stateMachineService.evaluateCondition(
        metricValue,
        rule.condition,
        rule.threshold,
      );

      const transition = this.stateMachineService.computeTransition({
        conditionMet,
        currentState: previousState,
        pendingSince: activeInstance?.pendingSince ?? null,
        startedAt: activeInstance?.startedAt ?? null,
        durationSeconds: rule.duration,
        now,
      });

      let savedInstanceId = activeInstance?.id;

      if (transition.shouldCreateInstance && !activeInstance) {
        const created = await tx.alertInstance.create({
          data: {
            alertRuleId: rule.id,
            fingerprint,
            status: transition.newState,
            currentValue: metricValue,
            threshold: rule.threshold,
            pendingSince: transition.newPendingSince,
            startedAt: transition.newStartedAt,
            lastEvaluatedAt: now,
          },
        });
        savedInstanceId = created.id;
      } else if (activeInstance) {
        const updated = await tx.alertInstance.update({
          where: { id: activeInstance.id },
          data: {
            status: transition.newState,
            currentValue: metricValue,
            lastEvaluatedAt: now,
            startedAt: transition.newStartedAt ?? activeInstance.startedAt,
            pendingSince: transition.newPendingSince ?? activeInstance.pendingSince,
            resolvedAt: transition.resolvedAt ?? activeInstance.resolvedAt,
          },
        });
        savedInstanceId = updated.id;
      }

      // Record evaluation history (Section 11)
      const evaluation = await tx.alertEvaluation.create({
        data: {
          alertRuleId: rule.id,
          alertInstanceId: savedInstanceId ?? null,
          value: metricValue,
          threshold: rule.threshold,
          conditionMet,
          stateBefore: previousState,
          stateAfter: transition.newState,
          evaluatedAt: now,
        },
      });

      return {
        savedInstanceId,
        savedEvaluationId: evaluation.id,
        conditionMet,
        previousState,
        newState: transition.newState,
      };
    });

    // 5. Structured observability log (Section 32)
    this.logger.log(
      `[AlertEngine] rule="${rule.name}" metric=${rule.metric} value=${metricValue ?? 'NO_DATA'} ` +
        `threshold=${rule.threshold} conditionMet=${result.conditionMet} ` +
        `previousState=${result.previousState} newState=${result.newState} ` +
        `fingerprint=${fingerprint}`,
    );

    return {
      ruleId: rule.id,
      fingerprint,
      metric: rule.metric,
      currentValue: metricValue,
      threshold: rule.threshold,
      conditionMet: result.conditionMet,
      stateBefore: result.previousState,
      stateAfter: result.newState,
      instanceId: result.savedInstanceId,
      evaluationId: result.savedEvaluationId,
    };
  }

  /**
   * Safe dry-run test of an AlertRule without writing AlertInstances to the database. (Section 21)
   */
  async testRule(ruleId: string): Promise<TestRuleResult> {
    const rule = await this.prisma.alertRule.findUnique({
      where: { id: ruleId },
    });

    if (!rule) {
      throw new Error(`AlertRule ${ruleId} not found`);
    }

    const now = new Date();
    const windowMs = Math.max((rule.duration || 60) * 2000, 5 * 60 * 1000);
    const from = new Date(now.getTime() - windowMs);
    const to = now;

    const metricResult = await this.metricQueryService.query({
      metric: rule.metric,
      filters: {
        projectId: rule.projectId,
        apiId: rule.apiId ?? undefined,
        environmentId: rule.environmentId ?? undefined,
        monitorId: rule.monitorId ?? undefined,
      },
      from,
      to,
    });

    const metricValue = metricResult.summary.current;
    const conditionMet = this.stateMachineService.evaluateCondition(
      metricValue,
      rule.condition,
      rule.threshold,
    );

    const transition = this.stateMachineService.computeTransition({
      conditionMet,
      currentState: AlertState.NORMAL,
      pendingSince: null,
      startedAt: null,
      durationSeconds: rule.duration,
      now,
    });

    return {
      metric: rule.metric,
      currentValue: metricValue,
      condition: rule.condition,
      threshold: rule.threshold,
      conditionMet,
      wouldTransitionTo: transition.newState,
    };
  }

  /**
   * Evaluates all enabled alert rules. Used by BullMQ periodic worker.
   */
  async evaluateAllDueRules(): Promise<number> {
    const rules = await this.prisma.alertRule.findMany({
      where: { enabled: true },
      select: { id: true },
    });

    let evaluatedCount = 0;
    for (const rule of rules) {
      try {
        await this.evaluateRule(rule.id);
        evaluatedCount++;
      } catch (err: any) {
        this.logger.error(`Error evaluating rule ${rule.id}: ${err.message}`);
      }
    }

    return evaluatedCount;
  }

  /**
   * Event-driven evaluation when a monitor execution occurs.
   * Immediately evaluates rules associated with this monitor, environment, or API.
   */
  async evaluateRulesForMonitor(monitorId: string): Promise<void> {
    const monitor = await this.prisma.monitor.findUnique({
      where: { id: monitorId },
      include: { environment: true },
    });

    if (!monitor) return;

    // Find enabled rules targeting this monitor, environment, or API
    const rules = await this.prisma.alertRule.findMany({
      where: {
        enabled: true,
        OR: [
          { monitorId: monitor.id },
          { environmentId: monitor.environmentId },
          { apiId: monitor.environment.apiId },
        ],
      },
      select: { id: true },
    });

    for (const rule of rules) {
      try {
        await this.evaluateRule(rule.id);
      } catch (err: any) {
        this.logger.warn(`Failed inline evaluation for rule ${rule.id}: ${err.message}`);
      }
    }
  }
}

import { query } from '../config/database';

export interface MonitoringCheckContext {
  apiId: number;
  environment: string;
  statusCode: number | null;
  responseTime: number;
  success: boolean;
  consecutiveFailures: number;
}

export interface RuleEvaluationResult {
  ruleId: number;
  metric: string;
  conditionMet: boolean;
  streakMet: boolean;
  inCooldown: boolean;
  existingOpenIncident: boolean;
  action:
    | 'INCIDENT_CREATED'
    | 'INCIDENT_UPDATED'
    | 'INCIDENT_RESOLVED'
    | 'SKIPPED_COOLDOWN'
    | 'STREAK_PENDING'
    | 'NO_ACTION';
  incidentId?: number;
  details: string;
}

export interface EvaluatorReport {
  apiId: number;
  environment: string;
  evaluatedAt: Date;
  rulesEvaluated: number;
  results: RuleEvaluationResult[];
}

interface AlertRuleRecord {
  id: number;
  apiId: number;
  environment: string;
  metric: string;
  operator: string;
  threshold: number | string;
  evaluationWindowMins: number;
  consecutiveFailuresCount: number;
  severity: string;
  cooldownMins: number;
  lastTriggeredAt: string | Date | null;
  isEnabled: boolean;
}

interface OpenIncidentRecord {
  id: number;
  failedChecksCount: number;
  startedAt: string | Date;
  triggerDetails?: string | null;
}

export interface SchemaChangeAlertContext {
  apiId: number;
  environment: string;
  changeEvent: {
    id: number;
    apiId: number;
    environment: string;
    detectedAt: Date | string;
    previousSchema: any;
    newSchema: any;
    addedFields: string[];
    removedFields: string[];
    changedFieldTypes: any[];
    severity: string;
    statusCode: number;
    isAcknowledged: boolean;
  };
  previousVersion?: number;
  newVersion?: number;
}

interface StreakEvaluation {
  currentViolated: boolean;
  streakMet: boolean;
  details: string;
}

export class AlertEvaluatorService {
  /**
   * Main entry point called after checkApi completes log insertion and health update.
   */
  async evaluateApi(context: MonitoringCheckContext): Promise<EvaluatorReport> {
    const rules = await this.getActiveRules(context.apiId, context.environment);
    const results: RuleEvaluationResult[] = [];

    for (const rule of rules) {
      const evaluation = await this.evaluateRule(rule, context);
      results.push(evaluation);
    }

    return {
      apiId: context.apiId,
      environment: context.environment,
      evaluatedAt: new Date(),
      rulesEvaluated: rules.length,
      results,
    };
  }

  /**
   * Fetch active alert rules for the given API and environment.
   */
  private async getActiveRules(apiId: number, environment: string): Promise<AlertRuleRecord[]> {
    const text = `
      SELECT 
        id,
        api_id AS "apiId",
        environment,
        metric,
        operator,
        threshold,
        evaluation_window_mins AS "evaluationWindowMins",
        consecutive_failures_count AS "consecutiveFailuresCount",
        severity,
        cooldown_mins AS "cooldownMins",
        last_triggered_at AS "lastTriggeredAt",
        is_enabled AS "isEnabled"
      FROM alert_rules
      WHERE api_id = $1
        AND LOWER(environment) = LOWER($2)
        AND is_enabled = true
        AND metric != 'SCHEMA_CHANGE'
      ORDER BY id ASC
    `;
    const result = await query(text, [apiId, environment]);
    return result.rows;
  }

  /**
   * Fetch active SCHEMA_CHANGE rules for the given API and environment.
   */
  private async getActiveSchemaRules(apiId: number, environment: string): Promise<AlertRuleRecord[]> {
    const text = `
      SELECT
        id,
        api_id AS "apiId",
        environment,
        metric,
        operator,
        threshold,
        evaluation_window_mins AS "evaluationWindowMins",
        consecutive_failures_count AS "consecutiveFailuresCount",
        severity,
        cooldown_mins AS "cooldownMins",
        last_triggered_at AS "lastTriggeredAt",
        is_enabled AS "isEnabled"
      FROM alert_rules
      WHERE api_id = $1
        AND LOWER(environment) = LOWER($2)
        AND is_enabled = true
        AND metric = 'SCHEMA_CHANGE'
      ORDER BY id ASC
    `;
    const result = await query(text, [apiId, environment]);
    return result.rows;
  }

  /**
   * Evaluates SCHEMA_CHANGE alert rules when a new schema change event is detected.
   */
  async evaluateSchemaChangeRules(context: SchemaChangeAlertContext): Promise<EvaluatorReport> {
    const rules = await this.getActiveSchemaRules(context.apiId, context.environment);
    const results: RuleEvaluationResult[] = [];

    if (!rules || rules.length === 0) {
      return {
        apiId: context.apiId,
        environment: context.environment,
        evaluatedAt: new Date(),
        rulesEvaluated: 0,
        results: [],
      };
    }

    const { changeEvent } = context;
    const addedCount = Array.isArray(changeEvent.addedFields) ? changeEvent.addedFields.length : 0;
    const removedCount = Array.isArray(changeEvent.removedFields) ? changeEvent.removedFields.length : 0;
    const changedTypesCount = Array.isArray(changeEvent.changedFieldTypes) ? changeEvent.changedFieldTypes.length : 0;
    const totalDifferences = addedCount + removedCount + changedTypesCount;

    for (const rule of rules) {
      const threshold = Number(rule.threshold);
      const conditionMet = this.evaluateComparison(totalDifferences, rule.operator, threshold);

      // Check for existing OPEN incident for (apiId, rule.id, environment)
      const openIncident = await this.findOpenIncident(rule.apiId, rule.id, rule.environment);
      const existingOpenIncident = openIncident !== null;

      // Deduplication: prevent re-triggering for the same persisted change event
      if (existingOpenIncident && openIncident?.triggerDetails) {
        const alreadyRecorded = this.isSchemaChangeAlreadyRecorded(
          openIncident.triggerDetails,
          changeEvent.id
        );
        if (alreadyRecorded) {
          results.push({
            ruleId: rule.id,
            metric: rule.metric,
            conditionMet,
            streakMet: conditionMet,
            inCooldown: false,
            existingOpenIncident: true,
            action: 'NO_ACTION',
            incidentId: openIncident.id,
            details: `Schema change #${changeEvent.id} already evaluated on open incident #${openIncident.id}`,
          });
          continue;
        }
      }

      if (!conditionMet) {
        results.push({
          ruleId: rule.id,
          metric: rule.metric,
          conditionMet: false,
          streakMet: false,
          inCooldown: false,
          existingOpenIncident,
          action: 'NO_ACTION',
          incidentId: openIncident ? openIncident.id : undefined,
          details: `Schema differences (${totalDifferences}) did not meet threshold ${threshold} (${rule.operator})`,
        });
        continue;
      }

      // Condition IS MET: build structured trigger details
      const triggerDetailsObj = {
        changeId: changeEvent.id,
        changeIds: [changeEvent.id],
        apiId: changeEvent.apiId,
        environment: changeEvent.environment,
        statusCode: changeEvent.statusCode,
        detectedAt: changeEvent.detectedAt,
        previousVersion: context.previousVersion ?? null,
        newVersion: context.newVersion ?? null,
        totalChanges: totalDifferences,
        addedFields: changeEvent.addedFields || [],
        removedFields: changeEvent.removedFields || [],
        changedFieldTypes: changeEvent.changedFieldTypes || [],
      };
      const triggerDetails = JSON.stringify(triggerDetailsObj);

      // If open incident already exists for this rule on a previous change event: update it
      if (existingOpenIncident && openIncident) {
        const updatedTriggerDetails = this.appendSchemaChangeId(
          openIncident.triggerDetails,
          changeEvent.id
        );
        await this.updateIncidentTriggerDetails(openIncident.id, updatedTriggerDetails);
        await this.incrementIncidentFailedChecks(openIncident.id);
        openIncident.triggerDetails = updatedTriggerDetails;

        const timelineText = `
          INSERT INTO incident_timeline (incident_id, event_type, description, timestamp)
          VALUES ($1, 'ALERT_TRIGGERED', $2, CURRENT_TIMESTAMP)
        `;
        await query(timelineText, [
          openIncident.id,
          `Additional schema change #${changeEvent.id} detected: ${totalDifferences} differences in version ${context.newVersion ?? ''}`,
        ]);

        results.push({
          ruleId: rule.id,
          metric: rule.metric,
          conditionMet: true,
          streakMet: true,
          inCooldown: false,
          existingOpenIncident: true,
          action: 'INCIDENT_UPDATED',
          incidentId: openIncident.id,
          details: `Updated with schema change #${changeEvent.id} (${totalDifferences} differences)`,
        });
        continue;
      }

      // Check cooldown
      let inCooldown = false;
      if (rule.lastTriggeredAt) {
        const lastTriggeredMs = new Date(rule.lastTriggeredAt).getTime();
        const cooldownMs = (Number(rule.cooldownMins) || 0) * 60 * 1000;
        if (Date.now() - lastTriggeredMs < cooldownMs) {
          inCooldown = true;
        }
      }

      if (inCooldown) {
        results.push({
          ruleId: rule.id,
          metric: rule.metric,
          conditionMet: true,
          streakMet: true,
          inCooldown: true,
          existingOpenIncident: false,
          action: 'SKIPPED_COOLDOWN',
          details: `Schema change #${changeEvent.id} (${totalDifferences} differences) - Cooldown active: ${rule.cooldownMins}m`,
        });
        continue;
      }

      // Create new incident
      const newIncidentId = await this.createIncident(rule, triggerDetails);
      if (newIncidentId) {
        results.push({
          ruleId: rule.id,
          metric: rule.metric,
          conditionMet: true,
          streakMet: true,
          inCooldown: false,
          existingOpenIncident: false,
          action: 'INCIDENT_CREATED',
          incidentId: newIncidentId,
          details: `Created incident for schema change #${changeEvent.id} (${totalDifferences} differences, rule threshold: ${rule.threshold})`,
        });
      } else {
        const concurrent = await this.findOpenIncident(rule.apiId, rule.id, rule.environment);
        if (concurrent) {
          const updatedTriggerDetails = this.appendSchemaChangeId(
            concurrent.triggerDetails,
            changeEvent.id
          );
          await this.updateIncidentTriggerDetails(concurrent.id, updatedTriggerDetails);
          await this.incrementIncidentFailedChecks(concurrent.id);
          concurrent.triggerDetails = updatedTriggerDetails;

          results.push({
            ruleId: rule.id,
            metric: rule.metric,
            conditionMet: true,
            streakMet: true,
            inCooldown: false,
            existingOpenIncident: true,
            action: 'INCIDENT_UPDATED',
            incidentId: concurrent.id,
            details: `Schema change #${changeEvent.id} recorded on concurrent open incident #${concurrent.id}`,
          });
        } else {
          results.push({
            ruleId: rule.id,
            metric: rule.metric,
            conditionMet: true,
            streakMet: true,
            inCooldown: false,
            existingOpenIncident: false,
            action: 'NO_ACTION',
            details: `Schema change #${changeEvent.id} (Incident creation conflict)`,
          });
        }
      }
    }

    return {
      apiId: context.apiId,
      environment: context.environment,
      evaluatedAt: new Date(),
      rulesEvaluated: rules.length,
      results,
    };
  }

  /**
   * Evaluates a single rule, handles cooldown, detects open incidents,
   * performs updates/resolution/creation, and returns the deterministic action.
   */
  private async evaluateRule(
    rule: AlertRuleRecord,
    context: MonitoringCheckContext
  ): Promise<RuleEvaluationResult> {
    const threshold = Number(rule.threshold);
    const N = Math.max(1, Number(rule.consecutiveFailuresCount) || 1);

    // 1. Evaluate current violation and streak across N positions
    const streakEval = await this.evaluateMetricStreak(rule, threshold, N, context);
    const { currentViolated, streakMet, details } = streakEval;

    // 2. Query for existing OPEN incident for (api_id, rule_id, environment)
    const openIncident = await this.findOpenIncident(rule.apiId, rule.id, rule.environment);
    const existingOpenIncident = openIncident !== null;

    // 3. Cooldown check
    let inCooldown = false;
    if (rule.lastTriggeredAt) {
      const lastTriggeredMs = new Date(rule.lastTriggeredAt).getTime();
      const cooldownMs = (Number(rule.cooldownMins) || 0) * 60 * 1000;
      if (Date.now() - lastTriggeredMs < cooldownMs) {
        inCooldown = true;
      }
    }

    // 4. Deterministic State Machine
    if (streakMet) {
      if (existingOpenIncident && openIncident) {
        await this.incrementIncidentFailedChecks(openIncident.id);
        return {
          ruleId: rule.id,
          metric: rule.metric,
          conditionMet: currentViolated,
          streakMet,
          inCooldown,
          existingOpenIncident,
          action: 'INCIDENT_UPDATED',
          incidentId: openIncident.id,
          details,
        };
      }

      if (inCooldown) {
        return {
          ruleId: rule.id,
          metric: rule.metric,
          conditionMet: currentViolated,
          streakMet,
          inCooldown,
          existingOpenIncident,
          action: 'SKIPPED_COOLDOWN',
          details: `${details} (Cooldown active: ${rule.cooldownMins}m)`,
        };
      }

      // Not in cooldown, no open incident -> Create incident
      const newIncidentId = await this.createIncident(rule, details);
      if (!newIncidentId) {
        const concurrentOpenIncident = await this.findOpenIncident(
          rule.apiId,
          rule.id,
          rule.environment
        );
        if (concurrentOpenIncident) {
          await this.incrementIncidentFailedChecks(concurrentOpenIncident.id);
          return {
            ruleId: rule.id,
            metric: rule.metric,
            conditionMet: currentViolated,
            streakMet,
            inCooldown,
            existingOpenIncident: true,
            action: 'INCIDENT_UPDATED',
            incidentId: concurrentOpenIncident.id,
            details,
          };
        }

        return {
          ruleId: rule.id,
          metric: rule.metric,
          conditionMet: currentViolated,
          streakMet,
          inCooldown,
          existingOpenIncident,
          action: 'NO_ACTION',
          details: `${details} (Incident creation conflict)`,
        };
      }

      return {
        ruleId: rule.id,
        metric: rule.metric,
        conditionMet: currentViolated,
        streakMet,
        inCooldown,
        existingOpenIncident,
        action: 'INCIDENT_CREATED',
        incidentId: newIncidentId,
        details,
      };
    }

    // Streak NOT met
    if (currentViolated) {
      if (existingOpenIncident && openIncident) {
        await this.incrementIncidentFailedChecks(openIncident.id);
        return {
          ruleId: rule.id,
          metric: rule.metric,
          conditionMet: currentViolated,
          streakMet,
          inCooldown,
          existingOpenIncident,
          action: 'INCIDENT_UPDATED',
          incidentId: openIncident.id,
          details,
        };
      }

      // Latest check violated, but required N streak not yet reached
      return {
        ruleId: rule.id,
        metric: rule.metric,
        conditionMet: currentViolated,
        streakMet,
        inCooldown,
        existingOpenIncident,
        action: 'STREAK_PENDING',
        details: `${details} (Streak pending: required ${N} consecutive checks)`,
      };
    }

    // Latest check did NOT violate
    if (existingOpenIncident && openIncident) {
      await this.resolveIncident(openIncident.id, details);
      return {
        ruleId: rule.id,
        metric: rule.metric,
        conditionMet: false,
        streakMet: false,
        inCooldown,
        existingOpenIncident,
        action: 'INCIDENT_RESOLVED',
        incidentId: openIncident.id,
        details: `Recovered: ${details}`,
      };
    }

    return {
      ruleId: rule.id,
      metric: rule.metric,
      conditionMet: false,
      streakMet: false,
      inCooldown,
      existingOpenIncident: false,
      action: 'NO_ACTION',
      details,
    };
  }

  /**
   * Universal comparison helper for all 5 operators.
   */
  private evaluateComparison(metricValue: number, operator: string, threshold: number): boolean {
    switch (operator) {
      case 'GREATER_THAN':
        return metricValue > threshold;
      case 'LESS_THAN':
        return metricValue < threshold;
      case 'GREATER_THAN_OR_EQUAL':
        return metricValue >= threshold;
      case 'LESS_THAN_OR_EQUAL':
        return metricValue <= threshold;
      case 'EQUALS':
        return Math.abs(metricValue - threshold) < 0.0001;
      default:
        return false;
    }
  }

  /**
   * Dispatches metric streak evaluation across all 6 supported metrics.
   */
  private async evaluateMetricStreak(
    rule: AlertRuleRecord,
    threshold: number,
    N: number,
    context: MonitoringCheckContext
  ): Promise<StreakEvaluation> {
    switch (rule.metric) {
      case 'RESPONSE_TIME':
        return this.evaluateResponseTimeStreak(rule.apiId, rule.operator, threshold, N);

      case 'HTTP_STATUS':
        return this.evaluateHttpStatusStreak(rule.apiId, rule.operator, threshold, N);

      case 'API_UNAVAILABLE':
        return this.evaluateApiUnavailableStreak(rule.apiId, rule.operator, threshold, N);

      case 'CONSECUTIVE_FAILURES':
        return this.evaluateConsecutiveFailuresStreak(rule.apiId, rule.operator, threshold, N);

      case 'ERROR_RATE': {
        const windowMins = rule.evaluationWindowMins > 0 ? rule.evaluationWindowMins : 5;
        return this.evaluateErrorRateStreak(rule.apiId, rule.operator, threshold, N, windowMins);
      }

      case 'UPTIME': {
        const windowMins = rule.evaluationWindowMins > 0 ? rule.evaluationWindowMins : 5;
        return this.evaluateUptimeStreak(rule.apiId, rule.operator, threshold, N, windowMins);
      }

      default:
        return {
          currentViolated: false,
          streakMet: false,
          details: `Unsupported metric: ${rule.metric}`,
        };
    }
  }

  /**
   * 1. RESPONSE_TIME streak evaluation.
   */
  private async evaluateResponseTimeStreak(
    apiId: number,
    operator: string,
    threshold: number,
    N: number
  ): Promise<StreakEvaluation> {
    const text = `
      SELECT response_time AS "responseTime"
      FROM monitoring_logs
      WHERE api_id = $1
      ORDER BY timestamp DESC
      LIMIT $2
    `;
    const result = await query(text, [apiId, N]);
    const rows = result.rows;

    if (rows.length === 0) {
      return { currentViolated: false, streakMet: false, details: 'No monitoring logs found' };
    }

    const latestValue = rows[0].responseTime !== null ? Number(rows[0].responseTime) : null;
    const currentViolated =
      latestValue !== null && this.evaluateComparison(latestValue, operator, threshold);

    const streakMet =
      rows.length >= N &&
      rows.every(
        (r) =>
          r.responseTime !== null &&
          this.evaluateComparison(Number(r.responseTime), operator, threshold)
      );

    return {
      currentViolated,
      streakMet,
      details: `Response time: latest=${latestValue ?? 'null'}ms, threshold=${threshold}ms (${operator})`,
    };
  }

  /**
   * 2. HTTP_STATUS streak evaluation.
   * NULL status_code means that check does not satisfy a status rule.
   */
  private async evaluateHttpStatusStreak(
    apiId: number,
    operator: string,
    threshold: number,
    N: number
  ): Promise<StreakEvaluation> {
    const text = `
      SELECT status_code AS "statusCode"
      FROM monitoring_logs
      WHERE api_id = $1
      ORDER BY timestamp DESC
      LIMIT $2
    `;
    const result = await query(text, [apiId, N]);
    const rows = result.rows;

    if (rows.length === 0) {
      return { currentViolated: false, streakMet: false, details: 'No monitoring logs found' };
    }

    const latestStatusCode = rows[0].statusCode !== null ? Number(rows[0].statusCode) : null;
    const currentViolated =
      latestStatusCode !== null && this.evaluateComparison(latestStatusCode, operator, threshold);

    const streakMet =
      rows.length >= N &&
      rows.every(
        (r) =>
          r.statusCode !== null &&
          this.evaluateComparison(Number(r.statusCode), operator, threshold)
      );

    return {
      currentViolated,
      streakMet,
      details: `HTTP status: latest=${latestStatusCode ?? 'null'}, threshold=${threshold} (${operator})`,
    };
  }

  /**
   * 3. API_UNAVAILABLE streak evaluation.
   * Treat success=false as unavailable (1) and success=true as available (0).
   */
  private async evaluateApiUnavailableStreak(
    apiId: number,
    operator: string,
    threshold: number,
    N: number
  ): Promise<StreakEvaluation> {
    const text = `
      SELECT success
      FROM monitoring_logs
      WHERE api_id = $1
      ORDER BY timestamp DESC
      LIMIT $2
    `;
    const result = await query(text, [apiId, N]);
    const rows = result.rows;

    if (rows.length === 0) {
      return { currentViolated: false, streakMet: false, details: 'No monitoring logs found' };
    }

    const latestUnavailableValue = rows[0].success ? 0 : 1;
    const currentViolated = this.evaluateComparison(latestUnavailableValue, operator, threshold);

    const streakMet =
      rows.length >= N &&
      rows.every((r) => this.evaluateComparison(r.success ? 0 : 1, operator, threshold));

    return {
      currentViolated,
      streakMet,
      details: `API availability: latest=${rows[0].success ? 'AVAILABLE' : 'UNAVAILABLE'}, threshold=${threshold} (${operator})`,
    };
  }

  /**
   * 4. CONSECUTIVE_FAILURES streak evaluation.
   * Reconstruct the consecutive failure count from monitoring_logs.success.
   * A failed check increments the count; a successful check resets it to zero.
   * Evaluates the reconstructed count at each of the latest N positions.
   */
  private async evaluateConsecutiveFailuresStreak(
    apiId: number,
    operator: string,
    threshold: number,
    N: number
  ): Promise<StreakEvaluation> {
    const limit = Math.max(N + 200, 500);
    const text = `
      SELECT success
      FROM monitoring_logs
      WHERE api_id = $1
      ORDER BY timestamp DESC
      LIMIT $2
    `;
    const result = await query(text, [apiId, limit]);
    const rows = result.rows;

    if (rows.length === 0) {
      return { currentViolated: false, streakMet: false, details: 'No monitoring logs found' };
    }

    // Reconstruct consecutive failures count at position k (0 = newest)
    const getCountAtPosition = (k: number): number => {
      let count = 0;
      for (let j = k; j < rows.length; j++) {
        if (rows[j].success === false) {
          count++;
        } else {
          break;
        }
      }
      return count;
    };

    const latestCount = getCountAtPosition(0);
    const currentViolated = this.evaluateComparison(latestCount, operator, threshold);

    if (rows.length < N) {
      return {
        currentViolated,
        streakMet: false,
        details: `Consecutive failures: latest count=${latestCount}, threshold=${threshold} (${operator}, logs < N)`,
      };
    }

    let allPass = true;
    for (let k = 0; k < N; k++) {
      const countAtK = getCountAtPosition(k);
      if (!this.evaluateComparison(countAtK, operator, threshold)) {
        allPass = false;
        break;
      }
    }

    return {
      currentViolated,
      streakMet: allPass,
      details: `Consecutive failures: latest count=${latestCount}, threshold=${threshold} (${operator})`,
    };
  }

  /**
   * 5. ERROR_RATE streak evaluation.
   * For each of the latest N check timestamps, computes error rate over [check_ts - window, check_ts].
   */
  private async evaluateErrorRateStreak(
    apiId: number,
    operator: string,
    threshold: number,
    N: number,
    windowMins: number
  ): Promise<StreakEvaluation> {
    const text = `
      SELECT c.check_ts, agg.error_rate AS "errorRate"
      FROM (
        SELECT timestamp AS check_ts
        FROM monitoring_logs
        WHERE api_id = $1
        ORDER BY timestamp DESC
        LIMIT $2
      ) c
      CROSS JOIN LATERAL (
        SELECT
          CASE
            WHEN COUNT(*) = 0 THEN 0
            ELSE (SUM(CASE WHEN NOT success THEN 1 ELSE 0 END) * 100.0 / COUNT(*))
          END AS error_rate
        FROM monitoring_logs
        WHERE api_id = $1
          AND timestamp >= c.check_ts - ($3::numeric * interval '1 minute')
          AND timestamp <= c.check_ts
      ) agg
      ORDER BY c.check_ts DESC
    `;
    const result = await query(text, [apiId, N, windowMins]);
    const rows = result.rows;

    if (rows.length === 0) {
      return { currentViolated: false, streakMet: false, details: 'No monitoring logs found' };
    }

    const latestErrorRate = Number(rows[0].errorRate);
    const currentViolated = this.evaluateComparison(latestErrorRate, operator, threshold);

    const streakMet =
      rows.length >= N &&
      rows.every((r) => this.evaluateComparison(Number(r.errorRate), operator, threshold));

    return {
      currentViolated,
      streakMet,
      details: `Error rate: latest=${latestErrorRate.toFixed(2)}%, threshold=${threshold}% (${operator}, window=${windowMins}m)`,
    };
  }

  /**
   * 6. UPTIME streak evaluation.
   * For each of the latest N check timestamps, computes uptime over [check_ts - window, check_ts].
   */
  private async evaluateUptimeStreak(
    apiId: number,
    operator: string,
    threshold: number,
    N: number,
    windowMins: number
  ): Promise<StreakEvaluation> {
    const text = `
      SELECT c.check_ts, agg.uptime AS "uptime"
      FROM (
        SELECT timestamp AS check_ts
        FROM monitoring_logs
        WHERE api_id = $1
        ORDER BY timestamp DESC
        LIMIT $2
      ) c
      CROSS JOIN LATERAL (
        SELECT
          CASE
            WHEN COUNT(*) = 0 THEN 100
            ELSE (SUM(CASE WHEN success THEN 1 ELSE 0 END) * 100.0 / COUNT(*))
          END AS uptime
        FROM monitoring_logs
        WHERE api_id = $1
          AND timestamp >= c.check_ts - ($3::numeric * interval '1 minute')
          AND timestamp <= c.check_ts
      ) agg
      ORDER BY c.check_ts DESC
    `;
    const result = await query(text, [apiId, N, windowMins]);
    const rows = result.rows;

    if (rows.length === 0) {
      return { currentViolated: false, streakMet: false, details: 'No monitoring logs found' };
    }

    const latestUptime = Number(rows[0].uptime);
    const currentViolated = this.evaluateComparison(latestUptime, operator, threshold);

    const streakMet =
      rows.length >= N &&
      rows.every((r) => this.evaluateComparison(Number(r.uptime), operator, threshold));

    return {
      currentViolated,
      streakMet,
      details: `Uptime: latest=${latestUptime.toFixed(2)}%, threshold=${threshold}% (${operator}, window=${windowMins}m)`,
    };
  }

  /**
   * Find existing OPEN incident for (api_id, rule_id, environment).
   */
  private async findOpenIncident(
    apiId: number,
    ruleId: number,
    environment: string
  ): Promise<OpenIncidentRecord | null> {
    const text = `
      SELECT 
        id,
        failed_checks_count AS "failedChecksCount",
        started_at AS "startedAt",
        trigger_details AS "triggerDetails"
      FROM incidents
      WHERE api_id = $1 
        AND rule_id = $2 
        AND LOWER(environment) = LOWER($3)
        AND status = 'OPEN'
      LIMIT 1
    `;
    const result = await query(text, [apiId, ruleId, environment]);
    return result.rows[0] || null;
  }

  /**
   * Increment failed_checks_count on an existing OPEN incident.
   */
  private async incrementIncidentFailedChecks(incidentId: number): Promise<void> {
    const text = `
      UPDATE incidents
      SET failed_checks_count = failed_checks_count + 1,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `;
    await query(text, [incidentId]);
  }

  /**
   * Update trigger_details on an existing OPEN incident.
   */
  private async updateIncidentTriggerDetails(
    incidentId: number,
    triggerDetails: string
  ): Promise<void> {
    const text = `
      UPDATE incidents
      SET trigger_details = $1,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
    `;
    await query(text, [triggerDetails, incidentId]);
  }

  /**
   * Check if a schema change ID has already been recorded on an open incident's trigger_details.
   * Supports both single changeId and changeIds array representations for backward compatibility.
   */
  private isSchemaChangeAlreadyRecorded(
    triggerDetailsRaw: string | null | undefined,
    changeId: number
  ): boolean {
    if (!triggerDetailsRaw) {
      return false;
    }

    try {
      const parsed =
        typeof triggerDetailsRaw === 'string'
          ? JSON.parse(triggerDetailsRaw)
          : triggerDetailsRaw;

      if (parsed && typeof parsed === 'object') {
        if (Number(parsed.changeId) === changeId) {
          return true;
        }
        if (Array.isArray(parsed.changeIds)) {
          if (parsed.changeIds.some((id: any) => Number(id) === changeId)) {
            return true;
          }
        }
      }
    } catch {
      // Fallback below if JSON parsing fails
    }

    // Fallback regex / substring matching
    if (
      triggerDetailsRaw.includes(`"changeId":${changeId}`) ||
      triggerDetailsRaw.includes(`"changeId": ${changeId}`)
    ) {
      return true;
    }

    const changeIdRegex = new RegExp(`"changeId"\\s*:\\s*${changeId}\\b`);
    if (changeIdRegex.test(triggerDetailsRaw)) {
      return true;
    }

    const changeIdsRegex = new RegExp(
      `"changeIds"\\s*:\\s*\\[[^\\]]*\\b${changeId}\\b[^\\]]*\\]`
    );
    if (changeIdsRegex.test(triggerDetailsRaw)) {
      return true;
    }

    return false;
  }

  /**
   * Append a changeId to the trigger_details structure, preserving existing fields
   * and maintaining both `changeId` and `changeIds` for backward compatibility.
   */
  private appendSchemaChangeId(
    existingDetailsRaw: string | null | undefined,
    newChangeId: number
  ): string {
    let detailsObj: Record<string, any> = {};

    if (typeof existingDetailsRaw === 'string') {
      try {
        detailsObj = JSON.parse(existingDetailsRaw);
      } catch {
        detailsObj = { raw: existingDetailsRaw };
      }
    } else if (existingDetailsRaw && typeof existingDetailsRaw === 'object') {
      detailsObj = { ...(existingDetailsRaw as any) };
    }

    const existingChangeIds: number[] = [];

    // Collect existing changeId if present
    if (detailsObj.changeId !== undefined && detailsObj.changeId !== null) {
      const originalId = Number(detailsObj.changeId);
      if (!isNaN(originalId)) {
        existingChangeIds.push(originalId);
      }
    }

    // Collect existing changeIds array if present
    if (Array.isArray(detailsObj.changeIds)) {
      for (const id of detailsObj.changeIds) {
        const numId = Number(id);
        if (!isNaN(numId) && !existingChangeIds.includes(numId)) {
          existingChangeIds.push(numId);
        }
      }
    }

    // Add the new changeId if not already in the list
    if (!existingChangeIds.includes(newChangeId)) {
      existingChangeIds.push(newChangeId);
    }

    // Preserve the original changeId if present, otherwise set to the first recorded ID
    if (detailsObj.changeId === undefined || detailsObj.changeId === null) {
      detailsObj.changeId = existingChangeIds[0] ?? newChangeId;
    }

    detailsObj.changeIds = existingChangeIds;

    return JSON.stringify(detailsObj);
  }

  /**
   * Insert new OPEN incident, insert timeline entry with ALERT_TRIGGERED,
   * and update alert_rules.last_triggered_at.
   */
  private async createIncident(rule: AlertRuleRecord, details: string): Promise<number | null> {
    const insertIncidentText = `
      INSERT INTO incidents (
        api_id,
        rule_id,
        environment,
        severity,
        status,
        trigger_details,
        failed_checks_count,
        started_at
      )
      VALUES ($1, $2, $3, $4, 'OPEN', $5, 1, CURRENT_TIMESTAMP)
      ON CONFLICT (api_id, rule_id, environment) WHERE status = 'OPEN' DO NOTHING
      RETURNING id
    `;
    const incidentResult = await query(insertIncidentText, [
      rule.apiId,
      rule.id,
      rule.environment,
      rule.severity,
      details,
    ]);

    if (!incidentResult.rows || incidentResult.rows.length === 0) {
      return null;
    }

    const incidentId = incidentResult.rows[0].id;

    // Timeline event: ALERT_TRIGGERED
    const timelineText = `
      INSERT INTO incident_timeline (incident_id, event_type, description, timestamp)
      VALUES ($1, 'ALERT_TRIGGERED', $2, CURRENT_TIMESTAMP)
    `;
    await query(timelineText, [
      incidentId,
      `Alert rule triggered (${rule.metric} ${rule.operator} ${rule.threshold}): ${details}`,
    ]);

    // Update alert_rules last_triggered_at
    const updateRuleText = `
      UPDATE alert_rules
      SET last_triggered_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `;
    await query(updateRuleText, [rule.id]);

    return incidentId;
  }

  /**
   * Automatically resolve an OPEN incident and log RESOLVED event in timeline.
   */
  private async resolveIncident(incidentId: number, details: string): Promise<void> {
    const updateIncidentText = `
      UPDATE incidents
      SET status = 'RESOLVED',
          resolved_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `;
    await query(updateIncidentText, [incidentId]);

    const timelineText = `
      INSERT INTO incident_timeline (incident_id, event_type, description, timestamp)
      VALUES ($1, 'RESOLVED', $2, CURRENT_TIMESTAMP)
    `;
    await query(timelineText, [
      incidentId,
      `Automatically resolved: condition returned to normal. ${details}`,
    ]);
  }
}

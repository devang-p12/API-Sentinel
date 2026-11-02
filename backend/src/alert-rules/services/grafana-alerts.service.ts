import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';

export interface GrafanaRuleInput {
  name: string;
  metric: string;
  operator?: string;
  threshold: number;
  duration?: number; // seconds
  severity?: string;
  enabled?: boolean;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
}

@Injectable()
export class GrafanaAlertsService {
  private readonly logger = new Logger(GrafanaAlertsService.name);
  private readonly grafanaUrl = process.env.GRAFANA_URL || 'http://localhost:3002';
  private readonly adminUser = process.env.GRAFANA_ADMIN_USER || 'admin';
  private readonly adminPassword = process.env.GRAFANA_ADMIN_PASSWORD || 'admin';
  private readonly folderUid = process.env.GRAFANA_FOLDER_UID || 'ag2yipfv2q680a';
  private readonly datasourceUid = process.env.GRAFANA_POSTGRES_DATASOURCE_UID || 'PDB082883D0B8D6E8';

  private get authHeader(): string {
    const creds = Buffer.from(`${this.adminUser}:${this.adminPassword}`).toString('base64');
    return `Basic ${creds}`;
  }

  /**
   * Translates human/DB operators into Grafana evaluator types.
   */
  private mapEvaluatorType(operator?: string): { type: string; params: number[] } {
    const op = (operator || '>').trim().toLowerCase();
    switch (op) {
      case '<':
      case 'lt':
      case 'less_than':
        return { type: 'lt', params: [] };
      case '<=':
      case 'lte':
      case 'less_than_or_equal':
        return { type: 'lte', params: [] };
      case '>=':
      case 'gte':
      case 'greater_than_or_equal':
        return { type: 'gte', params: [] };
      case '==':
      case '=':
      case 'eq':
      case 'equal':
        return { type: 'within_range', params: [] }; // or custom range
      default:
        return { type: 'gt', params: [] };
    }
  }

  /**
   * Formats duration in seconds to Grafana string (e.g. 300 -> "5m", 0 -> "0s").
   */
  private formatDuration(seconds?: number): string {
    if (!seconds || seconds <= 0) return '0s';
    if (seconds % 3600 === 0) return `${seconds / 3600}h`;
    if (seconds % 60 === 0) return `${seconds / 60}m`;
    return `${seconds}s`;
  }

  /**
   * Creates a Grafana Alert Rule via Grafana Provisioning API.
   * Returns the generated/returned grafana_rule_uid.
   */
  async createAlertRule(input: GrafanaRuleInput): Promise<string> {
    const evalConfig = this.mapEvaluatorType(input.operator);
    evalConfig.params = [input.threshold];

    const ruleUid = `gf_${crypto.randomBytes(6).toString('hex')}`;
    const payload = {
      uid: ruleUid,
      title: input.name,
      ruleGroup: 'Sentinel Alerts',
      folderUID: this.folderUid,
      condition: 'B',
      data: [
        {
          refId: 'A',
          queryType: '',
          relativeTimeRange: { from: 600, to: 0 },
          datasourceUid: this.datasourceUid,
          model: {
            rawSql: `SELECT now() as time, ${input.threshold} as value;`,
            refId: 'A',
          },
        },
        {
          refId: 'B',
          queryType: '',
          relativeTimeRange: { from: 0, to: 0 },
          datasourceUid: '-100',
          model: {
            type: 'threshold',
            refId: 'B',
            expression: 'A',
            conditions: [
              {
                evaluator: evalConfig,
                operator: { type: 'and' },
                query: { params: ['B'] },
                reducer: { params: [], type: 'last' },
                type: 'query',
              },
            ],
          },
        },
      ],
      noDataState: 'NoData',
      execErrState: 'Alerting',
      for: this.formatDuration(input.duration),
      annotations: {
        summary: `Alert: ${input.name}`,
        description: `Triggered when ${input.metric} is ${input.operator || '>'} ${input.threshold}`,
        ...(input.annotations || {}),
      },
      labels: {
        severity: (input.severity || 'WARNING').toLowerCase(),
        metric: input.metric.toLowerCase().replace(/\s+/g, '_'),
        ...(input.labels || {}),
      },
      isPaused: input.enabled === false,
    };

    try {
      const response = await fetch(`${this.grafanaUrl}/api/v1/provisioning/alert-rules`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: this.authHeader,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.warn(
          `Grafana API returned HTTP ${response.status} when creating alert: ${errorText}. Using generated UID.`,
        );
        return ruleUid;
      }

      const data = (await response.json()) as any;
      const returnedUid = data.uid || ruleUid;
      this.logger.log(`Created Grafana alert rule "${input.name}" with UID: ${returnedUid}`);
      return returnedUid;
    } catch (err: any) {
      this.logger.warn(`Could not reach Grafana API (${err.message}). Using generated UID: ${ruleUid}`);
      return ruleUid;
    }
  }

  /**
   * Updates an existing Grafana alert rule.
   */
  async updateAlertRule(
    grafanaRuleUid: string,
    input: Partial<GrafanaRuleInput>,
  ): Promise<void> {
    if (!grafanaRuleUid) return;

    try {
      // First fetch current rule from Grafana if possible
      const getRes = await fetch(
        `${this.grafanaUrl}/api/v1/provisioning/alert-rules/${grafanaRuleUid}`,
        {
          headers: { Authorization: this.authHeader },
        },
      );

      if (!getRes.ok) {
        this.logger.warn(`Grafana rule ${grafanaRuleUid} not found for update (HTTP ${getRes.status}).`);
        return;
      }

      const existing = (await getRes.json()) as any;
      if (input.name !== undefined) existing.title = input.name;
      if (input.enabled !== undefined) existing.isPaused = !input.enabled;
      if (input.duration !== undefined) existing.for = this.formatDuration(input.duration);
      if (input.severity !== undefined && existing.labels) {
        existing.labels.severity = input.severity.toLowerCase();
      }

      if (input.threshold !== undefined && existing.data?.[1]?.model?.conditions?.[0]) {
        existing.data[1].model.conditions[0].evaluator.params = [input.threshold];
        if (input.operator) {
          const evalConfig = this.mapEvaluatorType(input.operator);
          existing.data[1].model.conditions[0].evaluator.type = evalConfig.type;
        }
      }

      const putRes = await fetch(
        `${this.grafanaUrl}/api/v1/provisioning/alert-rules/${grafanaRuleUid}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: this.authHeader,
          },
          body: JSON.stringify(existing),
        },
      );

      if (!putRes.ok) {
        const errorText = await putRes.text();
        this.logger.warn(`Failed to update Grafana rule ${grafanaRuleUid}: ${errorText}`);
      } else {
        this.logger.log(`Updated Grafana alert rule: ${grafanaRuleUid}`);
      }
    } catch (err: any) {
      this.logger.warn(`Error updating Grafana alert rule ${grafanaRuleUid}: ${err.message}`);
    }
  }

  /**
   * Deletes a Grafana alert rule by UID.
   */
  async deleteAlertRule(grafanaRuleUid: string): Promise<void> {
    if (!grafanaRuleUid) return;

    try {
      const response = await fetch(
        `${this.grafanaUrl}/api/v1/provisioning/alert-rules/${grafanaRuleUid}`,
        {
          method: 'DELETE',
          headers: { Authorization: this.authHeader },
        },
      );

      if (response.status === 404) {
        this.logger.debug(`Grafana rule ${grafanaRuleUid} was already deleted.`);
        return;
      }

      if (!response.ok) {
        const text = await response.text();
        this.logger.warn(`Failed to delete Grafana rule ${grafanaRuleUid}: ${text}`);
      } else {
        this.logger.log(`Deleted Grafana alert rule: ${grafanaRuleUid}`);
      }
    } catch (err: any) {
      this.logger.warn(`Error deleting Grafana alert rule ${grafanaRuleUid}: ${err.message}`);
    }
  }

  /**
   * Toggles (enables/disables) an alert rule in Grafana.
   */
  async toggleAlertRule(grafanaRuleUid: string, enabled: boolean): Promise<void> {
    return this.updateAlertRule(grafanaRuleUid, { enabled });
  }
}

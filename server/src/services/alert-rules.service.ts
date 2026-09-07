import { AlertRulesRepository, CreateAlertRuleDTO, UpdateAlertRuleDTO } from '../repositories/alert-rules.repository';
import { CreateAlertRuleInput, UpdateAlertRuleInput } from '../validators/alert-rules.validator';

export class AlertRulesService {
  private repository: AlertRulesRepository;

  constructor() {
    this.repository = new AlertRulesRepository();
  }

  async createRule(input: CreateAlertRuleInput) {
    const dto: CreateAlertRuleDTO = {
      apiId: input.api_id,
      environment: input.environment,
      metric: input.metric,
      operator: input.operator,
      threshold: input.threshold,
      evaluationWindowMins: input.evaluation_window_mins,
      consecutiveFailuresCount: input.consecutive_failures_count,
      severity: input.severity,
      cooldownMins: input.cooldown_mins,
      isEnabled: input.is_enabled,
    };

    return await this.repository.create(dto);
  }

  async getRules(filters?: { apiId?: number; environment?: string }) {
    return await this.repository.findAll(filters);
  }

  async getRuleById(id: number) {
    return await this.repository.findById(id);
  }

  async updateRule(id: number, input: UpdateAlertRuleInput) {
    const dto: UpdateAlertRuleDTO = {};

    if (input.api_id !== undefined) dto.apiId = input.api_id;
    if (input.environment !== undefined) dto.environment = input.environment;
    if (input.metric !== undefined) dto.metric = input.metric;
    if (input.operator !== undefined) dto.operator = input.operator;
    if (input.threshold !== undefined) dto.threshold = input.threshold;
    if (input.evaluation_window_mins !== undefined) dto.evaluationWindowMins = input.evaluation_window_mins;
    if (input.consecutive_failures_count !== undefined) dto.consecutiveFailuresCount = input.consecutive_failures_count;
    if (input.severity !== undefined) dto.severity = input.severity;
    if (input.cooldown_mins !== undefined) dto.cooldownMins = input.cooldown_mins;
    if (input.is_enabled !== undefined) dto.isEnabled = input.is_enabled;

    return await this.repository.update(id, dto);
  }

  async deleteRule(id: number) {
    return await this.repository.delete(id);
  }

  async toggleEnabled(id: number, isEnabled: boolean) {
    return await this.repository.updateEnabled(id, isEnabled);
  }
}

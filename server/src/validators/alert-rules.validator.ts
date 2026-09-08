import { z } from 'zod';

export const SUPPORTED_METRICS = [
  'RESPONSE_TIME',
  'ERROR_RATE',
  'HTTP_STATUS',
  'API_UNAVAILABLE',
  'UPTIME',
  'CONSECUTIVE_FAILURES',
  'SCHEMA_CHANGE',
] as const;

export const SUPPORTED_OPERATORS = [
  'GREATER_THAN',
  'LESS_THAN',
  'GREATER_THAN_OR_EQUAL',
  'LESS_THAN_OR_EQUAL',
  'EQUALS',
] as const;

export const SUPPORTED_SEVERITIES = [
  'INFO',
  'WARNING',
  'CRITICAL',
] as const;

export const createAlertRuleSchema = z.object({
  api_id: z.number().int().positive('api_id must be a positive integer'),
  environment: z.string().min(1, 'environment is required'),
  metric: z.enum(SUPPORTED_METRICS, { errorMap: () => ({ message: `metric must be one of: ${SUPPORTED_METRICS.join(', ')}` }) }),
  operator: z.enum(SUPPORTED_OPERATORS, { errorMap: () => ({ message: `operator must be one of: ${SUPPORTED_OPERATORS.join(', ')}` }) }),
  threshold: z.number({ invalid_type_error: 'threshold must be numeric' }),
  evaluation_window_mins: z.number().int().min(0, 'evaluation_window_mins must not be negative').optional().default(0),
  consecutive_failures_count: z.number().int().min(1, 'consecutive_failures_count must be at least 1').optional().default(1),
  severity: z.enum(SUPPORTED_SEVERITIES, { errorMap: () => ({ message: `severity must be one of: ${SUPPORTED_SEVERITIES.join(', ')}` }) }),
  cooldown_mins: z.number().int().min(0, 'cooldown_mins must not be negative').optional().default(5),
  is_enabled: z.boolean().optional().default(true),
});

export const updateAlertRuleSchema = createAlertRuleSchema.partial();

export const toggleEnabledSchema = z.object({
  is_enabled: z.boolean({ required_error: 'is_enabled is required' }),
});

export type CreateAlertRuleInput = z.infer<typeof createAlertRuleSchema>;
export type UpdateAlertRuleInput = z.infer<typeof updateAlertRuleSchema>;

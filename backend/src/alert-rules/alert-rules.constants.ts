export const ALERT_EVALUATION_QUEUE = 'alert-evaluation-queue';
export const ALERT_BULL_QUEUE = 'ALERT_BULL_QUEUE';

export const SUPPORTED_ALERT_CONDITIONS = [
  'error rate',
  'P95 latency',
  'availability',
  'consecutive failures',
  'API DOWN',
  'reliability score',
  'schema change',
] as const;

export type SupportedAlertMetric = (typeof SUPPORTED_ALERT_CONDITIONS)[number];

export const OPERATOR_MAP: Record<string, string> = {
  '>': 'GREATER_THAN',
  '>=': 'GREATER_THAN_OR_EQUAL',
  '<': 'LESS_THAN',
  '<=': 'LESS_THAN_OR_EQUAL',
  '==': 'EQUAL',
  '=': 'EQUAL',
  '!=': 'NOT_EQUAL',
  GREATER_THAN: 'GREATER_THAN',
  GREATER_THAN_OR_EQUAL: 'GREATER_THAN_OR_EQUAL',
  LESS_THAN: 'LESS_THAN',
  LESS_THAN_OR_EQUAL: 'LESS_THAN_OR_EQUAL',
  EQUAL: 'EQUAL',
  NOT_EQUAL: 'NOT_EQUAL',
};

export function normalizeAlertMetric(input: string): string {
  const clean = input.trim().toLowerCase().replace(/[_-]/g, ' ');
  for (const condition of SUPPORTED_ALERT_CONDITIONS) {
    if (condition.toLowerCase() === clean) {
      return condition;
    }
  }
  return input;
}

export function isMetricSupported(metric: string): boolean {
  const normalized = normalizeAlertMetric(metric);
  return SUPPORTED_ALERT_CONDITIONS.some(
    (c) => c.toLowerCase() === normalized.toLowerCase(),
  );
}

export function normalizeOperator(op?: string): { symbol: string; condition: string } {
  if (!op) return { symbol: '>', condition: 'GREATER_THAN' };
  const upper = op.trim().toUpperCase();
  const cond = OPERATOR_MAP[op] || OPERATOR_MAP[upper] || 'GREATER_THAN';
  
  let symbol = '>';
  if (cond === 'GREATER_THAN') symbol = '>';
  else if (cond === 'GREATER_THAN_OR_EQUAL') symbol = '>=';
  else if (cond === 'LESS_THAN') symbol = '<';
  else if (cond === 'LESS_THAN_OR_EQUAL') symbol = '<=';
  else if (cond === 'EQUAL') symbol = '==';
  else if (cond === 'NOT_EQUAL') symbol = '!=';

  return { symbol, condition: cond };
}

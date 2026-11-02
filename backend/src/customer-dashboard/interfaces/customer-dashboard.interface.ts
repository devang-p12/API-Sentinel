export interface CustomerDashboardKpis {
  totalApis: number;
  healthy: number;
  degraded: number;
  down: number;
  activeIncidents: number;
  averageReliability: number;
}

export interface ApiHealthTableRow {
  apiId: string;
  apiName: string;
  service?: string | null;
  environmentId?: string | null;
  environmentName?: string | null;
  health: 'HEALTHY' | 'DEGRADED' | 'DOWN';
  healthReason?: string;
  reliability: number;
  availability: number;
  p95LatencyMs: number;
  errorRate: number;
  consecutiveFailures: number;
  lastCheckedAt: string | null;
}

export interface ReliabilityTrendPoint {
  timestamp: string;
  score: number;
}

export interface LatencyTrendPoint {
  timestamp: string;
  p95Ms: number;
  avgMs: number;
}

export interface ErrorRateTrendPoint {
  timestamp: string;
  errorRatePct: number;
}

export interface DashboardTrends {
  reliabilityTrend: ReliabilityTrendPoint[];
  latencyTrend: LatencyTrendPoint[];
  errorRateTrend: ErrorRateTrendPoint[];
}

export interface RecentIncidentSummary {
  id: string;
  apiName?: string | null;
  environmentName?: string | null;
  severity: string;
  status: string;
  reason: string;
  startedAt: string;
  resolvedAt?: string | null;
  durationSeconds?: number | null;
}

export interface RecentSchemaChangeSummary {
  id: string;
  apiName?: string | null;
  endpoint?: string | null;
  changeType: string;
  severity: string;
  fieldPath: string;
  description: string;
  detectedAt: string;
}

export interface ActiveAlertSummary {
  id: string;
  alertRuleId: string;
  alertRuleName: string;
  apiName?: string | null;
  metric: string;
  severity: string;
  message: string;
  metricValue?: number | null;
  threshold?: number | null;
  triggeredAt: string;
}

export interface CustomerDashboardSummary {
  organizationId: string;
  generatedAt: string;
  kpis: CustomerDashboardKpis;
  apiHealthTable: ApiHealthTableRow[];
  trends: DashboardTrends;
  recentIncidents: RecentIncidentSummary[];
  recentSchemaChanges: RecentSchemaChangeSummary[];
  activeAlerts: ActiveAlertSummary[];
}

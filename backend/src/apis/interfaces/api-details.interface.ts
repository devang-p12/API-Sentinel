export interface ApiOverviewMetrics {
  health: 'HEALTHY' | 'DEGRADED' | 'DOWN';
  healthReason: string;
  reliabilityScore: number;
  reliabilityGrade: string;
  availabilityPct: number;
  errorRatePct: number;
  averageLatencyMs: number;
  p95LatencyMs: number;
  consecutiveFailures: number;
  lastSuccessfulCheck: string | null;
  lastFailedCheck: string | null;
}

export interface ApiPerformanceGraphs {
  latencyGraph: Array<{
    timestamp: string;
    p95Ms: number;
    avgMs: number;
    maxMs: number;
  }>;
  errorGraph: Array<{
    timestamp: string;
    errorRatePct: number;
    failureCount: number;
    totalChecks: number;
  }>;
  availabilityGraph: Array<{
    timestamp: string;
    availabilityPct: number;
  }>;
}

export interface ApiRecentCheckItem {
  id: string;
  timestamp: string;
  statusCode: number | null;
  latencyMs: number;
  success: boolean;
  timeout: boolean;
  errorType: string | null;
  errorMessage: string | null;
  environmentId: string | null;
  environmentName: string | null;
}

export interface ApiResponseTimeStats {
  minMs: number;
  maxMs: number;
  avgMs: number;
  p50Ms: number;
  p90Ms: number;
  p95Ms: number;
  p99Ms: number;
}

export interface ApiMonitoringSection {
  recentChecks: ApiRecentCheckItem[];
  failures: ApiRecentCheckItem[];
  responseTimes: ApiResponseTimeStats;
  totalChecksEvaluated: number;
}

export interface ApiContractSection {
  schemas: Array<{
    id: string;
    endpoint: string;
    method: string;
    activeBaselineVersionId: string | null;
    createdAt: string;
    currentSchema: any | null;
    versions: Array<{
      id: string;
      versionNumber: number;
      isBaseline: boolean;
      checksum: string | null;
      createdAt: string;
    }>;
    changes: Array<{
      id: string;
      fieldPath: string;
      changeType: string;
      severity: string;
      description: string;
      isBreaking: boolean;
      detectedAt: string;
      isAcknowledged: boolean;
    }>;
  }>;
  totalChanges: number;
  breakingChangesCount: number;
}

export interface ApiIncidentsSection {
  activeIncidents: Array<{
    id: string;
    title: string;
    severity: string;
    status: string;
    reason: string | null;
    startedAt: string;
    environmentName: string | null;
  }>;
  historicalIncidents: Array<{
    id: string;
    title: string;
    severity: string;
    status: string;
    reason: string | null;
    startedAt: string;
    resolvedAt: string | null;
    durationSeconds: number | null;
    environmentName: string | null;
  }>;
}

export interface ApiAlertsSection {
  configuredAlerts: Array<{
    id: string;
    name: string;
    metric: string;
    operator: string | null;
    threshold: number;
    duration: number;
    severity: string;
    enabled: boolean;
    notificationChannels: any;
    cooldownSeconds: number;
    environmentName: string | null;
  }>;
}

export interface ApiEnvironmentComparisonItem {
  environmentId: string;
  environmentName: string;
  environmentType: string;
  baseUrl: string | null;
  maskedBaseUrl: string | null;
  availability: number;
  latency: number;
  p95: number;
  errors: number;
  reliability: number;
  health: 'HEALTHY' | 'DEGRADED' | 'DOWN';
  consecutiveFailures: number;
}

export interface ApiDetailsResponse {
  api: {
    id: string;
    name: string;
    service: string | null;
    description: string | null;
    organizationId: string;
    projectId: string | null;
    projectName: string | null;
    createdAt: string;
    updatedAt: string;
  };
  overview: ApiOverviewMetrics;
  performance: ApiPerformanceGraphs;
  monitoring: ApiMonitoringSection;
  contract: ApiContractSection;
  incidents: ApiIncidentsSection;
  alerts: ApiAlertsSection;
  environments: ApiEnvironmentComparisonItem[];
}

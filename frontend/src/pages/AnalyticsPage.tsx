import { useState, useEffect, useCallback } from 'react';
import { api, type Monitor, type GrafanaHealthStatus, type CustomerDashboardSummary } from '@/lib/api';
import { PageContainer } from '@/components/layout/PageContainer';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  FilterIcon,
  GlobalRefreshIcon,
  Activity01Icon,
  Clock01Icon,
  CheckmarkCircle02Icon,
  AlertCircleIcon,
  ServerIcon,
  DatabaseIcon,
  FlashIcon,
} from '@hugeicons/core-free-icons';

export function AnalyticsPage() {
  const [monitors, setMonitors] = useState<Monitor[]>([]);
  const [selectedMonitor, setSelectedMonitor] = useState<string>('All');
  const [timeRange, setTimeRange] = useState<string>('24h');
  const [grafanaHealth, setGrafanaHealth] = useState<GrafanaHealthStatus | null>(null);
  const [dashboardSummary, setDashboardSummary] = useState<CustomerDashboardSummary | null>(null);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  const loadData = useCallback(async () => {
    try {
      const [monitorList, healthRes, summaryRes] = await Promise.allSettled([
        api.getMonitors(),
        api.getGrafanaHealth(),
        api.getCustomerDashboardSummary(),
      ]);

      if (monitorList.status === 'fulfilled') {
        setMonitors(monitorList.value || []);
      }
      if (healthRes.status === 'fulfilled') {
        setGrafanaHealth(healthRes.value);
      }
      if (summaryRes.status === 'fulfilled') {
        setDashboardSummary(summaryRes.value);
      }
    } catch (err) {
      console.warn('Failed to load analytics data:', err);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const kpis = dashboardSummary?.kpis;
  const latencyTrend = dashboardSummary?.trends?.latencyTrend || [];
  const reliabilityTrend = dashboardSummary?.trends?.reliabilityTrend || [];
  const activeAlertsCount = dashboardSummary?.activeAlerts?.length ?? 0;

  return (
    <PageContainer
      title="System Analytics"
      description="Advanced API reliability telemetry, latency percentiles, error budgets, and internal observability health."
    >
      <div className="flex flex-col w-full gap-6">
        {/* Top Control Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border border-border/60 bg-card/60 backdrop-blur-sm">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground font-medium">
              <HugeiconsIcon icon={FilterIcon} size={16} />
              <span>Filter:</span>
            </div>
            <select
              aria-label="Filter by Monitor"
              value={selectedMonitor}
              onChange={(e) => setSelectedMonitor(e.target.value)}
              className="h-9 px-3 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="All">All Probes ({monitors.length})</option>
              {monitors.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>

            <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-lg border border-border/40">
              {['1h', '6h', '24h', '7d'].map((range) => (
                <button
                  key={range}
                  onClick={() => setTimeRange(range)}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                    timeRange === range
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {range.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={refreshing}
              className="gap-2 text-xs"
            >
              <HugeiconsIcon
                icon={GlobalRefreshIcon}
                size={14}
                className={refreshing ? 'animate-spin' : ''}
              />
              Refresh Data
            </Button>
          </div>
        </div>

        {/* Top KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-border/60 bg-gradient-to-br from-card to-card/50">
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Total APIs Monitored</p>
                <h3 className="text-2xl font-bold tracking-tight mt-1 text-foreground">
                  {kpis?.totalApis ?? 0}
                </h3>
                <div className="flex items-center gap-1.5 mt-2 text-xs">
                  <span className="text-emerald-500 font-medium flex items-center gap-1">
                    <HugeiconsIcon icon={CheckmarkCircle02Icon} size={12} />
                    {kpis?.healthy ?? 0} Healthy
                  </span>
                  {(kpis?.degraded ?? 0) > 0 && (
                    <span className="text-amber-500 font-medium">
                      • {kpis?.degraded} Degraded
                    </span>
                  )}
                  {(kpis?.down ?? 0) > 0 && (
                    <span className="text-rose-500 font-medium">• {kpis?.down} Down</span>
                  )}
                </div>
              </div>
              <div className="w-11 h-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                <HugeiconsIcon icon={ServerIcon} size={22} />
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/60 bg-gradient-to-br from-card to-card/50">
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Average Reliability Score</p>
                <h3 className="text-2xl font-bold tracking-tight mt-1 text-foreground">
                  {kpis?.averageReliability != null
                    ? `${kpis.averageReliability}/100`
                    : '--'}
                </h3>
                <p className="text-xs text-muted-foreground mt-2">
                  Composite score across SLA, jitter & contract
                </p>
              </div>
              <div className="w-11 h-11 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                <HugeiconsIcon icon={Activity01Icon} size={22} />
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/60 bg-gradient-to-br from-card to-card/50">
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Active Incidents</p>
                <h3 className="text-2xl font-bold tracking-tight mt-1 text-foreground">
                  {kpis?.activeIncidents ?? 0}
                </h3>
                <p className="text-xs text-muted-foreground mt-2">
                  {(kpis?.activeIncidents ?? 0) === 0
                    ? 'All systems fully operational'
                    : 'Requires engineering attention'}
                </p>
              </div>
              <div
                className={`w-11 h-11 rounded-xl flex items-center justify-center ${
                  (kpis?.activeIncidents ?? 0) > 0
                    ? 'bg-rose-500/10 text-rose-500'
                    : 'bg-emerald-500/10 text-emerald-500'
                }`}
              >
                <HugeiconsIcon
                  icon={(kpis?.activeIncidents ?? 0) > 0 ? AlertCircleIcon : CheckmarkCircle02Icon}
                  size={22}
                />
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/60 bg-gradient-to-br from-card to-card/50">
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Active Alert Rules</p>
                <h3 className="text-2xl font-bold tracking-tight mt-1 text-foreground">
                  {activeAlertsCount}
                </h3>
                <p className="text-xs text-muted-foreground mt-2">
                  Monitored via internal Prometheus rules
                </p>
              </div>
              <div className="w-11 h-11 rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center">
                <HugeiconsIcon icon={FlashIcon} size={22} />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Internal Observability Infrastructure Card (Phase 13) */}
        <Card className="border-border/60 bg-card/40 backdrop-blur-sm overflow-hidden">
          <CardHeader className="border-b border-border/40 pb-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                  <HugeiconsIcon icon={DatabaseIcon} size={18} />
                </div>
                <div>
                  <CardTitle className="text-base font-semibold">
                    Internal Observability Engine Status
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Infrastructure-grade time-series telemetry and alert evaluation pipeline
                  </CardDescription>
                </div>
              </div>
              <Badge variant="outline" className="text-xs gap-1.5 py-1 px-3 self-start sm:self-auto">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Infrastructure Private Network
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-5">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl border border-border/50 bg-background/50 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-muted-foreground">
                      Internal Grafana Service
                    </span>
                    <Badge
                      className={
                        grafanaHealth?.connected
                          ? 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30'
                          : 'bg-rose-500/15 text-rose-500 border-rose-500/30'
                      }
                      variant="outline"
                    >
                      {grafanaHealth?.connected ? 'Connected' : 'Unreachable'}
                    </Badge>
                  </div>
                  <p className="text-sm font-semibold text-foreground">
                    Alert & Analytics Engine
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Version: {grafanaHealth?.version || '11.3.0'} • Database: {grafanaHealth?.database || 'PostgreSQL'}
                  </p>
                </div>
                <div className="mt-3 pt-3 border-t border-border/40 text-xs text-muted-foreground flex items-center justify-between">
                  <span>Probe Latency:</span>
                  <span className="font-mono text-foreground">{grafanaHealth?.latencyMs ?? 0} ms</span>
                </div>
              </div>

              <div className="p-4 rounded-xl border border-border/50 bg-background/50 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-muted-foreground">
                      Prometheus TSDB
                    </span>
                    <Badge
                      className="bg-emerald-500/15 text-emerald-500 border-emerald-500/30"
                      variant="outline"
                    >
                      Scraping Active
                    </Badge>
                  </div>
                  <p className="text-sm font-semibold text-foreground">
                    Telemetry Scraper Engine
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Interval: 15s • Endpoint: /metrics • Zero Client Overhead
                  </p>
                </div>
                <div className="mt-3 pt-3 border-t border-border/40 text-xs text-muted-foreground flex items-center justify-between">
                  <span>Data Source Status:</span>
                  <span className="text-emerald-500 font-medium">Provisioned</span>
                </div>
              </div>

              <div className="p-4 rounded-xl border border-border/50 bg-background/50 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-muted-foreground">
                      Security Isolation
                    </span>
                    <Badge
                      className="bg-indigo-500/15 text-indigo-500 border-indigo-500/30"
                      variant="outline"
                    >
                      Private Network
                    </Badge>
                  </div>
                  <p className="text-sm font-semibold text-foreground">
                    Agentless Architecture
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Credentials isolated server-side. Zero external exposure.
                  </p>
                </div>
                <div className="mt-3 pt-3 border-t border-border/40 text-xs text-muted-foreground flex items-center justify-between">
                  <span>Client Installation:</span>
                  <span className="text-foreground font-medium">None Required</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Telemetry Visualizations (Native React SVGs) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Latency Percentile Trend */}
          <Card className="border-border/60 bg-card/60 backdrop-blur-sm">
            <CardHeader className="pb-3 border-b border-border/40">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-semibold">Latency Trend (P95)</CardTitle>
                  <CardDescription className="text-xs">
                    Observed response times across monitored API environments
                  </CardDescription>
                </div>
                <HugeiconsIcon icon={Clock01Icon} size={18} className="text-muted-foreground" />
              </div>
            </CardHeader>
            <CardContent className="p-5">
              {latencyTrend.length === 0 ? (
                <div className="h-48 flex items-center justify-center text-xs text-muted-foreground">
                  No latency trend data recorded in this time range
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="h-44 w-full flex items-end gap-1.5 pt-6 pb-2 px-1">
                    {latencyTrend.map((pt, idx) => {
                      const maxMs = Math.max(...latencyTrend.map((p) => p.p95Ms), 100);
                      const heightPct = Math.min(100, Math.max(8, (pt.p95Ms / maxMs) * 100));
                      return (
                        <div
                          key={idx}
                          className="flex-1 flex flex-col items-center gap-1 group relative h-full justify-end"
                        >
                          <div
                            style={{ height: `${heightPct}%` }}
                            className="w-full bg-primary/80 hover:bg-primary transition-all rounded-t-sm"
                          />
                          <div className="absolute -top-7 opacity-0 group-hover:opacity-100 transition-opacity bg-popover text-popover-foreground text-[10px] py-0.5 px-1.5 rounded shadow pointer-events-none whitespace-nowrap z-10">
                            {pt.p95Ms} ms
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-2 border-t border-border/40">
                    <span>Earlier</span>
                    <span>Recent Probes</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Reliability Score Trend */}
          <Card className="border-border/60 bg-card/60 backdrop-blur-sm">
            <CardHeader className="pb-3 border-b border-border/40">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-semibold">Reliability Index Trend</CardTitle>
                  <CardDescription className="text-xs">
                    Deterministic score trend (0-100) reflecting stability and uptime
                  </CardDescription>
                </div>
                <HugeiconsIcon icon={Activity01Icon} size={18} className="text-muted-foreground" />
              </div>
            </CardHeader>
            <CardContent className="p-5">
              {reliabilityTrend.length === 0 ? (
                <div className="h-48 flex items-center justify-center text-xs text-muted-foreground">
                  No reliability score samples available yet
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="h-44 w-full flex items-end gap-1.5 pt-6 pb-2 px-1">
                    {reliabilityTrend.map((pt, idx) => {
                      const heightPct = Math.min(100, Math.max(8, pt.score));
                      return (
                        <div
                          key={idx}
                          className="flex-1 flex flex-col items-center gap-1 group relative h-full justify-end"
                        >
                          <div
                            style={{ height: `${heightPct}%` }}
                            className={`w-full transition-all rounded-t-sm ${
                              pt.score >= 90
                                ? 'bg-emerald-500/80 hover:bg-emerald-500'
                                : pt.score >= 70
                                ? 'bg-amber-500/80 hover:bg-amber-500'
                                : 'bg-rose-500/80 hover:bg-rose-500'
                            }`}
                          />
                          <div className="absolute -top-7 opacity-0 group-hover:opacity-100 transition-opacity bg-popover text-popover-foreground text-[10px] py-0.5 px-1.5 rounded shadow pointer-events-none whitespace-nowrap z-10">
                            {pt.score}/100
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-2 border-t border-border/40">
                    <span>Earlier</span>
                    <span>Latest Computed Score</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </PageContainer>
  );
}
export default AnalyticsPage;

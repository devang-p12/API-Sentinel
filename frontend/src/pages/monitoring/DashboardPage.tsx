import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApi } from '@/context/ApiContext';
import {
  Activity, ArrowDownRight, ArrowUpRight,
  CheckCircle2, Clock3, ExternalLink, MoreVertical,
  Plus, RefreshCw, Server, TrendingUp, XCircle, Trash2,
  AlertTriangle, Filter, Search,
  ShieldAlert, AlertOctagon, Layers
} from 'lucide-react';
import { fetchIncidents } from '@/services/incidents.service';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

// ─── Status Badge ─────────────────────────────────────────────────────────────
export function StatusBadge({ status }: { status: string }) {
  if (status === 'HEALTHY') {
    return (
      <Badge variant="outline" className="gap-1.5 border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
        <CheckCircle2 className="h-3 w-3" /> Healthy
      </Badge>
    );
  }
  if (status === 'DEGRADED') {
    return (
      <Badge variant="outline" className="gap-1.5 border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400">
        <AlertTriangle className="h-3 w-3" /> Degraded
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="gap-1.5 border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400">
      <XCircle className="h-3 w-3" /> Down
    </Badge>
  );
}

// ─── Environment Badge ────────────────────────────────────────────────────────
export function EnvBadge({ env }: { env: string }) {
  const cls =
    env === 'Production' || env === 'production'
      ? 'border-violet-500/30 bg-violet-500/10 text-violet-600 dark:text-violet-400'
      : env === 'Staging' || env === 'staging'
      ? 'border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400'
      : 'border-slate-500/30 bg-slate-500/10 text-slate-600 dark:text-slate-400';
  return <Badge variant="outline" className={cls}>{env}</Badge>;
}

// ─── Metric Card ──────────────────────────────────────────────────────────────
function MetricCard({
  title, value, description, icon: Icon, trend, trendUp, onClick,
}: {
  title: string; value: string; description: string;
  icon: React.ElementType; trend?: string; trendUp?: boolean;
  onClick?: () => void;
}) {
  return (
    <Card
      className={onClick ? "cursor-pointer hover:bg-muted/30 transition-colors" : undefined}
      onClick={onClick}
    >
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="mt-2 text-3xl font-semibold tracking-tight">{value}</p>
            <div className="mt-2 flex items-center gap-2">
              {trend && (
                <span className={`flex items-center gap-0.5 text-xs font-medium ${trendUp ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                  {trendUp ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
                  {trend}
                </span>
              )}
              <span className="text-xs text-muted-foreground">{description}</span>
            </div>
          </div>
          <div className="rounded-lg border bg-muted/40 p-2">
            <Icon className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Dashboard Page ───────────────────────────────────────────────────────────
export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { deleteApi, updateApi } = useApi();
  
  const [stats, setStats] = useState<any>(null);
  const [healthList, setHealthList] = useState<any[]>([]);
  const [incidentMetrics, setIncidentMetrics] = useState({
    active: 0,
    critical: 0,
    affectedApis: 0,
  });
  const [loading, setLoading] = useState(true);
  
  const [envFilter, setEnvFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('name');

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const [statsRes, listRes, incidentsResult] = await Promise.all([
        fetch('/api/monitoring/dashboard/stats'),
        fetch(`/api/monitoring/health?environment=${envFilter}&status=${statusFilter}`),
        fetchIncidents({ environment: envFilter !== 'all' ? envFilter : undefined }).catch((err) => {
          console.warn('Failed to fetch incidents for dashboard KPIs:', err);
          return { incidents: [], total: 0 };
        }),
      ]);
      
      if (statsRes.ok && listRes.ok) {
        setStats(await statsRes.json());
        setHealthList(await listRes.json());
      }

      if (incidentsResult && Array.isArray(incidentsResult.incidents)) {
        const activeList = incidentsResult.incidents.filter(
          (i) => i.status === 'OPEN' || i.status === 'ACKNOWLEDGED'
        );
        const activeCount = activeList.length;
        const criticalCount = activeList.filter((i) => i.severity === 'CRITICAL').length;
        const uniqueApis = new Set(activeList.map((i) => i.apiId)).size;

        setIncidentMetrics({
          active: activeCount,
          critical: criticalCount,
          affectedApis: uniqueApis,
        });
      }
    } catch (err) {
      console.error('Failed to fetch dashboard data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 30000); // refresh every 30s
    return () => clearInterval(interval);
  }, [envFilter, statusFilter]);

  const sortedList = [...healthList].sort((a, b) => {
    if (sortBy === 'name') return a.name.localeCompare(b.name);
    if (sortBy === 'latency') return (b.avgResponseTime || 0) - (a.avgResponseTime || 0);
    if (sortBy === 'uptime') return (a.uptime || 0) - (b.uptime || 0);
    if (sortBy === 'errorRate') return (b.errorRate || 0) - (a.errorRate || 0);
    return 0;
  });

  const total = parseInt(stats?.total_apis || '0', 10);
  const healthy = parseInt(stats?.healthy_apis || '0', 10);
  const degraded = parseInt(stats?.degraded_apis || '0', 10);
  const down = parseInt(stats?.down_apis || '0', 10);
  const monitored = parseInt(stats?.monitored_apis || '0', 10);
  const overallAvailability = parseFloat(stats?.overall_availability || '100').toFixed(2);

  const healthPct = total === 0 ? 0 : Math.round((healthy / total) * 100);

  return (
    <div className="min-h-full bg-background p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-8">

        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-muted-foreground" />
              <h1 className="text-2xl font-semibold tracking-tight">API Health Dashboard</h1>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Organization-wide API monitoring and reliability metrics.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={fetchDashboardData} disabled={loading}>
              <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button size="sm" onClick={() => navigate('/monitoring/apis')}>
              <Plus className="mr-1.5 h-3.5 w-3.5" /> Register API
            </Button>
          </div>
        </div>

        {/* Metrics */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard title="Total APIs" value={String(total)} description={`${monitored} actively monitored`} icon={Server} />
          <MetricCard title="Healthy APIs" value={String(healthy)} description={`${healthPct}% of total`} icon={CheckCircle2} />
          <MetricCard title="Degraded / Down" value={`${degraded} / ${down}`} description="APIs needing attention" icon={AlertTriangle} />
          <MetricCard title="24h Availability" value={`${overallAvailability}%`} description="overall success rate" icon={TrendingUp} trendUp={parseFloat(overallAvailability) > 99} />
        </div>

        {/* Incident Overview */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold tracking-tight uppercase text-muted-foreground">
              Incident Overview
            </h2>
            <Button
              variant="ghost"
              size="xs"
              onClick={() => navigate('/insights/alerts')}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              View All Incidents →
            </Button>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <MetricCard
              title="Active Incidents"
              value={String(incidentMetrics.active)}
              description={incidentMetrics.active > 0 ? "Requiring triage or resolution" : "No open or acknowledged incidents"}
              icon={ShieldAlert}
              onClick={() => navigate('/insights/alerts')}
            />
            <MetricCard
              title="Critical Incidents"
              value={String(incidentMetrics.critical)}
              description={incidentMetrics.critical > 0 ? "High-priority severity alerts" : "No critical breaches"}
              icon={AlertOctagon}
              onClick={() => navigate('/insights/alerts')}
            />
            <MetricCard
              title="Affected APIs"
              value={String(incidentMetrics.affectedApis)}
              description={total > 0 ? `out of ${total} registered APIs` : "No APIs currently impacted"}
              icon={Layers}
              onClick={() => navigate('/insights/alerts')}
            />
          </div>
        </div>

        {/* API Status Table */}
        <Card className="overflow-hidden">
          <CardHeader>
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <CardTitle>API Status</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">Current status of all registered APIs</p>
              </div>
              <div className="flex items-center gap-2">
                <Select value={envFilter} onValueChange={(v) => v && setEnvFilter(v)}>
                  <SelectTrigger className="w-[140px] h-8 text-xs">
                    <SelectValue placeholder="Environment" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Environments</SelectItem>
                    <SelectItem value="production">Production</SelectItem>
                    <SelectItem value="staging">Staging</SelectItem>
                    <SelectItem value="development">Development</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={(v) => v && setStatusFilter(v)}>
                  <SelectTrigger className="w-[140px] h-8 text-xs">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="HEALTHY">Healthy</SelectItem>
                    <SelectItem value="DEGRADED">Degraded</SelectItem>
                    <SelectItem value="DOWN">Down</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={sortBy} onValueChange={(v) => v && setSortBy(v)}>
                  <SelectTrigger className="w-[150px] h-8 text-xs">
                    <SelectValue placeholder="Sort By" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="name">Sort by Name</SelectItem>
                    <SelectItem value="latency">Highest Latency</SelectItem>
                    <SelectItem value="uptime">Lowest Uptime</SelectItem>
                    <SelectItem value="errorRate">Highest Error Rate</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-6">API</TableHead>
                    <TableHead>Environment</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Uptime (24h)</TableHead>
                    <TableHead>Avg Latency</TableHead>
                    <TableHead>Error Rate</TableHead>
                    <TableHead>Monitoring</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedList.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center h-24 text-muted-foreground">
                        No APIs found matching filters.
                      </TableCell>
                    </TableRow>
                  ) : sortedList.map((api) => (
                    <TableRow
                      key={api.id}
                      className="cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => navigate(`/monitoring/apis/${api.id}`)}
                    >
                      <TableCell className="pl-6">
                        <div className="flex items-center gap-3">
                          <div className="rounded-md border bg-muted/40 p-2">
                            <Server className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <div>
                            <p className="font-medium text-sm">{api.name}</p>
                            <p className="text-xs text-muted-foreground">App ID: {api.application_id || 'Global'}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell><EnvBadge env={api.environment} /></TableCell>
                      <TableCell><StatusBadge status={api.healthStatus || 'HEALTHY'} /></TableCell>
                      <TableCell>
                        <span className={`font-mono text-xs ${parseFloat(api.uptime) < 99.0 ? 'text-red-500 font-semibold' : ''}`}>
                          {api.uptime}%
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="font-mono text-xs">
                          {api.avgResponseTime ? `${api.avgResponseTime}ms` : '-'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className={`font-mono text-xs ${parseFloat(api.errorRate) > 5.0 ? 'text-red-500 font-semibold' : ''}`}>
                          {api.errorRate}%
                        </span>
                      </TableCell>
                      <TableCell>
                        {api.monitoringEnabled ? (
                          <Badge variant="outline" className="border-emerald-500/30 text-emerald-500 bg-emerald-500/5 text-[10px]">Active</Badge>
                        ) : (
                          <Badge variant="outline" className="text-slate-400 bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-[10px]">Disabled</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

      </div>
    </div>
  );
};

export default DashboardPage;


import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApi } from '@/context/ApiContext';
import type { API } from '@/types/api';
import {
  Activity, AlertCircle, ArrowDownRight, ArrowUpRight,
  CheckCircle2, Clock3, ExternalLink, MoreVertical,
  Plus, RefreshCw, Server, TrendingUp, XCircle, Trash2,
} from 'lucide-react';
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
export function StatusBadge({ status }: { status: API['status'] }) {
  if (status === 'Active') {
    return (
      <Badge variant="outline" className="gap-1.5 border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
        <CheckCircle2 className="h-3 w-3" /> Healthy
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
    env === 'Production'
      ? 'border-violet-500/30 bg-violet-500/10 text-violet-600 dark:text-violet-400'
      : env === 'Staging'
      ? 'border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400'
      : 'border-slate-500/30 bg-slate-500/10 text-slate-600 dark:text-slate-400';
  return <Badge variant="outline" className={cls}>{env}</Badge>;
}

// ─── Metric Card ──────────────────────────────────────────────────────────────
function MetricCard({
  title, value, description, icon: Icon, trend, trendUp,
}: {
  title: string; value: string; description: string;
  icon: React.ElementType; trend?: string; trendUp?: boolean;
}) {
  return (
    <Card>
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

// ─── Health Row ───────────────────────────────────────────────────────────────
function HealthRow({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const pct = total === 0 ? 0 : Math.round((value / total) * 100);
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          <div className={`h-2 w-2 rounded-full ${color}`} />
          <span>{label}</span>
        </div>
        <span className="font-medium">{value}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// ─── Bar Chart ────────────────────────────────────────────────────────────────
const BAR_HEIGHTS = [38, 48, 42, 55, 47, 61, 52, 68, 58, 72, 64, 51, 56, 44, 49, 42, 53, 46, 39, 45];

// ─── Dashboard Page ───────────────────────────────────────────────────────────
export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { apis, deleteApi, updateApi, setSelectedApiId, isRefreshing, refreshApis } = useApi();
  const [envFilter, setEnvFilter] = useState('all');

  const filtered = envFilter === 'all' ? apis : apis.filter(a => a.environment === envFilter);
  const total = apis.length;
  const active = apis.filter(a => a.status === 'Active').length;
  const inactive = apis.filter(a => a.status === 'Inactive').length;
  const healthPct = total === 0 ? 0 : Math.round((active / total) * 100);

  const prodCount = apis.filter(a => a.environment === 'Production').length;
  const avgLatency = '184ms'; // mock

  const incidents = apis
    .filter(a => a.status === 'Inactive')
    .map(a => ({ api: a.name, message: 'Health check failed', env: a.environment, severity: 'Critical' as const, time: 'Just now' }));

  return (
    <div className="min-h-full bg-background p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-8">

        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-muted-foreground" />
              <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Monitor the health and reliability of your APIs.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={envFilter} onValueChange={(v) => v && setEnvFilter(v)}>
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Environments</SelectItem>
                <SelectItem value="Production">Production</SelectItem>
                <SelectItem value="Staging">Staging</SelectItem>
                <SelectItem value="Development">Development</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={refreshApis} disabled={isRefreshing}>
              <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button size="sm" onClick={() => navigate('/monitoring/apis')}>
              <Plus className="mr-1.5 h-3.5 w-3.5" /> Register API
            </Button>
          </div>
        </div>

        {/* Metrics */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard title="Total APIs" value={String(total)} description="registered endpoints" icon={Server} trend="+2" trendUp />
          <MetricCard title="Healthy APIs" value={String(active)} description={`${healthPct}% of total`} icon={CheckCircle2} trend="+4.2%" trendUp />
          <MetricCard title="Production APIs" value={String(prodCount)} description="in production" icon={TrendingUp} />
          <MetricCard title="Avg Latency" value={avgLatency} description="vs previous period" icon={Clock3} trend="-8ms" trendUp />
        </div>

        {/* Health + Response Time */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Health Ring */}
          <Card className="lg:col-span-1">
            <CardHeader><CardTitle>API Health</CardTitle></CardHeader>
            <CardContent>
              <div className="flex items-center justify-center py-6">
                <div className="relative flex h-44 w-44 items-center justify-center rounded-full border-[18px] border-emerald-500/20">
                  <div className="absolute inset-[-18px] rounded-full border-[18px] border-transparent border-t-emerald-500 border-r-emerald-500" />
                  <div className="text-center">
                    <p className="text-4xl font-semibold">{healthPct}%</p>
                    <p className="text-sm text-muted-foreground">Healthy</p>
                  </div>
                </div>
              </div>
              <div className="space-y-4">
                <HealthRow label="Healthy" value={active} total={total} color="bg-emerald-500" />
                <HealthRow label="Down" value={inactive} total={total} color="bg-red-500" />
              </div>
            </CardContent>
          </Card>

          {/* Bar Chart */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Response Time</CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">Average API latency over time</p>
                </div>
                <Badge variant="secondary">
                  <TrendingUp className="mr-1 h-3 w-3" /> 184ms avg
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex h-[220px] items-end gap-1.5 border-b border-l px-2 pb-0 pt-4">
                {BAR_HEIGHTS.map((h, i) => (
                  <div key={i} className="group relative flex flex-1 items-end">
                    <div
                      className="w-full rounded-t-sm bg-primary/60 transition-colors group-hover:bg-primary"
                      style={{ height: `${h}%` }}
                    />
                  </div>
                ))}
              </div>
              <div className="mt-3 flex justify-between text-xs text-muted-foreground">
                <span>12:00 PM</span><span>6:00 PM</span><span>12:00 AM</span><span>6:00 AM</span><span>Now</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* API Status Table */}
        <Card className="overflow-hidden">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>API Status</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">Current status of all monitored APIs</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => navigate('/monitoring/apis')}>View all APIs</Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-6">API</TableHead>
                    <TableHead>Environment</TableHead>
                    <TableHead>Group</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Version</TableHead>
                    <TableHead className="text-right pr-6">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((api) => (
                    <TableRow
                      key={api.id}
                      className="cursor-pointer"
                      onClick={() => setSelectedApiId(api.id)}
                    >
                      <TableCell className="pl-6">
                        <div className="flex items-center gap-3">
                          <div className="rounded-md border bg-muted/40 p-2">
                            <Server className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <div>
                            <p className="font-medium">{api.name}</p>
                            <p className="text-xs text-muted-foreground line-clamp-1 max-w-[220px]">{api.description || api.baseUrl}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell><EnvBadge env={api.environment} /></TableCell>
                      <TableCell><span className="text-sm text-muted-foreground">{api.group}</span></TableCell>
                      <TableCell><StatusBadge status={api.status} /></TableCell>
                      <TableCell><span className="font-mono text-xs">{api.version}</span></TableCell>
                      <TableCell className="text-right pr-6" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors cursor-pointer"
                          >
                            <MoreVertical className="h-3.5 w-3.5" />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setSelectedApiId(api.id)}>
                              <ExternalLink className="mr-2 h-3.5 w-3.5" /> View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => updateApi(api.id, { status: api.status === 'Active' ? 'Inactive' : 'Active' })}>
                              <RefreshCw className="mr-2 h-3.5 w-3.5" /> Toggle Status
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-red-600 focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-950/20"
                              onClick={() => { if (confirm(`Delete ${api.name}?`)) deleteApi(api.id); }}
                            >
                              <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Bottom: Incidents + Summary */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Incidents */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Recent Incidents</CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">Latest API reliability events</p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {incidents.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 gap-2 text-center">
                  <div className="rounded-full bg-emerald-500/10 p-3">
                    <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  </div>
                  <p className="text-sm font-medium">All systems operational</p>
                  <p className="text-xs text-muted-foreground">No active incidents detected.</p>
                </div>
              ) : (
                <div className="space-y-5">
                  {incidents.map((inc, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <div className="mt-0.5 rounded-full bg-red-500/10 p-1.5 text-red-600 dark:text-red-400">
                        <XCircle className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-medium">{inc.api}</p>
                          <span className="text-xs text-muted-foreground">{inc.time}</span>
                        </div>
                        <p className="mt-0.5 text-sm text-muted-foreground">{inc.message}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">{inc.env}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Monitoring Summary</CardTitle>
              <p className="text-sm text-muted-foreground">Current monitoring activity</p>
            </CardHeader>
            <CardContent>
              <div className="space-y-5">
                {[
                  { label: 'Registered APIs', value: String(total) },
                  { label: 'Active monitors', value: String(apis.filter(a => a.healthEnabled).length) },
                  { label: 'Production endpoints', value: String(prodCount) },
                  { label: 'APIs healthy', value: `${active} / ${total}` },
                  { label: 'Active incidents', value: String(inactive) },
                ].map(r => (
                  <div key={r.label} className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">{r.label}</span>
                    <span className="font-mono text-sm font-medium">{r.value}</span>
                  </div>
                ))}
                <div className="rounded-lg border bg-muted/30 p-4">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
                    <p className="text-sm font-medium">Monitoring system operational</p>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">Last check completed a few seconds ago.</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

      </div>
    </div>
  );
};

export default DashboardPage;

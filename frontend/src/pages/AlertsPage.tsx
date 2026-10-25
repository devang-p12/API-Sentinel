import { useState, useEffect, useCallback } from 'react';
import {
  api,
  type AlertRule,
  type AlertInstance,
  type AlertSummary,
  type AlertState,
  type AlertSeverity,
  type Api,
  type Environment,
} from '@/lib/api';
import { PageContainer } from '@/components/layout/PageContainer';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { CreateAlertRuleSheet } from '@/components/alerts/CreateAlertRuleSheet';
import { AlertDetailSheet } from '@/components/alerts/AlertDetailSheet';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  Alert01Icon,
  AlertCircleIcon,
  Add01Icon,
  ArrowReloadHorizontalIcon,
  Search01Icon,
  PlayIcon,
  Edit01Icon,
  Delete02Icon,
  FireIcon,
  Time02Icon,
  CheckmarkCircle02Icon,
} from '@hugeicons/core-free-icons';

export function AlertsPage() {
  const [activeTab, setActiveTab] = useState<'instances' | 'rules'>('instances');

  // Summary counts
  const [summary, setSummary] = useState<AlertSummary>({
    firing: 0,
    pending: 0,
    resolved: 0,
    total: 0,
  });

  // Instances & Rules
  const [instances, setInstances] = useState<AlertInstance[]>([]);
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [apis, setApis] = useState<Api[]>([]);
  const [environments, setEnvironments] = useState<Environment[]>([]);

  // Filters for Instances & Rules
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [severityFilter, setSeverityFilter] = useState<string>('ALL');
  const [apiFilter, setApiFilter] = useState<string>('ALL');
  const [environmentFilter, setEnvironmentFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Loading states
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // Sheets state
  const [createSheetOpen, setCreateSheetOpen] = useState<boolean>(false);
  const [editingRule, setEditingRule] = useState<AlertRule | null>(null);
  const [selectedInstance, setSelectedInstance] = useState<AlertInstance | null>(null);
  const [detailSheetOpen, setDetailSheetOpen] = useState<boolean>(false);

  // Quick Test modal state
  const [testingRuleId, setTestingRuleId] = useState<string | null>(null);
  const [testModalData, setTestModalData] = useState<{
    ruleName: string;
    metric: string;
    currentValue: number | null;
    condition: string;
    threshold: number;
    conditionMet: boolean;
    wouldTransitionTo: string;
  } | null>(null);

  // Fetch all data
  const loadData = useCallback(async (showRefreshing = false) => {
    if (showRefreshing) setIsRefreshing(true);
    else setIsLoading(true);

    try {
      const [sum, instRes, rulesList, apisList, envsList] = await Promise.all([
        api.getAlertSummary().catch(() => ({ firing: 0, pending: 0, resolved: 0, total: 0 })),
        api.getAlerts({ limit: 100 }).catch(() => ({ items: [], total: 0, limit: 100, offset: 0 })),
        api.getAlertRules().catch(() => []),
        api.getApis().catch(() => []),
        api.getEnvironments().catch(() => []),
      ]);

      setSummary(sum);
      setInstances(instRes.items || []);
      setRules(rulesList || []);
      setApis(apisList || []);
      setEnvironments(envsList || []);
    } catch (err) {
      console.error('Failed to load alert engine data:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    // Auto refresh every 15s to keep alert states live
    const interval = setInterval(() => {
      loadData(true);
    }, 15000);
    return () => clearInterval(interval);
  }, [loadData]);

  // Handle rule enable/disable toggle
  const handleToggleRuleEnabled = async (rule: AlertRule) => {
    try {
      if (rule.enabled) {
        await api.disableAlertRule(rule.id);
      } else {
        await api.enableAlertRule(rule.id);
      }
      await loadData(true);
    } catch (err) {
      console.error('Failed to toggle rule enabled:', err);
    }
  };

  // Handle delete rule
  const handleDeleteRule = async (ruleId: string) => {
    if (!window.confirm('Are you sure you want to delete this alert rule?')) return;
    try {
      await api.deleteAlertRule(ruleId);
      await loadData(true);
    } catch (err) {
      console.error('Failed to delete alert rule:', err);
    }
  };

  // Handle test rule
  const handleTestRule = async (rule: AlertRule) => {
    setTestingRuleId(rule.id);
    try {
      const result = await api.testAlertRule(rule.id);
      setTestModalData({
        ruleName: rule.name,
        ...result,
      });
    } catch (err) {
      console.error('Failed to test alert rule:', err);
    } finally {
      setTestingRuleId(null);
    }
  };

  // Filter instances
  const filteredInstances = instances.filter((inst) => {
    if (statusFilter !== 'ALL' && inst.status !== statusFilter) return false;
    if (severityFilter !== 'ALL' && inst.alertRule?.severity !== severityFilter) return false;
    if (apiFilter !== 'ALL' && inst.alertRule?.apiId !== apiFilter) return false;
    if (environmentFilter !== 'ALL' && inst.alertRule?.environmentId !== environmentFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = inst.alertRule?.name?.toLowerCase().includes(q);
      const matchApi = inst.alertRule?.api?.name?.toLowerCase().includes(q);
      const matchMetric = inst.alertRule?.metric?.toLowerCase().includes(q);
      const matchFp = inst.fingerprint.toLowerCase().includes(q);
      if (!matchName && !matchApi && !matchMetric && !matchFp) return false;
    }
    return true;
  });

  // Filter rules
  const filteredRules = rules.filter((rule) => {
    if (apiFilter !== 'ALL' && rule.apiId !== apiFilter) return false;
    if (environmentFilter !== 'ALL' && rule.environmentId !== environmentFilter) return false;
    if (severityFilter !== 'ALL' && rule.severity !== severityFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = rule.name.toLowerCase().includes(q);
      const matchMetric = rule.metric.toLowerCase().includes(q);
      const matchApi = rule.api?.name?.toLowerCase().includes(q);
      if (!matchName && !matchMetric && !matchApi) return false;
    }
    return true;
  });

  const getStatusBadge = (status: AlertState) => {
    switch (status) {
      case 'FIRING':
        return (
          <Badge className="bg-destructive/20 text-destructive border-destructive/30 font-mono text-xs gap-1.5 font-bold">
            <span className="size-2 rounded-full bg-destructive animate-ping" />
            🔥 FIRING
          </Badge>
        );
      case 'PENDING':
        return (
          <Badge className="bg-amber-500/20 text-amber-500 border-amber-500/30 font-mono text-xs gap-1.5 font-bold">
            <span className="size-2 rounded-full bg-amber-500 animate-pulse" />
            ⏳ PENDING
          </Badge>
        );
      case 'RESOLVED':
        return (
          <Badge className="bg-emerald-500/20 text-emerald-500 border-emerald-500/30 font-mono text-xs gap-1 font-semibold">
            ✓ RESOLVED
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="font-mono text-xs">
            {status}
          </Badge>
        );
    }
  };

  const getSeverityBadge = (sev: AlertSeverity) => {
    switch (sev) {
      case 'CRITICAL':
        return <Badge className="bg-destructive text-destructive-foreground font-mono text-[10px]">CRITICAL</Badge>;
      case 'HIGH':
        return <Badge className="bg-orange-500 text-white font-mono text-[10px]">HIGH</Badge>;
      case 'WARNING':
        return <Badge className="bg-amber-500 text-black font-mono text-[10px]">WARNING</Badge>;
      default:
        return <Badge variant="outline" className="font-mono text-[10px]">INFO</Badge>;
    }
  };

  const formatDuration = (inst: AlertInstance) => {
    const start = inst.startedAt ? new Date(inst.startedAt).getTime() : inst.pendingSince ? new Date(inst.pendingSince).getTime() : new Date(inst.createdAt).getTime();
    const end = inst.resolvedAt ? new Date(inst.resolvedAt).getTime() : Date.now();
    const diffSec = Math.max(0, Math.floor((end - start) / 1000));
    const m = Math.floor(diffSec / 60);
    const s = diffSec % 60;
    if (m === 0) return `${s}s`;
    return `${m}m ${s}s`;
  };

  return (
    <PageContainer
      title="Alerts & Health Engine"
      description="Continuous metric threshold evaluation, deterministic deduplication, and pending duration state machine."
      breadcrumbs={[{ label: "Sentinel", href: "/dashboard" }, { label: "Alerts" }]}
      action={
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadData(true)}
            disabled={isRefreshing}
            className="gap-1.5 font-mono text-xs h-8"
          >
            <HugeiconsIcon
              icon={ArrowReloadHorizontalIcon}
              className={`size-3.5 ${isRefreshing ? 'animate-spin' : ''}`}
            />
            <span>Refresh</span>
          </Button>

          <Button
            size="sm"
            onClick={() => {
              setEditingRule(null);
              setCreateSheetOpen(true);
            }}
            className="gap-1.5 h-8"
          >
            <HugeiconsIcon icon={Add01Icon} className="size-4" />
            <span>New Alert Rule</span>
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Section 28: Real Alert Status Summary Bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card
            onClick={() => {
              setActiveTab('instances');
              setStatusFilter('FIRING');
            }}
            className={`rounded-none border cursor-pointer transition-all ${
              statusFilter === 'FIRING' && activeTab === 'instances'
                ? 'border-destructive ring-1 ring-destructive/50 bg-destructive/10'
                : 'border-border bg-card hover:bg-muted/40'
            }`}
          >
            <CardContent className="p-3.5 flex items-center justify-between">
              <div>
                <span className="text-xs text-muted-foreground block font-medium">Firing Alerts</span>
                <span className="text-xl font-bold font-mono text-destructive flex items-center gap-1.5 mt-0.5">
                  🔥 {summary.firing}
                </span>
              </div>
              <div className="size-8 rounded bg-destructive/15 text-destructive flex items-center justify-center">
                <HugeiconsIcon icon={FireIcon} className="size-4" />
              </div>
            </CardContent>
          </Card>

          <Card
            onClick={() => {
              setActiveTab('instances');
              setStatusFilter('PENDING');
            }}
            className={`rounded-none border cursor-pointer transition-all ${
              statusFilter === 'PENDING' && activeTab === 'instances'
                ? 'border-amber-500 ring-1 ring-amber-500/50 bg-amber-500/10'
                : 'border-border bg-card hover:bg-muted/40'
            }`}
          >
            <CardContent className="p-3.5 flex items-center justify-between">
              <div>
                <span className="text-xs text-muted-foreground block font-medium">Pending Alerts</span>
                <span className="text-xl font-bold font-mono text-amber-500 flex items-center gap-1.5 mt-0.5">
                  ⏳ {summary.pending}
                </span>
              </div>
              <div className="size-8 rounded bg-amber-500/15 text-amber-500 flex items-center justify-center">
                <HugeiconsIcon icon={Time02Icon} className="size-4" />
              </div>
            </CardContent>
          </Card>

          <Card
            onClick={() => {
              setActiveTab('instances');
              setStatusFilter('RESOLVED');
            }}
            className={`rounded-none border cursor-pointer transition-all ${
              statusFilter === 'RESOLVED' && activeTab === 'instances'
                ? 'border-emerald-500 ring-1 ring-emerald-500/50 bg-emerald-500/10'
                : 'border-border bg-card hover:bg-muted/40'
            }`}
          >
            <CardContent className="p-3.5 flex items-center justify-between">
              <div>
                <span className="text-xs text-muted-foreground block font-medium">Resolved Alerts</span>
                <span className="text-xl font-bold font-mono text-emerald-500 flex items-center gap-1.5 mt-0.5">
                  ✓ {summary.resolved}
                </span>
              </div>
              <div className="size-8 rounded bg-emerald-500/15 text-emerald-500 flex items-center justify-center">
                <HugeiconsIcon icon={CheckmarkCircle02Icon} className="size-4" />
              </div>
            </CardContent>
          </Card>

          <Card
            onClick={() => setActiveTab('rules')}
            className={`rounded-none border cursor-pointer transition-all ${
              activeTab === 'rules'
                ? 'border-primary ring-1 ring-primary/50 bg-primary/10'
                : 'border-border bg-card hover:bg-muted/40'
            }`}
          >
            <CardContent className="p-3.5 flex items-center justify-between">
              <div>
                <span className="text-xs text-muted-foreground block font-medium">Active Alert Rules</span>
                <span className="text-xl font-bold font-mono text-primary flex items-center gap-1.5 mt-0.5">
                  ⚡ {rules.filter((r) => r.enabled).length} / {rules.length}
                </span>
              </div>
              <div className="size-8 rounded bg-primary/15 text-primary flex items-center justify-center">
                <HugeiconsIcon icon={AlertCircleIcon} className="size-4" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tab Selection & Search Filters */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-b border-border pb-3">
          {/* Tabs */}
          <div className="flex items-center gap-1 bg-muted/40 p-1 rounded-none border border-border">
            <button
              type="button"
              onClick={() => setActiveTab('instances')}
              className={`px-3 py-1.5 text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                activeTab === 'instances'
                  ? 'bg-card text-foreground shadow-xs font-bold border border-border/80'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <HugeiconsIcon icon={Alert01Icon} className="size-3.5 text-primary" />
              <span>Alert Instances</span>
              <Badge variant="outline" className="text-[10px] ml-1 font-mono">
                {instances.length}
              </Badge>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('rules')}
              className={`px-3 py-1.5 text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                activeTab === 'rules'
                  ? 'bg-card text-foreground shadow-xs font-bold border border-border/80'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <HugeiconsIcon icon={AlertCircleIcon} className="size-3.5 text-primary" />
              <span>Alert Rules</span>
              <Badge variant="outline" className="text-[10px] ml-1 font-mono">
                {rules.length}
              </Badge>
            </button>
          </div>

          {/* Search & Select Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-48 sm:w-60">
              <HugeiconsIcon
                icon={Search01Icon}
                className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                placeholder="Search alerts, rules..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 text-xs h-8"
              />
            </div>

            {activeTab === 'instances' && (
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="h-8 px-2 bg-background border border-border text-foreground text-xs rounded-none font-mono"
              >
                <option value="ALL">All States</option>
                <option value="FIRING">🔥 Firing</option>
                <option value="PENDING">⏳ Pending</option>
                <option value="RESOLVED">✓ Resolved</option>
              </select>
            )}

            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="h-8 px-2 bg-background border border-border text-foreground text-xs rounded-none font-mono"
            >
              <option value="ALL">All Severities</option>
              <option value="CRITICAL">Critical</option>
              <option value="HIGH">High</option>
              <option value="WARNING">Warning</option>
              <option value="INFO">Info</option>
            </select>

            <select
              value={apiFilter}
              onChange={(e) => setApiFilter(e.target.value)}
              className="h-8 px-2 bg-background border border-border text-foreground text-xs rounded-none font-mono"
            >
              <option value="ALL">All APIs</option>
              {apis.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>

            <select
              value={environmentFilter}
              onChange={(e) => setEnvironmentFilter(e.target.value)}
              className="h-8 px-2 bg-background border border-border text-foreground text-xs rounded-none font-mono"
            >
              <option value="ALL">All Envs</option>
              {environments.map((env) => (
                <option key={env.id} value={env.id}>
                  {env.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* TAB 1: Alert Instances Table */}
        {activeTab === 'instances' && (
          <div className="border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 font-mono text-[11px]">
                  <TableHead className="w-32">Status</TableHead>
                  <TableHead className="w-24">Severity</TableHead>
                  <TableHead>Alert Rule</TableHead>
                  <TableHead>Target Scope</TableHead>
                  <TableHead>Value / Threshold</TableHead>
                  <TableHead>Duration / Started</TableHead>
                  <TableHead className="text-right w-24">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-xs text-muted-foreground py-16">
                      <div className="flex flex-col items-center justify-center space-y-2">
                        <HugeiconsIcon icon={ArrowReloadHorizontalIcon} className="size-6 animate-spin text-muted-foreground" />
                        <span>Evaluating alert rules against live telemetry...</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : filteredInstances.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-xs text-muted-foreground py-16">
                      {instances.length === 0 ? (
                        <div className="flex flex-col items-center justify-center space-y-2">
                          <HugeiconsIcon icon={CheckmarkCircle02Icon} className="size-8 text-emerald-500/80" />
                          <span className="font-semibold text-foreground text-sm">All Services Healthy</span>
                          <span className="text-muted-foreground text-xs max-w-sm">
                            No active alerts are currently firing or pending. Alerts will appear here when conditions violate configured rules.
                          </span>
                        </div>
                      ) : (
                        <span>No alerts match the selected filters.</span>
                      )}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredInstances.map((inst) => (
                    <TableRow
                      key={inst.id}
                      onClick={() => {
                        setSelectedInstance(inst);
                        setDetailSheetOpen(true);
                      }}
                      className="cursor-pointer hover:bg-muted/30 transition-colors text-xs"
                    >
                      <TableCell className="py-2.5 font-medium">
                        {getStatusBadge(inst.status)}
                      </TableCell>
                      <TableCell className="py-2.5">
                        {inst.alertRule?.severity && getSeverityBadge(inst.alertRule.severity)}
                      </TableCell>
                      <TableCell className="py-2.5">
                        <div className="font-semibold text-foreground">
                          {inst.alertRule?.name || 'Alert Rule'}
                        </div>
                        <div className="text-[10px] text-muted-foreground font-mono">
                          {inst.alertRule?.metric}
                        </div>
                      </TableCell>
                      <TableCell className="py-2.5 font-mono text-[11px]">
                        <span className="text-foreground font-medium">
                          {inst.alertRule?.api?.name || 'All APIs'}
                        </span>
                        {inst.alertRule?.environment && (
                          <span className="text-muted-foreground block text-[10px]">
                            {inst.alertRule.environment.name}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="py-2.5 font-mono text-[11px]">
                        <div className="font-bold text-foreground">
                          {inst.currentValue !== null ? inst.currentValue : 'No Data'}
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          Threshold: {inst.threshold}
                        </div>
                      </TableCell>
                      <TableCell className="py-2.5 font-mono text-[11px]">
                        <div className="font-medium text-foreground">
                          {formatDuration(inst)}
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          {new Date(inst.startedAt || inst.pendingSince || inst.createdAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                          })}
                        </div>
                      </TableCell>
                      <TableCell className="py-2.5 text-right" onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="outline"
                          size="xs"
                          onClick={() => {
                            setSelectedInstance(inst);
                            setDetailSheetOpen(true);
                          }}
                          className="h-7 text-xs font-mono"
                        >
                          Inspect
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}

        {/* TAB 2: Alert Rules Table */}
        {activeTab === 'rules' && (
          <div className="border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 font-mono text-[11px]">
                  <TableHead className="w-20">State</TableHead>
                  <TableHead>Rule Name</TableHead>
                  <TableHead>Metric Condition</TableHead>
                  <TableHead>Timing (FOR / Interval)</TableHead>
                  <TableHead className="w-24">Severity</TableHead>
                  <TableHead>Scope</TableHead>
                  <TableHead className="text-right w-40">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRules.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-xs text-muted-foreground py-16">
                      <div className="flex flex-col items-center justify-center space-y-2">
                        <HugeiconsIcon icon={AlertCircleIcon} className="size-8 text-muted-foreground" />
                        <span className="font-semibold text-foreground text-sm">No Alert Rules Configured</span>
                        <span className="text-muted-foreground text-xs max-w-sm">
                          Create your first alert rule to start continuously monitoring metric thresholds across environments.
                        </span>
                        <Button
                          size="sm"
                          onClick={() => {
                            setEditingRule(null);
                            setCreateSheetOpen(true);
                          }}
                          className="mt-2"
                        >
                          + Create Rule
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredRules.map((rule) => (
                    <TableRow key={rule.id} className="hover:bg-muted/20 text-xs">
                      <TableCell className="py-2.5">
                        <button
                          type="button"
                          onClick={() => handleToggleRuleEnabled(rule)}
                          className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold transition-colors ${
                            rule.enabled
                              ? 'bg-emerald-500/15 text-emerald-500 hover:bg-emerald-500/25 border border-emerald-500/30'
                              : 'bg-muted text-muted-foreground hover:bg-muted/80 border border-border'
                          }`}
                          title={rule.enabled ? 'Click to disable evaluation' : 'Click to enable evaluation'}
                        >
                          {rule.enabled ? 'ACTIVE' : 'PAUSED'}
                        </button>
                      </TableCell>
                      <TableCell className="py-2.5">
                        <div className="font-semibold text-foreground">{rule.name}</div>
                        {rule.description && (
                          <div className="text-[10px] text-muted-foreground truncate max-w-xs">
                            {rule.description}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="py-2.5 font-mono text-[11px]">
                        <span className="font-semibold text-foreground">{rule.metric}</span>
                        <span className="text-muted-foreground ml-1">
                          {rule.condition === 'GREATER_THAN' && '>'}
                          {rule.condition === 'GREATER_THAN_OR_EQUAL' && '>='}
                          {rule.condition === 'LESS_THAN' && '<'}
                          {rule.condition === 'LESS_THAN_OR_EQUAL' && '<='}
                          {rule.condition === 'EQUAL' && '=='}
                          {rule.condition === 'NOT_EQUAL' && '!='}{' '}
                          {rule.threshold}
                        </span>
                      </TableCell>
                      <TableCell className="py-2.5 font-mono text-[10px] text-muted-foreground">
                        <div>FOR {rule.duration}s</div>
                        <div>Every {rule.evaluationInterval}s</div>
                      </TableCell>
                      <TableCell className="py-2.5">
                        {getSeverityBadge(rule.severity)}
                      </TableCell>
                      <TableCell className="py-2.5 font-mono text-[11px]">
                        <div className="text-foreground">{rule.api?.name || 'All APIs'}</div>
                        <div className="text-[10px] text-muted-foreground">
                          {rule.environment?.name || 'All Envs'}
                        </div>
                      </TableCell>
                      <TableCell className="py-2.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="xs"
                            disabled={testingRuleId === rule.id}
                            onClick={() => handleTestRule(rule)}
                            className="size-7 p-0 text-muted-foreground hover:text-primary"
                            title="Test Rule live against current metrics"
                          >
                            <HugeiconsIcon icon={PlayIcon} className="size-3.5" />
                          </Button>

                          <Button
                            variant="ghost"
                            size="xs"
                            onClick={() => {
                              setEditingRule(rule);
                              setCreateSheetOpen(true);
                            }}
                            className="size-7 p-0 text-muted-foreground hover:text-foreground"
                            title="Edit Alert Rule"
                          >
                            <HugeiconsIcon icon={Edit01Icon} className="size-3.5" />
                          </Button>

                          <Button
                            variant="ghost"
                            size="xs"
                            onClick={() => handleDeleteRule(rule.id)}
                            className="size-7 p-0 text-muted-foreground hover:text-destructive"
                            title="Delete Alert Rule"
                          >
                            <HugeiconsIcon icon={Delete02Icon} className="size-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Slide-out Sheets */}
      <CreateAlertRuleSheet
        open={createSheetOpen}
        onOpenChange={setCreateSheetOpen}
        initialData={editingRule}
        onSuccess={() => loadData(true)}
      />

      <AlertDetailSheet
        open={detailSheetOpen}
        onOpenChange={setDetailSheetOpen}
        alert={selectedInstance}
      />

      {/* Dry Run Test Result Modal */}
      {testModalData && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-card border border-border p-5 rounded-none max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-2">
              <span className="font-semibold text-sm text-foreground">Rule Test Result</span>
              <button
                type="button"
                onClick={() => setTestModalData(null)}
                className="text-muted-foreground hover:text-foreground text-xs"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2 text-xs font-mono">
              <div className="text-foreground font-semibold">{testModalData.ruleName}</div>
              <div className="p-3 bg-muted/40 rounded border border-border space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Metric:</span>
                  <span className="font-bold text-foreground">{testModalData.metric}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Current Live Value:</span>
                  <span className="font-bold text-foreground">
                    {testModalData.currentValue !== null ? testModalData.currentValue : 'No Data'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Threshold:</span>
                  <span className="font-bold text-foreground">{testModalData.threshold}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Condition Met:</span>
                  <Badge
                    variant={testModalData.conditionMet ? 'destructive' : 'outline'}
                    className="text-[10px] font-mono"
                  >
                    {testModalData.conditionMet ? 'VIOLATION (True)' : 'NORMAL (False)'}
                  </Badge>
                </div>
                <div className="flex items-center justify-between pt-1 border-t border-border">
                  <span className="text-muted-foreground">Would Transition To:</span>
                  <Badge variant="outline" className="text-[10px] font-mono">
                    {testModalData.wouldTransitionTo}
                  </Badge>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button size="sm" onClick={() => setTestModalData(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </PageContainer>
  );
}

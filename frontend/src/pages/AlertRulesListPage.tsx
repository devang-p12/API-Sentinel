import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  api,
  type AlertRule,
  type AlertSeverity,
  type Project,
  type Environment,
  type MetricDefinition,
} from '@/lib/api';
import { PageContainer } from '@/components/layout/PageContainer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  Add01Icon,
  Search01Icon,
  ArrowReloadHorizontalIcon,
  PlayIcon,
  Edit01Icon,
  Delete02Icon,
  ViewIcon,
} from '@hugeicons/core-free-icons';

export function AlertRulesListPage() {
  const navigate = useNavigate();

  const [rules, setRules] = useState<AlertRule[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [environments, setEnvironments] = useState<Environment[]>([]);
  const [metrics, setMetrics] = useState<MetricDefinition[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ENABLED' | 'DISABLED'>('ALL');
  const [severityFilter, setSeverityFilter] = useState<string>('ALL');
  const [projectFilter, setProjectFilter] = useState<string>('ALL');
  const [environmentFilter, setEnvironmentFilter] = useState<string>('ALL');
  const [metricFilter, setMetricFilter] = useState<string>('ALL');

  // Delete modal state
  const [ruleToDelete, setRuleToDelete] = useState<AlertRule | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Test rule feedback state
  const [testingRuleId, setTestingRuleId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{
    ruleId: string;
    metric: string;
    currentValue: number | null;
    conditionMet: boolean;
    threshold: number;
    wouldTransitionTo: string;
  } | null>(null);

  const loadData = useCallback(async (isSilent = false) => {
    if (!isSilent) setIsLoading(true);
    else setIsRefreshing(true);

    try {
      const [rulesData, projectsData, envsData, metricsData] = await Promise.all([
        api.getAlertRules(),
        api.getProjects().catch(() => []),
        api.getEnvironments().catch(() => []),
        api.getMetricCatalog().catch(() => []),
      ]);
      setRules(rulesData || []);
      setProjects(projectsData || []);
      setEnvironments(envsData || []);
      setMetrics(metricsData || []);
    } catch (err) {
      console.error('Failed to load alert rules:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Derived filtered rules
  const filteredRules = useMemo(() => {
    return rules.filter((rule) => {
      // Search query (name or description)
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesName = rule.name.toLowerCase().includes(query);
        const matchesDesc = (rule.description || '').toLowerCase().includes(query);
        const matchesMetric = rule.metric.toLowerCase().includes(query);
        if (!matchesName && !matchesDesc && !matchesMetric) return false;
      }

      // Status
      if (statusFilter === 'ENABLED' && !rule.enabled) return false;
      if (statusFilter === 'DISABLED' && rule.enabled) return false;

      // Severity
      if (severityFilter !== 'ALL' && rule.severity !== severityFilter) return false;

      // Project
      if (projectFilter !== 'ALL' && rule.projectId !== projectFilter) return false;

      // Environment
      if (environmentFilter !== 'ALL' && rule.environmentId !== environmentFilter) return false;

      // Metric
      if (metricFilter !== 'ALL' && rule.metric !== metricFilter) return false;

      return true;
    });
  }, [rules, searchQuery, statusFilter, severityFilter, projectFilter, environmentFilter, metricFilter]);

  // Status counters
  const counts = useMemo(() => {
    let firing = 0;
    let pending = 0;
    let normal = 0;
    let disabled = 0;

    rules.forEach((r) => {
      if (!r.enabled) {
        disabled++;
        return;
      }
      const instance = r.instances?.[0];
      if (instance?.status === 'FIRING') firing++;
      else if (instance?.status === 'PENDING') pending++;
      else normal++;
    });

    return {
      total: rules.length,
      firing,
      pending,
      normal,
      disabled,
    };
  }, [rules]);

  // Toggle rule enable/disable
  const handleToggleEnable = async (rule: AlertRule) => {
    try {
      if (rule.enabled) {
        await api.disableAlertRule(rule.id);
      } else {
        await api.enableAlertRule(rule.id);
      }
      setRules((prev) =>
        prev.map((r) => (r.id === rule.id ? { ...r, enabled: !rule.enabled } : r))
      );
    } catch (err) {
      console.error('Failed to toggle rule enabled status:', err);
    }
  };

  // Test rule handler
  const handleTestRule = async (ruleId: string) => {
    setTestingRuleId(ruleId);
    setTestResult(null);
    try {
      const res = await api.testAlertRule(ruleId);
      setTestResult({
        ruleId,
        metric: res.metric,
        currentValue: res.currentValue,
        conditionMet: res.conditionMet,
        threshold: res.threshold,
        wouldTransitionTo: res.wouldTransitionTo,
      });
      // Auto dismiss result after 6s
      setTimeout(() => {
        setTestResult((prev) => (prev?.ruleId === ruleId ? null : prev));
      }, 6000);
    } catch (err: any) {
      console.error('Failed to test alert rule:', err);
    } finally {
      setTestingRuleId(null);
    }
  };

  // Confirm delete handler
  const handleDeleteConfirm = async () => {
    if (!ruleToDelete) return;
    setIsDeleting(true);
    try {
      await api.deleteAlertRule(ruleToDelete.id);
      setRules((prev) => prev.filter((r) => r.id !== ruleToDelete.id));
      setRuleToDelete(null);
    } catch (err) {
      console.error('Failed to delete alert rule:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  // Format condition display (e.g. "> 1000 ms for 2 minutes")
  const formatCondition = (rule: AlertRule) => {
    const opMap: Record<string, string> = {
      GREATER_THAN: '>',
      GREATER_THAN_OR_EQUAL: '>=',
      LESS_THAN: '<',
      LESS_THAN_OR_EQUAL: '<=',
      EQUAL: '=',
      NOT_EQUAL: '!=',
    };
    const op = opMap[rule.condition] || rule.condition;
    const metricDef = metrics.find((m) => m.id === rule.metric);
    const unit = metricDef?.unit || '';

    let durationText = '';
    if (rule.duration && rule.duration > 0) {
      const mins = Math.floor(rule.duration / 60);
      const secs = rule.duration % 60;
      if (mins > 0 && secs === 0) {
        durationText = ` for ${mins} minute${mins > 1 ? 's' : ''}`;
      } else if (mins > 0) {
        durationText = ` for ${mins}m ${secs}s`;
      } else {
        durationText = ` for ${secs}s`;
      }
    }

    return `${op} ${rule.threshold} ${unit}${durationText}`;
  };

  // Format scope display (e.g. "Payments / Production" or "All APIs / Production")
  const formatScope = (rule: AlertRule) => {
    const apiPart = rule.api?.name || (rule.apiId ? 'Specific API' : 'All APIs');
    const envPart = rule.environment?.name || (rule.environmentId ? 'Specific Env' : 'All Envs');
    return `${apiPart} / ${envPart}`;
  };

  // Format metric display name
  const formatMetricName = (metricId: string) => {
    const found = metrics.find((m) => m.id === metricId);
    return found ? found.name : metricId.replace(/_/g, ' ');
  };

  // Determine state badge
  const getRuleState = (rule: AlertRule): { label: string; className: string } => {
    if (!rule.enabled) {
      return {
        label: 'Disabled',
        className: 'bg-muted/60 text-muted-foreground border-border/80',
      };
    }
    const instance = rule.instances?.[0];
    if (!instance) {
      return {
        label: 'Evaluating',
        className: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
      };
    }

    switch (instance.status) {
      case 'FIRING':
        return {
          label: 'Firing',
          className: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
        };
      case 'PENDING':
        return {
          label: 'Pending',
          className: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
        };
      case 'NORMAL':
      case 'RESOLVED':
      default:
        return {
          label: 'Normal',
          className: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
        };
    }
  };

  // Format severity badge
  const getSeverityBadge = (severity: AlertSeverity) => {
    switch (severity) {
      case 'CRITICAL':
        return (
          <Badge variant="outline" className="border-rose-500/40 text-rose-400 bg-rose-500/5 font-mono text-[11px] uppercase">
            Critical
          </Badge>
        );
      case 'HIGH':
        return (
          <Badge variant="outline" className="border-amber-500/40 text-amber-400 bg-amber-500/5 font-mono text-[11px] uppercase">
            High
          </Badge>
        );
      case 'WARNING':
        return (
          <Badge variant="outline" className="border-yellow-500/40 text-yellow-400 bg-yellow-500/5 font-mono text-[11px] uppercase">
            Warning
          </Badge>
        );
      case 'INFO':
      default:
        return (
          <Badge variant="outline" className="border-blue-500/40 text-blue-400 bg-blue-500/5 font-mono text-[11px] uppercase">
            Info
          </Badge>
        );
    }
  };

  // Format last evaluation relative time
  const formatLastEvaluation = (rule: AlertRule) => {
    const lastEval = rule.evaluations?.[0];
    if (!lastEval) {
      return <span className="text-muted-foreground text-xs font-mono">Evaluating</span>;
    }
    const evalDate = new Date(lastEval.evaluatedAt);
    const now = new Date();
    const diffSecs = Math.floor((now.getTime() - evalDate.getTime()) / 1000);

    if (diffSecs < 60) return <span className="text-xs font-mono text-foreground">{diffSecs}s ago</span>;
    const diffMins = Math.floor(diffSecs / 60);
    if (diffMins < 60) return <span className="text-xs font-mono text-foreground">{diffMins}m ago</span>;
    const diffHours = Math.floor(diffMins / 60);
    return <span className="text-xs font-mono text-muted-foreground">{diffHours}h ago</span>;
  };

  return (
    <PageContainer
      title="Alert Rules"
      description="Create and manage conditions that detect abnormal API behavior."
      action={
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadData(true)}
            disabled={isRefreshing}
            className="text-xs font-mono gap-1.5"
            title="Refresh rules"
          >
            <HugeiconsIcon
              icon={ArrowReloadHorizontalIcon}
              className={`size-3.5 ${isRefreshing ? 'animate-spin' : ''}`}
            />
            <span>Refresh</span>
          </Button>

          <Button
            size="sm"
            onClick={() => navigate('/alert-rules/new')}
            className="text-xs font-mono gap-1.5"
          >
            <HugeiconsIcon icon={Add01Icon} className="size-3.5" />
            <span>Create alert rule</span>
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {/* State Summary Counter Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 border border-border bg-card/60 p-2.5 rounded-none text-xs font-mono">
          <div className="flex items-center justify-between px-3 py-1 border-r border-border/50">
            <span className="text-muted-foreground">Total Rules</span>
            <span className="font-semibold text-foreground">{counts.total}</span>
          </div>
          <div className="flex items-center justify-between px-3 py-1 border-r border-border/50">
            <span className="text-muted-foreground">Firing</span>
            <span className="font-semibold text-rose-400">{counts.firing}</span>
          </div>
          <div className="flex items-center justify-between px-3 py-1 border-r border-border/50">
            <span className="text-muted-foreground">Pending</span>
            <span className="font-semibold text-amber-400">{counts.pending}</span>
          </div>
          <div className="flex items-center justify-between px-3 py-1 border-r border-border/50">
            <span className="text-muted-foreground">Normal</span>
            <span className="font-semibold text-emerald-400">{counts.normal}</span>
          </div>
          <div className="flex items-center justify-between px-3 py-1 col-span-2 sm:col-span-1">
            <span className="text-muted-foreground">Disabled</span>
            <span className="font-semibold text-muted-foreground">{counts.disabled}</span>
          </div>
        </div>

        {/* Search & Filter Toolbar */}
        <div className="border border-border bg-card p-3 space-y-3">
          <div className="flex flex-col sm:flex-row gap-2">
            {/* Search Input */}
            <div className="relative flex-1">
              <HugeiconsIcon
                icon={Search01Icon}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground"
              />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search alert rules by name, description, or metric..."
                className="pl-8 text-xs font-mono h-8 rounded-none border-border"
              />
            </div>

            {/* Reset Filters button if any filter active */}
            {(searchQuery ||
              statusFilter !== 'ALL' ||
              severityFilter !== 'ALL' ||
              projectFilter !== 'ALL' ||
              environmentFilter !== 'ALL' ||
              metricFilter !== 'ALL') && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearchQuery('');
                  setStatusFilter('ALL');
                  setSeverityFilter('ALL');
                  setProjectFilter('ALL');
                  setEnvironmentFilter('ALL');
                  setMetricFilter('ALL');
                }}
                className="text-xs font-mono h-8 text-muted-foreground hover:text-foreground shrink-0"
              >
                Reset filters
              </Button>
            )}
          </div>

          {/* Filter Dropdowns Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
            {/* Status Filter */}
            <div>
              <label className="text-[10px] font-mono text-muted-foreground block mb-1">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="w-full h-7 px-2 bg-background border border-border text-foreground font-mono text-xs rounded-none focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="ALL">All Statuses</option>
                <option value="ENABLED">Enabled</option>
                <option value="DISABLED">Disabled</option>
              </select>
            </div>

            {/* Severity Filter */}
            <div>
              <label className="text-[10px] font-mono text-muted-foreground block mb-1">Severity</label>
              <select
                value={severityFilter}
                onChange={(e) => setSeverityFilter(e.target.value)}
                className="w-full h-7 px-2 bg-background border border-border text-foreground font-mono text-xs rounded-none focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="ALL">All Severities</option>
                <option value="CRITICAL">Critical</option>
                <option value="HIGH">High</option>
                <option value="WARNING">Warning</option>
                <option value="INFO">Info</option>
              </select>
            </div>

            {/* Project Filter */}
            <div>
              <label className="text-[10px] font-mono text-muted-foreground block mb-1">Project</label>
              <select
                value={projectFilter}
                onChange={(e) => setProjectFilter(e.target.value)}
                className="w-full h-7 px-2 bg-background border border-border text-foreground font-mono text-xs rounded-none focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="ALL">All Projects</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Environment Filter */}
            <div>
              <label className="text-[10px] font-mono text-muted-foreground block mb-1">Environment</label>
              <select
                value={environmentFilter}
                onChange={(e) => setEnvironmentFilter(e.target.value)}
                className="w-full h-7 px-2 bg-background border border-border text-foreground font-mono text-xs rounded-none focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="ALL">All Environments</option>
                {environments.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Metric Filter */}
            <div>
              <label className="text-[10px] font-mono text-muted-foreground block mb-1">Metric</label>
              <select
                value={metricFilter}
                onChange={(e) => setMetricFilter(e.target.value)}
                className="w-full h-7 px-2 bg-background border border-border text-foreground font-mono text-xs rounded-none focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="ALL">All Metrics</option>
                {metrics.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Live Test Feedback Banner */}
        {testResult && (
          <div
            className={`p-3 border text-xs font-mono flex items-center justify-between ${
              testResult.conditionMet
                ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="font-semibold uppercase tracking-wider">Evaluation Test:</span>
              <span>
                Observed value: {testResult.currentValue !== null ? testResult.currentValue : 'No data'} | Threshold: {testResult.threshold} | Condition met:{' '}
                {testResult.conditionMet ? 'TRUE (Would fire)' : 'FALSE (Normal)'}
              </span>
            </div>
            <button
              onClick={() => setTestResult(null)}
              className="text-muted-foreground hover:text-foreground text-xs"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Rules Table / Empty State */}
        <div className="border border-border bg-card rounded-none overflow-hidden">
          {isLoading ? (
            <div className="p-12 text-center text-xs font-mono text-muted-foreground space-y-2">
              <span className="inline-block size-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <div>Loading alert rules...</div>
            </div>
          ) : filteredRules.length === 0 ? (
            <div className="p-12 text-center space-y-4">
              {rules.length === 0 ? (
                <>
                  <div className="space-y-1">
                    <h3 className="text-sm font-semibold text-foreground font-heading">
                      No alert rules yet.
                    </h3>
                    <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                      Create your first alert rule to start detecting API issues and anomalous latency or failure spikes.
                    </p>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => navigate('/alert-rules/new')}
                    className="text-xs font-mono gap-1.5"
                  >
                    <HugeiconsIcon icon={Add01Icon} className="size-3.5" />
                    <span>Create alert rule</span>
                  </Button>
                </>
              ) : (
                <div className="space-y-1">
                  <h3 className="text-sm font-semibold text-foreground font-heading">
                    No alert rules match the selected filters.
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Try adjusting your search criteria, severity, or scope filters.
                  </p>
                </div>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="text-xs font-mono uppercase text-muted-foreground">Rule</TableHead>
                  <TableHead className="text-xs font-mono uppercase text-muted-foreground">Metric</TableHead>
                  <TableHead className="text-xs font-mono uppercase text-muted-foreground">Scope</TableHead>
                  <TableHead className="text-xs font-mono uppercase text-muted-foreground">Condition</TableHead>
                  <TableHead className="text-xs font-mono uppercase text-muted-foreground">Severity</TableHead>
                  <TableHead className="text-xs font-mono uppercase text-muted-foreground">Notifications</TableHead>
                  <TableHead className="text-xs font-mono uppercase text-muted-foreground">Status</TableHead>
                  <TableHead className="text-xs font-mono uppercase text-muted-foreground">Last evaluation</TableHead>
                  <TableHead className="text-xs font-mono uppercase text-muted-foreground">State</TableHead>
                  <TableHead className="text-xs font-mono uppercase text-muted-foreground text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRules.map((rule) => {
                  const state = getRuleState(rule);

                  return (
                    <TableRow key={rule.id} className="border-border hover:bg-muted/20">
                      {/* Rule Name & Description */}
                      <TableCell className="font-medium">
                        <div className="flex flex-col min-w-[160px]">
                          <Link
                            to={`/alert-rules/${rule.id}`}
                            className="text-xs font-semibold text-foreground hover:underline hover:text-primary transition-colors"
                          >
                            {rule.name}
                          </Link>
                          {rule.description && (
                            <span className="text-[11px] text-muted-foreground line-clamp-1">
                              {rule.description}
                            </span>
                          )}
                        </div>
                      </TableCell>

                      {/* Metric */}
                      <TableCell className="text-xs font-mono text-foreground whitespace-nowrap">
                        {formatMetricName(rule.metric)}
                      </TableCell>

                      {/* Scope */}
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatScope(rule)}
                      </TableCell>

                      {/* Condition */}
                      <TableCell className="text-xs font-mono text-foreground whitespace-nowrap">
                        {formatCondition(rule)}
                      </TableCell>

                      {/* Severity */}
                      <TableCell className="whitespace-nowrap">
                        {getSeverityBadge(rule.severity)}
                      </TableCell>

                      {/* Notifications */}
                      <TableCell className="whitespace-nowrap">
                        {rule.notificationConfig?.email?.enabled &&
                        rule.notificationConfig?.email?.recipients &&
                        rule.notificationConfig.email.recipients.length > 0 ? (
                          <span
                            className="inline-flex items-center px-1.5 py-0.5 text-[11px] font-mono border border-border/80 bg-muted/40 text-foreground"
                            title={`Recipients: ${rule.notificationConfig.email.recipients.join(', ')}`}
                          >
                            Email
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-xs font-mono">—</span>
                        )}
                      </TableCell>

                      {/* Status (Enabled / Disabled toggle button) */}
                      <TableCell className="whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => handleToggleEnable(rule)}
                          className={`text-[11px] font-mono px-2 py-0.5 border transition-colors ${
                            rule.enabled
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
                              : 'bg-muted/40 text-muted-foreground border-border hover:bg-muted/60'
                          }`}
                          title={rule.enabled ? 'Click to disable rule' : 'Click to enable rule'}
                        >
                          {rule.enabled ? 'Enabled' : 'Disabled'}
                        </button>
                      </TableCell>

                      {/* Last Evaluation */}
                      <TableCell className="whitespace-nowrap">
                        {formatLastEvaluation(rule)}
                      </TableCell>

                      {/* State */}
                      <TableCell className="whitespace-nowrap">
                        <span
                          className={`inline-block px-2 py-0.5 text-[11px] font-mono border ${state.className}`}
                        >
                          {state.label}
                        </span>
                      </TableCell>

                      {/* Actions */}
                      <TableCell className="text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          {/* Test Rule */}
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            onClick={() => handleTestRule(rule.id)}
                            disabled={testingRuleId === rule.id}
                            title="Evaluate rule against current data"
                            className="text-muted-foreground hover:text-foreground"
                          >
                            <HugeiconsIcon
                              icon={PlayIcon}
                              className={`size-3.5 ${testingRuleId === rule.id ? 'animate-spin' : ''}`}
                            />
                            <span className="sr-only">Test rule</span>
                          </Button>

                          {/* View Detail */}
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            onClick={() => navigate(`/alert-rules/${rule.id}`)}
                            title="View rule details and history"
                            className="text-muted-foreground hover:text-foreground"
                          >
                            <HugeiconsIcon icon={ViewIcon} className="size-3.5" />
                            <span className="sr-only">View rule</span>
                          </Button>

                          {/* Edit Rule */}
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            onClick={() => navigate(`/alert-rules/${rule.id}/edit`)}
                            title="Edit rule configuration"
                            className="text-muted-foreground hover:text-foreground"
                          >
                            <HugeiconsIcon icon={Edit01Icon} className="size-3.5" />
                            <span className="sr-only">Edit rule</span>
                          </Button>

                          {/* Delete Rule */}
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            onClick={() => setRuleToDelete(rule)}
                            title="Delete alert rule"
                            className="text-muted-foreground hover:text-rose-400"
                          >
                            <HugeiconsIcon icon={Delete02Icon} className="size-3.5" />
                            <span className="sr-only">Delete rule</span>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>
      </div>

      {/* Delete Rule Confirmation Dialog */}
      <Dialog open={!!ruleToDelete} onOpenChange={(open) => !open && setRuleToDelete(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold font-mono">
              Delete Alert Rule
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground space-y-2 pt-2">
              <p>
                Are you sure you want to delete <span className="font-semibold text-foreground">{ruleToDelete?.name}</span>?
              </p>
              <p className="text-[11px] leading-relaxed border-l-2 border-amber-500/50 pl-2 text-muted-foreground">
                Deleting this alert rule will permanently remove its configuration. Historical alert instances and incident records are preserved for audit purposes and will not be erased.
              </p>
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="mt-4 gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setRuleToDelete(null)}
              disabled={isDeleting}
              className="text-xs font-mono"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
              className="text-xs font-mono"
            >
              {isDeleting ? 'Deleting...' : 'Delete rule'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useApi } from '@/context/ApiContext';
import {
  BellRing,
  Plus,
  RefreshCw,
  Pencil,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Loader2,
  X,
  ShieldAlert,
  CheckCircle,
  Activity,
  RotateCcw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import type {
  AlertRule,
  AlertMetric,
  AlertOperator,
  AlertSeverity,
  CreateAlertRulePayload,
} from '@/types/alert-rules';
import {
  fetchAlertRules,
  createAlertRule,
  updateAlertRule,
  deleteAlertRule,
  toggleAlertRule,
} from '@/services/alert-rules.service';

const METRICS: { value: AlertMetric; label: string; description: string; unit: string }[] = [
  { value: 'RESPONSE_TIME', label: 'Response Time', description: 'API response latency', unit: 'ms' },
  { value: 'ERROR_RATE', label: 'Error Rate', description: 'Failure rate percentage', unit: '%' },
  { value: 'HTTP_STATUS', label: 'HTTP Status Code', description: 'Specific HTTP status code', unit: '' },
  { value: 'API_UNAVAILABLE', label: 'API Unavailable', description: 'Complete service downtime', unit: '' },
  { value: 'UPTIME', label: 'Uptime', description: 'Availability percentage', unit: '%' },
  { value: 'CONSECUTIVE_FAILURES', label: 'Consecutive Failures', description: 'Count of back-to-back failures', unit: 'failures' },
  { value: 'SCHEMA_CHANGE', label: 'Schema Change', description: 'Response schema has changed', unit: 'changes' },
];

const OPERATORS: { value: AlertOperator; label: string; symbol: string }[] = [
  { value: 'GREATER_THAN', label: '> (Greater than)', symbol: '>' },
  { value: 'LESS_THAN', label: '< (Less than)', symbol: '<' },
  { value: 'GREATER_THAN_OR_EQUAL', label: '>= (Greater than or equal)', symbol: '>=' },
  { value: 'LESS_THAN_OR_EQUAL', label: '<= (Less than or equal)', symbol: '<=' },
  { value: 'EQUALS', label: '== (Equals)', symbol: '==' },
];

const SEVERITIES: { value: AlertSeverity; label: string }[] = [
  { value: 'INFO', label: 'Info' },
  { value: 'WARNING', label: 'Warning' },
  { value: 'CRITICAL', label: 'Critical' },
];

const ENVIRONMENTS = [
  { value: 'production', label: 'Production' },
  { value: 'staging', label: 'Staging' },
  { value: 'development', label: 'Development' },
];

interface FormState {
  api_id: number;
  environment: string;
  metric: AlertMetric;
  operator: AlertOperator;
  threshold: number;
  evaluation_window_mins: number;
  consecutive_failures_count: number;
  severity: AlertSeverity;
  cooldown_mins: number;
  is_enabled: boolean;
}

const DEFAULT_FORM_STATE: FormState = {
  api_id: 1,
  environment: 'production',
  metric: 'RESPONSE_TIME',
  operator: 'GREATER_THAN',
  threshold: 500,
  evaluation_window_mins: 0,
  consecutive_failures_count: 1,
  severity: 'WARNING',
  cooldown_mins: 5,
  is_enabled: true,
};

export const AlertRulesPage: React.FC = () => {
  const { apis } = useApi();

  const [rules, setRules] = useState<AlertRule[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Filters
  const [apiFilter, setApiFilter] = useState<string>('all');
  const [envFilter, setEnvFilter] = useState<string>('all');
  const [severityFilter, setSeverityFilter] = useState<string>('all');

  // Sheet / Modal State
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<AlertRule | null>(null);
  const [formData, setFormData] = useState<FormState>(DEFAULT_FORM_STATE);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load alert rules
  const loadRules = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await fetchAlertRules();
      setRules(data);
      setErrorMessage(null);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to retrieve alert rules.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRules();
  }, [loadRules]);

  // Available numeric APIs from context
  const numericApis = useMemo(() => {
    return apis.filter((a) => !isNaN(parseInt(a.id, 10)));
  }, [apis]);

  // Filtered rules
  const filteredRules = useMemo(() => {
    return rules.filter((rule) => {
      if (apiFilter !== 'all' && String(rule.apiId) !== apiFilter) {
        return false;
      }
      if (envFilter !== 'all' && rule.environment.toLowerCase() !== envFilter.toLowerCase()) {
        return false;
      }
      if (severityFilter !== 'all' && rule.severity !== severityFilter) {
        return false;
      }
      return true;
    });
  }, [rules, apiFilter, envFilter, severityFilter]);

  const hasActiveFilters = apiFilter !== 'all' || envFilter !== 'all' || severityFilter !== 'all';

  const clearFilters = () => {
    setApiFilter('all');
    setEnvFilter('all');
    setSeverityFilter('all');
  };

  // Open create sheet
  const handleOpenCreate = () => {
    setEditingRule(null);
    setFormError(null);
    const initialApiId =
      numericApis.length > 0 ? parseInt(numericApis[0].id, 10) : 1;
    const initialEnv =
      numericApis.length > 0 ? numericApis[0].environment.toLowerCase() : 'production';

    setFormData({
      ...DEFAULT_FORM_STATE,
      api_id: initialApiId,
      environment: initialEnv,
    });
    setIsSheetOpen(true);
  };

  // Open edit sheet
  const handleOpenEdit = (rule: AlertRule) => {
    setEditingRule(rule);
    setFormError(null);
    setFormData({
      api_id: rule.apiId,
      environment: rule.environment.toLowerCase(),
      metric: rule.metric,
      operator: rule.operator,
      threshold: rule.threshold,
      evaluation_window_mins: rule.evaluationWindowMins,
      consecutive_failures_count: rule.consecutiveFailuresCount,
      severity: rule.severity,
      cooldown_mins: rule.cooldownMins,
      is_enabled: rule.isEnabled,
    });
    setIsSheetOpen(true);
  };

  // Form validation
  const validateForm = (): string | null => {
    if (!formData.api_id || isNaN(formData.api_id) || formData.api_id <= 0) {
      return 'Please select a valid API.';
    }
    if (!formData.environment || !formData.environment.trim()) {
      return 'Environment is required.';
    }
    if (!formData.metric) {
      return 'Metric is required.';
    }
    if (!formData.operator) {
      return 'Operator is required.';
    }
    if (isNaN(formData.threshold)) {
      return 'Threshold must be a valid number.';
    }
    if (formData.evaluation_window_mins < 0) {
      return 'Evaluation window must be 0 or greater.';
    }
    if (formData.consecutive_failures_count < 1) {
      return 'Consecutive failures count must be at least 1.';
    }
    if (formData.cooldown_mins < 0) {
      return 'Cooldown must be 0 or greater.';
    }
    if (!formData.severity) {
      return 'Severity is required.';
    }
    return null;
  };

  // Submit create or edit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const error = validateForm();
    if (error) {
      setFormError(error);
      return;
    }

    setIsSubmitting(true);
    setFormError(null);

    const payload: CreateAlertRulePayload = {
      api_id: formData.api_id,
      environment: formData.environment.toLowerCase(),
      metric: formData.metric,
      operator: formData.operator,
      threshold: Number(formData.threshold),
      evaluation_window_mins: Number(formData.evaluation_window_mins),
      consecutive_failures_count: Number(formData.consecutive_failures_count),
      severity: formData.severity,
      cooldown_mins: Number(formData.cooldown_mins),
      is_enabled: formData.is_enabled,
    };

    try {
      if (editingRule) {
        await updateAlertRule(editingRule.id, payload);
        setSuccessMessage(`Alert rule #${editingRule.id} updated successfully.`);
      } else {
        const created = await createAlertRule(payload);
        setSuccessMessage(`Alert rule #${created.id} created successfully.`);
      }
      setIsSheetOpen(false);
      await loadRules();
    } catch (err: any) {
      setFormError(err.message || 'Failed to save alert rule.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Toggle rule enabled
  const handleToggle = async (rule: AlertRule, nextState: boolean) => {
    try {
      const updated = await toggleAlertRule(rule.id, nextState);
      setRules((prev) =>
        prev.map((r) => (r.id === rule.id ? { ...r, isEnabled: updated.isEnabled } : r))
      );
      setSuccessMessage(
        `Alert rule #${rule.id} ${updated.isEnabled ? 'enabled' : 'disabled'} successfully.`
      );
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to toggle alert rule.');
    }
  };

  // Delete rule
  const handleDelete = async (rule: AlertRule) => {
    const confirmed = window.confirm(
      `Are you sure you want to delete Alert Rule #${rule.id} (${rule.metric} ${rule.operator} ${rule.threshold})?`
    );
    if (!confirmed) return;

    try {
      await deleteAlertRule(rule.id);
      setSuccessMessage(`Alert rule #${rule.id} deleted successfully.`);
      await loadRules();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to delete alert rule.');
    }
  };

  // Helper helpers
  const getApiName = (apiId: number) => {
    const found = apis.find((a) => String(a.id) === String(apiId));
    return found ? found.name : `API #${apiId}`;
  };

  const getConditionDisplay = (rule: AlertRule) => {
    const op = OPERATORS.find((o) => o.value === rule.operator)?.symbol || rule.operator;
    const metricInfo = METRICS.find((m) => m.value === rule.metric);
    const unit = metricInfo?.unit ? ` ${metricInfo.unit}` : '';

    if (rule.metric === 'API_UNAVAILABLE') {
      return `${op} ${rule.threshold === 1 ? 'Unavailable (1)' : 'Available (0)'}`;
    }
    if (rule.metric === 'SCHEMA_CHANGE') {
      return `${op} ${rule.threshold} Changes`;
    }
    return `${op} ${rule.threshold}${unit}`;
  };

  const getMetricLabel = (metric: AlertMetric) => {
    return METRICS.find((m) => m.value === metric)?.label || metric;
  };

  const formatLastTriggered = (timestamp: string | null) => {
    if (!timestamp) {
      return <span className="text-muted-foreground italic text-xs">Never</span>;
    }
    const date = new Date(timestamp);
    return (
      <div className="flex flex-col text-xs leading-tight">
        <span className="font-medium text-foreground">{date.toLocaleDateString()}</span>
        <span className="text-muted-foreground text-[10px]">
          {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
    );
  };

  // Summary counts
  const totalCount = rules.length;
  const enabledCount = rules.filter((r) => r.isEnabled).length;
  const criticalCount = rules.filter((r) => r.severity === 'CRITICAL').length;
  const triggeredCount = rules.filter((r) => r.lastTriggeredAt !== null).length;

  return (
    <div className="min-h-full bg-background p-6 lg:p-8 space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">Alert Rules</h1>
            <Badge variant="outline" className="text-xs">
              {rules.length} total
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Configure threshold-based monitoring rules and automated alerts across environments.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadRules} disabled={isLoading}>
            <RefreshCw className={cn('mr-1.5 h-3.5 w-3.5', isLoading && 'animate-spin')} />
            Refresh
          </Button>
          <Button size="sm" onClick={handleOpenCreate}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Create Rule
          </Button>
        </div>
      </div>

      {/* Success / Error Banners */}
      {errorMessage && (
        <div className="flex items-center justify-between gap-2 rounded-lg border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-600 dark:text-red-400">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => setErrorMessage(null)}
            className="text-red-600 hover:bg-red-500/20"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      {successMessage && (
        <div className="flex items-center justify-between gap-2 rounded-lg border border-green-500/20 bg-green-500/10 p-4 text-sm text-green-600 dark:text-green-400">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{successMessage}</span>
          </div>
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => setSuccessMessage(null)}
            className="text-green-600 hover:bg-green-500/20"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      {/* Metric Cards Summary */}
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
        <Card className="border-black/10 dark:border-white/10 shadow-none">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-medium uppercase tracking-wider">Total Rules</span>
              <BellRing className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold">{totalCount}</div>
            <p className="text-[11px] text-muted-foreground mt-0.5">configured alert thresholds</p>
          </CardContent>
        </Card>

        <Card className="border-black/10 dark:border-white/10 shadow-none">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400">
              <span className="text-xs font-medium uppercase tracking-wider">Active Rules</span>
              <CheckCircle className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {enabledCount}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">actively evaluated</p>
          </CardContent>
        </Card>

        <Card className="border-black/10 dark:border-white/10 shadow-none">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between text-red-600 dark:text-red-400">
              <span className="text-xs font-medium uppercase tracking-wider">Critical Rules</span>
              <ShieldAlert className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold text-red-600 dark:text-red-400">{criticalCount}</div>
            <p className="text-[11px] text-muted-foreground mt-0.5">high-priority alerts</p>
          </CardContent>
        </Card>

        <Card className="border-black/10 dark:border-white/10 shadow-none">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between text-amber-600 dark:text-amber-400">
              <span className="text-xs font-medium uppercase tracking-wider">Triggered</span>
              <Activity className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
              {triggeredCount}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">rules triggered at least once</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Alert Rules Card */}
      <Card className="border-black/10 dark:border-white/10 shadow-none overflow-hidden">
        <CardHeader className="border-b p-4 sm:p-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <CardTitle className="text-lg">Configured Rules</CardTitle>
              <CardDescription className="text-xs mt-0.5">
                Evaluated by the background monitoring worker against API metrics.
              </CardDescription>
            </div>

            {/* Filters Bar */}
            <div className="flex flex-wrap items-center gap-2">
              {/* API Filter */}
              <Select value={apiFilter} onValueChange={(v) => v && setApiFilter(v)}>
                <SelectTrigger className="w-[160px] h-8 text-xs">
                  <SelectValue placeholder="All APIs" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All APIs</SelectItem>
                  {numericApis.map((api) => (
                    <SelectItem key={api.id} value={String(api.id)}>
                      {api.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Environment Filter */}
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

              {/* Severity Filter */}
              <Select value={severityFilter} onValueChange={(v) => v && setSeverityFilter(v)}>
                <SelectTrigger className="w-[130px] h-8 text-xs">
                  <SelectValue placeholder="Severity" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Severities</SelectItem>
                  <SelectItem value="CRITICAL">Critical</SelectItem>
                  <SelectItem value="WARNING">Warning</SelectItem>
                  <SelectItem value="INFO">Info</SelectItem>
                </SelectContent>
              </Select>

              {/* Clear Filters */}
              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearFilters}
                  className="h-8 text-xs text-muted-foreground hover:text-foreground"
                >
                  <RotateCcw className="h-3 w-3 mr-1" />
                  Clear
                </Button>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center p-12 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
              <span className="text-sm">Loading alert rules...</span>
            </div>
          ) : filteredRules.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-center">
              <div className="rounded-full bg-muted p-4 mb-3">
                <BellRing className="h-8 w-8 text-muted-foreground/60" />
              </div>
              <h3 className="text-base font-medium text-foreground">
                {hasActiveFilters ? 'No matching alert rules' : 'No alert rules configured'}
              </h3>
              <p className="mt-1 text-xs text-muted-foreground max-w-sm">
                {hasActiveFilters
                  ? 'No alert rules matched the current filter combination. Try adjusting or clearing your filters.'
                  : 'Get started by creating threshold-based alert rules to monitor response latency, error rates, and availability.'}
              </p>
              <div className="mt-4">
                {hasActiveFilters ? (
                  <Button variant="outline" size="sm" onClick={clearFilters}>
                    <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                    Clear Filters
                  </Button>
                ) : (
                  <Button size="sm" onClick={handleOpenCreate}>
                    <Plus className="h-3.5 w-3.5 mr-1.5" />
                    Create First Rule
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="pl-6">API</TableHead>
                    <TableHead>Environment</TableHead>
                    <TableHead>Metric</TableHead>
                    <TableHead>Condition</TableHead>
                    <TableHead>Severity</TableHead>
                    <TableHead className="text-center">Window</TableHead>
                    <TableHead className="text-center">Consecutive</TableHead>
                    <TableHead className="text-center">Cooldown</TableHead>
                    <TableHead>Last Triggered</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead className="pr-6 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRules.map((rule) => {
                    const envLower = rule.environment.toLowerCase();
                    const envVariant =
                      envLower === 'production'
                        ? 'production'
                        : envLower === 'staging'
                        ? 'staging'
                        : 'development';

                    return (
                      <TableRow key={rule.id} className="transition-colors">
                        {/* API Name */}
                        <TableCell className="pl-6 font-medium">
                          <div className="flex flex-col">
                            <span className="text-foreground">{getApiName(rule.apiId)}</span>
                            <span className="text-[11px] text-muted-foreground font-mono">
                              api_id: {rule.apiId}
                            </span>
                          </div>
                        </TableCell>

                        {/* Environment */}
                        <TableCell>
                          <Badge variant={envVariant} className="text-[11px] capitalize">
                            {rule.environment}
                          </Badge>
                        </TableCell>

                        {/* Metric */}
                        <TableCell>
                          <span className="font-medium text-xs text-foreground">
                            {getMetricLabel(rule.metric)}
                          </span>
                        </TableCell>

                        {/* Condition */}
                        <TableCell>
                          <code className="rounded bg-muted px-2 py-0.5 text-xs font-semibold text-foreground font-mono">
                            {getConditionDisplay(rule)}
                          </code>
                        </TableCell>

                        {/* Severity */}
                        <TableCell>
                          {rule.severity === 'CRITICAL' && (
                            <Badge
                              variant="outline"
                              className="border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400 font-semibold text-[10px]"
                            >
                              CRITICAL
                            </Badge>
                          )}
                          {rule.severity === 'WARNING' && (
                            <Badge
                              variant="outline"
                              className="border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400 font-semibold text-[10px]"
                            >
                              WARNING
                            </Badge>
                          )}
                          {rule.severity === 'INFO' && (
                            <Badge
                              variant="outline"
                              className="border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400 font-semibold text-[10px]"
                            >
                              INFO
                            </Badge>
                          )}
                        </TableCell>

                        {/* Window */}
                        <TableCell className="text-center text-xs text-muted-foreground">
                          {rule.evaluationWindowMins > 0 ? `${rule.evaluationWindowMins}m` : 'Direct'}
                        </TableCell>

                        {/* Consecutive Failures */}
                        <TableCell className="text-center text-xs text-muted-foreground">
                          {rule.consecutiveFailuresCount}x
                        </TableCell>

                        {/* Cooldown */}
                        <TableCell className="text-center text-xs text-muted-foreground">
                          {rule.cooldownMins}m
                        </TableCell>

                        {/* Last Triggered */}
                        <TableCell>{formatLastTriggered(rule.lastTriggeredAt)}</TableCell>

                        {/* Enabled / Disabled Toggle */}
                        <TableCell className="text-center">
                          <Switch
                            checked={rule.isEnabled}
                            onCheckedChange={(checked) => handleToggle(rule, checked)}
                            aria-label={`Toggle rule #${rule.id}`}
                          />
                        </TableCell>

                        {/* Actions */}
                        <TableCell className="pr-6 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon-xs"
                              title="Edit rule"
                              onClick={() => handleOpenEdit(rule)}
                              className="hover:bg-muted"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                              <span className="sr-only">Edit</span>
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon-xs"
                              title="Delete rule"
                              onClick={() => handleDelete(rule)}
                              className="hover:bg-red-500/10 hover:text-red-600 dark:hover:bg-red-950/30 dark:hover:text-red-400"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              <span className="sr-only">Delete</span>
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create / Edit Rule Sheet */}
      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent side="right" className="w-full sm:max-w-lg p-0 flex flex-col">
          <form onSubmit={handleSubmit} className="flex flex-col h-full">
            <SheetHeader className="p-6 border-b">
              <SheetTitle>{editingRule ? 'Edit Alert Rule' : 'Create Alert Rule'}</SheetTitle>
              <SheetDescription>
                {editingRule
                  ? `Modify conditions and evaluation thresholds for rule #${editingRule.id}.`
                  : 'Define evaluation criteria, thresholds, and notification parameters.'}
              </SheetDescription>
            </SheetHeader>

            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {formError && (
                <div className="flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-600 dark:text-red-400">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* API Selection */}
              <div className="space-y-1.5">
                <Label htmlFor="api_id" className="text-xs font-semibold">
                  API <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={String(formData.api_id)}
                  onValueChange={(val) => {
                    if (val) {
                      const id = parseInt(val, 10);
                      const selectedApi = apis.find((a) => a.id === val);
                      setFormData((prev) => ({
                        ...prev,
                        api_id: id,
                        environment: selectedApi
                          ? selectedApi.environment.toLowerCase()
                          : prev.environment,
                      }));
                    }
                  }}
                >
                  <SelectTrigger id="api_id" className="w-full text-xs">
                    <SelectValue placeholder="Select API" />
                  </SelectTrigger>
                  <SelectContent>
                    {numericApis.map((api) => (
                      <SelectItem key={api.id} value={String(api.id)}>
                        {api.name} ({api.environment})
                      </SelectItem>
                    ))}
                    {/* Fallback if editing rule with an ID not in numericApis */}
                    {!numericApis.some((a) => String(a.id) === String(formData.api_id)) && (
                      <SelectItem value={String(formData.api_id)}>
                        API #{formData.api_id}
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">
                  Target API monitored by this alert rule.
                </p>
              </div>

              {/* Environment */}
              <div className="space-y-1.5">
                <Label htmlFor="environment" className="text-xs font-semibold">
                  Environment <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={formData.environment}
                  onValueChange={(val) => val && setFormData((prev) => ({ ...prev, environment: val }))}
                >
                  <SelectTrigger id="environment" className="w-full text-xs">
                    <SelectValue placeholder="Select Environment" />
                  </SelectTrigger>
                  <SelectContent>
                    {ENVIRONMENTS.map((env) => (
                      <SelectItem key={env.value} value={env.value}>
                        {env.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Metric & Operator */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="metric" className="text-xs font-semibold">
                    Metric <span className="text-red-500">*</span>
                  </Label>
                  <Select
                    value={formData.metric}
                    onValueChange={(val) =>
                      val && setFormData((prev) => ({ ...prev, metric: val as AlertMetric }))
                    }
                  >
                    <SelectTrigger id="metric" className="w-full text-xs">
                      <SelectValue placeholder="Select Metric" />
                    </SelectTrigger>
                    <SelectContent>
                      {METRICS.map((metric) => (
                        <SelectItem key={metric.value} value={metric.value}>
                          {metric.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="operator" className="text-xs font-semibold">
                    Operator <span className="text-red-500">*</span>
                  </Label>
                  <Select
                    value={formData.operator}
                    onValueChange={(val) =>
                      val && setFormData((prev) => ({ ...prev, operator: val as AlertOperator }))
                    }
                  >
                    <SelectTrigger id="operator" className="w-full text-xs">
                      <SelectValue placeholder="Select Operator" />
                    </SelectTrigger>
                    <SelectContent>
                      {OPERATORS.map((op) => (
                        <SelectItem key={op.value} value={op.value}>
                          {op.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Threshold */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="threshold" className="text-xs font-semibold">
                    Threshold <span className="text-red-500">*</span>
                  </Label>
                  <span className="text-[11px] text-muted-foreground">
                    {METRICS.find((m) => m.value === formData.metric)?.unit &&
                      `Unit: ${METRICS.find((m) => m.value === formData.metric)?.unit}`}
                  </span>
                </div>
                <Input
                  id="threshold"
                  type="number"
                  step="any"
                  value={formData.threshold}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, threshold: parseFloat(e.target.value) || 0 }))
                  }
                  className="text-xs"
                />
                <p className="text-[11px] text-muted-foreground">
                  {formData.metric === 'RESPONSE_TIME' && 'Latency in milliseconds (e.g. 500).'}
                  {formData.metric === 'ERROR_RATE' && 'Failure rate percentage from 0 to 100 (e.g. 5).'}
                  {formData.metric === 'HTTP_STATUS' && 'Target HTTP response status code (e.g. 500).'}
                  {formData.metric === 'API_UNAVAILABLE' && '1 = Service Unavailable, 0 = Available.'}
                  {formData.metric === 'UPTIME' && 'Target uptime percentage (e.g. 99).'}
                  {formData.metric === 'CONSECUTIVE_FAILURES' &&
                    'Threshold number of failed checks (e.g. 3).'}
                  {formData.metric === 'SCHEMA_CHANGE' && 'Number of schema changes detected (e.g. 1).'}
                </p>
              </div>

              {/* Severity & Evaluation Window */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="severity" className="text-xs font-semibold">
                    Severity <span className="text-red-500">*</span>
                  </Label>
                  <Select
                    value={formData.severity}
                    onValueChange={(val) =>
                      val && setFormData((prev) => ({ ...prev, severity: val as AlertSeverity }))
                    }
                  >
                    <SelectTrigger id="severity" className="w-full text-xs">
                      <SelectValue placeholder="Select Severity" />
                    </SelectTrigger>
                    <SelectContent>
                      {SEVERITIES.map((sev) => (
                        <SelectItem key={sev.value} value={sev.value}>
                          {sev.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="evaluation_window_mins" className="text-xs font-semibold">
                    Evaluation Window (mins)
                  </Label>
                  <Input
                    id="evaluation_window_mins"
                    type="number"
                    min="0"
                    value={formData.evaluation_window_mins}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        evaluation_window_mins: Math.max(0, parseInt(e.target.value, 10) || 0),
                      }))
                    }
                    className="text-xs"
                  />
                  <p className="text-[10px] text-muted-foreground">0 for immediate checks</p>
                </div>
              </div>

              {/* Consecutive Failures & Cooldown */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="consecutive_failures_count" className="text-xs font-semibold">
                    Consecutive Failures <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="consecutive_failures_count"
                    type="number"
                    min="1"
                    value={formData.consecutive_failures_count}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        consecutive_failures_count: Math.max(1, parseInt(e.target.value, 10) || 1),
                      }))
                    }
                    className="text-xs"
                  />
                  <p className="text-[10px] text-muted-foreground">Min 1 failure</p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="cooldown_mins" className="text-xs font-semibold">
                    Cooldown (mins)
                  </Label>
                  <Input
                    id="cooldown_mins"
                    type="number"
                    min="0"
                    value={formData.cooldown_mins}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        cooldown_mins: Math.max(0, parseInt(e.target.value, 10) || 0),
                      }))
                    }
                    className="text-xs"
                  />
                  <p className="text-[10px] text-muted-foreground">Mins between alerts</p>
                </div>
              </div>

              {/* Rule Enabled Switch */}
              <div className="flex items-center justify-between rounded-lg border bg-muted/20 p-3.5">
                <div>
                  <Label htmlFor="is_enabled" className="text-xs font-semibold">
                    Enable Rule
                  </Label>
                  <p className="text-[11px] text-muted-foreground">
                    Active rules will be evaluated during each monitoring cycle.
                  </p>
                </div>
                <Switch
                  id="is_enabled"
                  checked={formData.is_enabled}
                  onCheckedChange={(checked) =>
                    setFormData((prev) => ({ ...prev, is_enabled: checked }))
                  }
                />
              </div>
            </div>

            <SheetFooter className="p-6 border-t mt-auto flex flex-row items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsSheetOpen(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    Saving...
                  </>
                ) : editingRule ? (
                  'Update Rule'
                ) : (
                  'Create Rule'
                )}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  );
};

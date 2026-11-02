import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  api,
  type AlertRule,
  type AlertEvaluation,
  type NotificationDelivery,
  type MetricDefinition,
  type MetricQueryResult,
} from '@/lib/api';
import { PageContainer } from '@/components/layout/PageContainer';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { MetricPreviewChart } from '@/components/alert-rules/MetricPreviewChart';
import { EvaluationHistoryTable } from '@/components/alert-rules/EvaluationHistoryTable';
import { AlertInstancesTable } from '@/components/alert-rules/AlertInstancesTable';
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
  PlayIcon,
  Edit01Icon,
  Delete02Icon,
  ArrowReloadHorizontalIcon,
  Mail01Icon,
} from '@hugeicons/core-free-icons';

export function AlertRuleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [rule, setRule] = useState<AlertRule | null>(null);
  const [evaluations, setEvaluations] = useState<AlertEvaluation[]>([]);
  const [metrics, setMetrics] = useState<MetricDefinition[]>([]);
  const [deliveries, setDeliveries] = useState<NotificationDelivery[]>([]);
  const [isSendingTestEmail, setIsSendingTestEmail] = useState(false);
  const [testEmailFeedback, setTestEmailFeedback] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Time range for chart
  const [chartTimeRange, setChartTimeRange] = useState<'15m' | '1h' | '6h' | '24h'>('1h');
  const [metricData, setMetricData] = useState<MetricQueryResult | null>(null);
  const [isLoadingChart, setIsLoadingChart] = useState(false);

  // Test rule feedback
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    metric: string;
    currentValue: number | null;
    conditionMet: boolean;
    threshold: number;
    wouldTransitionTo: string;
  } | null>(null);

  // Delete modal
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Load Rule & Context
  const loadRuleData = useCallback(async (isSilent = false) => {
    if (!id) return;
    if (!isSilent) setIsLoading(true);
    else setIsRefreshing(true);
    setError(null);

    try {
      const [ruleData, evalsData, metricCatalog, deliveriesData] = await Promise.all([
        api.getAlertRule(id),
        api.getAlertRuleEvaluations(id, 50).catch(() => []),
        api.getMetricCatalog().catch(() => []),
        api.getAlertRuleDeliveries(id, 50).catch(() => []),
      ]);

      setRule(ruleData);
      setEvaluations(evalsData || []);
      setMetrics(metricCatalog || []);
      setDeliveries(deliveriesData || ruleData?.deliveries || []);
    } catch (err: any) {
      setError(err?.message || 'Failed to load alert rule details.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [id]);

  useEffect(() => {
    loadRuleData();
  }, [loadRuleData]);

  // Query Telemetry for Detail Chart
  const fetchChartData = useCallback(async () => {
    if (!rule) return;
    setIsLoadingChart(true);

    try {
      const res = await api.previewMetricQuery({
        metric: rule.metric,
        filters: {
          projectId: rule.projectId,
          apiId: rule.apiId || undefined,
          environmentId: rule.environmentId || undefined,
          monitorId: rule.monitorId || undefined,
        },
        timeRange: chartTimeRange,
      });
      setMetricData(res);
    } catch (err) {
      console.error('Failed to load metric data for chart:', err);
      setMetricData(null);
    } finally {
      setIsLoadingChart(false);
    }
  }, [rule, chartTimeRange]);

  useEffect(() => {
    if (rule) {
      fetchChartData();
    }
  }, [rule, chartTimeRange, fetchChartData]);

  // Derived metric definition
  const metricDef = useMemo(() => {
    if (!rule) return null;
    return metrics.find((m) => m.id === rule.metric);
  }, [rule, metrics]);

  // Active instance and state
  const activeInstance = rule?.instances?.[0];
  const currentState = useMemo(() => {
    if (!rule?.enabled) return 'DISABLED';
    if (activeInstance) return activeInstance.status;
    if (evaluations?.[0]) return evaluations[0].stateAfter;
    if (rule?.evaluations?.[0]) return rule.evaluations[0].stateAfter;
    return 'NORMAL';
  }, [rule, activeInstance, evaluations]);


  const [isEvaluatingNow, setIsEvaluatingNow] = useState(false);

  // Evaluate now handler
  const handleEvaluateNow = async () => {
    if (!rule) return;
    setIsEvaluatingNow(true);
    try {
      await api.evaluateAlertRule(rule.id);
      await loadRuleData(true);
      await fetchChartData();
    } catch (err: any) {
      console.error('Failed to evaluate rule:', err);
    } finally {
      setIsEvaluatingNow(false);
    }
  };

  // Test rule handler
  const handleTestRule = async () => {
    if (!rule) return;
    setIsTesting(true);
    setTestResult(null);

    try {
      const res = await api.testAlertRule(rule.id);
      setTestResult(res);
      // Reload evaluations after testing
      const latestEvals = await api.getAlertRuleEvaluations(rule.id, 50).catch(() => []);
      setEvaluations(latestEvals);
    } catch (err: any) {
      console.error('Test rule failed:', err);
    } finally {
      setIsTesting(false);
    }
  };


  // Toggle rule enable/disable
  const handleToggleEnable = async () => {
    if (!rule) return;
    try {
      if (rule.enabled) {
        await api.disableAlertRule(rule.id);
        setRule({ ...rule, enabled: false });
      } else {
        await api.enableAlertRule(rule.id);
        setRule({ ...rule, enabled: true });
      }
    } catch (err) {
      console.error('Failed to toggle rule state:', err);
    }
  };

  // Delete rule
  const handleDeleteRule = async () => {
    if (!rule) return;
    setIsDeleting(true);
    try {
      await api.deleteAlertRule(rule.id);
      navigate('/alert-rules');
    } catch (err) {
      console.error('Failed to delete alert rule:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  // Send test email handler
  const handleSendTestEmail = async () => {
    if (!rule) return;
    const recipients = rule.notificationConfig?.email?.recipients || [];
    if (recipients.length === 0) {
      setTestEmailFeedback({
        success: false,
        message: 'No email recipients configured for this rule. Please edit the rule to add recipients.',
      });
      return;
    }

    setIsSendingTestEmail(true);
    setTestEmailFeedback(null);
    try {
      const res = await api.sendAlertRuleTestEmail({
        recipients,
        ruleName: rule.name,
        ruleId: rule.id,
      });
      setTestEmailFeedback({
        success: res.success,
        message: res.message || 'Test email dispatched successfully.',
      });
      // Refresh deliveries
      const updatedDeliveries = await api.getAlertRuleDeliveries(rule.id, 50).catch(() => []);
      setDeliveries(updatedDeliveries);
    } catch (err: any) {
      setTestEmailFeedback({
        success: false,
        message: err?.response?.data?.message || err?.message || 'Failed to dispatch test email.',
      });
    } finally {
      setIsSendingTestEmail(false);
    }
  };

  // Format delivery time
  const formatDeliveryTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffSecs = Math.floor((now.getTime() - date.getTime()) / 1000);

    let relative = '';
    if (diffSecs < 60) relative = `${Math.max(1, diffSecs)}s ago`;
    else if (diffSecs < 3600) relative = `${Math.floor(diffSecs / 60)}m ago`;
    else if (diffSecs < 86400) relative = `${Math.floor(diffSecs / 3600)}h ago`;
    else relative = `${Math.floor(diffSecs / 86400)}d ago`;

    const formattedTime = date.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    const formattedDate = date.toLocaleDateString();

    return {
      relative,
      formattedTime,
      formattedDate,
    };
  };

  // Related Incidents
  const relatedIncidents = useMemo(() => {
    if (!rule?.instances) return [];
    const list: any[] = [];
    rule.instances.forEach((inst) => {
      inst.incidentAlerts?.forEach((ia) => {
        if (ia.incident && !list.some((item) => item.id === ia.incident.id)) {
          list.push(ia.incident);
        }
      });
    });
    return list;
  }, [rule]);


  // Format operator display
  const formatConditionOperator = (cond: string) => {
    const map: Record<string, string> = {
      GREATER_THAN: 'IS GREATER THAN',
      GREATER_THAN_OR_EQUAL: 'IS GREATER THAN OR EQUAL TO',
      LESS_THAN: 'IS LESS THAN',
      LESS_THAN_OR_EQUAL: 'IS LESS THAN OR EQUAL TO',
      EQUAL: 'IS EQUAL TO',
      NOT_EQUAL: 'IS NOT EQUAL TO',
    };
    return map[cond] || cond;
  };

  // Format duration text
  const formatDurationText = (seconds: number) => {
    if (seconds === 0) return 'Immediate (0s)';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins > 0 && secs === 0) {
      return `${mins} minute${mins > 1 ? 's' : ''}`;
    }
    if (mins > 0) {
      return `${mins}m ${secs}s`;
    }
    return `${secs} seconds`;
  };

  if (isLoading) {
    return (
      <PageContainer
        title="Alert Rule Details"
        breadcrumbs={[
          { label: 'Alert Rules', href: '/alert-rules' },
          { label: 'Loading...' },
        ]}
      >
        <div className="p-12 text-center text-xs font-mono text-muted-foreground space-y-2 border border-border bg-card">
          <span className="inline-block size-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <div>Loading alert rule configuration...</div>
        </div>
      </PageContainer>
    );
  }

  if (error || !rule) {
    return (
      <PageContainer
        title="Alert Rule"
        breadcrumbs={[
          { label: 'Alert Rules', href: '/alert-rules' },
          { label: 'Not Found' },
        ]}
      >
        <div className="p-8 border border-border bg-card text-center space-y-4">
          <p className="text-xs text-rose-400 font-mono">{error || 'Alert rule not found.'}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/alert-rules')}
            className="text-xs font-mono"
          >
            Return to alert rules
          </Button>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer
      title={rule.name}
      description={rule.description || undefined}
      breadcrumbs={[
        { label: 'Alert Rules', href: '/alert-rules' },
        { label: rule.name },
      ]}
      action={
        <div className="flex items-center gap-2">
          {/* Refresh */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              loadRuleData(true);
              fetchChartData();
            }}
            disabled={isRefreshing}
            className="text-xs font-mono gap-1.5"
            title="Refresh rule state and evaluations"
          >
            <HugeiconsIcon
              icon={ArrowReloadHorizontalIcon}
              className={`size-3.5 ${isRefreshing ? 'animate-spin' : ''}`}
            />
            <span>Refresh</span>
          </Button>

          {/* Evaluate now */}
          <Button
            variant="default"
            size="sm"
            onClick={handleEvaluateNow}
            disabled={isEvaluatingNow}
            className="text-xs font-mono gap-1.5"
            title="Evaluate live metric telemetry and update state"
          >
            <HugeiconsIcon
              icon={PlayIcon}
              className={`size-3.5 ${isEvaluatingNow ? 'animate-spin' : ''}`}
            />
            <span>{isEvaluatingNow ? 'Evaluating...' : 'Evaluate now'}</span>
          </Button>

          {/* Test rule */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleTestRule}
            disabled={isTesting}
            className="text-xs font-mono gap-1.5"
            title="Run instant evaluation"
          >
            <HugeiconsIcon
              icon={PlayIcon}
              className={`size-3.5 ${isTesting ? 'animate-spin' : ''}`}
            />
            <span>Test rule</span>
          </Button>


          {/* Edit rule */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(`/alert-rules/${rule.id}/edit`)}
            className="text-xs font-mono gap-1.5"
          >
            <HugeiconsIcon icon={Edit01Icon} className="size-3.5" />
            <span>Edit</span>
          </Button>

          {/* Enable / Disable */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleToggleEnable}
            className="text-xs font-mono"
          >
            {rule.enabled ? 'Disable' : 'Enable'}
          </Button>

          {/* Delete */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowDeleteModal(true)}
            className="text-xs font-mono text-rose-400 hover:text-rose-300"
          >
            <HugeiconsIcon icon={Delete02Icon} className="size-3.5" />
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Section 1: Rule Status Banner */}
        <div
          className={`p-4 border font-mono text-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 ${
            currentState === 'FIRING'
              ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
              : currentState === 'PENDING'
              ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
              : currentState === 'DISABLED'
              ? 'bg-muted/40 border-border text-muted-foreground'
              : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
          }`}
        >
          <div className="flex items-center gap-3">
            <span
              className={`px-2 py-0.5 font-bold uppercase tracking-wider text-[11px] border ${
                currentState === 'FIRING'
                  ? 'border-rose-500/40 bg-rose-500/20'
                  : currentState === 'PENDING'
                  ? 'border-amber-500/40 bg-amber-500/20'
                  : currentState === 'DISABLED'
                  ? 'border-border bg-muted/60'
                  : 'border-emerald-500/40 bg-emerald-500/20'
              }`}
            >
              {currentState}
            </span>

            <div>
              {currentState === 'FIRING' && activeInstance?.startedAt && (
                <span>
                  Firing since{' '}
                  <span className="font-semibold text-foreground">
                    {new Date(activeInstance.startedAt).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })}
                  </span>{' '}
                  ({new Date(activeInstance.startedAt).toLocaleDateString()})
                </span>
              )}

              {currentState === 'PENDING' && activeInstance?.pendingSince && (
                <span>
                  Pending since{' '}
                  <span className="font-semibold text-foreground">
                    {new Date(activeInstance.pendingSince).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>{' '}
                  — Waiting for {formatDurationText(rule.duration)} duration before firing
                </span>
              )}

              {currentState === 'NORMAL' && (
                <span>Normal — Condition has not been met during recent evaluations</span>
              )}

              {currentState === 'DISABLED' && (
                <span>Disabled — Rule evaluation is currently suspended</span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 text-[11px]">
            <Badge variant="outline" className="font-mono uppercase text-[10px] border-border">
              Severity: {rule.severity}
            </Badge>
            <Badge variant="outline" className="font-mono text-[10px] border-border">
              {rule.enabled ? 'Automated Evaluation: Active' : 'Automated Evaluation: Paused'}
            </Badge>
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
              <span className="font-semibold uppercase tracking-wider">Test Result:</span>
              <span>
                Observed value: {testResult.currentValue !== null ? testResult.currentValue : 'No data'} | Threshold: {testResult.threshold} | Condition met:{' '}
                {testResult.conditionMet ? 'TRUE (Would fire/transition to pending)' : 'FALSE (Healthy)'}
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

        {/* Section 2: Rule Definition Grid */}
        <div className="border border-border bg-card p-5 space-y-4">
          <div className="border-b border-border/60 pb-2">
            <h2 className="text-sm font-semibold text-foreground font-heading">
              Rule Definition
            </h2>
            <p className="text-xs text-muted-foreground">
              Technical telemetry query, boundary condition, and scope parameters.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs font-mono">
            {/* Metric */}
            <div className="p-3 bg-muted/20 border border-border/60 space-y-1">
              <span className="text-[10px] uppercase text-muted-foreground block">Metric</span>
              <span className="font-semibold text-foreground block">
                {metricDef?.name || rule.metric}
              </span>
              <span className="text-[11px] text-muted-foreground block">
                {rule.metric} ({metricDef?.unit || ''})
              </span>
            </div>

            {/* Scope */}
            <div className="p-3 bg-muted/20 border border-border/60 space-y-1">
              <span className="text-[10px] uppercase text-muted-foreground block">Scope</span>
              <span className="font-semibold text-foreground block truncate">
                {rule.project?.name || 'All Projects'}
              </span>
              <span className="text-[11px] text-muted-foreground block truncate">
                {rule.api?.name || 'All APIs'} / {rule.environment?.name || 'All Envs'}
                {rule.monitor ? ` / ${rule.monitor.name}` : ''}
              </span>
            </div>

            {/* Condition */}
            <div className="p-3 bg-muted/20 border border-border/60 space-y-1">
              <span className="text-[10px] uppercase text-muted-foreground block">Condition</span>
              <span className="font-semibold text-foreground block">
                {formatConditionOperator(rule.condition)}
              </span>
              <span className="text-[11px] text-rose-400 font-semibold block">
                {rule.threshold} {metricDef?.unit || ''}
              </span>
            </div>

            {/* Timing */}
            <div className="p-3 bg-muted/20 border border-border/60 space-y-1">
              <span className="text-[10px] uppercase text-muted-foreground block">Timing</span>
              <span className="font-semibold text-foreground block">
                For {formatDurationText(rule.duration)}
              </span>
              <span className="text-[11px] text-muted-foreground block">
                Eval every {rule.evaluationInterval || 60}s | Window {rule.labels?._evaluationWindow || '5m'}
              </span>
            </div>
          </div>

          {/* Labels Row */}
          {rule.labels && Object.keys(rule.labels).some((k) => !k.startsWith('_')) && (
            <div className="pt-2 border-t border-border/40">
              <span className="text-[10px] font-mono uppercase text-muted-foreground block mb-1.5">
                Configured Labels
              </span>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(rule.labels)
                  .filter(([k]) => !k.startsWith('_'))
                  .map(([k, v]) => (
                    <Badge
                      key={k}
                      variant="outline"
                      className="font-mono text-[11px] bg-muted/50 border-border text-foreground px-2 py-0.5"
                    >
                      <span className="text-muted-foreground">{k}</span>
                      <span className="mx-1 text-muted-foreground/60">=</span>
                      <span>{String(v)}</span>
                    </Badge>
                  ))}
              </div>
            </div>
          )}
        </div>

        {/* Section 3: Telemetry Detail Chart */}
        <div className="border border-border bg-card p-5 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-border/60 pb-2">
            <div>
              <h2 className="text-sm font-semibold text-foreground font-heading">
                Telemetry Metric Trend
              </h2>
              <p className="text-xs text-muted-foreground">
                Historical time-series telemetry with threshold boundary line.
              </p>
            </div>

            {/* Time range selector */}
            <div className="flex items-center gap-1 border border-border bg-background p-0.5 font-mono text-xs">
              {(['15m', '1h', '6h', '24h'] as const).map((range) => (
                <button
                  key={range}
                  type="button"
                  onClick={() => setChartTimeRange(range)}
                  className={`px-2 py-0.5 text-xs transition-colors ${
                    chartTimeRange === range
                      ? 'bg-muted text-foreground font-semibold'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {range}
                </button>
              ))}
            </div>
          </div>

          <div className="pt-2">
            <MetricPreviewChart
              data={metricData}
              threshold={rule.threshold}
              unit={metricDef?.unit || ''}
              metricName={metricDef?.name || rule.metric}
              isLoading={isLoadingChart}
            />
          </div>
        </div>

        {/* Section 4: Current / Related Incidents */}
        {relatedIncidents.length > 0 && (
          <div className="border border-border bg-card p-5 space-y-3">
            <div className="border-b border-border/60 pb-2">
              <h2 className="text-sm font-semibold text-foreground font-heading">
                Related Incidents
              </h2>
              <p className="text-xs text-muted-foreground">
                Incidents triggered or correlated with this alert rule.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {relatedIncidents.map((inc) => (
                <div
                  key={inc.id}
                  className="p-3 border border-border bg-muted/20 font-mono text-xs space-y-1.5 flex items-start justify-between"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <Link
                        to="/incidents"
                        className="font-semibold text-primary hover:underline"
                      >
                        INC-{inc.id.substring(0, 8)}
                      </Link>
                      <Badge
                        variant="outline"
                        className={`text-[10px] uppercase font-mono ${
                          inc.status === 'OPEN'
                            ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                            : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                        }`}
                      >
                        {inc.status}
                      </Badge>
                    </div>
                    <p className="text-muted-foreground text-[11px] line-clamp-1">{inc.title}</p>
                    <span className="text-[10px] text-muted-foreground">
                      Severity: {inc.severity} | Started: {new Date(inc.startedAt).toLocaleTimeString()}
                    </span>
                  </div>

                  <Button
                    variant="ghost"
                    size="xs"
                    onClick={() => navigate('/incidents')}
                    className="text-xs font-mono"
                  >
                    View
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Section 5: Notifications */}
        <div className="border border-border bg-card p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-border/60 pb-3">
            <div>
              <h2 className="text-sm font-semibold text-foreground font-heading flex items-center gap-2">
                <HugeiconsIcon icon={Mail01Icon} className="size-4 text-primary" />
                <span>Notifications</span>
              </h2>
              <p className="text-xs text-muted-foreground">
                Email dispatch configuration and recent delivery status.
              </p>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto">
              {rule.notificationConfig?.email?.enabled && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSendTestEmail}
                  disabled={isSendingTestEmail}
                  className="text-xs font-mono gap-1.5"
                >
                  <HugeiconsIcon
                    icon={Mail01Icon}
                    className={`size-3.5 ${isSendingTestEmail ? 'animate-spin' : ''}`}
                  />
                  <span>{isSendingTestEmail ? 'Sending test...' : 'Send test email'}</span>
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate(`/alert-rules/${rule.id}/edit`)}
                className="text-xs font-mono gap-1.5"
              >
                <HugeiconsIcon icon={Edit01Icon} className="size-3.5" />
                <span>Edit notification settings</span>
              </Button>
            </div>
          </div>

          {/* Test Email Feedback */}
          {testEmailFeedback && (
            <div
              className={`p-3 border text-xs font-mono flex items-center justify-between ${
                testEmailFeedback.success
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                  : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
              }`}
            >
              <span>{testEmailFeedback.message}</span>
              <button
                type="button"
                onClick={() => setTestEmailFeedback(null)}
                className="text-muted-foreground hover:text-foreground text-xs ml-4"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Configuration Summary Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 text-xs font-mono">
            {/* Delivery Method */}
            <div className="p-3 bg-muted/20 border border-border/60 space-y-1">
              <span className="text-[10px] uppercase text-muted-foreground block">Email</span>
              <div className="flex items-center gap-2 pt-0.5">
                <Badge
                  variant="outline"
                  className={`text-[10px] font-mono uppercase ${
                    rule.notificationConfig?.email?.enabled
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                      : 'bg-muted/60 text-muted-foreground border-border'
                  }`}
                >
                  {rule.notificationConfig?.email?.enabled ? 'Enabled' : 'Disabled'}
                </Badge>
              </div>
            </div>

            {/* Recipients */}
            <div className="p-3 bg-muted/20 border border-border/60 space-y-1">
              <span className="text-[10px] uppercase text-muted-foreground block">
                Recipients ({rule.notificationConfig?.email?.recipients?.length || 0})
              </span>
              {rule.notificationConfig?.email?.recipients && rule.notificationConfig.email.recipients.length > 0 ? (
                <div className="space-y-1 pt-0.5 max-h-24 overflow-y-auto">
                  {rule.notificationConfig.email.recipients.map((email) => (
                    <div key={email} className="text-foreground truncate font-mono text-[11px]" title={email}>
                      {email}
                    </div>
                  ))}
                </div>
              ) : (
                <span className="text-muted-foreground italic block pt-0.5 text-[11px]">
                  No recipients configured
                </span>
              )}
            </div>

            {/* Events */}
            <div className="p-3 bg-muted/20 border border-border/60 space-y-1">
              <span className="text-[10px] uppercase text-muted-foreground block">Events</span>
              <div className="space-y-1 pt-0.5 text-[11px]">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Alert firing</span>
                  <span className={rule.notificationConfig?.email?.onFiring ? 'text-emerald-400 font-semibold' : 'text-muted-foreground'}>
                    {rule.notificationConfig?.email?.onFiring ? 'Yes' : 'No'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Alert resolved</span>
                  <span className={rule.notificationConfig?.email?.onResolved ? 'text-emerald-400 font-semibold' : 'text-muted-foreground'}>
                    {rule.notificationConfig?.email?.onResolved ? 'Yes' : 'No'}
                  </span>
                </div>
                {rule.notificationConfig?.email?.repeatInterval && rule.notificationConfig.email.repeatInterval > 0 ? (
                  <div className="flex items-center justify-between pt-0.5 border-t border-border/40">
                    <span className="text-muted-foreground">Repeat every</span>
                    <span className="text-foreground">{rule.notificationConfig.email.repeatInterval}m</span>
                  </div>
                ) : null}
              </div>
            </div>

            {/* Delivery status */}
            <div className="p-3 bg-muted/20 border border-border/60 space-y-1">
              <span className="text-[10px] uppercase text-muted-foreground block">Delivery status</span>
              <div className="pt-0.5 space-y-1">
                <span className="text-[10px] text-muted-foreground block">Last notification:</span>
                {deliveries.length > 0 ? (
                  <div>
                    <span className="font-semibold text-foreground block">
                      Sent {formatDeliveryTime(deliveries[0].createdAt).relative}
                    </span>
                    <span className="text-[10px] text-muted-foreground block truncate">
                      {deliveries[0].recipient || 'Recipient'} ({deliveries[0].status})
                    </span>
                  </div>
                ) : (
                  <span className="text-muted-foreground italic text-[11px] block">
                    Never sent
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Recent deliveries sub-table */}
          <div className="pt-2">
            <div className="border-b border-border/40 pb-1.5 mb-2 flex items-center justify-between">
              <span className="text-xs font-semibold text-foreground font-mono">
                Recent deliveries
              </span>
              <span className="text-[11px] font-mono text-muted-foreground">
                Showing {deliveries.length} delivery record{deliveries.length === 1 ? '' : 's'}
              </span>
            </div>

            {deliveries.length === 0 ? (
              <div className="p-6 border border-dashed border-border text-center text-xs text-muted-foreground font-mono">
                No notification deliveries recorded yet.
              </div>
            ) : (
              <div className="border border-border bg-background overflow-hidden">
                <Table>
                  <TableHeader className="bg-muted/40">
                    <TableRow className="border-border hover:bg-transparent">
                      <TableHead className="text-[11px] font-mono uppercase text-muted-foreground h-8">Time</TableHead>
                      <TableHead className="text-[11px] font-mono uppercase text-muted-foreground h-8">Event</TableHead>
                      <TableHead className="text-[11px] font-mono uppercase text-muted-foreground h-8">Recipient</TableHead>
                      <TableHead className="text-[11px] font-mono uppercase text-muted-foreground h-8 text-right">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {deliveries.map((delivery) => {
                      const timeInfo = formatDeliveryTime(delivery.createdAt);
                      let eventLabel = 'Firing';
                      let eventClass = 'bg-rose-500/10 text-rose-400 border-rose-500/30';

                      if (delivery.eventType === 'RECOVERY' || delivery.deduplicationKey?.includes('RECOVERY')) {
                        eventLabel = 'Resolved';
                        eventClass = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
                      } else if (delivery.eventType === 'TEST' || delivery.deduplicationKey?.includes('TEST')) {
                        eventLabel = 'Test';
                        eventClass = 'bg-blue-500/10 text-blue-400 border-blue-500/30';
                      } else {
                        eventLabel = 'Firing';
                        eventClass = 'bg-rose-500/10 text-rose-400 border-rose-500/30';
                      }

                      return (
                        <TableRow key={delivery.id} className="border-border hover:bg-muted/20">
                          <TableCell className="font-mono text-xs py-2 whitespace-nowrap">
                            <span className="text-foreground">{timeInfo.formattedTime}</span>{' '}
                            <span className="text-[10px] text-muted-foreground">({timeInfo.relative})</span>
                          </TableCell>
                          <TableCell className="font-mono text-xs py-2 whitespace-nowrap">
                            <Badge variant="outline" className={`text-[10px] uppercase font-mono ${eventClass}`}>
                              {eventLabel}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-mono text-xs py-2 text-foreground max-w-[240px] truncate" title={delivery.recipient || ''}>
                            {delivery.recipient || '—'}
                          </TableCell>
                          <TableCell className="font-mono text-xs py-2 text-right whitespace-nowrap">
                            <Badge
                              variant="outline"
                              className={`text-[10px] uppercase font-mono ${
                                delivery.status === 'SENT'
                                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                  : delivery.status === 'FAILED'
                                  ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                                  : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                              }`}
                              title={delivery.errorMessage || undefined}
                            >
                              {delivery.status === 'SENT' ? 'Sent' : delivery.status === 'FAILED' ? 'Failed' : delivery.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </div>


        {/* Section 6: Evaluation History */}
        <div className="border border-border bg-card p-5 space-y-3">
          <div className="border-b border-border/60 pb-2">
            <h2 className="text-sm font-semibold text-foreground font-heading">
              Evaluation History
            </h2>
            <p className="text-xs text-muted-foreground">
              Audit log of continuous evaluation cycles evaluated by the background engine.
            </p>
          </div>

          <EvaluationHistoryTable
            evaluations={evaluations}
            unit={metricDef?.unit || ''}
            threshold={rule.threshold}
            isLoading={isRefreshing}
          />
        </div>

        {/* Section 7: Alert Instances */}
        <div className="border border-border bg-card p-5 space-y-3">
          <div className="border-b border-border/60 pb-2">
            <h2 className="text-sm font-semibold text-foreground font-heading">
              Alert Instances
            </h2>
            <p className="text-xs text-muted-foreground">
              Historical violation instances spawned when this rule met its triggering condition.
            </p>
          </div>

          <AlertInstancesTable
            instances={rule.instances || []}
            unit={metricDef?.unit || ''}
          />
        </div>
      </div>

      {/* Delete Rule Confirmation Dialog */}
      <Dialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold font-mono">
              Delete Alert Rule
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground space-y-2 pt-2">
              <p>
                Are you sure you want to delete <span className="font-semibold text-foreground">{rule.name}</span>?
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
              onClick={() => setShowDeleteModal(false)}
              disabled={isDeleting}
              className="text-xs font-mono"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={handleDeleteRule}
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

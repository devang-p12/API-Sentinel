import { useState, useEffect } from 'react';
import {
  api,
  type AlertRule,
  type AlertCondition,
  type AlertSeverity,
  type Api,
  type Environment,
  type Monitor,
  type MetricDefinition,
  type Project,
} from '@/lib/api';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  AlertCircleIcon,
  PlayIcon,
  Add01Icon,
  Delete02Icon,
} from '@hugeicons/core-free-icons';

interface CreateAlertRuleSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData?: Partial<AlertRule> | null;
  onSuccess: (rule: AlertRule) => void;
}

const DEFAULT_METRICS: Array<{ id: string; name: string; unit: string; description: string }> = [
  { id: 'availability', name: 'Availability SLA', unit: '%', description: 'Percentage of successful probes' },
  { id: 'success_rate', name: 'Success Rate', unit: '%', description: 'Ratio of 2xx/3xx HTTP responses' },
  { id: 'error_rate', name: 'Error Rate', unit: '%', description: 'Ratio of 4xx/5xx responses' },
  { id: 'p95_latency', name: 'p95 Latency', unit: 'ms', description: '95th percentile response time' },
  { id: 'p99_latency', name: 'p99 Latency', unit: 'ms', description: '99th percentile response time' },
  { id: 'p50_latency', name: 'p50 Latency (Median)', unit: 'ms', description: 'Median response time' },
  { id: 'average_latency', name: 'Average Latency', unit: 'ms', description: 'Arithmetic mean latency' },
  { id: 'min_latency', name: 'Minimum Latency', unit: 'ms', description: 'Lowest recorded latency' },
  { id: 'max_latency', name: 'Maximum Latency', unit: 'ms', description: 'Highest recorded latency' },
  { id: 'request_count', name: 'Request Count', unit: 'count', description: 'Total probes executed' },
  { id: 'timeout_count', name: 'Timeout Count', unit: 'count', description: 'Probes that exceeded execution timeout' },
  { id: 'failure_count', name: 'Failure Count', unit: 'count', description: 'Probes with network/TLS/HTTP failures' },
];

export function CreateAlertRuleSheet({
  open,
  onOpenChange,
  initialData,
  onSuccess,
}: CreateAlertRuleSheetProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [apis, setApis] = useState<Api[]>([]);
  const [environments, setEnvironments] = useState<Environment[]>([]);
  const [monitors, setMonitors] = useState<Monitor[]>([]);
  const [catalog, setCatalog] = useState<MetricDefinition[]>([]);

  // Form states
  const [projectId, setProjectId] = useState<string>('');
  const [name, setName] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [metric, setMetric] = useState<string>('p95_latency');
  const [apiId, setApiId] = useState<string>('');
  const [environmentId, setEnvironmentId] = useState<string>('');
  const [monitorId, setMonitorId] = useState<string>('');
  const [condition, setCondition] = useState<AlertCondition>('GREATER_THAN');
  const [threshold, setThreshold] = useState<number>(1000);
  const [duration, setDuration] = useState<number>(60); // 1 minute default
  const [evaluationInterval, setEvaluationInterval] = useState<number>(30); // 30 seconds
  const [severity, setSeverity] = useState<AlertSeverity>('WARNING');
  const [enabled, setEnabled] = useState<boolean>(true);
  const [labels, setLabels] = useState<Array<{ key: string; value: string }>>([
    { key: 'team', value: 'backend' },
    { key: 'service', value: 'api' },
  ]);

  // Loading & Test states
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{
    metric: string;
    currentValue: number | null;
    condition: string;
    threshold: number;
    conditionMet: boolean;
    wouldTransitionTo: string;
  } | null>(null);
  const [isTesting, setIsTesting] = useState<boolean>(false);

  // Load dropdown resources
  useEffect(() => {
    if (!open) return;
    const loadResources = async () => {
      try {
        const [projs, apisList, envsList, monsList, catList] = await Promise.all([
          api.getProjects().catch(() => []),
          api.getApis().catch(() => []),
          api.getEnvironments().catch(() => []),
          api.getMonitors().catch(() => []),
          api.getMetricCatalog().catch(() => []),
        ]);
        setProjects(projs);
        setApis(apisList);
        setEnvironments(envsList);
        setMonitors(monsList);
        setCatalog(catList);

        if (projs.length > 0 && !projectId) {
          setProjectId(projs[0].id);
        }
      } catch (err) {
        console.error('Failed to load resources:', err);
      }
    };
    loadResources();
  }, [open]);

  // Pre-fill form when initialData changes or opened
  useEffect(() => {
    if (initialData) {
      if (initialData.projectId) setProjectId(initialData.projectId);
      if (initialData.name) setName(initialData.name);
      if (initialData.description) setDescription(initialData.description);
      if (initialData.metric) setMetric(initialData.metric);
      if (initialData.apiId) setApiId(initialData.apiId);
      if (initialData.environmentId) setEnvironmentId(initialData.environmentId);
      if (initialData.monitorId) setMonitorId(initialData.monitorId);
      if (initialData.condition) setCondition(initialData.condition);
      if (initialData.threshold !== undefined) setThreshold(initialData.threshold);
      if (initialData.duration !== undefined) setDuration(initialData.duration);
      if (initialData.evaluationInterval !== undefined) setEvaluationInterval(initialData.evaluationInterval);
      if (initialData.severity) setSeverity(initialData.severity);
      if (initialData.enabled !== undefined) setEnabled(initialData.enabled);

      if (initialData.labels && typeof initialData.labels === 'object') {
        const entries = Object.entries(initialData.labels).map(([key, value]) => ({
          key,
          value: String(value),
        }));
        if (entries.length > 0) setLabels(entries);
      }
    } else {
      // Defaults
      setName('');
      setDescription('');
      setMetric('p95_latency');
      setCondition('GREATER_THAN');
      setThreshold(1000);
      setDuration(60);
      setEvaluationInterval(30);
      setSeverity('WARNING');
      setEnabled(true);
      setTestResult(null);
      setErrorMsg(null);
    }
  }, [initialData, open]);

  // Handle key-value labels
  const handleAddLabel = () => {
    setLabels([...labels, { key: '', value: '' }]);
  };

  const handleUpdateLabel = (index: number, key: string, value: string) => {
    const updated = [...labels];
    updated[index] = { key, value };
    setLabels(updated);
  };

  const handleRemoveLabel = (index: number) => {
    setLabels(labels.filter((_, i) => i !== index));
  };

  // Convert label pairs to object
  const buildLabelsObject = () => {
    const obj: Record<string, string> = {};
    for (const item of labels) {
      if (item.key.trim()) {
        obj[item.key.trim()] = item.value.trim();
      }
    }
    return obj;
  };

  // Test live rule if it has an id
  const handleTestExisting = async () => {
    if (!initialData?.id) return;
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await api.testAlertRule(initialData.id);
      setTestResult(res);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to evaluate test');
    } finally {
      setIsTesting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg('Rule name is required');
      return;
    }
    if (!projectId && projects.length > 0) {
      setProjectId(projects[0].id);
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    const payload: Partial<AlertRule> = {
      projectId: projectId || projects[0]?.id,
      name: name.trim(),
      description: description.trim() || undefined,
      metric,
      apiId: apiId || undefined,
      environmentId: environmentId || undefined,
      monitorId: monitorId || undefined,
      condition,
      threshold: Number(threshold),
      duration: Number(duration),
      evaluationInterval: Number(evaluationInterval),
      severity,
      labels: buildLabelsObject(),
      enabled,
    };

    try {
      let saved: AlertRule;
      if (initialData?.id) {
        saved = await api.updateAlertRule(initialData.id, payload);
      } else {
        saved = await api.createAlertRule(payload);
      }
      onSuccess(saved);
      onOpenChange(false);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to save alert rule');
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedMetricDef =
    DEFAULT_METRICS.find((m) => m.id === metric) ||
    catalog.find((c) => c.id === metric) || {
      id: metric,
      name: metric,
      unit: '',
      description: '',
    };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-xl bg-card border-border overflow-y-auto p-4 sm:p-6"
      >
        <SheetHeader className="text-left border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded bg-primary/10 text-primary">
              <HugeiconsIcon icon={AlertCircleIcon} className="size-4" />
            </div>
            <div>
              <SheetTitle className="text-sm font-semibold">
                {initialData?.id ? 'Edit Alert Rule' : 'Create Alert Rule'}
              </SheetTitle>
              <SheetDescription className="text-xs text-muted-foreground">
                Define metric threshold conditions and pending durations for stateful alerts.
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        {errorMsg && (
          <div className="mt-4 p-2.5 bg-destructive/10 border border-destructive/20 text-destructive text-xs rounded">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="py-4 space-y-5 text-xs">
          {/* Rule Name & Description */}
          <div className="space-y-3">
            <div>
              <label className="block text-[11px] font-semibold text-foreground mb-1">
                Rule Name <span className="text-destructive">*</span>
              </label>
              <Input
                placeholder="e.g. Production Payment API High Latency"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="text-xs"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-muted-foreground mb-1">
                Description (Optional)
              </label>
              <Input
                placeholder="Triggers when p95 response time exceeds 1000ms for over 2 minutes"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="text-xs"
              />
            </div>
          </div>

          {/* Scope Filters */}
          <div className="p-3 bg-muted/20 border border-border space-y-3">
            <span className="block text-[11px] font-semibold text-foreground">
              Scope & Dimensions
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div>
                <label className="block text-[10px] text-muted-foreground mb-1">API Filter</label>
                <select
                  value={apiId}
                  onChange={(e) => setApiId(e.target.value)}
                  className="w-full h-8 px-2 bg-background border border-border text-foreground rounded text-xs"
                >
                  <option value="">All APIs</option>
                  {apis.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] text-muted-foreground mb-1">Environment</label>
                <select
                  value={environmentId}
                  onChange={(e) => setEnvironmentId(e.target.value)}
                  className="w-full h-8 px-2 bg-background border border-border text-foreground rounded text-xs"
                >
                  <option value="">All Environments</option>
                  {environments.map((env) => (
                    <option key={env.id} value={env.id}>
                      {env.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] text-muted-foreground mb-1">Monitor</label>
                <select
                  value={monitorId}
                  onChange={(e) => setMonitorId(e.target.value)}
                  className="w-full h-8 px-2 bg-background border border-border text-foreground rounded text-xs"
                >
                  <option value="">All Monitors</option>
                  {monitors
                    .filter(
                      (m) =>
                        (!apiId || (m.environment as any)?.apiId === apiId || m.environment?.api?.id === apiId) &&
                        (!environmentId || m.environmentId === environmentId),
                    )
                    .map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                </select>
              </div>
            </div>
          </div>

          {/* Condition Builder */}
          <div className="p-3 bg-muted/20 border border-border space-y-3">
            <span className="block text-[11px] font-semibold text-foreground">
              Condition Expression
            </span>

            <div className="space-y-2">
              <div>
                <label className="block text-[10px] text-muted-foreground mb-1">Metric</label>
                <select
                  value={metric}
                  onChange={(e) => setMetric(e.target.value)}
                  className="w-full h-8 px-2 bg-background border border-border text-foreground rounded text-xs font-mono"
                >
                  {DEFAULT_METRICS.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.id})
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {selectedMetricDef.description}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] text-muted-foreground mb-1">Condition</label>
                  <select
                    value={condition}
                    onChange={(e) => setCondition(e.target.value as AlertCondition)}
                    className="w-full h-8 px-2 bg-background border border-border text-foreground rounded text-xs font-mono"
                  >
                    <option value="GREATER_THAN">Is Above (&gt;)</option>
                    <option value="GREATER_THAN_OR_EQUAL">Is Above or Equal (&gt;=)</option>
                    <option value="LESS_THAN">Is Below (&lt;)</option>
                    <option value="LESS_THAN_OR_EQUAL">Is Below or Equal (&lt;=)</option>
                    <option value="EQUAL">Is Exactly (==)</option>
                    <option value="NOT_EQUAL">Is Not Equal (!=)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] text-muted-foreground mb-1">
                    Threshold ({selectedMetricDef.unit || 'value'})
                  </label>
                  <Input
                    type="number"
                    step="any"
                    value={threshold}
                    onChange={(e) => setThreshold(parseFloat(e.target.value) || 0)}
                    required
                    className="text-xs font-mono"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Timing & Evaluation: FOR duration and interval */}
          <div className="grid grid-cols-2 gap-3 p-3 bg-muted/20 border border-border">
            <div>
              <label className="block text-[11px] font-semibold text-foreground mb-1">
                FOR Duration (Pending)
              </label>
              <select
                value={duration}
                onChange={(e) => setDuration(parseInt(e.target.value, 10))}
                className="w-full h-8 px-2 bg-background border border-border text-foreground rounded text-xs font-mono"
              >
                <option value="0">0 seconds (Immediate firing)</option>
                <option value="30">30 seconds</option>
                <option value="60">1 minute</option>
                <option value="120">2 minutes</option>
                <option value="300">5 minutes</option>
                <option value="600">10 minutes</option>
              </select>
              <p className="text-[10px] text-muted-foreground mt-1">
                Condition must remain true for this duration before firing. Prevents spike noise.
              </p>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-foreground mb-1">
                Evaluation Interval
              </label>
              <select
                value={evaluationInterval}
                onChange={(e) => setEvaluationInterval(parseInt(e.target.value, 10))}
                className="w-full h-8 px-2 bg-background border border-border text-foreground rounded text-xs font-mono"
              >
                <option value="15">Every 15 seconds</option>
                <option value="30">Every 30 seconds</option>
                <option value="60">Every 1 minute</option>
                <option value="300">Every 5 minutes</option>
              </select>
              <p className="text-[10px] text-muted-foreground mt-1">
                How often the alert evaluator calculates the metric.
              </p>
            </div>
          </div>

          {/* Severity & Status */}
          <div className="grid grid-cols-2 gap-3 p-3 bg-muted/20 border border-border">
            <div>
              <label className="block text-[11px] font-semibold text-foreground mb-1">Severity</label>
              <select
                value={severity}
                onChange={(e) => setSeverity(e.target.value as AlertSeverity)}
                className="w-full h-8 px-2 bg-background border border-border text-foreground rounded text-xs font-semibold"
              >
                <option value="CRITICAL">CRITICAL</option>
                <option value="HIGH">HIGH</option>
                <option value="WARNING">WARNING</option>
                <option value="INFO">INFO</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-foreground mb-1">Rule State</label>
              <div className="flex items-center gap-2 mt-1.5">
                <input
                  type="checkbox"
                  id="rule-enabled"
                  checked={enabled}
                  onChange={(e) => setEnabled(e.target.checked)}
                  className="rounded border-border"
                />
                <label htmlFor="rule-enabled" className="text-xs text-foreground cursor-pointer">
                  {enabled ? 'Active / Enabled' : 'Paused / Disabled'}
                </label>
              </div>
            </div>
          </div>

          {/* Labels Section */}
          <div className="p-3 bg-muted/20 border border-border space-y-2">
            <div className="flex items-center justify-between">
              <span className="block text-[11px] font-semibold text-foreground">
                Labels (Key / Value)
              </span>
              <Button
                type="button"
                variant="outline"
                size="xs"
                onClick={handleAddLabel}
                className="h-6 text-[10px] gap-1"
              >
                <HugeiconsIcon icon={Add01Icon} className="size-3" />
                <span>Add Label</span>
              </Button>
            </div>

            {labels.map((item, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <Input
                  placeholder="key"
                  value={item.key}
                  onChange={(e) => handleUpdateLabel(idx, e.target.value, item.value)}
                  className="text-xs h-7 font-mono"
                />
                <Input
                  placeholder="value"
                  value={item.value}
                  onChange={(e) => handleUpdateLabel(idx, item.key, e.target.value)}
                  className="text-xs h-7 font-mono"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  onClick={() => handleRemoveLabel(idx)}
                  className="size-7 p-0 text-muted-foreground hover:text-destructive shrink-0"
                >
                  <HugeiconsIcon icon={Delete02Icon} className="size-3.5" />
                </Button>
              </div>
            ))}
          </div>

          {/* Dry Run / Test Section (Available for existing saved rules) */}
          {initialData?.id && (
            <div className="p-3 bg-muted/30 border border-border space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <span className="block text-[11px] font-semibold text-foreground">
                    Dry Run Live Data Evaluation
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    Evaluate metric and state without creating an active incident.
                  </span>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  disabled={isTesting}
                  onClick={handleTestExisting}
                  className="h-7 gap-1 font-mono text-[11px]"
                >
                  <HugeiconsIcon icon={PlayIcon} className="size-3 text-primary" />
                  <span>{isTesting ? 'Testing...' : 'Test Rule'}</span>
                </Button>
              </div>

              {testResult && (
                <div className="p-2.5 rounded bg-card border border-border text-[11px] font-mono space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Current Metric Value:</span>
                    <span className="font-semibold text-foreground">
                      {testResult.currentValue !== null ? `${testResult.currentValue}` : 'No Data'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Condition Met:</span>
                    <Badge
                      variant={testResult.conditionMet ? 'destructive' : 'outline'}
                      className="text-[10px] font-mono uppercase"
                    >
                      {testResult.conditionMet ? 'VIOLATION (True)' : 'NORMAL (False)'}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Would Transition To:</span>
                    <Badge variant="outline" className="text-[10px] font-mono">
                      {testResult.wouldTransitionTo}
                    </Badge>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="pt-2 flex items-center justify-end gap-2 border-t border-border">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting}
              className="gap-1.5"
            >
              {isSubmitting ? (
                <span>Saving...</span>
              ) : (
                <span>{initialData?.id ? 'Update Rule' : 'Create Alert Rule'}</span>
              )}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}

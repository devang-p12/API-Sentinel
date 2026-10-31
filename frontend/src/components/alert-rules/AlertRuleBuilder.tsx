import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  api,
  type AlertRule,
  type AlertCondition,
  type AlertSeverity,
  type MetricDefinition,
  type MetricQueryResult,
  type AlertRuleNotificationConfig,
  type Project,
  type Api,
  type Environment,
  type Monitor,
} from '@/lib/api';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { MetricSelector } from './MetricSelector';
import { ScopeSelector } from './ScopeSelector';
import { AggregationSelector } from './AggregationSelector';
import { ConditionBuilder } from './ConditionBuilder';
import { EvaluationTimingSelector } from './EvaluationTimingSelector';
import { SeveritySelector } from './SeveritySelector';
import { LabelEditor } from './LabelEditor';
import { NotificationConfigEditor } from './NotificationConfigEditor';
import { RulePreview } from './RulePreview';

interface AlertRuleBuilderProps {
  initialData?: Partial<AlertRule>;
  isEditing?: boolean;
  ruleId?: string;
  onSuccess: (rule: AlertRule) => void;
  onCancel: () => void;
}

export function AlertRuleBuilder({
  initialData,
  isEditing = false,
  ruleId,
  onSuccess,
  onCancel,
}: AlertRuleBuilderProps) {
  // Domain catalogs
  const [metrics, setMetrics] = useState<MetricDefinition[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [apis, setApis] = useState<Api[]>([]);
  const [environments, setEnvironments] = useState<Environment[]>([]);
  const [monitors, setMonitors] = useState<Monitor[]>([]);
  const [isLoadingCatalogs, setIsLoadingCatalogs] = useState(true);

  // Form state
  const [name, setName] = useState(initialData?.name || '');
  const [description, setDescription] = useState(initialData?.description || '');
  const [projectId, setProjectId] = useState(initialData?.projectId || '');
  const [apiId, setApiId] = useState(initialData?.apiId || '');
  const [environmentId, setEnvironmentId] = useState(initialData?.environmentId || '');
  const [monitorId, setMonitorId] = useState(initialData?.monitorId || '');
  const [metric, setMetric] = useState(initialData?.metric || 'p95_latency');
  const [aggregation, setAggregation] = useState('p95');
  const [condition, setCondition] = useState<AlertCondition>(initialData?.condition || 'GREATER_THAN');
  const [threshold, setThreshold] = useState<number>(initialData?.threshold ?? 1000);
  const [evaluationWindow, setEvaluationWindow] = useState('5m');
  const [forDuration, setForDuration] = useState<number>(initialData?.duration ?? 120);
  const [evaluationInterval, setEvaluationInterval] = useState<number>(initialData?.evaluationInterval ?? 60);
  const [severity, setSeverity] = useState<AlertSeverity>(initialData?.severity || 'WARNING');
  const [labels, setLabels] = useState<Record<string, string>>(() => {
    if (initialData?.labels && typeof initialData.labels === 'object') {
      const clean: Record<string, string> = {};
      Object.entries(initialData.labels).forEach(([k, v]) => {
        if (!k.startsWith('_')) clean[k] = String(v);
      });
      return clean;
    }
    return {};
  });
  const [enabled, setEnabled] = useState(initialData?.enabled ?? true);
  const [notificationConfig, setNotificationConfig] = useState<AlertRuleNotificationConfig>(() => {
    return (
      initialData?.notificationConfig || {
        email: {
          enabled: true,
          recipients: [],
          onFiring: true,
          onResolved: true,
          repeatInterval: 0,
        },
      }
    );
  });

  // Advanced section collapsible
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Validation errors
  const [errors, setErrors] = useState<{
    name?: string;
    projectId?: string;
    metric?: string;
    threshold?: string;
    recipients?: string;
  }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Live metric query telemetry preview state
  const [metricData, setMetricData] = useState<MetricQueryResult | null>(null);
  const [isLoadingMetricData, setIsLoadingMetricData] = useState(false);
  const [metricError, setMetricError] = useState<string | null>(null);

  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load catalogs on mount
  useEffect(() => {
    let isMounted = true;
    async function loadCatalogs() {
      try {
        const [metricCatalog, projs, apisList, envsList, monsList] = await Promise.all([
          api.getMetricCatalog().catch(() => []),
          api.getProjects().catch(() => []),
          api.getApis().catch(() => []),
          api.getEnvironments().catch(() => []),
          api.getMonitors().catch(() => []),
        ]);

        if (!isMounted) return;

        setMetrics(metricCatalog);
        setProjects(projs);
        setApis(apisList);
        setEnvironments(envsList);
        setMonitors(monsList);

        // Auto-select first project if not editing and no project selected
        if (!initialData?.projectId && projs.length > 0) {
          setProjectId(projs[0].id);
        }
      } catch (err: any) {
        if (isMounted) {
          console.error('Failed to load catalogs for alert rule builder:', err);
        }
      } finally {
        if (isMounted) setIsLoadingCatalogs(false);
      }
    }

    loadCatalogs();
    return () => {
      isMounted = false;
    };
  }, [initialData]);

  // Derived selected names for preview
  const selectedMetricObj = useMemo(() => {
    return metrics.find((m) => m.id === metric);
  }, [metrics, metric]);

  const selectedProjectObj = useMemo(() => {
    return projects.find((p) => p.id === projectId);
  }, [projects, projectId]);

  const selectedApiObj = useMemo(() => {
    return apis.find((a) => a.id === apiId);
  }, [apis, apiId]);

  const selectedEnvObj = useMemo(() => {
    return environments.find((e) => e.id === environmentId);
  }, [environments, environmentId]);

  const selectedMonObj = useMemo(() => {
    return monitors.find((m) => m.id === monitorId);
  }, [monitors, monitorId]);

  // Query live telemetry preview whenever metric, scope, or evaluation window changes (Debounced 300ms)
  const fetchMetricTelemetry = useCallback(async () => {
    if (!metric) return;

    setIsLoadingMetricData(true);
    setMetricError(null);

    try {
      const result = await api.previewMetricQuery({
        metric,
        filters: {
          projectId: projectId || undefined,
          apiId: apiId || undefined,
          environmentId: environmentId || undefined,
          monitorId: monitorId || undefined,
        },
        timeRange: evaluationWindow,
      });
      setMetricData(result);
    } catch (err: any) {
      setMetricError(err?.message || 'Unable to fetch historical telemetry');
      setMetricData(null);
    } finally {
      setIsLoadingMetricData(false);
    }
  }, [metric, projectId, apiId, environmentId, monitorId, evaluationWindow]);

  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      fetchMetricTelemetry();
    }, 300);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [fetchMetricTelemetry]);

  // Validation
  const validateForm = () => {
    const errs: typeof errors = {};
    if (!name.trim()) errs.name = 'Rule name is required.';
    if (!projectId) errs.projectId = 'Project scope is required.';
    if (!metric) errs.metric = 'Metric selection is required.';
    if (threshold === undefined || isNaN(threshold)) errs.threshold = 'Valid numeric threshold is required.';

    if (notificationConfig.email?.enabled) {
      if (!notificationConfig.email.recipients || notificationConfig.email.recipients.length === 0) {
        errs.recipients = 'Add at least one email recipient.';
      }
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // Submit handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      // Store evaluation window and aggregation in labels with leading underscore to preserve full intent
      const fullLabels: Record<string, any> = {
        ...labels,
        _evaluationWindow: evaluationWindow,
        _aggregation: aggregation,
      };

      const payload: Partial<AlertRule> = {
        name: name.trim(),
        description: description.trim() || null,
        projectId,
        metric,
        apiId: apiId || null,
        environmentId: environmentId || null,
        monitorId: monitorId || null,
        condition,
        threshold: Number(threshold),
        duration: Number(forDuration),
        evaluationInterval: Number(evaluationInterval),
        severity,
        labels: fullLabels,
        notificationConfig,
        enabled,
      };

      let result: AlertRule;
      if (isEditing && ruleId) {
        result = await api.updateAlertRule(ruleId, payload);
      } else {
        result = await api.createAlertRule(payload);
      }

      onSuccess(result);
    } catch (err: any) {
      setSubmitError(err?.message || 'Failed to persist alert rule. Please check the inputs.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoadingCatalogs) {
    return (
      <div className="flex flex-col items-center justify-center p-16 border border-border rounded-lg bg-card text-muted-foreground font-mono text-xs">
        <div className="h-5 w-5 border-2 border-primary border-t-transparent rounded-full animate-spin mb-3" />
        <span>Loading observability schema & metric catalog...</span>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {submitError && (
        <div className="p-3.5 border border-destructive/40 bg-destructive/10 rounded-md text-xs text-destructive font-mono">
          {submitError}
        </div>
      )}

      {/* Main 2-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Configuration Forms (7 cols) */}
        <div className="lg:col-span-7 space-y-8">
          {/* Section 1: Name and Description */}
          <div className="rounded-lg border border-border bg-card p-5 space-y-4 shadow-sm">
            <div className="border-b border-border/50 pb-2">
              <h2 className="text-sm font-semibold text-foreground">1. Rule Definition</h2>
              <p className="text-xs text-muted-foreground">
                Give this rule a descriptive operational title for on-call notification and incident summaries.
              </p>
            </div>

            <div>
              <label className="text-xs font-medium text-foreground block mb-1">
                Rule Name <span className="text-destructive">*</span>
              </label>
              <Input
                type="text"
                placeholder="e.g. High Production API Latency"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (errors.name) setErrors((prev) => ({ ...prev, name: undefined }));
                }}
                className="h-8 text-xs font-mono"
              />
              {errors.name && <p className="text-xs text-destructive mt-1">{errors.name}</p>}
            </div>

            <div>
              <label className="text-xs font-medium text-foreground block mb-1">
                Description
              </label>
              <Input
                type="text"
                placeholder="Alert when production API latency remains above the acceptable threshold."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="h-8 text-xs"
              />
            </div>
          </div>

          {/* Section 2: Metric Selection */}
          <div className="rounded-lg border border-border bg-card p-5 space-y-4 shadow-sm">
            <div className="border-b border-border/50 pb-2">
              <h2 className="text-sm font-semibold text-foreground">2. Metric Selection</h2>
              <p className="text-xs text-muted-foreground">
                Select the telemetry metric to observe from the API Sentinel Metric Registry.
              </p>
            </div>

            <MetricSelector
              metrics={metrics}
              selectedMetricId={metric}
              onSelect={(mDef) => {
                setMetric(mDef.id);
                // Set default sensible threshold for common metrics
                if (mDef.id.includes('latency')) setThreshold(1000);
                else if (mDef.id.includes('error_rate')) setThreshold(5);
                else if (mDef.id.includes('availability')) setThreshold(99);
                if (errors.metric) setErrors((prev) => ({ ...prev, metric: undefined }));
              }}
              error={errors.metric}
            />
          </div>

          {/* Section 3: Scope Hierarchy */}
          <div className="rounded-lg border border-border bg-card p-5 space-y-4 shadow-sm">
            <div className="border-b border-border/50 pb-2">
              <h2 className="text-sm font-semibold text-foreground">3. Scope Hierarchy</h2>
              <p className="text-xs text-muted-foreground">
                Narrow down the target boundary to a specific API, Environment, or Monitor.
              </p>
            </div>

            <ScopeSelector
              projects={projects}
              apis={apis}
              environments={environments}
              monitors={monitors}
              projectId={projectId}
              apiId={apiId}
              environmentId={environmentId}
              monitorId={monitorId}
              onChange={(newScope) => {
                setProjectId(newScope.projectId);
                setApiId(newScope.apiId);
                setEnvironmentId(newScope.environmentId);
                setMonitorId(newScope.monitorId);
                if (errors.projectId) setErrors((prev) => ({ ...prev, projectId: undefined }));
              }}
              errors={{ projectId: errors.projectId }}
            />
          </div>

          {/* Section 4: Aggregation & Condition */}
          <div className="rounded-lg border border-border bg-card p-5 space-y-4 shadow-sm">
            <div className="border-b border-border/50 pb-2">
              <h2 className="text-sm font-semibold text-foreground">4. Condition & Threshold</h2>
              <p className="text-xs text-muted-foreground">
                Configure the mathematical assertion and threshold value.
              </p>
            </div>

            <AggregationSelector
              metricId={metric}
              metricCategory={selectedMetricObj?.category}
              aggregation={aggregation}
              onChange={setAggregation}
            />

            <ConditionBuilder
              metricName={selectedMetricObj?.name || metric}
              metricUnit={selectedMetricObj?.unit || ''}
              condition={condition}
              threshold={threshold}
              onConditionChange={setCondition}
              onThresholdChange={(newThresh) => {
                setThreshold(newThresh);
                if (errors.threshold) setErrors((prev) => ({ ...prev, threshold: undefined }));
              }}
              error={errors.threshold}
            />
          </div>

          {/* Section 5: Evaluation Timing & For Duration */}
          <div className="rounded-lg border border-border bg-card p-5 space-y-4 shadow-sm">
            <div className="border-b border-border/50 pb-2">
              <h2 className="text-sm font-semibold text-foreground">5. Evaluation Windows & Pending State</h2>
              <p className="text-xs text-muted-foreground">
                Define the aggregation window and the duration the condition must persist before firing.
              </p>
            </div>

            <EvaluationTimingSelector
              evaluationWindow={evaluationWindow}
              forDuration={forDuration}
              evaluationInterval={evaluationInterval}
              onEvaluationWindowChange={setEvaluationWindow}
              onForDurationChange={setForDuration}
              onEvaluationIntervalChange={setEvaluationInterval}
            />
          </div>

          {/* Section 6: Severity */}
          <div className="rounded-lg border border-border bg-card p-5 space-y-4 shadow-sm">
            <div className="border-b border-border/50 pb-2">
              <h2 className="text-sm font-semibold text-foreground">6. Severity</h2>
              <p className="text-xs text-muted-foreground">
                Set the operational classification for incident tracking and routing.
              </p>
            </div>

            <SeveritySelector value={severity} onChange={setSeverity} />
          </div>

          {/* Section 7: Labels */}
          <div className="rounded-lg border border-border bg-card p-5 space-y-4 shadow-sm">
            <div className="border-b border-border/50 pb-2">
              <h2 className="text-sm font-semibold text-foreground">7. Notification Labels</h2>
              <p className="text-xs text-muted-foreground">
                Dimension tags evaluated by Notification Policies (e.g. team=backend, tier=critical).
              </p>
            </div>

            <LabelEditor labels={labels} onChange={setLabels} />
          </div>

          {/* Section 8: Notification Delivery */}
          <div className="rounded-lg border border-border bg-card p-5 space-y-4 shadow-sm">
            <div className="border-b border-border/50 pb-2">
              <h2 className="text-sm font-semibold text-foreground">8. Notification</h2>
              <p className="text-xs text-muted-foreground">
                Choose where notifications for this alert rule are delivered.
              </p>
            </div>

            <NotificationConfigEditor
              value={notificationConfig}
              onChange={setNotificationConfig}
              ruleName={name}
              ruleId={ruleId}
              error={errors.recipients}
            />
          </div>

          {/* Section 9: Advanced Settings (Collapsible) */}
          <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="w-full flex items-center justify-between text-xs font-semibold text-foreground font-mono"
            >
              <span>Advanced settings</span>
              <span className="text-muted-foreground">{showAdvanced ? '▲ Hide' : '▼ Show'}</span>
            </button>

            {showAdvanced && (
              <div className="mt-4 pt-4 border-t border-border/60 space-y-3 text-xs">
                <div className="flex items-center justify-between py-1">
                  <div>
                    <label className="font-medium text-foreground block">Active Rule State</label>
                    <span className="text-muted-foreground text-[11px]">
                      Enable continuous automated evaluation by the background scheduler.
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={enabled}
                    onChange={(e) => setEnabled(e.target.checked)}
                    className="h-4 w-4 rounded border-border"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Bottom Action Bar */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
            <Button type="button" variant="outline" size="sm" onClick={onCancel} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={isSubmitting} className="font-mono text-xs">
              {isSubmitting ? 'Saving rule...' : isEditing ? 'Save changes' : 'Create rule'}
            </Button>
          </div>
        </div>

        {/* Right Column: Live Sticky Rule Preview (5 cols) */}
        <div className="lg:col-span-5">
          <RulePreview
            name={name}
            description={description}
            metricName={selectedMetricObj?.name || metric}
            metricId={metric}
            metricUnit={selectedMetricObj?.unit || ''}
            projectName={selectedProjectObj?.name || ''}
            apiName={selectedApiObj?.name || ''}
            environmentName={selectedEnvObj?.name || ''}
            monitorName={selectedMonObj?.name || ''}
            condition={condition}
            threshold={threshold}
            forDuration={forDuration}
            evaluationWindow={evaluationWindow}
            severity={severity}
            labels={labels}
            notificationConfig={notificationConfig}
            metricData={metricData}
            isLoadingMetricData={isLoadingMetricData}
            metricError={metricError}
          />
        </div>
      </div>
    </form>
  );
}

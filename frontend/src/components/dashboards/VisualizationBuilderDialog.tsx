import { useState, useEffect, useMemo, type FormEvent } from 'react';
import {
  api,
  type MetricDefinition,
  type MetricQueryResult,
  type DashboardWidget,
  type Api,
  type Environment,
  type Monitor,
} from '@/lib/api';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { WidgetRenderer } from './renderers/WidgetRenderer';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  ChartLineData01Icon,
  PieChartIcon,
  Table01Icon,
  DashboardSpeed01Icon,
  ViewIcon,
  RefreshIcon,
  CircleLock02Icon,
} from '@hugeicons/core-free-icons';

interface VisualizationBuilderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialWidget?: DashboardWidget | null;
  projectId?: string;
  onSave: (data: {
    title: string;
    metric: string;
    visualizationType: string;
    configuration: Record<string, any>;
    width: number;
    height: number;
  }) => Promise<void>;
}

export function VisualizationBuilderDialog({
  open,
  onOpenChange,
  initialWidget,
  projectId,
  onSave,
}: VisualizationBuilderDialogProps) {
  const [catalog, setCatalog] = useState<MetricDefinition[]>([]);
  const [apis, setApis] = useState<Api[]>([]);
  const [environments, setEnvironments] = useState<Environment[]>([]);
  const [monitors, setMonitors] = useState<Monitor[]>([]);

  // Form states
  const [title, setTitle] = useState('');
  const [metric, setMetric] = useState('availability');
  const [visualizationType, setVisualizationType] = useState('stat');
  const [apiId, setApiId] = useState('');
  const [environmentId, setEnvironmentId] = useState('');
  const [monitorId, setMonitorId] = useState('');
  const [timeRange, setTimeRange] = useState('24h');
  const [width, setWidth] = useState(6);
  const [height, setHeight] = useState(3);

  // Preview state
  const [previewData, setPreviewData] = useState<MetricQueryResult | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load catalog and metadata on open
  useEffect(() => {
    if (open) {
      loadResources();
    }
  }, [open, projectId]);

  // Sync initial widget when editing
  useEffect(() => {
    if (initialWidget && open) {
      setTitle(initialWidget.title);
      setMetric(initialWidget.metric);
      setVisualizationType(initialWidget.visualizationType);
      const conf = initialWidget.configuration || {};
      setApiId(conf.apiId || '');
      setEnvironmentId(conf.environmentId || '');
      setMonitorId(conf.monitorId || '');
      setTimeRange(conf.timeRange || '24h');
      setWidth(initialWidget.width || 6);
      setHeight(initialWidget.height || 3);
    } else if (open && !initialWidget) {
      setTitle('');
      setMetric('availability');
      setVisualizationType('stat');
      setApiId('');
      setEnvironmentId('');
      setMonitorId('');
      setTimeRange('24h');
      setWidth(6);
      setHeight(3);
      setPreviewData(null);
    }
  }, [initialWidget, open]);

  const loadResources = async () => {
    try {
      const [cat, apisList, envsList, monsList] = await Promise.all([
        api.getMetricCatalog().catch(() => []),
        api.getApis(projectId).catch(() => []),
        api.getEnvironments().catch(() => []),
        api.getMonitors().catch(() => []),
      ]);
      setCatalog(cat);
      setApis(apisList);
      setEnvironments(envsList);
      setMonitors(monsList);

      if (cat.length > 0 && !metric) {
        setMetric(cat[0].id);
        setVisualizationType(cat[0].defaultVisualization);
      }
    } catch (err) {
      console.error('Failed to load metric resources:', err);
    }
  };

  // Selected metric definition
  const currentMetricDef = catalog.find((m) => m.id === metric);

  // Auto-switch visualization type if not supported
  const handleMetricChange = (newMetricId: string) => {
    setMetric(newMetricId);
    const def = catalog.find((m) => m.id === newMetricId);
    if (def) {
      if (!def.supportedVisualizations.includes(visualizationType as any)) {
        setVisualizationType(def.defaultVisualization);
      }
      if (!title || catalog.some((m) => m.name === title)) {
        setTitle(def.name);
      }
    }
  };

  // Trigger preview query with real execution data
  const handleFetchPreview = async () => {
    setIsLoadingPreview(true);
    setPreviewError(null);
    try {
      const result = await api.previewMetricQuery({
        metric,
        filters: {
          projectId,
          apiId: apiId || undefined,
          environmentId: environmentId || undefined,
          monitorId: monitorId || undefined,
        },
        timeRange,
      });
      setPreviewData(result);
    } catch (err: any) {
      setPreviewError(err.message || 'Failed to query metric telemetry');
    } finally {
      setIsLoadingPreview(false);
    }
  };

  // Run preview on initial mount / changes
  useEffect(() => {
    if (open && metric) {
      handleFetchPreview();
    }
  }, [open, metric, apiId, environmentId, monitorId, timeRange]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!currentMetricDef?.supportedVisualizations.includes(visualizationType as any)) {
      return;
    }
    const finalTitle = title.trim() || currentMetricDef?.name || 'Custom Metric';
    setIsSubmitting(true);
    try {
      await onSave({
        title: finalTitle,
        metric,
        visualizationType,
        configuration: {
          apiId: apiId || undefined,
          environmentId: environmentId || undefined,
          monitorId: monitorId || undefined,
          timeRange,
        },
        width,
        height,
      });
      onOpenChange(false);
    } catch (err: any) {
      setPreviewError(err.message || 'Failed to save visualization');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filtered environment / monitors based on selections
  const availableEnvironments = useMemo(() => {
    if (apiId) {
      return environments
        .filter((e) => e.apiId === apiId)
        .map((e) => ({ value: e.id, label: e.name }));
    }
    const seen = new Set<string>();
    const list: Array<{ value: string; label: string }> = [];
    for (const env of environments) {
      const name = env.name.trim();
      const key = name.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        list.push({ value: name, label: name });
      }
    }
    return list;
  }, [environments, apiId]);

  const availableMonitors = monitors.filter((m) => {
    if (apiId && m.environment?.apiId !== apiId && m.environment?.api?.id !== apiId) return false;
    if (environmentId) {
      const matchesEnvId = m.environmentId === environmentId || m.environment?.id === environmentId;
      const matchesEnvName = m.environment?.name?.toLowerCase() === environmentId.toLowerCase();
      if (!matchesEnvId && !matchesEnvName) return false;
    }
    return true;
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full sm:max-w-4xl bg-card border-border max-h-[90vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader className="border-b border-border pb-3">
          <DialogTitle className="text-base font-semibold flex items-center gap-2">
            <HugeiconsIcon icon={ChartLineData01Icon} className="size-4 text-primary" />
            <span>{initialWidget ? 'Configure Visualization' : 'Create Custom Visualization'}</span>
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Select metrics, filter across APIs and environments, and configure your visualization panel.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 pt-3">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column: Configuration Controls (7 cols) */}
            <div className="lg:col-span-7 space-y-4 text-xs">
              {/* Title Input */}
              <div className="space-y-1.5">
                <label className="font-semibold text-foreground">Panel Title</label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={currentMetricDef?.name || 'e.g. Production Latency (P95)'}
                  className="rounded-none border-input h-8 text-xs font-mono"
                />
              </div>

              {/* Metric Selector Grouped by Category */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="font-semibold text-foreground">Metric Definition</label>
                  {currentMetricDef && (
                    <span className="text-[10px] font-mono text-muted-foreground">
                      Unit: <span className="text-foreground">{currentMetricDef.unit}</span>
                    </span>
                  )}
                </div>
                <select
                  value={metric}
                  onChange={(e) => handleMetricChange(e.target.value)}
                  className="w-full h-8 px-2.5 bg-input/20 border border-input rounded-none text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <optgroup label="Reliability & SLAs">
                    {catalog
                      .filter((m) => m.category === 'reliability')
                      .map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name} ({m.unit})
                        </option>
                      ))}
                  </optgroup>
                  <optgroup label="Performance & Latency">
                    {catalog
                      .filter((m) => m.category === 'performance')
                      .map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name} ({m.unit})
                        </option>
                      ))}
                  </optgroup>
                  <optgroup label="Traffic & Payload">
                    {catalog
                      .filter((m) => m.category === 'traffic')
                      .map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name} ({m.unit})
                        </option>
                      ))}
                  </optgroup>
                  <optgroup label="Errors & Failures">
                    {catalog
                      .filter((m) => m.category === 'errors')
                      .map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name} ({m.unit})
                        </option>
                      ))}
                  </optgroup>
                </select>
                {currentMetricDef && (
                  <p className="text-[11px] text-muted-foreground italic">
                    {currentMetricDef.description}
                  </p>
                )}
              </div>

              {/* Scope & Filtering Grid */}
              <div className="border border-border/60 bg-muted/20 p-3 space-y-3 rounded-none">
                <span className="font-semibold text-foreground block text-[11px] uppercase tracking-wider">
                  Target Scope & Filters
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div className="space-y-1">
                    <label className="text-[10px] text-muted-foreground">API Scope</label>
                    <select
                      value={apiId}
                      onChange={(e) => {
                        setApiId(e.target.value);
                        setEnvironmentId('');
                        setMonitorId('');
                      }}
                      className="w-full h-7 px-2 bg-input/30 border border-input rounded-none text-[11px] text-foreground"
                    >
                      <option value="">All APIs</option>
                      {apis.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] text-muted-foreground">Environment</label>
                    <select
                      value={environmentId}
                      onChange={(e) => {
                        setEnvironmentId(e.target.value);
                        setMonitorId('');
                      }}
                      className="w-full h-7 px-2 bg-input/30 border border-input rounded-none text-[11px] text-foreground"
                    >
                      <option value="">All Environments</option>
                      {availableEnvironments.map((env) => (
                        <option key={env.value} value={env.value}>
                          {env.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] text-muted-foreground">Monitor Endpoint</label>
                    <select
                      value={monitorId}
                      onChange={(e) => setMonitorId(e.target.value)}
                      className="w-full h-7 px-2 bg-input/30 border border-input rounded-none text-[11px] text-foreground"
                    >
                      <option value="">All Monitors</option>
                      {availableMonitors.map((mon) => (
                        <option key={mon.id} value={mon.id}>
                          {mon.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Visualization Type Selector */}
              <div className="space-y-2">
                <label className="font-semibold text-foreground block">Visualization Type</label>
                <div className="grid grid-cols-5 gap-2">
                  {[
                    { id: 'stat', label: 'Stat', icon: DashboardSpeed01Icon },
                    { id: 'time_series', label: 'Time Series', icon: ChartLineData01Icon },
                    { id: 'bar', label: 'Bar Meter', icon: PieChartIcon },
                    { id: 'gauge', label: 'Gauge', icon: ViewIcon },
                    { id: 'table', label: 'Table', icon: Table01Icon },
                  ].map((v) => {
                    const isSupported = Boolean(currentMetricDef?.supportedVisualizations.includes(v.id as any));
                    const isSelected = visualizationType === v.id;
                    return (
                      <button
                        type="button"
                        key={v.id}
                        disabled={!isSupported}
                        onClick={() => isSupported && setVisualizationType(v.id)}
                        className={`p-2 flex flex-col items-center justify-center gap-1.5 border rounded-none text-center transition-all ${
                          isSelected
                            ? 'border-primary bg-primary/10 text-primary font-semibold ring-1 ring-primary'
                            : isSupported
                            ? 'border-border bg-card hover:bg-muted/40 text-foreground cursor-pointer'
                            : 'border-border/30 bg-muted/20 opacity-30 text-muted-foreground cursor-not-allowed'
                        }`}
                        title={!isSupported ? `Locked: not supported for ${currentMetricDef?.name || 'this metric'}` : v.label}
                      >
                        <HugeiconsIcon icon={!isSupported ? CircleLock02Icon : v.icon} className="size-4" />
                        <span className="text-[10px] font-mono leading-none">{!isSupported ? 'Locked' : v.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Sizing & Time Range Options */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="space-y-1">
                  <label className="font-medium text-[11px] text-muted-foreground">Panel Width</label>
                  <select
                    value={width}
                    onChange={(e) => setWidth(Number(e.target.value))}
                    className="w-full h-7 px-2 bg-input/30 border border-input rounded-none text-xs text-foreground font-mono"
                  >
                    <option value={12}>Full Width (12 columns)</option>
                    <option value={8}>Two-Thirds (8 columns)</option>
                    <option value={6}>Half Width (6 columns)</option>
                    <option value={4}>One-Third (4 columns)</option>
                    <option value={3}>Quarter Width (3 columns)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-medium text-[11px] text-muted-foreground">Time Window</label>
                  <select
                    value={timeRange}
                    onChange={(e) => setTimeRange(e.target.value)}
                    className="w-full h-7 px-2 bg-input/30 border border-input rounded-none text-xs text-foreground font-mono"
                  >
                    <option value="15m">Last 15 minutes</option>
                    <option value="1h">Last 1 hour</option>
                    <option value="6h">Last 6 hours</option>
                    <option value="24h">Last 24 hours</option>
                    <option value="7d">Last 7 days</option>
                    <option value="30d">Last 30 days</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Right Column: Live Data Preview Card (5 cols) */}
            <div className="lg:col-span-5 flex flex-col space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold text-foreground">Live Telemetry Preview</span>
                  <Badge variant="outline" className="text-[9px] font-mono px-1 py-0 text-emerald-500 border-emerald-500/30">
                    REAL DATA
                  </Badge>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  onClick={handleFetchPreview}
                  disabled={isLoadingPreview}
                  className="h-6 gap-1 text-[10px] font-mono"
                >
                  <HugeiconsIcon
                    icon={RefreshIcon}
                    className={`size-3 ${isLoadingPreview ? 'animate-spin' : ''}`}
                  />
                  <span>Refresh</span>
                </Button>
              </div>

              {/* Preview Window Container */}
              <div className="flex-1 min-h-[220px] max-h-[320px] border border-border bg-card/70 flex flex-col rounded-none overflow-hidden">
                <div className="p-2 border-b border-border/40 bg-muted/20 flex items-center justify-between text-[11px] font-mono">
                  <span className="font-semibold text-foreground truncate max-w-[180px]">
                    {title.trim() || currentMetricDef?.name || 'Preview Panel'}
                  </span>
                  <span className="text-muted-foreground text-[10px] uppercase">
                    {visualizationType}
                  </span>
                </div>

                <div className="flex-1 overflow-auto">
                  {previewError ? (
                    <div className="p-6 text-center text-xs text-destructive flex flex-col items-center justify-center h-full">
                      <span>{previewError}</span>
                    </div>
                  ) : (
                    <WidgetRenderer
                      widget={{
                        id: 'preview',
                        dashboardId: 'preview',
                        title: title.trim() || currentMetricDef?.name || 'Preview',
                        metric,
                        visualizationType: visualizationType as any,
                        configuration: { apiId, environmentId, monitorId, timeRange },
                        x: 0,
                        y: 0,
                        width,
                        height,
                        data: previewData || undefined,
                      }}
                      isLoading={isLoadingPreview}
                    />
                  )}
                </div>
              </div>

              <div className="text-[10px] font-mono text-muted-foreground bg-muted/30 p-2 border border-border/40">
                Data queried live from PostgreSQL <span className="text-foreground">monitor_executions</span> via <span className="text-foreground">MetricQueryService</span>.
              </div>
            </div>
          </div>

          <DialogFooter className="border-t border-border pt-3 gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting || !currentMetricDef?.supportedVisualizations.includes(visualizationType as any)}
              className="gap-1.5 font-medium"
            >
              <span>{initialWidget ? 'Save Visualization' : 'Add to Dashboard'}</span>
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

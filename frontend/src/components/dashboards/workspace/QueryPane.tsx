import { useState, useEffect } from 'react';
import type {
  MetricDefinition,
  Api,
  Environment,
  Monitor,
  DashboardWidget,
} from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ResizeHandle } from '@/components/common/ResizeHandle';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  Cancel01Icon,
  ArrowUp01Icon,
  ArrowDown01Icon,
  ArrowLeft01Icon,
  ArrowRight01Icon,
  Tick02Icon,
  Settings02Icon,
} from '@hugeicons/core-free-icons';

interface QueryPaneProps {
  isOpen: boolean;
  isCollapsed: boolean;
  height: number;
  catalog: MetricDefinition[];
  apis: Api[];
  environments: Environment[];
  monitors: Monitor[];
  activeWidget: DashboardWidget | null;
  draftWidget: Partial<DashboardWidget> | null;
  onResize: (delta: number) => void;
  onToggleCollapse: () => void;
  onClose: () => void;
  onSaveWidget: (data: {
    title: string;
    metric: string;
    visualizationType: 'stat' | 'time_series' | 'bar' | 'table' | 'gauge';
    configuration: Record<string, any>;
    width: number;
    height: number;
  }) => Promise<void>;
  onChangeDraft: (draft: Partial<DashboardWidget>) => void;
}

export function QueryPane({
  isOpen,
  isCollapsed,
  height,
  catalog,
  apis,
  environments,
  monitors,
  activeWidget,
  draftWidget,
  onResize,
  onToggleCollapse,
  onClose,
  onSaveWidget,
  onChangeDraft,
}: QueryPaneProps) {
  // Local state for configuration
  const currentItem = activeWidget || draftWidget;
  const currentConfig = (currentItem?.configuration as Record<string, any>) || {};

  const [title, setTitle] = useState(currentItem?.title || '');
  const [metric, setMetric] = useState(currentItem?.metric || 'availability');
  const [visualizationType, setVisualizationType] = useState<'stat' | 'time_series' | 'bar' | 'table' | 'gauge'>(
    (currentItem?.visualizationType as any) || 'stat'
  );
  const [apiId, setApiId] = useState(currentConfig.apiId || '');
  const [environmentId, setEnvironmentId] = useState(currentConfig.environmentId || '');
  const [monitorId, setMonitorId] = useState(currentConfig.monitorId || '');
  const [timeRange, setTimeRange] = useState(currentConfig.timeRange || '24h');
  const [width, setWidth] = useState(currentItem?.width || 6);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (currentItem) {
      setTitle(currentItem.title || '');
      setMetric(currentItem.metric || 'availability');
      setVisualizationType((currentItem.visualizationType as any) || 'stat');
      const conf = (currentItem.configuration as Record<string, any>) || {};
      setApiId(conf.apiId || '');
      setEnvironmentId(conf.environmentId || '');
      setMonitorId(conf.monitorId || '');
      setTimeRange(conf.timeRange || '24h');
      setWidth(currentItem.width || 6);
    }
  }, [currentItem]);

  // Sync draft changes immediately to parent
  const handleFieldChange = (updates: Partial<{
    title: string;
    metric: string;
    visualizationType: 'stat' | 'time_series' | 'bar' | 'table' | 'gauge';
    apiId: string;
    environmentId: string;
    monitorId: string;
    timeRange: string;
    width: number;
  }>) => {
    const nextMetric = updates.metric ?? metric;
    const nextViz = updates.visualizationType ?? visualizationType;
    const nextTitle = updates.title ?? title;
    const nextApiId = updates.apiId !== undefined ? updates.apiId : apiId;
    const nextEnvId = updates.environmentId !== undefined ? updates.environmentId : environmentId;
    const nextMonId = updates.monitorId !== undefined ? updates.monitorId : monitorId;
    const nextTime = updates.timeRange ?? timeRange;
    const nextWidth = updates.width ?? width;

    if (updates.metric !== undefined) setMetric(updates.metric);
    if (updates.visualizationType !== undefined) setVisualizationType(updates.visualizationType);
    if (updates.title !== undefined) setTitle(updates.title);
    if (updates.apiId !== undefined) setApiId(updates.apiId);
    if (updates.environmentId !== undefined) setEnvironmentId(updates.environmentId);
    if (updates.monitorId !== undefined) setMonitorId(updates.monitorId);
    if (updates.timeRange !== undefined) setTimeRange(updates.timeRange);
    if (updates.width !== undefined) setWidth(updates.width);

    onChangeDraft({
      title: nextTitle,
      metric: nextMetric,
      visualizationType: nextViz as any,
      configuration: {
        apiId: nextApiId || undefined,
        environmentId: nextEnvId || undefined,
        monitorId: nextMonId || undefined,
        timeRange: nextTime,
      },
      width: nextWidth,
      height: 3,
    });
  };

  const handleApply = async () => {
    setIsSubmitting(true);
    try {
      await onSaveWidget({
        title: title.trim() || catalog.find((m) => m.id === metric)?.name || 'Custom Panel',
        metric,
        visualizationType,
        configuration: {
          apiId: apiId || undefined,
          environmentId: environmentId || undefined,
          monitorId: monitorId || undefined,
          timeRange,
        },
        width,
        height: 3,
      });
      onClose();
    } catch (err) {
      console.error('Failed to apply widget query:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const availableEnvironments = environments.filter((e) => !apiId || e.apiId === apiId);
  const availableMonitors = monitors.filter(
    (m) => (!environmentId || m.environmentId === environmentId) && (!apiId || m.environment?.apiId === apiId),
  );

  const currentMetricDef = catalog.find((m) => m.id === metric);

  if (!isOpen) return null;

  return (
    <div
      style={{ height: isCollapsed ? '36px' : `${height}px` }}
      className="border-t border-border bg-card flex flex-col shrink-0 select-none shadow-2xl z-20 relative transition-[height] duration-150 ease-out"
    >
      {/* Draggable top resize handle */}
      {!isCollapsed && (
        <div className="absolute top-0 left-0 right-0 z-30 flex justify-center">
          <ResizeHandle
            direction="vertical"
            onResize={onResize}
            title="Drag to resize query pane height"
            className="w-full"
          />
        </div>
      )}

      {/* Pane Toolbar Header */}
      <div className="h-9 px-4 border-b border-border flex items-center justify-between shrink-0 bg-muted/30 text-xs">
        <div className="flex items-center gap-2 font-mono">
          <HugeiconsIcon icon={Settings02Icon} className="size-3.5 text-primary" />
          <span className="font-semibold text-foreground">Query & Metric Configuration</span>
          {activeWidget && (
            <Badge variant="outline" className="text-[10px] py-0 px-1 font-mono">
              Editing: {activeWidget.title}
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <Button
            variant="ghost"
            size="xs"
            onClick={onToggleCollapse}
            className="h-6 px-1.5 text-muted-foreground hover:text-foreground text-[10px] font-mono gap-1"
            title={isCollapsed ? 'Expand pane' : 'Collapse pane'}
          >
            <HugeiconsIcon
              icon={isCollapsed ? ArrowUp01Icon : ArrowDown01Icon}
              className="size-3"
            />
            <span>{isCollapsed ? 'Expand' : 'Collapse'}</span>
          </Button>

          <Button
            variant="ghost"
            size="xs"
            onClick={onClose}
            className="size-6 p-0 text-muted-foreground hover:text-foreground"
            title="Close query pane"
          >
            <HugeiconsIcon icon={Cancel01Icon} className="size-3.5" />
          </Button>
        </div>
      </div>

      {/* Expanded Pane Body */}
      {!isCollapsed && (
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-6 gap-3 text-xs">
            {/* Panel Title */}
            <div className="space-y-1">
              <label className="font-semibold text-foreground text-[11px]">Title</label>
              <Input
                value={title}
                onChange={(e) => handleFieldChange({ title: e.target.value })}
                placeholder={currentMetricDef?.name || 'Panel Title'}
                className="h-8 rounded-none border-input text-xs font-mono"
              />
            </div>

            {/* Metric Selector */}
            <div className="space-y-1">
              <label className="font-semibold text-foreground text-[11px]">Metric</label>
              <select
                value={metric}
                onChange={(e) => handleFieldChange({ metric: e.target.value })}
                className="w-full h-8 px-2 bg-input/20 border border-input rounded-none text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              >
                {catalog.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.unit})
                  </option>
                ))}
              </select>
            </div>

            {/* API Scope Filter */}
            <div className="space-y-1">
              <label className="font-semibold text-foreground text-[11px]">API</label>
              <select
                value={apiId}
                onChange={(e) => handleFieldChange({ apiId: e.target.value, environmentId: '', monitorId: '' })}
                className="w-full h-8 px-2 bg-input/20 border border-input rounded-none text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="">All APIs</option>
                {apis.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Environment Filter */}
            <div className="space-y-1">
              <label className="font-semibold text-foreground text-[11px]">Environment</label>
              <select
                value={environmentId}
                onChange={(e) => handleFieldChange({ environmentId: e.target.value, monitorId: '' })}
                className="w-full h-8 px-2 bg-input/20 border border-input rounded-none text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="">All Environments</option>
                {availableEnvironments.map((env) => (
                  <option key={env.id} value={env.id}>
                    {env.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Monitor Endpoint Filter */}
            <div className="space-y-1">
              <label className="font-semibold text-foreground text-[11px]">Monitor</label>
              <select
                value={monitorId}
                onChange={(e) => handleFieldChange({ monitorId: e.target.value })}
                className="w-full h-8 px-2 bg-input/20 border border-input rounded-none text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="">All Monitors</option>
                {availableMonitors.map((mon) => (
                  <option key={mon.id} value={mon.id}>
                    {mon.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Visualization Type */}
            <div className="space-y-1">
              <label className="font-semibold text-foreground text-[11px]">Visualization</label>
              <select
                value={visualizationType}
                onChange={(e) => handleFieldChange({ visualizationType: e.target.value as any })}
                className="w-full h-8 px-2 bg-input/20 border border-input rounded-none text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-ring uppercase"
              >
                <option value="stat">Stat</option>
                <option value="time_series">Time Series</option>
                <option value="bar">Bar Chart</option>
                <option value="gauge">Gauge</option>
                <option value="table">Table</option>
              </select>
            </div>
          </div>

          {/* Sizing & Apply Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-border/50 text-xs font-mono">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <span className="text-muted-foreground text-[11px]">Width:</span>
                <div className="flex items-center border border-input bg-input/20">
                  <button
                    type="button"
                    title="Shrink width (← arrow)"
                    onClick={() => handleFieldChange({ width: Math.max(3, width - 1) })}
                    disabled={width <= 3}
                    className="size-7 flex items-center justify-center hover:bg-muted text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
                  >
                    <HugeiconsIcon icon={ArrowLeft01Icon} className="size-3.5" />
                  </button>
                  <span className="px-2 text-xs font-mono font-semibold text-foreground select-none">
                    {width}/12 cols
                  </span>
                  <button
                    type="button"
                    title="Expand width (→ arrow)"
                    onClick={() => handleFieldChange({ width: Math.min(12, width + 1) })}
                    disabled={width >= 12}
                    className="size-7 flex items-center justify-center hover:bg-muted text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
                  >
                    <HugeiconsIcon icon={ArrowRight01Icon} className="size-3.5" />
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-muted-foreground text-[11px]">Time Window:</span>
                <select
                  value={timeRange}
                  onChange={(e) => handleFieldChange({ timeRange: e.target.value })}
                  className="h-7 px-2 bg-input/20 border border-input rounded-none text-xs text-foreground"
                >
                  <option value="15m">15m</option>
                  <option value="1h">1h</option>
                  <option value="6h">6h</option>
                  <option value="24h">24h</option>
                  <option value="7d">7d</option>
                  <option value="30d">30d</option>
                </select>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={onClose}
                className="h-7 text-xs font-mono"
              >
                Cancel
              </Button>

              <Button
                size="sm"
                onClick={handleApply}
                disabled={isSubmitting}
                className="h-7 gap-1 font-medium text-xs"
              >
                <HugeiconsIcon icon={Tick02Icon} className="size-3.5" />
                <span>{activeWidget ? 'Apply Changes' : 'Save Panel'}</span>
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

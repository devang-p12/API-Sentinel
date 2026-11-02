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
  DashboardSpeed01Icon,
  ChartLineData01Icon,
  PieChartIcon,
  ViewIcon,
  Table01Icon,
  CircleLock02Icon,
} from '@hugeicons/core-free-icons';

interface QueryPaneProps {
  isOpen: boolean;
  isCollapsed: boolean;
  height: number;
  catalog: MetricDefinition[];
  apis?: Api[];
  environments?: Environment[];
  monitors?: Monitor[];
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

const VISUALIZATION_TYPES = [
  { id: 'stat', label: 'Stat', icon: DashboardSpeed01Icon },
  { id: 'time_series', label: 'Time Series', icon: ChartLineData01Icon },
  { id: 'bar', label: 'Bar Chart', icon: PieChartIcon },
  { id: 'gauge', label: 'Gauge', icon: ViewIcon },
  { id: 'table', label: 'Table', icon: Table01Icon },
] as const;

export function QueryPane({
  isOpen,
  isCollapsed,
  height,
  catalog,
  activeWidget,
  draftWidget,
  onResize,
  onToggleCollapse,
  onClose,
  onSaveWidget,
  onChangeDraft,
}: QueryPaneProps) {
  const currentItem = activeWidget || draftWidget;
  const currentConfig = (currentItem?.configuration as Record<string, any>) || {};

  const [title, setTitle] = useState(currentItem?.title || '');
  const [metric, setMetric] = useState(currentItem?.metric || 'availability');
  const [visualizationType, setVisualizationType] = useState<'stat' | 'time_series' | 'bar' | 'table' | 'gauge'>(
    (currentItem?.visualizationType as any) || 'stat'
  );
  const [width, setWidth] = useState(currentItem?.width || 6);
  const [rowSpan, setRowSpan] = useState(currentItem?.height || 3);
  const [newRow, setNewRow] = useState(Boolean(currentConfig.newRow));
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Sync state whenever active or draft widget changes
  useEffect(() => {
    if (currentItem) {
      const currentMetric = currentItem.metric || 'availability';
      const metricDef = catalog.find((m) => m.id === currentMetric);
      let initialViz = (currentItem.visualizationType as any) || 'stat';

      // If existing visualization is not supported, lock and fallback to default
      if (metricDef && !metricDef.supportedVisualizations.includes(initialViz)) {
        initialViz = metricDef.defaultVisualization;
      }

      setTitle(currentItem.title || '');
      setMetric(currentMetric);
      setVisualizationType(initialViz);
      setWidth(currentItem.width || 6);
      setRowSpan(currentItem.height || 3);
      const conf = (currentItem.configuration as Record<string, any>) || {};
      setNewRow(Boolean(conf.newRow));
    }
  }, [currentItem, catalog]);

  const currentMetricDef = catalog.find((m) => m.id === metric);
  const isCurrentVizSupported = Boolean(
    currentMetricDef?.supportedVisualizations.includes(visualizationType)
  );

  const handleMetricChange = (newMetricId: string) => {
    const newDef = catalog.find((m) => m.id === newMetricId);
    let nextViz = visualizationType;

    // If new metric does not support currently selected visualization, automatically switch to its default
    if (newDef && !newDef.supportedVisualizations.includes(nextViz)) {
      nextViz = newDef.defaultVisualization;
    }

    setMetric(newMetricId);
    setVisualizationType(nextViz);

    onChangeDraft({
      title,
      metric: newMetricId,
      visualizationType: nextViz,
      configuration: { newRow },
      width,
      height: rowSpan,
    });
  };

  const handleVizChange = (type: 'stat' | 'time_series' | 'bar' | 'table' | 'gauge') => {
    if (!currentMetricDef?.supportedVisualizations.includes(type)) {
      // Locked: unsupported visualization form
      return;
    }
    setVisualizationType(type);

    onChangeDraft({
      title,
      metric,
      visualizationType: type,
      configuration: { newRow },
      width,
      height: rowSpan,
    });
  };

  const handleTitleChange = (newTitle: string) => {
    setTitle(newTitle);
    onChangeDraft({
      title: newTitle,
      metric,
      visualizationType,
      configuration: { newRow },
      width,
      height: rowSpan,
    });
  };

  const handleWidthChange = (newWidth: number) => {
    const clamped = Math.max(3, Math.min(12, newWidth));
    setWidth(clamped);
    onChangeDraft({
      title,
      metric,
      visualizationType,
      configuration: { newRow },
      width: clamped,
      height: rowSpan,
    });
  };

  const handleRowSpanChange = (newRowSpan: number) => {
    const clamped = Math.max(2, Math.min(8, newRowSpan));
    setRowSpan(clamped);
    onChangeDraft({
      title,
      metric,
      visualizationType,
      configuration: { newRow },
      width,
      height: clamped,
    });
  };

  const handleNewRowToggle = () => {
    const updated = !newRow;
    setNewRow(updated);
    onChangeDraft({
      title,
      metric,
      visualizationType,
      configuration: { newRow: updated },
      width,
      height: rowSpan,
    });
  };

  const handleApply = async () => {
    if (!isCurrentVizSupported) {
      return;
    }
    setIsSubmitting(true);
    try {
      await onSaveWidget({
        title: title.trim() || currentMetricDef?.name || 'Custom Panel',
        metric,
        visualizationType,
        configuration: {
          newRow,
        },
        width,
        height: rowSpan,
      });
      onClose();
    } catch (err) {
      console.error('Failed to apply widget query:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

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
          <span className="font-semibold text-foreground">Visualization & Layout Configuration</span>
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
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 text-xs">
            {/* Panel Title */}
            <div className="md:col-span-3 space-y-1">
              <label className="font-semibold text-foreground text-[11px] uppercase tracking-wider block">
                Panel Title
              </label>
              <Input
                value={title}
                onChange={(e) => handleTitleChange(e.target.value)}
                placeholder={currentMetricDef?.name || 'Panel Title'}
                className="h-8 rounded-none border-input text-xs font-mono"
              />
            </div>

            {/* Metric Selector */}
            <div className="md:col-span-4 space-y-1">
              <div className="flex items-center justify-between">
                <label className="font-semibold text-foreground text-[11px] uppercase tracking-wider">
                  Metric
                </label>
                <span className="text-[10px] font-mono text-muted-foreground">
                  Unit: {currentMetricDef?.unit || '—'}
                </span>
              </div>
              <select
                value={metric}
                onChange={(e) => handleMetricChange(e.target.value)}
                className="w-full h-8 px-2 bg-input/20 border border-input rounded-none text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              >
                {catalog.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.unit})
                  </option>
                ))}
              </select>
            </div>

            {/* Visualization Type Switcher with Strict Lock for Unsupported Types */}
            <div className="md:col-span-5 space-y-1">
              <div className="flex items-center justify-between">
                <label className="font-semibold text-foreground text-[11px] uppercase tracking-wider">
                  Visualization Type
                </label>
                <span className="text-[10px] font-mono text-muted-foreground">
                  {currentMetricDef?.supportedVisualizations.length} format{currentMetricDef && currentMetricDef.supportedVisualizations.length > 1 ? 's' : ''} supported
                </span>
              </div>

              <div className="grid grid-cols-5 gap-1">
                {VISUALIZATION_TYPES.map((v) => {
                  const isSupported = Boolean(currentMetricDef?.supportedVisualizations.includes(v.id as any));
                  const isSelected = visualizationType === v.id;

                  return (
                    <button
                      type="button"
                      key={v.id}
                      disabled={!isSupported}
                      onClick={() => handleVizChange(v.id as any)}
                      className={`h-8 px-1.5 flex items-center justify-center gap-1.5 border text-xs transition-all ${
                        isSelected
                          ? 'border-primary bg-primary/10 text-primary font-semibold ring-1 ring-primary'
                          : isSupported
                          ? 'border-input bg-card hover:bg-muted/40 text-foreground cursor-pointer'
                          : 'border-border/30 bg-muted/20 opacity-30 text-muted-foreground cursor-not-allowed'
                      }`}
                      title={
                        !isSupported
                          ? `Locked: ${v.label} is not supported for ${currentMetricDef?.name || 'this metric'}`
                          : v.label
                      }
                    >
                      {!isSupported ? (
                        <HugeiconsIcon icon={CircleLock02Icon} className="size-3 text-muted-foreground shrink-0" />
                      ) : (
                        <HugeiconsIcon icon={v.icon} className="size-3.5 shrink-0" />
                      )}
                      <span className="text-[10px] font-mono truncate">{v.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Sizing, Global Filter Note, and Save Actions */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-border/50 text-xs font-mono">
            <div className="flex flex-wrap items-center gap-3">
              {/* Width / Grid Columns */}
              <div className="flex items-center gap-1.5">
                <span className="text-muted-foreground text-[11px]">Width:</span>
                <div className="flex items-center border border-input bg-input/20">
                  <button
                    type="button"
                    title="Shrink width (← arrow)"
                    onClick={() => handleWidthChange(width - 1)}
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
                    onClick={() => handleWidthChange(width + 1)}
                    disabled={width >= 12}
                    className="size-7 flex items-center justify-center hover:bg-muted text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
                  >
                    <HugeiconsIcon icon={ArrowRight01Icon} className="size-3.5" />
                  </button>
                </div>
              </div>

              {/* Row Span (Height) */}
              <div className="flex items-center gap-1.5">
                <span className="text-muted-foreground text-[11px]">Row Span:</span>
                <div className="flex items-center border border-input bg-input/20">
                  <button
                    type="button"
                    title="Shrink height (↑ arrow)"
                    onClick={() => handleRowSpanChange(rowSpan - 1)}
                    disabled={rowSpan <= 2}
                    className="size-7 flex items-center justify-center hover:bg-muted text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
                  >
                    <HugeiconsIcon icon={ArrowUp01Icon} className="size-3.5" />
                  </button>
                  <span className="px-2 text-xs font-mono font-semibold text-foreground select-none">
                    {rowSpan} rows
                  </span>
                  <button
                    type="button"
                    title="Expand height (↓ arrow)"
                    onClick={() => handleRowSpanChange(rowSpan + 1)}
                    disabled={rowSpan >= 8}
                    className="size-7 flex items-center justify-center hover:bg-muted text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
                  >
                    <HugeiconsIcon icon={ArrowDown01Icon} className="size-3.5" />
                  </button>
                </div>
              </div>

              {/* Start on New Row */}
              <button
                type="button"
                onClick={handleNewRowToggle}
                className={`h-7 px-2 border text-xs flex items-center gap-1 transition-colors ${
                  newRow
                    ? 'bg-primary/10 border-primary text-primary font-semibold'
                    : 'bg-input/20 border-input text-muted-foreground hover:text-foreground'
                }`}
                title="Force panel to start on a new row"
              >
                <span>{newRow ? '✓ Starts on New Row' : 'Start on New Row'}</span>
              </button>

              {/* Minimalistic note explaining header filters */}
              <div className="hidden lg:flex items-center gap-1 text-[11px] text-muted-foreground/80 pl-2">
                <span className="size-1 rounded-full bg-emerald-500 inline-block" />
                <span>Filters (Time Window, Environment, API) apply automatically from header</span>
              </div>
            </div>

            {/* Action Buttons */}
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
                disabled={isSubmitting || !isCurrentVizSupported}
                className="h-7 gap-1 font-medium text-xs"
                title={!isCurrentVizSupported ? 'Selected visualization form is locked for this metric' : undefined}
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

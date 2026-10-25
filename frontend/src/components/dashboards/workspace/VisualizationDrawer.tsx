import { useState, useEffect } from 'react';
import {
  api,
  type MetricDefinition,
  type MetricQueryResult,
} from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ResizeHandle } from '@/components/common/ResizeHandle';
import { WidgetRenderer } from '../renderers/WidgetRenderer';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  Cancel01Icon,
  Search01Icon,
  Add01Icon,
  Settings02Icon,
  ChartLineData01Icon,
  PieChartIcon,
  Table01Icon,
  DashboardSpeed01Icon,
  ViewIcon,
  RefreshIcon,
} from '@hugeicons/core-free-icons';

interface VisualizationDrawerProps {
  isOpen: boolean;
  width: number;
  catalog: MetricDefinition[];
  projectId?: string;
  defaultApiId?: string;
  defaultEnvironmentId?: string;
  timeRange: string;
  onClose: () => void;
  onResize: (delta: number) => void;
  onAddWidget: (data: {
    title: string;
    metric: string;
    visualizationType: 'stat' | 'time_series' | 'bar' | 'table' | 'gauge';
    configuration: Record<string, any>;
    width: number;
    height: number;
  }) => Promise<void>;
  onConfigureQuery: (draft: {
    title: string;
    metric: string;
    visualizationType: 'stat' | 'time_series' | 'bar' | 'table' | 'gauge';
    configuration: Record<string, any>;
    width: number;
    height: number;
  }) => void;
}

export function VisualizationDrawer({
  isOpen,
  width,
  catalog,
  projectId,
  defaultApiId,
  defaultEnvironmentId,
  timeRange,
  onClose,
  onResize,
  onAddWidget,
  onConfigureQuery,
}: VisualizationDrawerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMetricId, setSelectedMetricId] = useState('availability');
  const [selectedVizType, setSelectedVizType] = useState<'stat' | 'time_series' | 'bar' | 'table' | 'gauge'>('stat');
  const [previewData, setPreviewData] = useState<MetricQueryResult | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Sync selected metric definition
  const currentMetricDef = catalog.find((m) => m.id === selectedMetricId);

  // Auto-switch viz type when metric changes
  const handleSelectMetric = (metricId: string) => {
    setSelectedMetricId(metricId);
    const def = catalog.find((m) => m.id === metricId);
    if (def) {
      if (!def.supportedVisualizations.includes(selectedVizType as any)) {
        setSelectedVizType(def.defaultVisualization);
      }
    }
  };

  // Live preview query
  const fetchPreview = async () => {
    if (!selectedMetricId) return;
    setIsLoadingPreview(true);
    setPreviewError(null);
    try {
      const result = await api.previewMetricQuery({
        metric: selectedMetricId,
        filters: {
          projectId,
          apiId: defaultApiId || undefined,
          environmentId: defaultEnvironmentId || undefined,
        },
        timeRange,
      });
      setPreviewData(result);
    } catch (err: any) {
      setPreviewError(err.message || 'Failed to query telemetry');
    } finally {
      setIsLoadingPreview(false);
    }
  };

  useEffect(() => {
    if (isOpen && selectedMetricId) {
      fetchPreview();
    }
  }, [isOpen, selectedMetricId, defaultApiId, defaultEnvironmentId, timeRange]);

  const handleAddQuickly = async () => {
    if (!currentMetricDef) return;
    setIsSubmitting(true);
    try {
      await onAddWidget({
        title: currentMetricDef.name,
        metric: selectedMetricId,
        visualizationType: selectedVizType,
        configuration: {
          apiId: defaultApiId || undefined,
          environmentId: defaultEnvironmentId || undefined,
          timeRange,
        },
        width: selectedVizType === 'time_series' || selectedVizType === 'bar' ? 12 : 6,
        height: 3,
      });
      onClose();
    } catch (err) {
      console.error('Failed to add widget:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenBottomConfigure = () => {
    if (!currentMetricDef) return;
    onConfigureQuery({
      title: currentMetricDef.name,
      metric: selectedMetricId,
      visualizationType: selectedVizType,
      configuration: {
        apiId: defaultApiId || undefined,
        environmentId: defaultEnvironmentId || undefined,
        timeRange,
      },
      width: selectedVizType === 'time_series' || selectedVizType === 'bar' ? 12 : 6,
      height: 3,
    });
  };

  // Filtered metrics based on search query
  const filteredCatalog = catalog.filter(
    (m) =>
      m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.category.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const categories: Array<{ id: string; label: string }> = [
    { id: 'reliability', label: 'Reliability & SLAs' },
    { id: 'performance', label: 'Performance & Latency' },
    { id: 'traffic', label: 'Traffic & Volume' },
    { id: 'errors', label: 'Errors & Failures' },
  ];

  if (!isOpen) return null;

  return (
    <div
      style={{ width: `${width}px` }}
      className="border-l border-border bg-card flex flex-col h-full shrink-0 select-none shadow-xl z-20 relative transition-[width] duration-100 ease-out"
    >
      {/* Draggable left resize handle */}
      <div className="absolute left-0 top-0 bottom-0 z-30 flex items-center">
        <ResizeHandle
          direction="horizontal"
          onResize={onResize}
          title="Drag to resize visualization drawer"
          className="h-full"
        />
      </div>

      {/* Drawer Header */}
      <div className="h-14 px-4 border-b border-border flex items-center justify-between shrink-0 bg-muted/20">
        <div className="flex items-center gap-2">
          <HugeiconsIcon icon={ChartLineData01Icon} className="size-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground tracking-tight">
            Add Visualization
          </h2>
        </div>
        <Button
          variant="ghost"
          size="xs"
          onClick={onClose}
          className="size-7 p-0 text-muted-foreground hover:text-foreground"
          aria-label="Close drawer"
        >
          <HugeiconsIcon icon={Cancel01Icon} className="size-4" />
        </Button>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Search Input */}
        <div className="relative">
          <HugeiconsIcon
            icon={Search01Icon}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground"
          />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search metrics..."
            className="rounded-none border-input h-8 pl-8 text-xs font-mono"
          />
        </div>

        {/* Live Preview Panel */}
        <div className="border border-border bg-card/70 flex flex-col rounded-none overflow-hidden">
          <div className="p-2 border-b border-border/40 bg-muted/30 flex items-center justify-between text-xs font-mono">
            <span className="font-semibold text-foreground truncate max-w-[200px]">
              {currentMetricDef?.name || 'Preview'}
            </span>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground uppercase">{selectedVizType}</span>
              <button
                type="button"
                onClick={fetchPreview}
                disabled={isLoadingPreview}
                className="text-muted-foreground hover:text-foreground p-0.5"
                title="Refresh preview"
              >
                <HugeiconsIcon
                  icon={RefreshIcon}
                  className={`size-3 ${isLoadingPreview ? 'animate-spin' : ''}`}
                />
              </button>
            </div>
          </div>

          <div className="min-h-[140px] max-h-[190px] overflow-hidden flex flex-col justify-center">
            {previewError ? (
              <div className="p-4 text-center text-xs text-destructive">
                {previewError}
              </div>
            ) : (
              <WidgetRenderer
                widget={{
                  id: 'preview',
                  dashboardId: 'preview',
                  title: currentMetricDef?.name || 'Preview',
                  metric: selectedMetricId,
                  visualizationType: selectedVizType as any,
                  configuration: {},
                  x: 0,
                  y: 0,
                  width: 6,
                  height: 3,
                  data: previewData || undefined,
                }}
                isLoading={isLoadingPreview}
              />
            )}
          </div>
        </div>

        {/* Quick Visualization Type Switcher */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-foreground text-[11px] uppercase tracking-wider">
              Visualization Type
            </span>
            <span className="text-[10px] font-mono text-muted-foreground">
              Unit: {currentMetricDef?.unit || '—'}
            </span>
          </div>
          <div className="grid grid-cols-5 gap-1.5">
            {[
              { id: 'stat', label: 'Stat', icon: DashboardSpeed01Icon },
              { id: 'time_series', label: 'Time', icon: ChartLineData01Icon },
              { id: 'bar', label: 'Bar', icon: PieChartIcon },
              { id: 'gauge', label: 'Gauge', icon: ViewIcon },
              { id: 'table', label: 'Table', icon: Table01Icon },
            ].map((v) => {
              const isSupported = currentMetricDef?.supportedVisualizations.includes(v.id as any);
              const isSelected = selectedVizType === v.id;
              return (
                <button
                  type="button"
                  key={v.id}
                  onClick={() => setSelectedVizType(v.id as any)}
                  className={`p-1.5 flex flex-col items-center justify-center gap-1 border rounded-none text-center transition-all ${
                    isSelected
                      ? 'border-primary bg-primary/10 text-primary font-semibold ring-1 ring-primary'
                      : isSupported
                      ? 'border-border bg-card hover:bg-muted/40 text-foreground'
                      : 'border-border/30 opacity-40 hover:opacity-70 text-muted-foreground'
                  }`}
                >
                  <HugeiconsIcon icon={v.icon} className="size-3.5" />
                  <span className="text-[9px] font-mono leading-none">{v.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-2 pt-1">
          <Button
            size="sm"
            onClick={handleAddQuickly}
            disabled={isSubmitting}
            className="h-8 gap-1 font-medium text-xs"
          >
            <HugeiconsIcon icon={Add01Icon} className="size-3.5" />
            <span>Add Panel</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleOpenBottomConfigure}
            className="h-8 gap-1 text-xs font-mono"
            title="Open query configuration pane"
          >
            <HugeiconsIcon icon={Settings02Icon} className="size-3.5" />
            <span>Configure Query</span>
          </Button>
        </div>

        {/* Categorized Metric Library */}
        <div className="space-y-4 pt-2 border-t border-border/50">
          <span className="font-semibold text-foreground block text-[11px] uppercase tracking-wider">
            Available Metrics
          </span>

          {categories.map((cat) => {
            const catMetrics = filteredCatalog.filter((m) => m.category === cat.id);
            if (catMetrics.length === 0) return null;

            return (
              <div key={cat.id} className="space-y-1.5">
                <div className="text-[10px] font-mono text-muted-foreground uppercase font-semibold">
                  {cat.label}
                </div>
                <div className="space-y-1">
                  {catMetrics.map((m) => {
                    const isSelected = selectedMetricId === m.id;
                    return (
                      <button
                        type="button"
                        key={m.id}
                        onClick={() => handleSelectMetric(m.id)}
                        className={`w-full text-left p-2 border transition-all flex flex-col gap-0.5 rounded-none ${
                          isSelected
                            ? 'border-primary bg-primary/10 shadow-xs'
                            : 'border-border/50 bg-card hover:bg-muted/40'
                        }`}
                      >
                        <div className="flex items-center justify-between text-xs font-medium">
                          <span className={isSelected ? 'text-primary font-semibold' : 'text-foreground'}>
                            {m.name}
                          </span>
                          <Badge variant="outline" className="text-[9px] font-mono px-1 py-0">
                            {m.unit}
                          </Badge>
                        </div>
                        <p className="text-[11px] text-muted-foreground line-clamp-1">
                          {m.description}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

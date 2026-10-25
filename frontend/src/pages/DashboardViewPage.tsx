import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api, type DashboardDataResponse, type DashboardWidget } from '@/lib/api';
import { PageContainer } from '@/components/layout/PageContainer';
import { Button } from '@/components/ui/button';
import { DashboardGrid } from '@/components/dashboards/DashboardGrid';
import { VisualizationBuilderDialog } from '@/components/dashboards/VisualizationBuilderDialog';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  Add01Icon,
  Edit02Icon,
  Tick02Icon,
  RefreshIcon,
  FloppyDiskIcon,
} from '@hugeicons/core-free-icons';

export function DashboardViewPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [dashboardData, setDashboardData] = useState<DashboardDataResponse | null>(null);
  const [widgets, setWidgets] = useState<DashboardWidget[]>([]);
  const [timeRange, setTimeRange] = useState('24h');
  const [isEditMode, setIsEditMode] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSavingLayout, setIsSavingLayout] = useState(false);
  const [hasUnsavedLayout, setHasUnsavedLayout] = useState(false);

  // Modal states
  const [isBuilderOpen, setIsBuilderOpen] = useState(false);
  const [editingWidget, setEditingWidget] = useState<DashboardWidget | null>(null);

  useEffect(() => {
    if (id) {
      loadData(id, timeRange);
    }
  }, [id, timeRange]);

  const loadData = async (dashboardId: string, range: string) => {
    setIsRefreshing(true);
    try {
      const data = await api.getDashboardData(dashboardId, range);
      setDashboardData(data);
      setWidgets(data.widgets || []);
      setHasUnsavedLayout(false);
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const handleSaveWidget = async (widgetData: {
    title: string;
    metric: string;
    visualizationType: string;
    configuration: Record<string, any>;
    width: number;
    height: number;
  }) => {
    if (!id) return;
    if (editingWidget) {
      // Update existing widget
      await api.updateWidget(id, editingWidget.id, widgetData);
    } else {
      // Add new widget (place after existing widgets)
      const nextY = widgets.reduce((maxY, w) => Math.max(maxY, w.y + (w.height || 3)), 0);
      await api.addWidget(id, {
        ...widgetData,
        x: 0,
        y: nextY,
      });
    }
    setEditingWidget(null);
    await loadData(id, timeRange);
  };

  const handleDeleteWidget = async (widgetId: string) => {
    if (!id) return;
    if (!window.confirm('Remove this visualization from the dashboard?')) return;
    try {
      await api.deleteWidget(id, widgetId);
      await loadData(id, timeRange);
    } catch (err) {
      console.error('Failed to delete widget:', err);
    }
  };

  const handleDuplicateWidget = async (widget: DashboardWidget) => {
    if (!id) return;
    try {
      const nextY = widgets.reduce((maxY, w) => Math.max(maxY, w.y + (w.height || 3)), 0);
      await api.addWidget(id, {
        title: `${widget.title} (Copy)`,
        metric: widget.metric,
        visualizationType: widget.visualizationType,
        configuration: widget.configuration,
        width: widget.width,
        height: widget.height,
        x: 0,
        y: nextY,
      });
      await loadData(id, timeRange);
    } catch (err) {
      console.error('Failed to duplicate widget:', err);
    }
  };

  const handleLayoutChange = (updatedWidgets: DashboardWidget[]) => {
    setWidgets(updatedWidgets);
    setHasUnsavedLayout(true);
  };

  const handleSaveLayout = async () => {
    if (!id) return;
    setIsSavingLayout(true);
    try {
      const layoutPayload = widgets.map((w) => ({
        id: w.id,
        x: w.x,
        y: w.y,
        width: w.width,
        height: w.height,
      }));
      await api.updateDashboardLayout(id, layoutPayload);
      setHasUnsavedLayout(false);
    } catch (err) {
      console.error('Failed to save layout:', err);
    } finally {
      setIsSavingLayout(false);
    }
  };

  if (isLoading && !dashboardData) {
    return (
      <PageContainer
        title="Loading Dashboard..."
        description="Fetching custom telemetry..."
        breadcrumbs={[{ label: 'Sentinel', href: '/dashboard' }, { label: 'Dashboards', href: '/dashboards' }, { label: 'Loading' }]}
      >
        <div className="py-24 flex flex-col items-center justify-center space-y-3 text-muted-foreground text-xs animate-pulse">
          <div className="size-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <span className="font-mono">Loading telemetry panels...</span>
        </div>
      </PageContainer>
    );
  }

  if (!dashboardData) {
    return (
      <PageContainer
        title="Dashboard Not Found"
        breadcrumbs={[{ label: 'Sentinel', href: '/dashboard' }, { label: 'Dashboards', href: '/dashboards' }]}
      >
        <div className="py-16 text-center space-y-3">
          <p className="text-sm text-muted-foreground">The requested custom dashboard does not exist.</p>
          <Button size="sm" onClick={() => navigate('/dashboards')}>
            Back to Dashboards
          </Button>
        </div>
      </PageContainer>
    );
  }

  const { dashboard } = dashboardData;

  return (
    <PageContainer
      title={dashboard.name}
      description={dashboard.description || 'Custom Grafana-style observability dashboard.'}
      breadcrumbs={[
        { label: 'Sentinel', href: '/dashboard' },
        { label: 'Dashboards', href: '/dashboards' },
        { label: dashboard.name },
      ]}
      action={
        <div className="flex flex-wrap items-center gap-2">
          {/* Global Time Range Selector */}
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="h-8 px-2 bg-input/20 border border-input rounded-none text-xs text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="15m">Last 15m</option>
            <option value="1h">Last 1h</option>
            <option value="6h">Last 6h</option>
            <option value="24h">Last 24h</option>
            <option value="7d">Last 7d</option>
            <option value="30d">Last 30d</option>
          </select>

          {/* Refresh Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => id && loadData(id, timeRange)}
            disabled={isRefreshing}
            className="h-8 gap-1.5 font-mono text-xs"
          >
            <HugeiconsIcon
              icon={RefreshIcon}
              className={`size-3.5 ${isRefreshing ? 'animate-spin' : ''}`}
            />
            <span className="hidden sm:inline">Refresh</span>
          </Button>

          {/* Edit Mode Toggle */}
          <Button
            variant={isEditMode ? 'default' : 'outline'}
            size="sm"
            onClick={() => {
              if (isEditMode && hasUnsavedLayout) {
                handleSaveLayout();
              }
              setIsEditMode(!isEditMode);
            }}
            className="h-8 gap-1.5 font-medium"
          >
            <HugeiconsIcon icon={isEditMode ? Tick02Icon : Edit02Icon} className="size-3.5" />
            <span>{isEditMode ? 'Done Editing' : 'Edit Dashboard'}</span>
          </Button>

          {/* Edit Mode Specific Action Buttons */}
          {isEditMode && (
            <>
              {hasUnsavedLayout && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleSaveLayout}
                  disabled={isSavingLayout}
                  className="h-8 gap-1.5 text-primary border-primary/50 font-mono text-xs"
                >
                  <HugeiconsIcon icon={FloppyDiskIcon} className="size-3.5" />
                  <span>{isSavingLayout ? 'Saving...' : 'Save Layout'}</span>
                </Button>
              )}

              <Button
                size="sm"
                onClick={() => {
                  setEditingWidget(null);
                  setIsBuilderOpen(true);
                }}
                className="h-8 gap-1.5 font-medium"
              >
                <HugeiconsIcon icon={Add01Icon} className="size-3.5" />
                <span>Add Visualization</span>
              </Button>
            </>
          )}
        </div>
      }
    >
      <div className="space-y-4">
        {/* Edit mode active banner */}
        {isEditMode && (
          <div className="p-2.5 bg-primary/10 border border-primary/30 flex items-center justify-between text-xs font-mono text-primary">
            <div className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-primary animate-pulse" />
              <span>EDIT MODE ACTIVE — Drag panels to reorder or use the panel menu to resize.</span>
            </div>
            {hasUnsavedLayout && (
              <span className="text-[11px] underline cursor-pointer" onClick={handleSaveLayout}>
                Unsaved layout changes (Click to Save)
              </span>
            )}
          </div>
        )}

        {/* Dynamic 12-Column Layout Grid */}
        <DashboardGrid
          widgets={widgets}
          isEditMode={isEditMode}
          isLoading={isRefreshing}
          onEditWidget={(widget) => {
            setEditingWidget(widget);
            setIsBuilderOpen(true);
          }}
          onDeleteWidget={handleDeleteWidget}
          onDuplicateWidget={handleDuplicateWidget}
          onUpdateLayout={handleLayoutChange}
          onAddVisualization={() => {
            setEditingWidget(null);
            setIsBuilderOpen(true);
          }}
        />
      </div>

      {/* Visualization Builder Dialog */}
      <VisualizationBuilderDialog
        open={isBuilderOpen}
        onOpenChange={setIsBuilderOpen}
        initialWidget={editingWidget}
        projectId={dashboard.projectId}
        onSave={handleSaveWidget}
      />
    </PageContainer>
  );
}

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  api,
  type DashboardDataResponse,
  type DashboardWidget,
  type MetricDefinition,
  type Api,
  type Environment,
  type Monitor,
} from '@/lib/api';
import { useWorkspaceState } from '@/components/dashboards/workspace/useWorkspaceState';
import { DashboardHeader } from '@/components/dashboards/workspace/DashboardHeader';
import { DashboardGrid } from '@/components/dashboards/DashboardGrid';
import { VisualizationDrawer } from '@/components/dashboards/workspace/VisualizationDrawer';
import { QueryPane } from '@/components/dashboards/workspace/QueryPane';

export function DashboardViewPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // Workspace layout & drawer states
  const {
    editMode,
    setEditMode,
    saveStatus,
    setSaveStatus,
    rightDrawerOpen,
    rightDrawerWidth,
    openRightDrawer,
    closeRightDrawer,
    setRightDrawerWidth,
    bottomPaneOpen,
    bottomPaneHeight,
    bottomPaneCollapsed,
    openBottomPane,
    closeBottomPane,
    toggleBottomPaneCollapse,
    setBottomPaneHeight,
    selectedWidgetId,
    setSelectedWidgetId,
  } = useWorkspaceState();

  // Data states
  const [dashboardData, setDashboardData] = useState<DashboardDataResponse | null>(null);
  const [widgets, setWidgets] = useState<DashboardWidget[]>([]);
  const [catalog, setCatalog] = useState<MetricDefinition[]>([]);
  const [apis, setApis] = useState<Api[]>([]);
  const [environments, setEnvironments] = useState<Environment[]>([]);
  const [monitors, setMonitors] = useState<Monitor[]>([]);

  // Global filters
  const [selectedApiId, setSelectedApiId] = useState<string>('');
  const [selectedEnvironmentId, setSelectedEnvironmentId] = useState<string>('');
  const [timeRange, setTimeRange] = useState<string>('24h');
  const [autoRefreshInterval, setAutoRefreshInterval] = useState<number>(0);

  // Loading & refresh states
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // Active draft widget for bottom query pane
  const [draftWidget, setDraftWidget] = useState<Partial<DashboardWidget> | null>(null);

  // Debounced layout save ref
  const saveLayoutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 1. Initial Load of Dashboard & System Resources
  useEffect(() => {
    if (id) {
      loadInitialData(id);
    }
  }, [id]);

  const loadInitialData = async (dashboardId: string) => {
    setIsLoading(true);
    try {
      const [data, cat, apisList, envsList, monsList] = await Promise.all([
        api.getDashboardData(
          dashboardId,
          timeRange,
          undefined,
          undefined,
          selectedApiId || undefined,
          selectedEnvironmentId || undefined,
        ),
        api.getMetricCatalog().catch(() => []),
        api.getApis().catch(() => []),
        api.getEnvironments().catch(() => []),
        api.getMonitors().catch(() => []),
      ]);
      setDashboardData(data);
      setWidgets(data.widgets || []);
      setCatalog(cat);
      setApis(apisList);
      setEnvironments(envsList);
      setMonitors(monsList);
      setSaveStatus('saved');
    } catch (err) {
      console.error('Failed to load dashboard:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // 2. Fetch/Refresh Telemetry Data
  const refreshTelemetry = useCallback(
    async (showLoadingSpinner = true) => {
      if (!id) return;
      if (showLoadingSpinner) setIsRefreshing(true);
      try {
        const data = await api.getDashboardData(
          id,
          timeRange,
          undefined,
          undefined,
          selectedApiId || undefined,
          selectedEnvironmentId || undefined,
        );
        setDashboardData(data);
        setWidgets(data.widgets || []);
      } catch (err) {
        console.error('Failed to refresh dashboard data:', err);
      } finally {
        if (showLoadingSpinner) setIsRefreshing(false);
      }
    },
    [id, timeRange, selectedApiId, selectedEnvironmentId],
  );

  // Trigger refresh when global time range or filters change
  useEffect(() => {
    if (id && !isLoading) {
      refreshTelemetry();
    }
  }, [id, timeRange, selectedApiId, selectedEnvironmentId, refreshTelemetry]);

  // 3. Auto Refresh Interval Handling
  useEffect(() => {
    if (autoRefreshInterval <= 0 || !id) return;
    const intervalTimer = setInterval(() => {
      refreshTelemetry(false);
    }, autoRefreshInterval * 1000);
    return () => clearInterval(intervalTimer);
  }, [autoRefreshInterval, id, refreshTelemetry]);

  // 4. Debounced Layout Autosave (Section 16 & 17)
  const handleUpdateLayout = (updatedWidgets: DashboardWidget[]) => {
    setWidgets(updatedWidgets);
    setSaveStatus('saving');

    if (saveLayoutTimerRef.current) {
      clearTimeout(saveLayoutTimerRef.current);
    }

    saveLayoutTimerRef.current = setTimeout(async () => {
      if (!id) return;
      try {
        const layoutPayload = updatedWidgets.map((w) => ({
          id: w.id,
          x: w.x,
          y: w.y,
          width: w.width,
          height: w.height,
        }));
        await api.updateDashboardLayout(id, layoutPayload);
        setSaveStatus('saved');
      } catch (err) {
        console.error('Failed to autosave layout:', err);
        setSaveStatus('error');
      }
    }, 600);
  };

  // 5. Widget Actions: Add, Edit, Duplicate, Delete
  const handleAddWidget = async (data: {
    title: string;
    metric: string;
    visualizationType: 'stat' | 'time_series' | 'bar' | 'table' | 'gauge';
    configuration: Record<string, any>;
    width: number;
    height: number;
  }) => {
    if (!id) return;
    setSaveStatus('saving');
    try {
      const nextY = widgets.reduce((maxY, w) => Math.max(maxY, w.y + (w.height || 3)), 0);
      await api.addWidget(id, {
        ...data,
        x: 0,
        y: nextY,
      });
      await refreshTelemetry(true);
      setSaveStatus('saved');
    } catch (err) {
      console.error('Failed to add widget:', err);
      setSaveStatus('error');
    }
  };

  const handleEditWidget = (widget: DashboardWidget) => {
    setSelectedWidgetId(widget.id);
    setDraftWidget({
      ...widget,
    });
    // Open bottom query pane for deep query editing
    openBottomPane(widget.id);
  };

  const handleSaveWidgetFromBottomPane = async (data: {
    title: string;
    metric: string;
    visualizationType: 'stat' | 'time_series' | 'bar' | 'table' | 'gauge';
    configuration: Record<string, any>;
    width: number;
    height: number;
  }) => {
    if (!id) return;
    setSaveStatus('saving');
    try {
      if (selectedWidgetId) {
        // Update existing widget
        await api.updateWidget(id, selectedWidgetId, data);
      } else {
        // Create new widget
        const nextY = widgets.reduce((maxY, w) => Math.max(maxY, w.y + (w.height || 3)), 0);
        await api.addWidget(id, {
          ...data,
          x: 0,
          y: nextY,
        });
      }
      closeBottomPane();
      closeRightDrawer();
      setDraftWidget(null);
      await refreshTelemetry(true);
      setSaveStatus('saved');
    } catch (err) {
      console.error('Failed to save widget configuration:', err);
      setSaveStatus('error');
    }
  };

  const handleDeleteWidget = async (widgetId: string) => {
    if (!id) return;
    if (!window.confirm('Delete this visualization panel?')) return;
    setSaveStatus('saving');
    try {
      await api.deleteWidget(id, widgetId);
      if (selectedWidgetId === widgetId) {
        closeBottomPane();
      }
      await refreshTelemetry(true);
      setSaveStatus('saved');
    } catch (err) {
      console.error('Failed to delete widget:', err);
      setSaveStatus('error');
    }
  };

  const handleDuplicateWidget = async (widget: DashboardWidget) => {
    if (!id) return;
    setSaveStatus('saving');
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
      await refreshTelemetry(true);
      setSaveStatus('saved');
    } catch (err) {
      console.error('Failed to duplicate widget:', err);
      setSaveStatus('error');
    }
  };

  // Active widget being edited in bottom pane
  const activeEditingWidget = widgets.find((w) => w.id === selectedWidgetId) || null;

  if (isLoading && !dashboardData) {
    return (
      <div className="flex-1 flex flex-col h-full bg-background">
        <div className="h-14 border-b border-border bg-card/30 flex items-center px-6 animate-pulse">
          <div className="h-5 w-48 bg-muted rounded-none" />
        </div>
        <div className="flex-1 p-6 flex flex-col items-center justify-center space-y-3 text-muted-foreground text-xs animate-pulse">
          <div className="size-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <span className="font-mono">Loading dashboard workspace...</span>
        </div>
      </div>
    );
  }

  if (!dashboardData) {
    return (
      <div className="p-8 text-center space-y-4">
        <p className="text-sm text-muted-foreground">The requested custom dashboard does not exist.</p>
        <button
          onClick={() => navigate('/dashboards')}
          className="px-3 py-1.5 text-xs bg-primary text-primary-foreground font-mono"
        >
          Back to Dashboards
        </button>
      </div>
    );
  }

  const { dashboard } = dashboardData;

  // All widgets render their metrics computed according to filter precedence (Widget > Global > Default)
  const displayedWidgets = widgets;

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-background text-foreground">
      {/* 1. Global Workspace Header */}
      <DashboardHeader
        title={dashboard.name}
        description={dashboard.description || 'API Observability and Reliability Dashboard'}
        apis={apis}
        environments={environments}
        selectedApiId={selectedApiId}
        selectedEnvironmentId={selectedEnvironmentId}
        timeRange={timeRange}
        autoRefreshInterval={autoRefreshInterval}
        isRefreshing={isRefreshing}
        isEditMode={editMode}
        saveStatus={saveStatus}
        onSelectApi={setSelectedApiId}
        onSelectEnvironment={setSelectedEnvironmentId}
        onSelectTimeRange={setTimeRange}
        onSelectAutoRefresh={setAutoRefreshInterval}
        onRefresh={() => refreshTelemetry(true)}
        onToggleEditMode={() => setEditMode(!editMode)}
        onOpenAddDrawer={() => {
          openRightDrawer();
        }}
      />

      {/* 2. Main Middle Workspace: Canvas + Right Drawer */}
      <div className="flex-1 flex min-h-0 overflow-hidden relative">
        {/* Main Canvas Scroll Area */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 min-w-0 bg-background/50 focus:outline-none">
          <DashboardGrid
            widgets={displayedWidgets}
            isEditMode={editMode}
            isLoading={isRefreshing}
            onEditWidget={handleEditWidget}
            onDeleteWidget={handleDeleteWidget}
            onDuplicateWidget={handleDuplicateWidget}
            onUpdateLayout={handleUpdateLayout}
            onAddVisualization={() => {
              openRightDrawer();
            }}
          />
        </main>

        {/* 3. Right-Side Visualization Drawer */}
        <VisualizationDrawer
          isOpen={rightDrawerOpen}
          width={rightDrawerWidth}
          catalog={catalog}
          projectId={dashboard.projectId}
          defaultApiId={selectedApiId}
          defaultEnvironmentId={selectedEnvironmentId}
          timeRange={timeRange}
          onClose={closeRightDrawer}
          onResize={setRightDrawerWidth}
          onAddWidget={handleAddWidget}
          onConfigureQuery={(draft) => {
            setDraftWidget(draft);
            setSelectedWidgetId(null);
            openBottomPane();
          }}
        />
      </div>

      {/* 4. Bottom Query / Metric Configuration Pane */}
      <QueryPane
        isOpen={bottomPaneOpen}
        isCollapsed={bottomPaneCollapsed}
        height={bottomPaneHeight}
        catalog={catalog}
        apis={apis}
        environments={environments}
        monitors={monitors}
        activeWidget={activeEditingWidget}
        draftWidget={draftWidget}
        onResize={setBottomPaneHeight}
        onToggleCollapse={toggleBottomPaneCollapse}
        onClose={closeBottomPane}
        onSaveWidget={handleSaveWidgetFromBottomPane}
        onChangeDraft={setDraftWidget}
      />
    </div>
  );
}

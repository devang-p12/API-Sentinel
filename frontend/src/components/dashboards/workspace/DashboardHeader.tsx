import type { Api, Environment } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  Add01Icon,
  Edit02Icon,
  Tick02Icon,
  RefreshIcon,
  CheckmarkCircle02Icon,
  AlertCircleIcon,
} from '@hugeicons/core-free-icons';

interface DashboardHeaderProps {
  title: string;
  description?: string;
  apis: Api[];
  environments: Environment[];
  selectedApiId: string;
  selectedEnvironmentId: string;
  timeRange: string;
  autoRefreshInterval: number; // in seconds, 0 = off
  isRefreshing: boolean;
  isEditMode: boolean;
  saveStatus: 'saved' | 'saving' | 'error' | 'idle';
  onSelectApi: (apiId: string) => void;
  onSelectEnvironment: (environmentId: string) => void;
  onSelectTimeRange: (range: string) => void;
  onSelectAutoRefresh: (seconds: number) => void;
  onRefresh: () => void;
  onToggleEditMode: () => void;
  onOpenAddDrawer: () => void;
}

export function DashboardHeader({
  title,
  description,
  apis,
  environments,
  selectedApiId,
  selectedEnvironmentId,
  timeRange,
  autoRefreshInterval,
  isRefreshing,
  isEditMode,
  saveStatus,
  onSelectApi,
  onSelectEnvironment,
  onSelectTimeRange,
  onSelectAutoRefresh,
  onRefresh,
  onToggleEditMode,
  onOpenAddDrawer,
}: DashboardHeaderProps) {
  const filteredEnvironments = environments.filter(
    (env) => !selectedApiId || env.apiId === selectedApiId,
  );

  return (
    <div className="border-b border-border bg-card/40 backdrop-blur-md px-4 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-3 shrink-0">
      {/* Title & Metadata */}
      <div className="flex flex-col min-w-0">
        <div className="flex items-center gap-2">
          <h1 className="text-base sm:text-lg font-heading font-semibold text-foreground tracking-tight truncate">
            {title}
          </h1>
          {isEditMode && (
            <Badge variant="outline" className="text-[10px] font-mono border-primary/40 text-primary bg-primary/10 px-1.5 py-0">
              EDITING
            </Badge>
          )}

          {/* Autosave Status Indicator */}
          <div className="flex items-center gap-1 font-mono text-[11px] text-muted-foreground ml-1">
            {saveStatus === 'saving' && (
              <span className="flex items-center gap-1 text-amber-500">
                <span className="size-1.5 rounded-full bg-amber-500 animate-pulse" />
                <span>Saving...</span>
              </span>
            )}
            {saveStatus === 'saved' && (
              <span className="flex items-center gap-1 text-muted-foreground/80">
                <HugeiconsIcon icon={CheckmarkCircle02Icon} className="size-3 text-emerald-500" />
                <span className="text-[10px]">Saved</span>
              </span>
            )}
            {saveStatus === 'error' && (
              <span className="flex items-center gap-1 text-destructive">
                <HugeiconsIcon icon={AlertCircleIcon} className="size-3 text-destructive" />
                <span className="text-[10px]">Couldn't save</span>
              </span>
            )}
          </div>
        </div>
        {description && (
          <p className="text-xs text-muted-foreground truncate max-w-xl">
            {description}
          </p>
        )}
      </div>

      {/* Global Controls Toolbar */}
      <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
        {/* Global API Selector */}
        <div className="flex items-center gap-1">
          <select
            value={selectedApiId}
            onChange={(e) => onSelectApi(e.target.value)}
            className="h-8 px-2 bg-input/20 border border-input rounded-none text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            title="Filter by API"
          >
            <option value="">All APIs</option>
            {apis.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>

        {/* Global Environment Selector */}
        <div className="flex items-center gap-1">
          <select
            value={selectedEnvironmentId}
            onChange={(e) => onSelectEnvironment(e.target.value)}
            className="h-8 px-2 bg-input/20 border border-input rounded-none text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            title="Filter by Environment"
          >
            <option value="">All Environments</option>
            {filteredEnvironments.map((env) => (
              <option key={env.id} value={env.id}>
                {env.name}
              </option>
            ))}
          </select>
        </div>

        {/* Global Time Range Selector */}
        <select
          value={timeRange}
          onChange={(e) => onSelectTimeRange(e.target.value)}
          className="h-8 px-2 bg-input/20 border border-input rounded-none text-xs text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-ring"
          title="Select Global Time Range"
        >
          <option value="5m">Last 5 min</option>
          <option value="15m">Last 15 min</option>
          <option value="30m">Last 30 min</option>
          <option value="1h">Last 1 hour</option>
          <option value="6h">Last 6 hours</option>
          <option value="12h">Last 12 hours</option>
          <option value="24h">Last 24 hours</option>
          <option value="7d">Last 7 days</option>
          <option value="30d">Last 30 days</option>
        </select>

        {/* Auto Refresh Interval */}
        <select
          value={autoRefreshInterval}
          onChange={(e) => onSelectAutoRefresh(Number(e.target.value))}
          className="h-8 px-2 bg-input/20 border border-input rounded-none text-xs text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-ring"
          title="Auto Refresh Rate"
        >
          <option value={0}>Auto: Off</option>
          <option value={10}>Auto: 10s</option>
          <option value={30}>Auto: 30s</option>
          <option value={60}>Auto: 1m</option>
          <option value={300}>Auto: 5m</option>
        </select>

        {/* Manual Refresh Button */}
        <Button
          variant="outline"
          size="sm"
          onClick={onRefresh}
          disabled={isRefreshing}
          className="h-8 gap-1 font-mono text-xs"
          title="Refresh telemetry now"
        >
          <HugeiconsIcon
            icon={RefreshIcon}
            className={`size-3.5 ${isRefreshing ? 'animate-spin' : ''}`}
          />
          <span className="hidden sm:inline">Refresh</span>
        </Button>

        {/* Add Visualization Button */}
        <Button
          size="sm"
          onClick={onOpenAddDrawer}
          className="h-8 gap-1.5 font-medium"
        >
          <HugeiconsIcon icon={Add01Icon} className="size-3.5" />
          <span>Add visualization</span>
        </Button>

        {/* View / Edit Mode Toggle */}
        <Button
          variant={isEditMode ? 'default' : 'outline'}
          size="sm"
          onClick={onToggleEditMode}
          className="h-8 gap-1.5 font-medium"
        >
          <HugeiconsIcon icon={isEditMode ? Tick02Icon : Edit02Icon} className="size-3.5" />
          <span>{isEditMode ? 'Exit Edit' : 'Edit'}</span>
        </Button>
      </div>
    </div>
  );
}

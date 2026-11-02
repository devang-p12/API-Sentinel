import type { DashboardWidget } from '@/lib/api';
import { StatRenderer } from './StatRenderer';
import { TimeSeriesRenderer } from './TimeSeriesRenderer';
import { BarChartRenderer } from './BarChartRenderer';
import { GaugeRenderer } from './GaugeRenderer';
import { TableRenderer } from './TableRenderer';

interface WidgetRendererProps {
  widget: DashboardWidget;
  isLoading?: boolean;
}

export function WidgetRenderer({ widget, isLoading }: WidgetRendererProps) {
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[140px] text-muted-foreground text-xs p-6 space-y-2 animate-pulse">
        <div className="size-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        <span className="font-mono text-[11px]">Querying telemetry engine...</span>
      </div>
    );
  }

  const data = widget.data;
  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[140px] text-muted-foreground text-xs p-4 text-center">
        <span className="font-semibold text-foreground">No Telemetry Recorded</span>
        <span className="text-[11px] mt-1">No executions match the configured filters for this metric.</span>
      </div>
    );
  }

  switch (widget.visualizationType) {
    case 'stat':
      return <StatRenderer data={data} metric={widget.metric} />;
    case 'time_series':
      return <TimeSeriesRenderer data={data} metric={widget.metric} />;
    case 'bar':
      return <BarChartRenderer data={data} metric={widget.metric} />;
    case 'gauge':
      return <GaugeRenderer data={data} metric={widget.metric} />;
    case 'table':
      return <TableRenderer data={data} metric={widget.metric} />;
    default:
      return (
        <div className="flex flex-col items-center justify-center h-full min-h-[140px] text-muted-foreground text-xs p-4 text-center font-mono space-y-1">
          <span className="text-destructive font-semibold">Visualization Locked</span>
          <span className="text-[10px] text-muted-foreground">
            {String(widget.visualizationType)} is not supported for {widget.metric}.
          </span>
        </div>
      );
  }
}

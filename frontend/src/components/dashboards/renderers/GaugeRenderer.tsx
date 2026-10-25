import type { MetricQueryResult } from '@/lib/api';

interface GaugeRendererProps {
  data: MetricQueryResult;
  metric: string;
}

export function GaugeRenderer({ data, metric }: GaugeRendererProps) {
  const current = data.summary.current;
  const isPercent = data.unit === '%';

  // Compute fill percentage: 0 to 100
  let fillPct = 0;
  if (current !== null) {
    if (isPercent) {
      fillPct = Math.min(100, Math.max(0, current));
    } else {
      // For latency: scale relative to max or 1000ms threshold
      const maxTarget = data.summary.max && data.summary.max > 0 ? data.summary.max : 1000;
      fillPct = Math.min(100, Math.max(0, (current / maxTarget) * 100));
    }
  }

  // Semi-circle SVG gauge parameters
  const radius = 65;
  const strokeWidth = 10;
  const circumference = Math.PI * radius; // Half-circle
  const strokeDashoffset = circumference - (fillPct / 100) * circumference;

  let gaugeColor = 'text-primary';
  if (isPercent) {
    if (metric === 'error_rate') {
      gaugeColor = (current ?? 0) === 0 ? 'text-emerald-500' : (current ?? 0) < 5 ? 'text-amber-500' : 'text-destructive';
    } else {
      gaugeColor = (current ?? 0) >= 99 ? 'text-emerald-500' : (current ?? 0) >= 90 ? 'text-amber-500' : 'text-destructive';
    }
  }

  return (
    <div className="flex flex-col items-center justify-between h-full p-4 select-none">
      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider text-center">
        {data.metricName}
      </div>

      <div className="relative flex flex-col items-center justify-center my-auto">
        <svg width="180" height="110" viewBox="0 0 180 110" className="overflow-visible">
          {/* Background Arc */}
          <path
            d="M 20 95 A 65 65 0 0 1 160 95"
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            className="text-muted/40"
            strokeLinecap="round"
          />

          {/* Value Arc */}
          <path
            d="M 20 95 A 65 65 0 0 1 160 95"
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            className={`${gaugeColor} transition-all duration-700 ease-out`}
          />
        </svg>

        {/* Center Readout */}
        <div className="absolute bottom-2 flex flex-col items-center text-center">
          <span className="text-3xl font-bold font-mono tracking-tight text-foreground">
            {current !== null ? current : '—'}
          </span>
          <span className="text-xs font-mono text-muted-foreground">{data.unit}</span>
        </div>
      </div>

      <div className="flex items-center justify-between w-full text-[10px] font-mono text-muted-foreground px-4 border-t border-border/40 pt-1.5">
        <span>0{isPercent ? '%' : ''}</span>
        <span>Target: {isPercent ? '100%' : '<500ms'}</span>
        <span>{isPercent ? '100%' : `${data.summary.max || 1000}ms`}</span>
      </div>
    </div>
  );
}

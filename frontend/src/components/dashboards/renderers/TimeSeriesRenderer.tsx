import { useState } from 'react';
import type { MetricQueryResult } from '@/lib/api';

interface TimeSeriesRendererProps {
  data: MetricQueryResult;
  metric: string;
}

export function TimeSeriesRenderer({ data }: TimeSeriesRendererProps) {
  const points = data.timeSeries || [];
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  // Filter out any invalid/null points
  const validPoints = points.filter(
    (p): p is { timestamp: string; value: number; label?: string } =>
      p.value !== null && p.value !== undefined && !isNaN(p.value),
  );

  if (validPoints.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[160px] text-muted-foreground text-xs p-4 text-center">
        <span>No telemetry recordings in selected time window</span>
      </div>
    );
  }

  const numericValues = validPoints.map((p) => p.value);
  const minVal = Math.min(...numericValues);
  const maxVal = Math.max(...numericValues);
  const valRange = maxVal - minVal === 0 ? Math.max(1, maxVal * 0.1 || 1) : maxVal - minVal;

  const width = 600;
  const height = 180;
  const padX = 40;
  const padY = 24;
  const chartW = width - padX * 2;
  const chartH = height - padY * 2;

  // Resolve start and end timestamps from telemetry timeRange metadata if available
  const fromMs = data.timeRange?.from
    ? new Date(data.timeRange.from).getTime()
    : new Date(validPoints[0].timestamp).getTime();
  const toMs = data.timeRange?.to
    ? new Date(data.timeRange.to).getTime()
    : new Date(validPoints[validPoints.length - 1].timestamp).getTime();
  const timeSpan = Math.max(1, toMs - fromMs);

  const coords = validPoints.map((p) => {
    const t = new Date(p.timestamp).getTime();
    // Map X coordinate according to its true position on the timeline
    const progress = Math.max(0, Math.min(1, (t - fromMs) / timeSpan));
    const x = validPoints.length === 1 && !data.timeRange?.from
      ? padX + chartW / 2
      : padX + progress * chartW;
    const y = padY + chartH - ((p.value - minVal) / valRange) * chartH;
    return { x, y, point: p };
  });

  const isSinglePoint = coords.length === 1;

  const linePath = coords.reduce((acc, curr, idx) => {
    return idx === 0 ? `M ${curr.x} ${curr.y}` : `${acc} L ${curr.x} ${curr.y}`;
  }, '');

  const areaPath = !isSinglePoint
    ? `${linePath} L ${coords[coords.length - 1].x} ${height - padY} L ${coords[0].x} ${height - padY} Z`
    : '';

  const hovered = hoveredIndex !== null ? coords[hoveredIndex] : null;

  // Helper to format timestamps for axis
  const formatAxisDate = (isoStr: string) => {
    const d = new Date(isoStr);
    const isMultiDay = timeSpan > 24 * 60 * 60 * 1000;
    if (isMultiDay) {
      return d.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    }
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const startLabel = data.timeRange?.from
    ? formatAxisDate(data.timeRange.from)
    : formatAxisDate(validPoints[0].timestamp);
  const endLabel = data.timeRange?.to
    ? formatAxisDate(data.timeRange.to)
    : formatAxisDate(validPoints[validPoints.length - 1].timestamp);

  return (
    <div className="flex flex-col h-full justify-between p-3 select-none">
      {/* Header telemetry info */}
      <div className="flex items-center justify-between text-xs px-1">
        <div className="flex items-center gap-2">
          <span className="font-mono font-semibold text-foreground text-sm">
            {hovered ? `${hovered.point.value} ${data.unit}` : `${data.summary.current ?? '—'} ${data.unit}`}
          </span>
          {hovered ? (
            <span className="text-[11px] font-mono text-muted-foreground">
              @ {new Date(hovered.point.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          ) : isSinglePoint ? (
            <span className="text-[10px] font-mono text-amber-500 bg-amber-500/10 px-1.5 py-0.5 border border-amber-500/20">
              1 recorded point
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-3 text-[10px] font-mono text-muted-foreground">
          <span>Min: {minVal}{data.unit}</span>
          <span>Max: {maxVal}{data.unit}</span>
          <span>Avg: {data.summary.avg ?? '—'}{data.unit}</span>
        </div>
      </div>

      {/* SVG Canvas */}
      <div className="relative w-full h-full min-h-[140px] mt-1">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-full overflow-visible"
          preserveAspectRatio="none"
          onMouseLeave={() => setHoveredIndex(null)}
        >
          <defs>
            <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="currentColor" stopOpacity="0.25" className="text-primary" />
              <stop offset="100%" stopColor="currentColor" stopOpacity="0.0" className="text-primary" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          <line
            x1={padX}
            y1={padY}
            x2={width - padX}
            y2={padY}
            stroke="currentColor"
            strokeDasharray="3 3"
            className="text-border/40"
          />
          <line
            x1={padX}
            y1={padY + chartH / 2}
            x2={width - padX}
            y2={padY + chartH / 2}
            stroke="currentColor"
            strokeDasharray="3 3"
            className="text-border/40"
          />
          <line
            x1={padX}
            y1={height - padY}
            x2={width - padX}
            y2={height - padY}
            stroke="currentColor"
            className="text-border"
          />

          {/* Single point guideline if only 1 point is recorded in the entire window */}
          {isSinglePoint && (
            <line
              x1={padX}
              y1={coords[0].y}
              x2={width - padX}
              y2={coords[0].y}
              stroke="currentColor"
              strokeDasharray="4 4"
              className="text-primary/40"
            />
          )}

          {/* Area Fill */}
          {!isSinglePoint && <path d={areaPath} fill="url(#chartGradient)" />}

          {/* Main Trend Line */}
          {!isSinglePoint && (
            <path
              d={linePath}
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-primary"
            />
          )}

          {/* Interactive Data Points and Crosshair */}
          {coords.map((c, i) => (
            <g key={i}>
              {/* Beacon halo for single isolated points */}
              {isSinglePoint && (
                <circle
                  cx={c.x}
                  cy={c.y}
                  r={8}
                  className="fill-primary/20 animate-ping pointer-events-none"
                />
              )}
              <circle
                cx={c.x}
                cy={c.y}
                r={isSinglePoint ? 4.5 : hoveredIndex === i ? 4 : 2}
                className={
                  isSinglePoint || hoveredIndex === i
                    ? 'fill-primary stroke-background stroke-2'
                    : 'fill-primary/70'
                }
              />
              {/* Invisible touch/mouse target */}
              <rect
                x={c.x - Math.max(12, chartW / coords.length / 2)}
                y={0}
                width={Math.max(24, chartW / coords.length)}
                height={height}
                fill="transparent"
                className="cursor-crosshair"
                onMouseEnter={() => setHoveredIndex(i)}
              />
            </g>
          ))}

          {/* Active Hover Crosshair Line */}
          {hovered && (
            <line
              x1={hovered.x}
              y1={padY}
              x2={hovered.x}
              y2={height - padY}
              stroke="currentColor"
              strokeDasharray="2 2"
              className="text-primary/70 pointer-events-none"
            />
          )}
        </svg>
      </div>

      {/* Time axis range */}
      <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground px-1 mt-1 border-t border-border/40 pt-1">
        <span>{startLabel}</span>
        {isSinglePoint && (
          <span className="text-[9px] text-muted-foreground/70">
            Recorded at {new Date(coords[0].point.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
        <span>{endLabel}</span>
      </div>
    </div>
  );
}

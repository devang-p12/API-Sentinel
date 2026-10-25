import { useState } from 'react';
import type { MetricQueryResult } from '@/lib/api';

interface TimeSeriesRendererProps {
  data: MetricQueryResult;
  metric: string;
}

export function TimeSeriesRenderer({ data }: TimeSeriesRendererProps) {
  const points = data.timeSeries || [];
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  if (points.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[160px] text-muted-foreground text-xs p-4 text-center">
        <span>No time-series datapoints in selected window</span>
      </div>
    );
  }

  const values = points.map((p) => p.value);
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const valRange = maxVal - minVal === 0 ? 1 : maxVal - minVal;

  const width = 600;
  const height = 180;
  const padX = 40;
  const padY = 24;
  const chartW = width - padX * 2;
  const chartH = height - padY * 2;

  const coords = points.map((p, i) => {
    const x = points.length === 1 ? padX + chartW / 2 : padX + (i / (points.length - 1)) * chartW;
    const y = padY + chartH - ((p.value - minVal) / valRange) * chartH;
    return { x, y, point: p };
  });

  const linePath = coords.reduce((acc, curr, idx) => {
    return idx === 0 ? `M ${curr.x} ${curr.y}` : `${acc} L ${curr.x} ${curr.y}`;
  }, '');

  const areaPath = `${linePath} L ${coords[coords.length - 1].x} ${height - padY} L ${coords[0].x} ${height - padY} Z`;

  const hovered = hoveredIndex !== null ? coords[hoveredIndex] : null;

  return (
    <div className="flex flex-col h-full justify-between p-3 select-none">
      {/* Header telemetry info */}
      <div className="flex items-center justify-between text-xs px-1">
        <div className="flex items-center gap-2">
          <span className="font-mono font-semibold text-foreground text-sm">
            {hovered ? `${hovered.point.value} ${data.unit}` : `${data.summary.current ?? '—'} ${data.unit}`}
          </span>
          {hovered && (
            <span className="text-[11px] font-mono text-muted-foreground">
              @ {new Date(hovered.point.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 text-[10px] font-mono text-muted-foreground">
          <span>Min: {minVal}{data.unit}</span>
          <span>Max: {maxVal}{data.unit}</span>
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

          {/* Area Fill */}
          <path d={areaPath} fill="url(#chartGradient)" />

          {/* Main Trend Line */}
          <path
            d={linePath}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-primary"
          />

          {/* Interactive Data Points and Crosshair */}
          {coords.map((c, i) => (
            <g key={i}>
              <circle
                cx={c.x}
                cy={c.y}
                r={hoveredIndex === i ? 4 : 2}
                className={hoveredIndex === i ? 'fill-primary stroke-background stroke-2' : 'fill-primary/60'}
              />
              {/* Invisible touch/mouse target */}
              <rect
                x={c.x - (chartW / points.length) / 2}
                y={0}
                width={chartW / points.length}
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
        <span>{new Date(points[0].timestamp).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
        <span>{new Date(points[points.length - 1].timestamp).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
      </div>
    </div>
  );
}

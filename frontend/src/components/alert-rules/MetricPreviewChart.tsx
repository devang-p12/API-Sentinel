import { useState } from 'react';
import type { MetricQueryResult } from '@/lib/api';

interface MetricPreviewChartProps {
  data: MetricQueryResult | null;
  threshold?: number;
  unit?: string;
  metricName?: string;
  isLoading?: boolean;
  error?: string | null;
  height?: number;
}

export function MetricPreviewChart({
  data,
  threshold,
  unit: propUnit,
  metricName,
  isLoading = false,
  error = null,
  height = 180,
}: MetricPreviewChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const unit = data?.unit || propUnit || '';
  const points = data?.timeSeries || [];

  if (isLoading) {
    return (
      <div
        className="flex flex-col items-center justify-center border border-border/60 bg-muted/20 rounded-md p-6 text-xs text-muted-foreground font-mono"
        style={{ minHeight: `${height}px` }}
      >
        <div className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin mb-2" />
        <span>Loading metric telemetry...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="flex flex-col items-center justify-center border border-destructive/30 bg-destructive/5 rounded-md p-6 text-xs text-destructive font-mono text-center"
        style={{ minHeight: `${height}px` }}
      >
        <span>Error querying metric data</span>
        <span className="text-[11px] text-muted-foreground mt-1">{error}</span>
      </div>
    );
  }

  if (points.length === 0) {
    return (
      <div
        className="flex flex-col items-center justify-center border border-dashed border-border/80 bg-muted/10 rounded-md p-6 text-xs text-muted-foreground font-mono text-center"
        style={{ minHeight: `${height}px` }}
      >
        <span>No metric data available for the selected scope and time range.</span>
        <span className="text-[11px] text-muted-foreground/70 mt-1">
          Historical chart will render once monitor checks record execution telemetry.
        </span>
      </div>
    );
  }

  const values = points.map((p) => (p.value !== null && !isNaN(p.value) ? p.value : 0));
  let minVal = Math.min(...values);
  let maxVal = Math.max(...values);

  // If threshold is provided, include it in the Y-scale calculation so the threshold line is visible
  if (threshold !== undefined && !isNaN(threshold)) {
    minVal = Math.min(minVal, threshold);
    maxVal = Math.max(maxVal, threshold);
  }

  // Add small padding to Y-domain
  const rawRange = maxVal - minVal;
  const padding = rawRange === 0 ? Math.max(maxVal * 0.1, 1) : rawRange * 0.12;
  const yMin = Math.max(0, minVal - padding);
  const yMax = maxVal + padding;
  const yRange = yMax - yMin === 0 ? 1 : yMax - yMin;

  const width = 640;
  const padX = 45;
  const padY = 24;
  const chartW = width - padX * 2;
  const chartH = height - padY * 2;

  const coords = points.map((p, i) => {
    const val = p.value !== null && !isNaN(p.value) ? p.value : 0;
    const x = points.length === 1 ? padX + chartW / 2 : padX + (i / (points.length - 1)) * chartW;
    const y = padY + chartH - ((val - yMin) / yRange) * chartH;
    return { x, y, point: p, val };
  });

  const linePath = coords.reduce((acc, curr, idx) => {
    return idx === 0 ? `M ${curr.x} ${curr.y}` : `${acc} L ${curr.x} ${curr.y}`;
  }, '');

  const areaPath = `${linePath} L ${coords[coords.length - 1].x} ${height - padY} L ${coords[0].x} ${height - padY} Z`;

  // Threshold Y coordinate
  const thresholdY =
    threshold !== undefined && !isNaN(threshold)
      ? padY + chartH - ((threshold - yMin) / yRange) * chartH
      : null;

  const hovered = hoveredIndex !== null ? coords[hoveredIndex] : null;

  return (
    <div className="flex flex-col border border-border/80 bg-card rounded-md p-3 select-none">
      {/* Header telemetry info */}
      <div className="flex items-center justify-between text-xs pb-2 border-b border-border/40 font-mono">
        <div className="flex items-center gap-2">
          {metricName && <span className="text-muted-foreground">{metricName}:</span>}
          <span className="font-semibold text-foreground">
            {hovered
              ? `${hovered.val.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${unit}`
              : data?.summary?.current !== null && data?.summary?.current !== undefined
                ? `${data.summary.current.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${unit}`
                : `${coords[coords.length - 1]?.val.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${unit}`}
          </span>
          {hovered && (
            <span className="text-[11px] text-muted-foreground">
              @ {new Date(hovered.point.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
          {threshold !== undefined && !isNaN(threshold) && (
            <span className="text-destructive font-medium">
              Threshold: {threshold} {unit}
            </span>
          )}
          <span>Min: {Math.round(minVal * 10) / 10}</span>
          <span>Max: {Math.round(maxVal * 10) / 10}</span>
        </div>
      </div>

      {/* SVG Canvas */}
      <div className="relative w-full mt-2" style={{ height: `${height}px` }}>
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-full overflow-visible"
          preserveAspectRatio="none"
          onMouseLeave={() => setHoveredIndex(null)}
        >
          <defs>
            <linearGradient id="metricPreviewGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--primary, #3b82f6)" stopOpacity="0.2" />
              <stop offset="100%" stopColor="var(--primary, #3b82f6)" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          <line
            x1={padX}
            y1={padY}
            x2={width - padX}
            y2={padY}
            stroke="currentColor"
            strokeOpacity="0.08"
            strokeDasharray="2 2"
          />
          <line
            x1={padX}
            y1={padY + chartH / 2}
            x2={width - padX}
            y2={padY + chartH / 2}
            stroke="currentColor"
            strokeOpacity="0.08"
            strokeDasharray="2 2"
          />
          <line
            x1={padX}
            y1={height - padY}
            x2={width - padX}
            y2={height - padY}
            stroke="currentColor"
            strokeOpacity="0.15"
          />

          {/* Area fill */}
          <path d={areaPath} fill="url(#metricPreviewGradient)" />

          {/* Line stroke */}
          <path
            d={linePath}
            fill="none"
            stroke="var(--primary, #3b82f6)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Threshold reference line */}
          {thresholdY !== null && thresholdY >= padY && thresholdY <= height - padY && (
            <g>
              <line
                x1={padX}
                y1={thresholdY}
                x2={width - padX}
                y2={thresholdY}
                stroke="var(--destructive, #ef4444)"
                strokeWidth="1.5"
                strokeDasharray="4 4"
              />
              <text
                x={width - padX - 4}
                y={thresholdY - 4}
                fill="var(--destructive, #ef4444)"
                fontSize="9"
                fontWeight="500"
                fontFamily="monospace"
                textAnchor="end"
              >
                threshold ({threshold} {unit})
              </text>
            </g>
          )}

          {/* Points & Interactive hover targets */}
          {coords.map((c, i) => (
            <g key={i}>
              <circle
                cx={c.x}
                cy={c.y}
                r={hoveredIndex === i ? 4 : points.length < 25 ? 2.5 : 1.5}
                className={
                  hoveredIndex === i
                    ? 'fill-foreground stroke-background stroke-2'
                    : 'fill-primary'
                }
              />
              {/* Invisible wider target for hovering */}
              <rect
                x={c.x - (chartW / (points.length * 2 || 1))}
                y={0}
                width={Math.max(12, chartW / (points.length || 1))}
                height={height}
                fill="transparent"
                onMouseEnter={() => setHoveredIndex(i)}
                className="cursor-crosshair"
              />
            </g>
          ))}

          {/* Active hover guideline */}
          {hovered && (
            <line
              x1={hovered.x}
              y1={padY}
              x2={hovered.x}
              y2={height - padY}
              stroke="currentColor"
              strokeOpacity="0.3"
              strokeDasharray="2 2"
            />
          )}
        </svg>
      </div>

      {/* Time window axis footer */}
      <div className="flex justify-between items-center text-[10px] text-muted-foreground font-mono mt-1 px-1">
        <span>{new Date(points[0].timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
        <span className="text-muted-foreground/60">Historical Telemetry Window</span>
        <span>
          {new Date(points[points.length - 1].timestamp).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </span>
      </div>
    </div>
  );
}

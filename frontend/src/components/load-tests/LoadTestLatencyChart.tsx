import { useState } from 'react';
import type { LoadTestSample } from '@/lib/api';

interface LoadTestLatencyChartProps {
  samples: LoadTestSample[];
  className?: string;
}

export function LoadTestLatencyChart({ samples, className = '' }: LoadTestLatencyChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  if (!samples || samples.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-48 border border-border/40 rounded-md bg-card/20 text-muted-foreground text-xs p-4 text-center">
        <span>No latency samples recorded yet</span>
      </div>
    );
  }

  // Calculate min & max bounds
  const p50Values = samples.map((s) => s.p50Latency ?? s.avgLatency);
  const p95Values = samples.map((s) => s.p95Latency);
  const p99Values = samples.map((s) => s.p99Latency ?? s.p95Latency);

  const allVals = [...p50Values, ...p95Values, ...p99Values];
  const minVal = 0;
  const maxVal = Math.max(10, Math.ceil(Math.max(...allVals) * 1.15));
  const valRange = maxVal - minVal;

  const width = 800;
  const height = 240;
  const padLeft = 55;
  const padRight = 20;
  const padTop = 20;
  const padBottom = 35;

  const chartW = width - padLeft - padRight;
  const chartH = height - padTop - padBottom;

  const count = samples.length;

  const getCoords = (values: number[]) => {
    return values.map((val, i) => {
      const x = count === 1 ? padLeft + chartW / 2 : padLeft + (i / (count - 1)) * chartW;
      const y = padTop + chartH - ((val - minVal) / valRange) * chartH;
      return { x, y, val };
    });
  };

  const p50Coords = getCoords(p50Values);
  const p95Coords = getCoords(p95Values);
  const p99Coords = getCoords(p99Values);

  const buildPath = (coords: Array<{ x: number; y: number }>) => {
    return coords.reduce((acc, curr, idx) => {
      return idx === 0 ? `M ${curr.x} ${curr.y}` : `${acc} L ${curr.x} ${curr.y}`;
    }, '');
  };

  const p50Path = buildPath(p50Coords);
  const p95Path = buildPath(p95Coords);
  const p99Path = buildPath(p99Coords);

  // Y-axis grid ticks (4 steps)
  const yTicks = [0, 0.33, 0.66, 1].map((pct) => {
    const val = Math.round(minVal + pct * valRange);
    const y = padTop + chartH - pct * chartH;
    return { val, y };
  });

  // X-axis ticks (relative seconds)
  const xTicks = samples
    .filter((_, i) => count <= 8 || i % Math.ceil(count / 7) === 0 || i === count - 1)
    .map((s) => {
      const i = samples.indexOf(s);
      const x = count === 1 ? padLeft + chartW / 2 : padLeft + (i / (count - 1)) * chartW;
      return { label: `${s.relativeSeconds}s`, x };
    });

  const hoveredSample = hoveredIndex !== null ? samples[hoveredIndex] : null;
  const hoveredX =
    hoveredIndex !== null
      ? count === 1
        ? padLeft + chartW / 2
        : padLeft + (hoveredIndex / (count - 1)) * chartW
      : null;

  return (
    <div className={`flex flex-col border border-border/50 rounded-lg bg-card/40 p-4 select-none ${className}`}>
      {/* Header telemetry and legend */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3 pb-3 border-b border-border/40 text-xs">
        <div>
          <div className="font-medium text-foreground text-sm">Latency Over Time</div>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Percentiles measured across sample intervals
          </p>
        </div>

        <div className="flex items-center gap-4 text-xs font-mono">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-0.5 bg-sky-400 inline-block rounded-full" />
            <span className="text-muted-foreground text-[11px]">P50</span>
            {hoveredSample && (
              <span className="text-foreground font-semibold">
                {hoveredSample.p50Latency ?? hoveredSample.avgLatency}ms
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-0.5 bg-amber-400 inline-block rounded-full" />
            <span className="text-muted-foreground text-[11px]">P95</span>
            {hoveredSample && (
              <span className="text-foreground font-semibold">
                {hoveredSample.p95Latency}ms
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-0.5 bg-rose-400 inline-block rounded-full" />
            <span className="text-muted-foreground text-[11px]">P99</span>
            {hoveredSample && (
              <span className="text-foreground font-semibold">
                {hoveredSample.p99Latency ?? hoveredSample.p95Latency}ms
              </span>
            )}
          </div>
          {hoveredSample && (
            <span className="text-muted-foreground text-[11px] pl-2 border-l border-border/60">
              @{hoveredSample.relativeSeconds}s
            </span>
          )}
        </div>
      </div>

      {/* SVG Canvas */}
      <div className="relative w-full h-56">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-full overflow-visible"
          preserveAspectRatio="none"
          onMouseLeave={() => setHoveredIndex(null)}
        >
          {/* Y-axis grid lines */}
          {yTicks.map((t, idx) => (
            <g key={idx}>
              <line
                x1={padLeft}
                y1={t.y}
                x2={width - padRight}
                y2={t.y}
                stroke="currentColor"
                strokeDasharray="3 3"
                className="text-border/40"
              />
              <text
                x={padLeft - 8}
                y={t.y + 4}
                textAnchor="end"
                className="fill-muted-foreground text-[10px] font-mono"
              >
                {t.val}ms
              </text>
            </g>
          ))}

          {/* X-axis labels */}
          {xTicks.map((t, idx) => (
            <text
              key={idx}
              x={t.x}
              y={height - 8}
              textAnchor="middle"
              className="fill-muted-foreground text-[10px] font-mono"
            >
              {t.label}
            </text>
          ))}

          {/* Chart Curves */}
          {/* P99 (Rose) */}
          <path
            d={p99Path}
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            className="text-rose-400"
          />

          {/* P95 (Amber) */}
          <path
            d={p95Path}
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            className="text-amber-400"
          />

          {/* P50 (Sky) */}
          <path
            d={p50Path}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="text-sky-400"
          />

          {/* Hover guideline and interactive overlay */}
          {hoveredX !== null && (
            <line
              x1={hoveredX}
              y1={padTop}
              x2={hoveredX}
              y2={padTop + chartH}
              stroke="currentColor"
              strokeDasharray="2 2"
              className="text-foreground/60"
            />
          )}

          {/* Transparent hit boxes for hovering */}
          {samples.map((_, i) => {
            const stepW = chartW / Math.max(1, count - 1);
            const x = count === 1 ? padLeft : padLeft + i * stepW - stepW / 2;
            return (
              <rect
                key={i}
                x={x}
                y={padTop}
                width={count === 1 ? chartW : stepW}
                height={chartH}
                fill="transparent"
                onMouseEnter={() => setHoveredIndex(i)}
                className="cursor-crosshair"
              />
            );
          })}
        </svg>
      </div>
    </div>
  );
}

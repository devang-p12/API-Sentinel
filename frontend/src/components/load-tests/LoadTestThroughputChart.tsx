import { useState } from 'react';
import type { LoadTestSample } from '@/lib/api';

interface LoadTestThroughputChartProps {
  samples: LoadTestSample[];
  className?: string;
}

export function LoadTestThroughputChart({
  samples,
  className = '',
}: LoadTestThroughputChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  if (!samples || samples.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-48 border border-border/40 rounded-md bg-card/20 text-muted-foreground text-xs p-4 text-center">
        <span>No throughput samples recorded yet</span>
      </div>
    );
  }

  const rpsValues = samples.map((s) => s.requestsPerSecond);
  const vuValues = samples.map((s) => s.activeUsers);

  const maxRps = Math.max(1, Math.ceil(Math.max(...rpsValues) * 1.15));
  const maxVu = Math.max(1, Math.max(...vuValues));

  const width = 800;
  const height = 240;
  const padLeft = 55;
  const padRight = 50;
  const padTop = 20;
  const padBottom = 35;

  const chartW = width - padLeft - padRight;
  const chartH = height - padTop - padBottom;
  const count = samples.length;

  // RPS coordinates (Left Axis)
  const rpsCoords = rpsValues.map((val, i) => {
    const x = count === 1 ? padLeft + chartW / 2 : padLeft + (i / (count - 1)) * chartW;
    const y = padTop + chartH - (val / maxRps) * chartH;
    return { x, y, val };
  });

  // VU coordinates (Right Axis)
  const vuCoords = vuValues.map((val, i) => {
    const x = count === 1 ? padLeft + chartW / 2 : padLeft + (i / (count - 1)) * chartW;
    const y = padTop + chartH - (val / (maxVu * 1.15 || 1)) * chartH;
    return { x, y, val };
  });

  const rpsPath = rpsCoords.reduce((acc, curr, idx) => {
    return idx === 0 ? `M ${curr.x} ${curr.y}` : `${acc} L ${curr.x} ${curr.y}`;
  }, '');

  const rpsArea = `${rpsPath} L ${rpsCoords[rpsCoords.length - 1].x} ${padTop + chartH} L ${rpsCoords[0].x} ${padTop + chartH} Z`;

  const vuPath = vuCoords.reduce((acc, curr, idx) => {
    return idx === 0 ? `M ${curr.x} ${curr.y}` : `${acc} L ${curr.x} ${curr.y}`;
  }, '');

  // Y-axis ticks (Left: RPS)
  const yTicks = [0, 0.33, 0.66, 1].map((pct) => {
    const val = Math.round(pct * maxRps);
    const y = padTop + chartH - pct * chartH;
    return { val, y };
  });

  // X-axis ticks (seconds)
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
          <div className="font-medium text-foreground text-sm">Throughput & Virtual Users</div>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Requests executed per second and active concurrency
          </p>
        </div>

        <div className="flex items-center gap-4 text-xs font-mono">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-0.5 bg-emerald-400 inline-block rounded-full" />
            <span className="text-muted-foreground text-[11px]">RPS</span>
            {hoveredSample && (
              <span className="text-foreground font-semibold">
                {hoveredSample.requestsPerSecond}/s
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-0.5 bg-indigo-400 inline-block rounded-full" />
            <span className="text-muted-foreground text-[11px]">Active VUs</span>
            {hoveredSample && (
              <span className="text-foreground font-semibold">
                {hoveredSample.activeUsers}
              </span>
            )}
          </div>
          {hoveredSample && (
            <span className="text-muted-foreground text-[11px] pl-2 border-l border-border/60">
              Total reqs: {hoveredSample.totalRequestsSoFar}
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
          <defs>
            <linearGradient id="rpsAreaGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="currentColor" stopOpacity="0.2" className="text-emerald-500" />
              <stop offset="100%" stopColor="currentColor" stopOpacity="0.0" className="text-emerald-500" />
            </linearGradient>
          </defs>

          {/* Left Y-axis grid lines (RPS) */}
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
                {t.val}
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

          {/* RPS Area Fill */}
          <path d={rpsArea} fill="url(#rpsAreaGradient)" />

          {/* Active VUs line (Indigo) */}
          <path
            d={vuPath}
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeDasharray="4 2"
            className="text-indigo-400/80"
          />

          {/* RPS Line (Emerald) */}
          <path
            d={rpsPath}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="text-emerald-400"
          />

          {/* Hover guideline */}
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

          {/* Transparent hit boxes */}
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

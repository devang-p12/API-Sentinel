import { useMemo } from 'react';

interface AggregationSelectorProps {
  metricId: string;
  metricCategory?: string;
  aggregation: string;
  onChange: (aggregation: string) => void;
}

export function AggregationSelector({
  metricId,
  metricCategory,
  aggregation,
  onChange,
}: AggregationSelectorProps) {
  const options = useMemo(() => {
    const id = metricId.toLowerCase();
    const cat = metricCategory?.toLowerCase();

    if (id.includes('latency') || cat === 'performance') {
      return [
        { value: 'p95', label: 'P95 Percentile (Recommended for tail latency)' },
        { value: 'p99', label: 'P99 Percentile (Worst-case tail)' },
        { value: 'p50', label: 'P50 Percentile (Median)' },
        { value: 'avg', label: 'Average (Mean)' },
        { value: 'max', label: 'Maximum (Peak spike)' },
        { value: 'min', label: 'Minimum' },
      ];
    }

    if (id.includes('count') || cat === 'traffic') {
      return [
        { value: 'sum', label: 'Sum (Total executions)' },
        { value: 'rate', label: 'Rate (Per second/minute)' },
        { value: 'count', label: 'Count (Discrete occurrences)' },
      ];
    }

    if (id.includes('rate') || id.includes('availability') || cat === 'reliability') {
      return [
        { value: 'avg', label: 'Average percentage across checks' },
        { value: 'min', label: 'Minimum percentage (Worst period)' },
      ];
    }

    return [
      { value: 'avg', label: 'Average' },
      { value: 'p95', label: 'P95' },
      { value: 'sum', label: 'Sum' },
    ];
  }, [metricId, metricCategory]);

  return (
    <div>
      <label className="text-xs font-medium text-foreground block mb-1">
        Aggregation Method
      </label>
      <p className="text-xs text-muted-foreground mb-1.5">
        How datapoints are grouped over the evaluation window.
      </p>
      <select
        value={aggregation}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-8 px-2.5 text-xs bg-background border border-border rounded-md font-mono focus:outline-none focus:ring-1 focus:ring-ring"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

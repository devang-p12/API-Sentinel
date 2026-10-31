import { useState, useMemo } from 'react';
import type { MetricDefinition } from '@/lib/api';
import { Input } from '@/components/ui/input';

interface MetricSelectorProps {
  metrics: MetricDefinition[];
  selectedMetricId: string;
  onSelect: (metric: MetricDefinition) => void;
  error?: string;
}

export function MetricSelector({
  metrics,
  selectedMetricId,
  onSelect,
  error,
}: MetricSelectorProps) {
  const [search, setSearch] = useState('');

  const selectedMetric = useMemo(() => {
    return metrics.find((m) => m.id === selectedMetricId);
  }, [metrics, selectedMetricId]);

  const filteredMetrics = useMemo(() => {
    if (!search.trim()) return metrics;
    const q = search.toLowerCase();
    return metrics.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        m.id.toLowerCase().includes(q) ||
        m.category.toLowerCase().includes(q) ||
        m.description.toLowerCase().includes(q),
    );
  }, [metrics, search]);

  const grouped = useMemo(() => {
    const map: Record<string, MetricDefinition[]> = {
      reliability: [],
      performance: [],
      traffic: [],
      errors: [],
    };
    filteredMetrics.forEach((m) => {
      const cat = m.category || 'performance';
      if (!map[cat]) map[cat] = [];
      map[cat].push(m);
    });
    return map;
  }, [filteredMetrics]);

  return (
    <div className="space-y-3">
      <div>
        <label className="text-xs font-medium text-foreground block mb-1">
          Metric <span className="text-destructive">*</span>
        </label>
        <p className="text-xs text-muted-foreground mb-2">
          Select the telemetry metric to continuously evaluate against the threshold.
        </p>

        {/* Search input */}
        <div className="mb-2">
          <Input
            type="text"
            placeholder="Search metrics (e.g. p95, error rate, availability)..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 text-xs font-mono"
          />
        </div>

        {/* Scrollable metric selection list */}
        <div className="border border-border/80 rounded-md divide-y divide-border/40 max-h-52 overflow-y-auto bg-card">
          {Object.entries(grouped).map(([category, items]) => {
            if (items.length === 0) return null;
            return (
              <div key={category} className="p-1">
                <div className="px-2 py-1 text-[10px] font-mono uppercase tracking-wider text-muted-foreground font-semibold">
                  {category}
                </div>
                <div className="space-y-0.5">
                  {items.map((m) => {
                    const isSelected = m.id === selectedMetricId;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => onSelect(m)}
                        className={`w-full text-left px-2.5 py-1.5 rounded flex items-center justify-between text-xs transition-colors ${
                          isSelected
                            ? 'bg-primary/10 text-primary font-medium border border-primary/20'
                            : 'hover:bg-muted/60 text-foreground'
                        }`}
                      >
                        <div className="flex flex-col min-w-0 pr-2">
                          <span className="truncate">{m.name}</span>
                          <span className="text-[10px] font-mono text-muted-foreground truncate">
                            {m.id}
                          </span>
                        </div>
                        <span className="text-[10px] font-mono text-muted-foreground border border-border/60 px-1.5 py-0.5 rounded bg-muted/40 shrink-0">
                          {m.unit}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
          {filteredMetrics.length === 0 && (
            <div className="p-4 text-center text-xs text-muted-foreground font-mono">
              No metrics match "{search}"
            </div>
          )}
        </div>
        {error && <p className="text-xs text-destructive mt-1">{error}</p>}
      </div>

      {/* Dynamic metric description details card */}
      {selectedMetric && (
        <div className="rounded-md border border-border/60 bg-muted/30 p-3 space-y-1.5 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-foreground">{selectedMetric.name}</span>
            <span className="font-mono text-[11px] text-muted-foreground">
              Unit: <strong className="text-foreground">{selectedMetric.unit}</strong>
            </span>
          </div>
          <p className="text-muted-foreground text-[11px]">{selectedMetric.description}</p>
          <div className="pt-1 border-t border-border/40 flex items-center gap-2 text-[10px] text-muted-foreground font-mono">
            <span>Visualizations:</span>
            <div className="flex flex-wrap gap-1">
              {selectedMetric.supportedVisualizations.map((v) => (
                <span
                  key={v}
                  className="px-1.5 py-0.2 rounded bg-muted border border-border/40"
                >
                  {v}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

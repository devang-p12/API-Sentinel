import type { MetricQueryResult } from '@/lib/api';
import { Badge } from '@/components/ui/badge';

interface StatRendererProps {
  data: MetricQueryResult;
  metric: string;
}

export function StatRenderer({ data, metric }: StatRendererProps) {
  const current = data.summary.current;
  const isPercent = data.unit === '%';
  const isMs = data.unit === 'ms';

  // Determine status color tone
  let valueColor = 'text-foreground';
  let badgeColor = 'bg-muted text-muted-foreground';

  if (current !== null) {
    if (isPercent) {
      if (metric === 'error_rate') {
        valueColor = current === 0 ? 'text-emerald-500' : current < 5 ? 'text-amber-500' : 'text-destructive';
        badgeColor = current === 0 ? 'text-emerald-500 border-emerald-500/30' : 'text-destructive border-destructive/30';
      } else {
        valueColor = current >= 99 ? 'text-emerald-500' : current >= 95 ? 'text-amber-500' : 'text-destructive';
        badgeColor = current >= 99 ? 'text-emerald-500 border-emerald-500/30' : 'text-amber-500 border-amber-500/30';
      }
    } else if (isMs) {
      valueColor = current < 150 ? 'text-emerald-500' : current < 500 ? 'text-amber-500' : 'text-amber-600';
    }
  }

  return (
    <div className="flex flex-col justify-between h-full p-4">
      <div className="flex items-start justify-between">
        <span className="text-xs font-medium text-muted-foreground tracking-wider uppercase">
          {data.metricName}
        </span>
        <Badge variant="outline" className={`font-mono text-[10px] ${badgeColor}`}>
          {data.unit}
        </Badge>
      </div>

      <div className="my-auto py-2">
        {current !== null ? (
          <div className="flex items-baseline gap-2">
            <span className={`text-4xl sm:text-5xl font-bold font-mono tracking-tight ${valueColor}`}>
              {current}
            </span>
            <span className="text-sm font-mono text-muted-foreground">
              {data.unit}
            </span>
          </div>
        ) : (
          <div className="text-xl font-mono text-muted-foreground">
            No Data
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2 pt-3 border-t border-border/50 text-[11px] font-mono text-muted-foreground">
        <div>
          <span className="block text-[10px] text-muted-foreground/80">Min</span>
          <span className="font-medium text-foreground">{data.summary.min ?? '—'}</span>
        </div>
        <div>
          <span className="block text-[10px] text-muted-foreground/80">Avg</span>
          <span className="font-medium text-foreground">{data.summary.avg ?? '—'}</span>
        </div>
        <div>
          <span className="block text-[10px] text-muted-foreground/80">Max</span>
          <span className="font-medium text-foreground">{data.summary.max ?? '—'}</span>
        </div>
      </div>
    </div>
  );
}

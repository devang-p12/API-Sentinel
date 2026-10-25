import type { MetricQueryResult } from '@/lib/api';
import { Badge } from '@/components/ui/badge';

interface BarChartRendererProps {
  data: MetricQueryResult;
  metric: string;
}

export function BarChartRenderer({ data }: BarChartRendererProps) {
  const items = data.distribution || [];

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[160px] text-muted-foreground text-xs p-4 text-center">
        <span>No distribution data available in this time window</span>
      </div>
    );
  }

  const maxCount = Math.max(...items.map((i) => i.count), 1);

  const getBarColor = (category: string) => {
    if (category.startsWith('2') || category === 'SUCCESS') return 'bg-emerald-500';
    if (category.startsWith('3')) return 'bg-blue-500';
    if (category.startsWith('4')) return 'bg-amber-500';
    if (category.startsWith('5') || category === 'ERROR') return 'bg-destructive';
    if (category === 'TIMEOUT') return 'bg-amber-600';
    return 'bg-primary';
  };

  const getBadgeVariant = (category: string) => {
    if (category.startsWith('2') || category === 'SUCCESS') {
      return 'border-emerald-500/30 text-emerald-500 bg-emerald-500/10';
    }
    if (category.startsWith('5') || category === 'ERROR') {
      return 'border-destructive/30 text-destructive bg-destructive/10';
    }
    if (category === 'TIMEOUT') {
      return 'border-amber-500/30 text-amber-500 bg-amber-500/10';
    }
    return 'border-border text-foreground bg-muted/40';
  };

  return (
    <div className="flex flex-col h-full justify-between p-4 space-y-3 overflow-y-auto">
      <div className="flex items-center justify-between text-xs text-muted-foreground border-b border-border/50 pb-2">
        <span className="font-medium uppercase tracking-wider text-[10px]">Category / Status</span>
        <span className="font-mono text-[10px]">Count / Share</span>
      </div>

      <div className="space-y-3 flex-1 flex flex-col justify-center">
        {items.map((item) => {
          const widthPct = Math.max(3, (item.count / maxCount) * 100);
          return (
            <div key={item.category} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <Badge variant="outline" className={`font-mono text-[11px] px-1.5 py-0 ${getBadgeVariant(item.category)}`}>
                  {item.category}
                </Badge>
                <div className="flex items-center gap-2 font-mono text-xs">
                  <span className="font-semibold text-foreground">{item.count.toLocaleString()}</span>
                  <span className="text-muted-foreground text-[11px]">({item.percentage}%)</span>
                </div>
              </div>

              {/* Progress Bar Container */}
              <div className="w-full h-2 rounded-none bg-muted/50 overflow-hidden flex">
                <div
                  className={`h-full transition-all duration-500 ${getBarColor(item.category)}`}
                  style={{ width: `${widthPct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className="text-[10px] font-mono text-muted-foreground text-right border-t border-border/40 pt-1.5">
        Total Evaluated: {data.summary.total?.toLocaleString() ?? '—'}
      </div>
    </div>
  );
}

import { Badge } from '@/components/ui/badge';
import type { LoadTestStatus } from '@/lib/api';

interface LoadTestStatusBadgeProps {
  status: LoadTestStatus;
  className?: string;
}

export function LoadTestStatusBadge({ status, className = '' }: LoadTestStatusBadgeProps) {
  switch (status) {
    case 'COMPLETED':
      return (
        <Badge
          variant="outline"
          className={`bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 font-mono text-[10px] tracking-wide uppercase px-2 py-0.5 ${className}`}
        >
          Completed
        </Badge>
      );
    case 'RUNNING':
      return (
        <Badge
          variant="outline"
          className={`bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 font-mono text-[10px] tracking-wide uppercase px-2 py-0.5 inline-flex items-center gap-1.5 ${className}`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
          Running
        </Badge>
      );
    case 'QUEUED':
      return (
        <Badge
          variant="outline"
          className={`bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20 font-mono text-[10px] tracking-wide uppercase px-2 py-0.5 ${className}`}
        >
          Queued
        </Badge>
      );
    case 'FAILED':
      return (
        <Badge
          variant="outline"
          className={`bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20 font-mono text-[10px] tracking-wide uppercase px-2 py-0.5 ${className}`}
        >
          Failed
        </Badge>
      );
    case 'CANCELLED':
      return (
        <Badge
          variant="outline"
          className={`bg-muted/40 text-muted-foreground border-border font-mono text-[10px] tracking-wide uppercase px-2 py-0.5 ${className}`}
        >
          Cancelled
        </Badge>
      );
    default:
      return (
        <Badge variant="outline" className={`font-mono text-[10px] px-2 py-0.5 ${className}`}>
          {status}
        </Badge>
      );
  }
}

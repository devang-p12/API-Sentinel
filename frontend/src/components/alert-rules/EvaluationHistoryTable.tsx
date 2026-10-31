import type { AlertEvaluation } from '@/lib/api';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

interface EvaluationHistoryTableProps {
  evaluations: AlertEvaluation[];
  unit?: string;
  threshold?: number;
  isLoading?: boolean;
}

export function EvaluationHistoryTable({
  evaluations,
  unit = '',
  threshold,
  isLoading = false,
}: EvaluationHistoryTableProps) {
  if (isLoading) {
    return (
      <div className="p-8 text-center text-xs text-muted-foreground font-mono">
        Loading evaluation history...
      </div>
    );
  }

  if (!evaluations || evaluations.length === 0) {
    return (
      <div className="p-8 border border-dashed border-border rounded-md text-center text-xs text-muted-foreground font-mono">
        No evaluation history recorded yet. The background scheduler evaluates active rules every minute.
      </div>
    );
  }

  const getStateBadge = (state: string) => {
    switch (state) {
      case 'FIRING':
        return (
          <Badge variant="outline" className="text-[10px] font-mono bg-destructive/15 text-destructive border-destructive/30 uppercase">
            FIRING
          </Badge>
        );
      case 'PENDING':
        return (
          <Badge variant="outline" className="text-[10px] font-mono bg-amber-500/15 text-amber-500 border-amber-500/30 uppercase">
            PENDING
          </Badge>
        );
      case 'RESOLVED':
        return (
          <Badge variant="outline" className="text-[10px] font-mono bg-emerald-500/15 text-emerald-500 border-emerald-500/30 uppercase">
            RESOLVED
          </Badge>
        );
      case 'NORMAL':
      default:
        return (
          <Badge variant="outline" className="text-[10px] font-mono bg-muted text-muted-foreground border-border uppercase">
            NORMAL
          </Badge>
        );
    }
  };

  return (
    <div className="border border-border rounded-md overflow-hidden bg-card">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40 font-mono text-[11px]">
            <TableHead className="w-[180px]">Evaluated At</TableHead>
            <TableHead>Observed Value</TableHead>
            <TableHead>Threshold</TableHead>
            <TableHead className="text-center w-[120px]">Condition Met</TableHead>
            <TableHead className="text-right w-[140px]">State</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody className="text-xs font-mono">
          {evaluations.map((ev) => {
            const date = new Date(ev.evaluatedAt);
            return (
              <TableRow key={ev.id} className="hover:bg-muted/30">
                <TableCell className="text-muted-foreground">
                  <div className="flex flex-col">
                    <span className="font-semibold text-foreground">
                      {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                    <span className="text-[10px] text-muted-foreground/70">
                      {date.toLocaleDateString()}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="font-medium text-foreground">
                  {ev.value !== null && ev.value !== undefined ? (
                    <span>
                      {ev.value.toLocaleString(undefined, { maximumFractionDigits: 2 })} {unit}
                    </span>
                  ) : (
                    <span className="text-muted-foreground italic">NO DATA</span>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {ev.threshold !== undefined ? `${ev.threshold} ${unit}` : threshold ? `${threshold} ${unit}` : '—'}
                </TableCell>
                <TableCell className="text-center">
                  <span
                    className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold ${
                      ev.conditionMet
                        ? 'bg-destructive/10 text-destructive border border-destructive/20'
                        : 'bg-muted text-muted-foreground border border-border/60'
                    }`}
                  >
                    {ev.conditionMet ? 'TRUE' : 'FALSE'}
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1.5">
                    {ev.stateBefore && ev.stateBefore !== ev.stateAfter && (
                      <span className="text-[10px] text-muted-foreground line-through opacity-70">
                        {ev.stateBefore}
                      </span>
                    )}
                    {getStateBadge(ev.stateAfter)}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

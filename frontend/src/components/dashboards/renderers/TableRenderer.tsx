import type { MetricQueryResult } from '@/lib/api';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

interface TableRendererProps {
  data: MetricQueryResult;
  metric: string;
}

export function TableRenderer({ data }: TableRendererProps) {
  const tableData = data.table;
  const columns = tableData?.columns || [];
  const rows = tableData?.rows || [];

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[160px] text-muted-foreground text-xs p-4 text-center">
        <span>No tabular rows available for this metric</span>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto p-2">
      <Table>
        <TableHeader>
          <TableRow className="border-border hover:bg-transparent">
            {columns.map((col) => (
              <TableHead key={col} className="text-xs font-semibold py-2">
                {col}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, idx) => (
            <TableRow key={row.monitorId || idx} className="hover:bg-muted/30 border-border text-xs">
              <TableCell className="py-2 font-medium text-foreground">
                {row.monitorName || row.name || '—'}
              </TableCell>
              <TableCell className="py-2 font-mono text-muted-foreground text-[11px] truncate max-w-[140px]">
                {row.url || '—'}
              </TableCell>
              <TableCell className="py-2 font-mono">{row.totalChecks ?? '—'}</TableCell>
              <TableCell className="py-2 font-mono font-medium text-foreground">
                {row.availability ?? '—'}
              </TableCell>
              <TableCell className="py-2 font-mono">{row.avgLatency ?? '—'}</TableCell>
              <TableCell className="py-2 font-mono">{row.p95Latency ?? '—'}</TableCell>
              <TableCell className="py-2">
                {row.status === 'HEALTHY' ? (
                  <Badge variant="outline" className="text-[10px] border-emerald-500/30 text-emerald-500">
                    HEALTHY
                  </Badge>
                ) : row.status === 'DEGRADED' ? (
                  <Badge variant="outline" className="text-[10px] border-amber-500/30 text-amber-500">
                    DEGRADED
                  </Badge>
                ) : (
                  <Badge variant="destructive" className="text-[10px]">
                    CRITICAL
                  </Badge>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

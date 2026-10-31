import { Link } from 'react-router-dom';
import type { AlertInstance } from '@/lib/api';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

interface AlertInstancesTableProps {
  instances: AlertInstance[];
  unit?: string;
}

export function AlertInstancesTable({ instances, unit = '' }: AlertInstancesTableProps) {
  if (!instances || instances.length === 0) {
    return (
      <div className="p-8 border border-dashed border-border rounded-md text-center text-xs text-muted-foreground font-mono">
        No alert violations recorded yet. This rule is operating within healthy parameters.
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
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

  const calculateDuration = (startStr?: string | null, endStr?: string | null) => {
    if (!startStr) return '—';
    const start = new Date(startStr).getTime();
    const end = endStr ? new Date(endStr).getTime() : Date.now();
    const diffSec = Math.max(0, Math.round((end - start) / 1000));

    if (diffSec < 60) return `${diffSec}s`;
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ${diffSec % 60}s`;
    return `${Math.floor(diffSec / 3600)}h ${Math.floor((diffSec % 3600) / 60)}m`;
  };

  return (
    <div className="border border-border rounded-md overflow-hidden bg-card">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40 font-mono text-[11px]">
            <TableHead>Instance / Fingerprint</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Current / Peak Value</TableHead>
            <TableHead>Started At</TableHead>
            <TableHead>Duration</TableHead>
            <TableHead className="text-right">Incident</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody className="text-xs font-mono">
          {instances.map((inst) => {
            const relatedIncident = inst.incidentAlerts?.[0]?.incident;
            return (
              <TableRow key={inst.id} className="hover:bg-muted/30">
                <TableCell>
                  <div className="flex flex-col">
                    <span className="font-semibold text-foreground truncate max-w-[200px]">
                      {inst.fingerprint.substring(0, 16)}...
                    </span>
                    <span className="text-[10px] text-muted-foreground">ID: {inst.id.substring(0, 8)}</span>
                  </div>
                </TableCell>
                <TableCell>{getStatusBadge(inst.status)}</TableCell>
                <TableCell className="font-medium text-foreground">
                  {inst.currentValue !== null && inst.currentValue !== undefined
                    ? `${inst.currentValue.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${unit}`
                    : '—'}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {inst.startedAt ? (
                    <div className="flex flex-col">
                      <span className="text-foreground">
                        {new Date(inst.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <span className="text-[10px] text-muted-foreground/70">
                        {new Date(inst.startedAt).toLocaleDateString()}
                      </span>
                    </div>
                  ) : (
                    '—'
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {calculateDuration(inst.startedAt, inst.resolvedAt)}
                </TableCell>
                <TableCell className="text-right">
                  {relatedIncident ? (
                    <Link
                      to="/incidents"
                      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-muted/60 border border-border/80 hover:bg-muted text-primary text-[11px] font-semibold"
                    >
                      <span>INC-{relatedIncident.id.substring(0, 8)}</span>
                    </Link>
                  ) : (
                    <span className="text-muted-foreground/60">—</span>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

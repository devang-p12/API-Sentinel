import { useState } from 'react';
import type { Monitor } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface MonitorsTableProps {
  monitors: Monitor[];
  onTriggerRun: (id: string) => Promise<void>;
  onSelectMonitor: (monitor: Monitor) => void;
}

export function MonitorsTable({ monitors, onTriggerRun, onSelectMonitor }: MonitorsTableProps) {
  const [search, setSearch] = useState('');
  const [selectedEnv, setSelectedEnv] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [runningIds, setRunningIds] = useState<Set<string>>(new Set());

  // Extract unique environments
  const envNames = Array.from(
    new Set(monitors.map((m) => m.environment?.name).filter(Boolean)),
  ) as string[];

  const handleRun = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setRunningIds((prev) => new Set(prev).add(id));
    try {
      await onTriggerRun(id);
    } finally {
      setTimeout(() => {
        setRunningIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }, 1000);
    }
  };

  const filteredMonitors = monitors.filter((m) => {
    const matchesSearch =
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      m.url.toLowerCase().includes(search.toLowerCase());

    const matchesEnv =
      selectedEnv === 'ALL' || m.environment?.name?.toUpperCase() === selectedEnv.toUpperCase();

    const latest = m.executions && m.executions[0];
    const matchesStatus =
      selectedStatus === 'ALL' ||
      (selectedStatus === 'SUCCESS' && latest?.status === 'SUCCESS') ||
      (selectedStatus === 'FAILED' && latest?.status === 'FAILED') ||
      (selectedStatus === 'TIMEOUT' && latest?.status === 'TIMEOUT');

    return matchesSearch && matchesEnv && matchesStatus;
  });

  const getMethodBadgeVariant = (method: string) => {
    switch (method) {
      case 'GET':
        return 'border-sky-500/30 text-sky-500 bg-sky-500/10';
      case 'POST':
        return 'border-emerald-500/30 text-emerald-500 bg-emerald-500/10';
      case 'PUT':
      case 'PATCH':
        return 'border-amber-500/30 text-amber-500 bg-amber-500/10';
      case 'DELETE':
        return 'border-destructive/30 text-destructive bg-destructive/10';
      default:
        return 'border-border text-muted-foreground';
    }
  };

  const getStatusBadge = (status?: string, statusCode?: number | null) => {
    if (!status) {
      return (
        <Badge variant="outline" className="text-[10px] text-muted-foreground border-border">
          PENDING
        </Badge>
      );
    }

    if (status === 'SUCCESS') {
      return (
        <Badge variant="outline" className="text-[10px] gap-1.5 border-emerald-500/30 text-emerald-500 bg-emerald-500/10">
          <span className="size-1.5 rounded-full bg-emerald-500 inline-block" />
          {statusCode ?? 200} OK
        </Badge>
      );
    }

    if (status === 'TIMEOUT') {
      return (
        <Badge variant="outline" className="text-[10px] gap-1.5 border-amber-500/40 text-amber-500 bg-amber-500/10">
          <span className="size-1.5 rounded-full bg-amber-500 inline-block" />
          TIMEOUT
        </Badge>
      );
    }

    return (
      <Badge variant="destructive" className="text-[10px] gap-1.5">
        <span className="size-1.5 rounded-full bg-white inline-block" />
        {statusCode ?? 'FAILED'}
      </Badge>
    );
  };

  const getLatencyBadge = (latencyMs?: number) => {
    if (latencyMs === undefined || latencyMs === null) {
      return <span className="text-muted-foreground text-xs font-mono">-</span>;
    }

    let color = 'text-emerald-500';
    if (latencyMs > 1000) color = 'text-amber-500';
    if (latencyMs > 3000) color = 'text-destructive';

    return <span className={`text-xs font-mono font-medium ${color}`}>{latencyMs}ms</span>;
  };

  const formatTimestamp = (iso?: string) => {
    if (!iso) return 'Never';
    const date = new Date(iso);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  return (
    <div className="space-y-3">
      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 bg-card/40 p-2.5 rounded border border-border">
        <div className="flex items-center gap-2 flex-1 max-w-sm">
          <div className="relative w-full">
            <svg className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <Input
              placeholder="Filter by name or endpoint..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-7.5 pl-8 text-xs bg-background"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-center">
          {/* Environment Filter */}
          <div className="flex items-center gap-1 border border-border rounded p-0.5 bg-background text-xs">
            <button
              onClick={() => setSelectedEnv('ALL')}
              className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                selectedEnv === 'ALL'
                  ? 'bg-muted text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              All Envs
            </button>
            {envNames.map((env) => (
              <button
                key={env}
                onClick={() => setSelectedEnv(env)}
                className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                  selectedEnv.toUpperCase() === env.toUpperCase()
                    ? 'bg-muted text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {env}
              </button>
            ))}
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1 border border-border rounded p-0.5 bg-background text-xs">
            {['ALL', 'SUCCESS', 'FAILED', 'TIMEOUT'].map((s) => (
              <button
                key={s}
                onClick={() => setSelectedStatus(s)}
                className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                  selectedStatus === s
                    ? 'bg-muted text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {s === 'ALL' ? 'All' : s}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Monitors Table */}
      <div className="border border-border rounded bg-card/30 overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/40">
            <TableRow className="border-border hover:bg-transparent">
              <TableHead className="text-xs h-8 font-medium w-[80px]">Method</TableHead>
              <TableHead className="text-xs h-8 font-medium">Monitor & Endpoint</TableHead>
              <TableHead className="text-xs h-8 font-medium w-[120px]">Environment</TableHead>
              <TableHead className="text-xs h-8 font-medium w-[130px]">Last Status</TableHead>
              <TableHead className="text-xs h-8 font-medium w-[100px]">Latency</TableHead>
              <TableHead className="text-xs h-8 font-medium w-[80px]">Interval</TableHead>
              <TableHead className="text-xs h-8 font-medium w-[100px]">Last Check</TableHead>
              <TableHead className="text-xs h-8 font-medium w-[120px] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredMonitors.length === 0 ? (
              <TableRow className="border-border">
                <TableCell colSpan={8} className="h-28 text-center text-xs text-muted-foreground">
                  No monitors match your current filters.
                </TableCell>
              </TableRow>
            ) : (
              filteredMonitors.map((m) => {
                const latest = m.executions && m.executions[0];
                const isRunning = runningIds.has(m.id);

                return (
                  <TableRow
                    key={m.id}
                    onClick={() => onSelectMonitor(m)}
                    className="border-border hover:bg-muted/30 cursor-pointer transition-colors"
                  >
                    <TableCell className="py-2.5">
                      <Badge
                        variant="outline"
                        className={`text-[10px] font-mono px-1.5 py-0 h-4.5 ${getMethodBadgeVariant(
                          m.method,
                        )}`}
                      >
                        {m.method}
                      </Badge>
                    </TableCell>

                    <TableCell className="py-2.5">
                      <div className="flex flex-col">
                        <span className="text-xs font-semibold text-foreground hover:underline">
                          {m.name}
                        </span>
                        <span className="text-[11px] font-mono text-muted-foreground truncate max-w-xs sm:max-w-md">
                          {m.url}
                        </span>
                      </div>
                    </TableCell>

                    <TableCell className="py-2.5">
                      <Badge variant="secondary" className="text-[10px] h-4.5 font-normal text-muted-foreground">
                        {m.environment?.name || 'Default'}
                      </Badge>
                    </TableCell>

                    <TableCell className="py-2.5">
                      {getStatusBadge(latest?.status, latest?.statusCode)}
                    </TableCell>

                    <TableCell className="py-2.5">
                      {getLatencyBadge(latest?.responseTimeMs)}
                    </TableCell>

                    <TableCell className="py-2.5 text-xs text-muted-foreground font-mono">
                      {m.intervalSeconds}s
                    </TableCell>

                    <TableCell className="py-2.5 text-xs text-muted-foreground font-mono">
                      {formatTimestamp(latest?.executedAt)}
                    </TableCell>

                    <TableCell className="py-2.5 text-right">
                      <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="outline"
                          size="xs"
                          disabled={isRunning}
                          onClick={(e) => handleRun(e, m.id)}
                          className="h-6 text-[11px] gap-1"
                          title="Trigger immediate probe execution via BullMQ"
                        >
                          {isRunning ? (
                            <span className="size-2 rounded-full bg-primary animate-ping" />
                          ) : (
                            <svg className="size-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <polygon points="5 3 19 12 5 21 5 3" />
                            </svg>
                          )}
                          <span>Run</span>
                        </Button>

                        <Button
                          variant="ghost"
                          size="xs"
                          onClick={() => onSelectMonitor(m)}
                          className="h-6 text-[11px] text-muted-foreground"
                        >
                          Inspect
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

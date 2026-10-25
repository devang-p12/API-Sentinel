import { useState, useEffect } from 'react';
import { api, type Monitor, type MonitorExecution, type MonitorAnalyticsSummary } from '@/lib/api';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface MonitorDetailSheetProps {
  monitor: Monitor | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTriggerRun: (id: string) => Promise<void>;
}

export function MonitorDetailSheet({
  monitor,
  open,
  onOpenChange,
  onTriggerRun,
}: MonitorDetailSheetProps) {
  const [executions, setExecutions] = useState<MonitorExecution[]>([]);
  const [analytics, setAnalytics] = useState<MonitorAnalyticsSummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRunning, setIsRunning] = useState(false);

  useEffect(() => {
    if (monitor && open) {
      loadData(monitor.id);
    }
  }, [monitor, open]);

  const loadData = async (monitorId: string) => {
    setIsLoading(true);
    try {
      const [execs, stats] = await Promise.all([
        api.getMonitorExecutions(monitorId, 25),
        api.getMonitorAnalytics(monitorId).catch(() => null),
      ]);
      setExecutions(execs);
      setAnalytics(stats);
    } catch (err) {
      console.error('Failed to load monitor details:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleManualRun = async () => {
    if (!monitor) return;
    setIsRunning(true);
    try {
      await onTriggerRun(monitor.id);
      await new Promise((r) => setTimeout(r, 1200));
      await loadData(monitor.id);
    } finally {
      setIsRunning(false);
    }
  };

  if (!monitor) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-xl bg-card border-border overflow-y-auto p-4 sm:p-6">
        <SheetHeader className="text-left border-b border-border pb-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs font-mono">
                {monitor.method}
              </Badge>
              <SheetTitle className="text-sm font-semibold truncate">
                {monitor.name}
              </SheetTitle>
            </div>
            <Button
              variant="outline"
              size="xs"
              disabled={isRunning}
              onClick={handleManualRun}
              className="h-6 gap-1"
            >
              {isRunning ? (
                <span className="size-2 rounded-full bg-primary animate-ping" />
              ) : (
                <svg className="size-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
              )}
              <span>Run Probe</span>
            </Button>
          </div>
          <SheetDescription className="text-xs font-mono text-muted-foreground mt-1 truncate">
            {monitor.url}
          </SheetDescription>
        </SheetHeader>

        <div className="py-4 space-y-5 text-xs">
          {/* Metadata Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-muted/30 p-2.5 rounded border border-border">
            <div>
              <span className="text-muted-foreground block text-[10px]">Environment</span>
              <span className="font-medium text-foreground">{monitor.environment?.name || 'Default'}</span>
            </div>
            <div>
              <span className="text-muted-foreground block text-[10px]">Frequency</span>
              <span className="font-mono text-foreground">{monitor.intervalSeconds}s</span>
            </div>
            <div>
              <span className="text-muted-foreground block text-[10px]">Timeout</span>
              <span className="font-mono text-foreground">{monitor.timeoutMs}ms</span>
            </div>
            <div>
              <span className="text-muted-foreground block text-[10px]">Total Checks</span>
              <span className="font-mono text-foreground">{analytics?.totalChecks ?? executions.length}</span>
            </div>
          </div>

          {/* Performance & SLA Summary */}
          {analytics && (
            <div className="border border-border rounded p-3 bg-card/60 space-y-2">
              <span className="font-semibold text-xs text-foreground block">
                SLA & Latency Percentiles (24h Window)
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-1">
                <div className="p-2 bg-muted/40 rounded border border-border/50 text-center">
                  <span className="text-[10px] text-muted-foreground block">Availability</span>
                  <span className={`text-sm font-bold font-mono ${analytics.availabilityPct >= 99 ? 'text-emerald-500' : 'text-amber-500'}`}>
                    {analytics.availabilityPct}%
                  </span>
                </div>
                <div className="p-2 bg-muted/40 rounded border border-border/50 text-center">
                  <span className="text-[10px] text-muted-foreground block">P50 (Median)</span>
                  <span className="text-sm font-bold font-mono text-foreground">
                    {analytics.latency.percentiles.p50}ms
                  </span>
                </div>
                <div className="p-2 bg-muted/40 rounded border border-border/50 text-center">
                  <span className="text-[10px] text-muted-foreground block">P90</span>
                  <span className="text-sm font-bold font-mono text-foreground">
                    {analytics.latency.percentiles.p90}ms
                  </span>
                </div>
                <div className="p-2 bg-muted/40 rounded border border-border/50 text-center">
                  <span className="text-[10px] text-muted-foreground block">P95</span>
                  <span className="text-sm font-bold font-mono text-foreground">
                    {analytics.latency.percentiles.p95}ms
                  </span>
                </div>
                <div className="p-2 bg-muted/40 rounded border border-border/50 text-center">
                  <span className="text-[10px] text-muted-foreground block">P99</span>
                  <span className="text-sm font-bold font-mono text-foreground">
                    {analytics.latency.percentiles.p99}ms
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Execution History Table */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-xs text-foreground">
                Recent Probe Executions ({executions.length})
              </span>
              {isLoading && <span className="text-[10px] text-muted-foreground animate-pulse">Loading...</span>}
            </div>

            <div className="border border-border rounded overflow-hidden">
              <Table>
                <TableHeader className="bg-muted/40">
                  <TableRow className="border-border">
                    <TableHead className="text-xs h-7 font-medium w-[90px]">Status</TableHead>
                    <TableHead className="text-xs h-7 font-medium w-[80px]">Latency</TableHead>
                    <TableHead className="text-xs h-7 font-medium">Details / Error</TableHead>
                    <TableHead className="text-xs h-7 font-medium w-[70px] text-right">Size</TableHead>
                    <TableHead className="text-xs h-7 font-medium w-[80px] text-right">Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {executions.length === 0 ? (
                    <TableRow className="border-border">
                      <TableCell colSpan={5} className="h-20 text-center text-xs text-muted-foreground">
                        No executions recorded yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    executions.map((exec) => (
                      <TableRow key={exec.id} className="border-border text-xs">
                        <TableCell className="py-1.5 font-mono">
                          {exec.status === 'SUCCESS' ? (
                            <Badge variant="outline" className="text-[10px] h-4.5 px-1 gap-1 border-emerald-500/30 text-emerald-500">
                              <span className="size-1 rounded-full bg-emerald-500" />
                              {exec.statusCode ?? 200}
                            </Badge>
                          ) : exec.status === 'TIMEOUT' ? (
                            <Badge variant="outline" className="text-[10px] h-4.5 px-1 gap-1 border-amber-500/40 text-amber-500">
                              <span className="size-1 rounded-full bg-amber-500" />
                              TIME
                            </Badge>
                          ) : (
                            <Badge variant="destructive" className="text-[10px] h-4.5 px-1 gap-1">
                              <span className="size-1 rounded-full bg-white" />
                              {exec.statusCode ?? 'FAIL'}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="py-1.5 font-mono">
                          {exec.responseTimeMs}ms
                        </TableCell>
                        <TableCell className="py-1.5 text-muted-foreground truncate max-w-[180px]">
                          {exec.errorMessage || 'OK'}
                        </TableCell>
                        <TableCell className="py-1.5 text-right font-mono text-[10px] text-muted-foreground">
                          {exec.responseSize ? `${exec.responseSize}B` : '-'}
                        </TableCell>
                        <TableCell className="py-1.5 text-right font-mono text-[10px] text-muted-foreground">
                          {new Date(exec.executedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  api,
  type AlertInstance,
  type AlertEvaluation,
} from '@/lib/api';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
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
import { HugeiconsIcon } from '@hugeicons/react';
import {
  Copy01Icon,
  CheckmarkCircle02Icon,
  ArrowReloadHorizontalIcon,
} from '@hugeicons/core-free-icons';

interface AlertDetailSheetProps {
  alert: AlertInstance | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AlertDetailSheet({
  alert,
  open,
  onOpenChange,
}: AlertDetailSheetProps) {
  const [evaluations, setEvaluations] = useState<AlertEvaluation[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [copiedFingerprint, setCopiedFingerprint] = useState<boolean>(false);

  useEffect(() => {
    if (alert && open) {
      loadEvaluations(alert.id);
    }
  }, [alert, open]);

  const loadEvaluations = async (instanceId: string) => {
    setIsLoading(true);
    try {
      const data = await api.getAlertEvaluations(instanceId);
      setEvaluations(data || []);
    } catch (err) {
      console.error('Failed to load alert evaluations:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const copyFingerprint = () => {
    if (!alert?.fingerprint) return;
    navigator.clipboard.writeText(alert.fingerprint);
    setCopiedFingerprint(true);
    setTimeout(() => setCopiedFingerprint(false), 2000);
  };

  if (!alert) return null;

  // Calculate duration
  const calcDuration = () => {
    const start = alert.startedAt ? new Date(alert.startedAt).getTime() : alert.pendingSince ? new Date(alert.pendingSince).getTime() : new Date(alert.createdAt).getTime();
    const end = alert.resolvedAt ? new Date(alert.resolvedAt).getTime() : Date.now();
    const diffSec = Math.max(0, Math.floor((end - start) / 1000));
    const m = Math.floor(diffSec / 60);
    const s = diffSec % 60;
    if (m === 0) return `${s}s`;
    return `${m}m ${s}s`;
  };

  // Status badge helper
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'FIRING':
        return (
          <Badge className="bg-destructive/20 text-destructive border-destructive/30 font-mono text-xs gap-1">
            <span className="size-2 rounded-full bg-destructive animate-ping" />
            🔥 FIRING
          </Badge>
        );
      case 'PENDING':
        return (
          <Badge className="bg-amber-500/20 text-amber-500 border-amber-500/30 font-mono text-xs gap-1">
            <span className="size-2 rounded-full bg-amber-500 animate-pulse" />
            ⏳ PENDING
          </Badge>
        );
      case 'RESOLVED':
        return (
          <Badge className="bg-emerald-500/20 text-emerald-500 border-emerald-500/30 font-mono text-xs gap-1">
            ✓ RESOLVED
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="font-mono text-xs">
            {status}
          </Badge>
        );
    }
  };

  const getSeverityBadge = (sev: string) => {
    switch (sev) {
      case 'CRITICAL':
        return <Badge className="bg-destructive text-destructive-foreground font-mono text-[10px]">CRITICAL</Badge>;
      case 'HIGH':
        return <Badge className="bg-orange-500 text-white font-mono text-[10px]">HIGH</Badge>;
      case 'WARNING':
        return <Badge className="bg-amber-500 text-black font-mono text-[10px]">WARNING</Badge>;
      default:
        return <Badge variant="outline" className="font-mono text-[10px]">INFO</Badge>;
    }
  };

  // Render SVG Sparkline / Timeline with Threshold line
  const renderEvaluationChart = () => {
    if (evaluations.length === 0) return null;

    const points = [...evaluations].reverse(); // chronological order
    const values = points.map((e) => (e.value !== null ? e.value : alert.threshold));
    const allVals = [...values, alert.threshold];
    const minVal = Math.min(...allVals) * 0.9;
    const maxVal = Math.max(...allVals) * 1.1;
    const valRange = maxVal - minVal === 0 ? 1 : maxVal - minVal;

    const width = 500;
    const height = 120;
    const padX = 20;
    const padY = 15;
    const chartW = width - padX * 2;
    const chartH = height - padY * 2;

    const coords = points.map((p, i) => {
      const x = points.length === 1 ? padX + chartW / 2 : padX + (i / (points.length - 1)) * chartW;
      const v = p.value !== null ? p.value : alert.threshold;
      const y = padY + chartH - ((v - minVal) / valRange) * chartH;
      return { x, y, eval: p };
    });

    const linePath = coords.reduce((acc, curr, idx) => {
      return idx === 0 ? `M ${curr.x} ${curr.y}` : `${acc} L ${curr.x} ${curr.y}`;
    }, '');

    const thresholdY = padY + chartH - ((alert.threshold - minVal) / valRange) * chartH;

    return (
      <div className="bg-muted/30 border border-border p-3 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-foreground">Metric Timeline & Threshold</span>
          <div className="flex items-center gap-3 text-[10px] font-mono">
            <span className="flex items-center gap-1 text-primary">
              <span className="size-2 rounded-full bg-primary" /> Metric Value
            </span>
            <span className="flex items-center gap-1 text-destructive">
              <span className="w-3 h-0.5 bg-destructive border-dashed" /> Threshold ({alert.threshold})
            </span>
          </div>
        </div>

        <div className="relative w-full h-[120px] bg-background/50 border border-border/50 rounded overflow-hidden">
          <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full overflow-visible">
            {/* Threshold dashed line */}
            <line
              x1={padX}
              y1={thresholdY}
              x2={width - padX}
              y2={thresholdY}
              stroke="hsl(var(--destructive))"
              strokeWidth="1.5"
              strokeDasharray="4 3"
            />
            {/* Metric line */}
            <path
              d={linePath}
              fill="none"
              stroke="hsl(var(--primary))"
              strokeWidth="2"
            />
            {/* Datapoints */}
            {coords.map((c, i) => (
              <circle
                key={i}
                cx={c.x}
                cy={c.y}
                r={c.eval.conditionMet ? 3.5 : 2.5}
                fill={c.eval.conditionMet ? 'hsl(var(--destructive))' : 'hsl(var(--primary))'}
                stroke="hsl(var(--background))"
                strokeWidth="1"
              />
            ))}
          </svg>
        </div>
      </div>
    );
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-xl bg-card border-border overflow-y-auto p-4 sm:p-6"
      >
        <SheetHeader className="text-left border-b border-border pb-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              {getStatusBadge(alert.status)}
              {alert.alertRule && getSeverityBadge(alert.alertRule.severity)}
            </div>
            <Button
              variant="outline"
              size="xs"
              onClick={() => loadEvaluations(alert.id)}
              disabled={isLoading}
              className="h-6 gap-1 text-[11px]"
            >
              <HugeiconsIcon icon={ArrowReloadHorizontalIcon} className="size-3" />
              <span>Refresh</span>
            </Button>
          </div>
          <SheetTitle className="text-sm font-semibold mt-1">
            {alert.alertRule?.name || 'Alert Instance'}
          </SheetTitle>
          <SheetDescription className="text-xs text-muted-foreground truncate font-mono">
            Fingerprint: {alert.fingerprint.slice(0, 20)}...
          </SheetDescription>
        </SheetHeader>

        <div className="py-4 space-y-4 text-xs">
          {/* Status & Timing Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-muted/30 p-2.5 rounded border border-border">
            <div>
              <span className="text-muted-foreground block text-[10px]">Current Value</span>
              <span className="font-mono font-bold text-sm text-foreground">
                {alert.currentValue !== null ? alert.currentValue : 'No Data'}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground block text-[10px]">Threshold</span>
              <span className="font-mono font-bold text-sm text-foreground">
                {alert.alertRule?.condition === 'GREATER_THAN' && '> '}
                {alert.alertRule?.condition === 'GREATER_THAN_OR_EQUAL' && '>= '}
                {alert.alertRule?.condition === 'LESS_THAN' && '< '}
                {alert.alertRule?.condition === 'LESS_THAN_OR_EQUAL' && '<= '}
                {alert.alertRule?.condition === 'EQUAL' && '== '}
                {alert.alertRule?.condition === 'NOT_EQUAL' && '!= '}
                {alert.threshold}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground block text-[10px]">Active Duration</span>
              <span className="font-mono font-bold text-sm text-foreground">
                {calcDuration()}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground block text-[10px]">Metric Name</span>
              <span className="font-mono text-xs text-foreground truncate block">
                {alert.alertRule?.metric || '—'}
              </span>
            </div>
          </div>

          {/* Scope Dimensions */}
          <div className="p-3 bg-muted/20 border border-border space-y-2">
            <span className="block text-[11px] font-semibold text-foreground">Target Dimensions</span>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-muted-foreground text-[10px] block">API</span>
                <span className="font-medium text-foreground">
                  {alert.alertRule?.api?.name || 'All APIs'}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground text-[10px] block">Environment</span>
                <span className="font-medium text-foreground">
                  {alert.alertRule?.environment?.name || 'All Environments'}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground text-[10px] block">Monitor</span>
                <span className="font-medium text-foreground">
                  {alert.alertRule?.monitor?.name || 'All Monitors'}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground text-[10px] block">FOR Duration</span>
                <span className="font-medium text-foreground">
                  {alert.alertRule?.duration ? `${alert.alertRule.duration}s` : 'Immediate'}
                </span>
              </div>
            </div>

            {/* Fingerprint row with copy */}
            <div className="pt-2 border-t border-border flex items-center justify-between text-[11px]">
              <span className="text-muted-foreground font-mono">Deduplication Fingerprint:</span>
              <button
                type="button"
                onClick={copyFingerprint}
                className="flex items-center gap-1 font-mono text-[10px] hover:text-primary transition-colors text-foreground"
                title="Click to copy full deterministic fingerprint"
              >
                <span>{alert.fingerprint.slice(0, 16)}...</span>
                <HugeiconsIcon icon={copiedFingerprint ? CheckmarkCircle02Icon : Copy01Icon} className="size-3" />
              </button>
            </div>
          </div>

          {/* Related Incident (Section 30) */}
          <div className="p-3 bg-muted/20 border border-border space-y-2">
            <span className="block text-[11px] font-semibold text-foreground">Related Incident</span>
            {alert.incidentAlerts && alert.incidentAlerts.length > 0 ? (
              <div className="flex items-center justify-between p-2.5 rounded bg-card border border-border text-xs">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px] font-mono h-5">
                      INC-{alert.incidentAlerts[0].incident.id.slice(0, 8)}
                    </Badge>
                    <span className="font-semibold text-foreground">
                      {alert.incidentAlerts[0].incident.title}
                    </span>
                  </div>
                  <div className="text-[11px] text-muted-foreground flex items-center gap-2">
                    <span className="font-medium text-foreground">{alert.incidentAlerts[0].incident.severity}</span>
                    <span>•</span>
                    <span
                      className={
                        alert.incidentAlerts[0].incident.status === 'OPEN'
                          ? 'text-destructive font-semibold'
                          : alert.incidentAlerts[0].incident.status === 'ACKNOWLEDGED'
                          ? 'text-amber-500 font-semibold'
                          : 'text-emerald-500 font-semibold'
                      }
                    >
                      {alert.incidentAlerts[0].incident.status}
                    </span>
                  </div>
                </div>
                <Link
                  to="/incidents"
                  className="text-primary hover:underline text-xs font-medium px-2 py-1 bg-primary/10 rounded"
                >
                  View Incidents
                </Link>
              </div>
            ) : (
              <div className="text-xs text-muted-foreground italic py-1">
                No active incident associated with this alert.
              </div>
            )}
          </div>

          {/* Metric Time Series Chart */}
          {renderEvaluationChart()}

          {/* Evaluation History Table (Section 11) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-foreground">
                Evaluation History (Why Did This Alert Fire?)
              </span>
              <span className="text-[10px] text-muted-foreground font-mono">
                {evaluations.length} evaluation events
              </span>
            </div>

            <div className="border border-border rounded overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead className="text-[10px] font-semibold py-1.5">Timestamp</TableHead>
                    <TableHead className="text-[10px] font-semibold py-1.5">Value</TableHead>
                    <TableHead className="text-[10px] font-semibold py-1.5">Condition Met</TableHead>
                    <TableHead className="text-[10px] font-semibold py-1.5">State Transition</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {evaluations.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-xs text-muted-foreground py-6">
                        No evaluations recorded yet
                      </TableCell>
                    </TableRow>
                  ) : (
                    evaluations.slice(0, 15).map((ev) => (
                      <TableRow key={ev.id} className="font-mono text-[11px]">
                        <TableCell className="py-1.5 text-muted-foreground">
                          {new Date(ev.evaluatedAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                          })}
                        </TableCell>
                        <TableCell className="py-1.5 font-semibold text-foreground">
                          {ev.value !== null ? ev.value : 'No Data'}
                        </TableCell>
                        <TableCell className="py-1.5">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[9px] font-semibold ${
                              ev.conditionMet
                                ? 'bg-destructive/15 text-destructive'
                                : 'bg-muted text-muted-foreground'
                            }`}
                          >
                            {ev.conditionMet ? 'TRUE' : 'FALSE'}
                          </span>
                        </TableCell>
                        <TableCell className="py-1.5">
                          <span className="text-[10px]">
                            {ev.stateBefore} →{' '}
                            <span
                              className={`font-semibold ${
                                ev.stateAfter === 'FIRING'
                                  ? 'text-destructive'
                                  : ev.stateAfter === 'PENDING'
                                  ? 'text-amber-500'
                                  : ev.stateAfter === 'RESOLVED'
                                  ? 'text-emerald-500'
                                  : 'text-foreground'
                              }`}
                            >
                              {ev.stateAfter}
                            </span>
                          </span>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Labels */}
          {alert.alertRule?.labels && Object.keys(alert.alertRule.labels).length > 0 && (
            <div className="p-3 bg-muted/20 border border-border space-y-1.5">
              <span className="block text-[11px] font-semibold text-foreground">Labels</span>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(alert.alertRule.labels).map(([k, v]) => (
                  <Badge key={k} variant="outline" className="text-[10px] font-mono">
                    {k}: <span className="text-primary ml-1">{String(v)}</span>
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

import { useState, useEffect } from 'react';
import {
  api,
  type Incident,
  type IncidentEvent,
  type AlertInstance,
  type NotificationDelivery,
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
import { HugeiconsIcon } from '@hugeicons/react';
import {
  CheckmarkCircle02Icon,
  Clock01Icon,
  ArrowReloadHorizontalIcon,
  ArrowRight01Icon,
  UserIcon,
  ComputerIcon,
} from '@hugeicons/core-free-icons';

interface IncidentDetailSheetProps {
  incidentId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAlertClick?: (alert: AlertInstance) => void;
  onIncidentUpdated?: () => void;
}

export function IncidentDetailSheet({
  incidentId,
  open,
  onOpenChange,
  onAlertClick,
  onIncidentUpdated,
}: IncidentDetailSheetProps) {
  const [incident, setIncident] = useState<Incident | null>(null);
  const [timeline, setTimeline] = useState<IncidentEvent[]>([]);
  const [alerts, setAlerts] = useState<AlertInstance[]>([]);
  const [notifications, setNotifications] = useState<NotificationDelivery[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isActionLoading, setIsActionLoading] = useState<boolean>(false);

  useEffect(() => {
    if (incidentId && open) {
      loadIncidentDetails(incidentId);
    }
  }, [incidentId, open]);

  const loadIncidentDetails = async (id: string) => {
    setIsLoading(true);
    try {
      const [incData, timelineData, alertsData, notifsData] = await Promise.all([
        api.getIncident(id),
        api.getIncidentTimeline(id).catch(() => []),
        api.getIncidentAlerts(id).catch(() => []),
        api.getIncidentNotifications(id).catch(() => []),
      ]);
      setIncident(incData);
      setTimeline(timelineData || []);
      setAlerts(alertsData || []);
      setNotifications(notifsData || []);
    } catch (err) {
      console.error('Failed to load incident details:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAcknowledge = async () => {
    if (!incidentId) return;
    setIsActionLoading(true);
    try {
      await api.acknowledgeIncident(incidentId);
      await loadIncidentDetails(incidentId);
      onIncidentUpdated?.();
    } catch (err) {
      console.error('Failed to acknowledge incident:', err);
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleResolve = async () => {
    if (!incidentId) return;
    setIsActionLoading(true);
    try {
      await api.resolveIncident(incidentId);
      await loadIncidentDetails(incidentId);
      onIncidentUpdated?.();
    } catch (err) {
      console.error('Failed to resolve incident:', err);
    } finally {
      setIsActionLoading(false);
    }
  };

  if (!incidentId) return null;

  const formatDuration = (seconds?: number) => {
    if (seconds === undefined || seconds === null) return '—';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    if (m === 0) return `${s}s`;
    const h = Math.floor(m / 60);
    const remM = m % 60;
    if (h === 0) return `${m}m ${s}s`;
    return `${h}h ${remM}m`;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'OPEN':
        return (
          <Badge className="bg-destructive/20 text-destructive border-destructive/30 font-mono text-xs gap-1">
            <span className="size-2 rounded-full bg-destructive animate-ping" />
            🔴 OPEN
          </Badge>
        );
      case 'ACKNOWLEDGED':
        return (
          <Badge className="bg-amber-500/20 text-amber-500 border-amber-500/30 font-mono text-xs gap-1">
            <span className="size-2 rounded-full bg-amber-500" />
            🟡 ACKNOWLEDGED
          </Badge>
        );
      case 'RESOLVED':
        return (
          <Badge className="bg-emerald-500/20 text-emerald-500 border-emerald-500/30 font-mono text-xs gap-1">
            <HugeiconsIcon icon={CheckmarkCircle02Icon} className="size-3" />
            ✓ RESOLVED
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'CRITICAL':
        return <Badge className="bg-red-500 text-white font-mono text-[10px]">CRITICAL</Badge>;
      case 'HIGH':
        return <Badge className="bg-orange-500 text-white font-mono text-[10px]">HIGH</Badge>;
      case 'WARNING':
        return <Badge className="bg-amber-500 text-black font-mono text-[10px]">WARNING</Badge>;
      case 'INFO':
        return <Badge className="bg-blue-500 text-white font-mono text-[10px]">INFO</Badge>;
      default:
        return <Badge variant="outline">{severity}</Badge>;
    }
  };

  const getTimelineIcon = (type: string) => {
    switch (type) {
      case 'CREATED':
        return <div className="size-5 rounded-full bg-destructive/20 text-destructive flex items-center justify-center font-bold text-[10px]">🚨</div>;
      case 'ALERT_ATTACHED':
        return <div className="size-5 rounded-full bg-orange-500/20 text-orange-500 flex items-center justify-center font-bold text-[10px]">🔥</div>;
      case 'SEVERITY_CHANGED':
        return <div className="size-5 rounded-full bg-red-500/20 text-red-500 flex items-center justify-center font-bold text-[10px]">⚠️</div>;
      case 'ACKNOWLEDGED':
        return <div className="size-5 rounded-full bg-amber-500/20 text-amber-500 flex items-center justify-center font-bold text-[10px]">👤</div>;
      case 'ALERT_RESOLVED':
        return <div className="size-5 rounded-full bg-emerald-500/20 text-emerald-500 flex items-center justify-center font-bold text-[10px]">✓</div>;
      case 'RESOLVED':
        return <div className="size-5 rounded-full bg-emerald-500/30 text-emerald-500 flex items-center justify-center font-bold text-[10px]">✅</div>;
      default:
        return <div className="size-5 rounded-full bg-muted text-muted-foreground flex items-center justify-center font-bold text-[10px]">●</div>;
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-2xl bg-card border-border overflow-y-auto p-4 sm:p-6"
      >
        <SheetHeader className="text-left border-b border-border pb-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="font-mono text-xs px-2 py-0.5">
                INC-{incidentId.slice(0, 8)}
              </Badge>
              {incident && getStatusBadge(incident.status)}
              {incident && getSeverityBadge(incident.severity)}
            </div>
            <Button
              variant="outline"
              size="xs"
              onClick={() => loadIncidentDetails(incidentId)}
              disabled={isLoading}
              className="h-6 gap-1 text-[11px]"
            >
              <HugeiconsIcon icon={ArrowReloadHorizontalIcon} className="size-3" />
              <span>Refresh</span>
            </Button>
          </div>
          <SheetTitle className="text-base font-semibold mt-2 text-foreground">
            {incident?.title || 'Incident Details'}
          </SheetTitle>
          <SheetDescription className="text-xs text-muted-foreground">
            {incident?.description || 'Operational incident generated by correlated alert instances.'}
          </SheetDescription>
        </SheetHeader>

        {isLoading && !incident ? (
          <div className="py-12 text-center text-xs text-muted-foreground">
            Loading incident data...
          </div>
        ) : incident ? (
          <div className="py-4 space-y-5 text-xs">
            {/* Quick Actions Bar */}
            <div className="flex items-center gap-2 p-3 bg-muted/30 border border-border rounded">
              <span className="text-[11px] font-semibold text-muted-foreground mr-auto">Incident Actions:</span>
              {incident.status === 'OPEN' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleAcknowledge}
                  disabled={isActionLoading}
                  className="h-7 text-xs border-amber-500/30 text-amber-500 hover:bg-amber-500/10 gap-1.5"
                >
                  <HugeiconsIcon icon={Clock01Icon} className="size-3.5" />
                  <span>Acknowledge Incident</span>
                </Button>
              )}
              {incident.status !== 'RESOLVED' && (
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleResolve}
                  disabled={isActionLoading}
                  className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
                >
                  <HugeiconsIcon icon={CheckmarkCircle02Icon} className="size-3.5" />
                  <span>Resolve Incident</span>
                </Button>
              )}
              {incident.status === 'RESOLVED' && (
                <Badge variant="outline" className="border-emerald-500/30 text-emerald-500 bg-emerald-500/10">
                  Incident Resolved & Closed
                </Badge>
              )}
            </div>

            {/* Metrics Overview Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-muted/20 p-3 rounded border border-border">
              <div>
                <span className="text-muted-foreground block text-[10px]">Target API</span>
                <span className="font-semibold text-foreground truncate block">
                  {incident.api?.name || 'All APIs'}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[10px]">Environment</span>
                <span className="font-semibold text-foreground truncate block">
                  {incident.environment?.name || 'All Environments'}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[10px]">Active Duration</span>
                <span className="font-mono font-bold text-sm text-foreground">
                  {formatDuration(incident.durationSeconds)}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[10px]">Correlated Alerts</span>
                <span className="font-mono font-bold text-sm text-foreground">
                  {alerts.length}
                </span>
              </div>
            </div>

            {/* Timestamps Details */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] p-2.5 bg-muted/10 border border-border rounded text-muted-foreground">
              <div>
                <span className="block font-medium text-foreground">Started:</span>
                <span>{new Date(incident.startedAt).toLocaleString()}</span>
              </div>
              <div>
                <span className="block font-medium text-foreground">Acknowledged:</span>
                <span>
                  {incident.acknowledgedAt
                    ? `${new Date(incident.acknowledgedAt).toLocaleTimeString()} by ${incident.acknowledgedBy || 'User'}`
                    : 'Not yet acknowledged'}
                </span>
              </div>
              <div>
                <span className="block font-medium text-foreground">Resolved:</span>
                <span>
                  {incident.resolvedAt
                    ? `${new Date(incident.resolvedAt).toLocaleTimeString()} by ${incident.resolvedBy || 'System'}`
                    : 'Active / Unresolved'}
                </span>
              </div>
            </div>

            {/* Correlated Alerts Section (Section 28) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-foreground">
                  Correlated Alerts ({alerts.length})
                </span>
                <span className="text-[10px] text-muted-foreground">
                  Multi-alert incident correlation
                </span>
              </div>
              {alerts.length === 0 ? (
                <div className="p-4 text-center border border-dashed border-border text-muted-foreground text-xs">
                  No active alert instances attached.
                </div>
              ) : (
                <div className="space-y-1.5">
                  {alerts.map((al) => (
                    <div
                      key={al.id}
                      onClick={() => onAlertClick?.(al)}
                      className="flex items-center justify-between p-2.5 rounded bg-muted/20 border border-border hover:border-primary/50 transition-colors cursor-pointer group"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-foreground group-hover:text-primary transition-colors">
                            {al.alertRule?.name || 'Alert Rule'}
                          </span>
                          {al.status === 'FIRING' ? (
                            <Badge className="bg-destructive/20 text-destructive border-destructive/30 text-[10px] py-0 h-4">
                              🔥 FIRING
                            </Badge>
                          ) : al.status === 'PENDING' ? (
                            <Badge className="bg-amber-500/20 text-amber-500 border-amber-500/30 text-[10px] py-0 h-4">
                              ⏳ PENDING
                            </Badge>
                          ) : (
                            <Badge className="bg-emerald-500/20 text-emerald-500 border-emerald-500/30 text-[10px] py-0 h-4">
                              ✓ RESOLVED
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-[11px] text-muted-foreground font-mono">
                          <span>Metric: {al.alertRule?.metric}</span>
                          <span>•</span>
                          <span>Value: {al.currentValue ?? 'N/A'} (Threshold: {al.threshold})</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 text-[11px] text-muted-foreground group-hover:text-primary">
                        <span>Inspect</span>
                        <HugeiconsIcon icon={ArrowRight01Icon} className="size-3.5" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Notifications Dispatched Section (Phase 6, Section 27) */}
            <div className="space-y-2 pt-2 border-t border-border">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <span>🔔</span>
                  <span>Notifications Dispatched ({notifications.length})</span>
                </span>
                <span className="text-[10px] text-muted-foreground">
                  Multi-channel alert routing
                </span>
              </div>
              {notifications.length === 0 ? (
                <div className="p-3 text-center border border-dashed border-border rounded text-muted-foreground text-xs">
                  No notifications routed for this incident yet.
                </div>
              ) : (
                <div className="space-y-1.5">
                  {notifications.map((n) => (
                    <div
                      key={n.id}
                      className="p-2.5 rounded bg-muted/20 border border-border flex items-center justify-between gap-2 text-xs"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-foreground">
                            {n.contactPoint?.name || 'Contact Point'}
                          </span>
                          <Badge variant="outline" className="text-[9px] font-mono px-1.5 py-0 h-4">
                            {n.contactPoint?.type || 'WEBHOOK'}
                          </Badge>
                          <Badge
                            variant="secondary"
                            className={`text-[9px] px-1.5 py-0 h-4 ${
                              n.eventType === 'FIRING'
                                ? 'bg-red-500/10 text-red-400'
                                : 'bg-emerald-500/10 text-emerald-400'
                            }`}
                          >
                            {n.eventType}
                          </Badge>
                        </div>
                        <div className="text-[10px] text-muted-foreground font-mono">
                          Policy: {n.policy?.name || 'Default'} • {new Date(n.createdAt).toLocaleTimeString()}
                        </div>
                        {n.errorMessage && (
                          <div className="text-[10px] text-destructive font-mono truncate max-w-sm">
                            {n.errorMessage}
                          </div>
                        )}
                      </div>

                      <div className="shrink-0">
                        {n.status === 'SENT' ? (
                          <span className="text-emerald-400 font-semibold flex items-center gap-1 text-[11px]">
                            <HugeiconsIcon icon={CheckmarkCircle02Icon} className="size-3.5" />
                            SENT
                          </span>
                        ) : n.status === 'PENDING' ? (
                          <span className="text-amber-400 font-semibold flex items-center gap-1 text-[11px]">
                            <HugeiconsIcon icon={Clock01Icon} className="size-3.5" />
                            RETRYING ({n.attemptCount})
                          </span>
                        ) : n.status === 'SENDING' ? (
                          <span className="text-sky-400 font-semibold flex items-center gap-1 text-[11px]">
                            <span className="animate-spin text-xs">⟳</span> SENDING
                          </span>
                        ) : (
                          <span className="text-destructive font-semibold flex items-center gap-1 text-[11px]">
                            FAILED
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Vertical Incident Timeline Section (Section 29) */}
            <div className="space-y-3 pt-2 border-t border-border">
              <span className="text-xs font-semibold text-foreground block">
                Incident Timeline & Audit Trail
              </span>
              {timeline.length === 0 ? (
                <div className="p-4 text-center border border-dashed border-border text-muted-foreground text-xs">
                  No timeline events recorded yet.
                </div>
              ) : (
                <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-border">
                  {timeline.map((evt) => (
                    <div key={evt.id} className="relative group">
                      {/* Timeline Node Icon */}
                      <div className="absolute -left-6 top-0.5 z-10 bg-card rounded-full">
                        {getTimelineIcon(evt.type)}
                      </div>

                      {/* Event Details */}
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[10px] text-muted-foreground">
                            {new Date(evt.createdAt).toLocaleTimeString()}
                          </span>
                          <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 font-mono uppercase">
                            {evt.type.replace('_', ' ')}
                          </Badge>
                          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                            <HugeiconsIcon
                              icon={evt.actorType === 'USER' ? UserIcon : ComputerIcon}
                              className="size-3"
                            />
                            {evt.actorType}
                          </span>
                        </div>
                        <p className="text-xs text-foreground font-medium">
                          {evt.message}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

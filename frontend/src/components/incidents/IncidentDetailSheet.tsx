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
  Alert02Icon,
  AlertCircleIcon,
  CheckmarkCircle02Icon,
  Clock01Icon,
  ArrowReloadHorizontalIcon,
  ArrowRight01Icon,
  UserIcon,
  ComputerIcon,
  Notification01Icon,
  FlashIcon,
  Tick01Icon,
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
          <Badge
            variant="outline"
            className="bg-rose-500/10 text-rose-500 border-rose-500/30 font-mono text-[11px] font-semibold gap-1.5 px-2 py-0.5"
          >
            <span className="size-1.5 rounded-full bg-rose-500 animate-pulse shrink-0" />
            OPEN
          </Badge>
        );
      case 'ACKNOWLEDGED':
        return (
          <Badge
            variant="outline"
            className="bg-amber-500/10 text-amber-500 border-amber-500/30 font-mono text-[11px] font-semibold gap-1.5 px-2 py-0.5"
          >
            <span className="size-1.5 rounded-full bg-amber-500 shrink-0" />
            ACKNOWLEDGED
          </Badge>
        );
      case 'RESOLVED':
        return (
          <Badge
            variant="outline"
            className="bg-emerald-500/10 text-emerald-500 border-emerald-500/30 font-mono text-[11px] font-semibold gap-1.5 px-2 py-0.5"
          >
            <HugeiconsIcon icon={CheckmarkCircle02Icon} className="size-3 text-emerald-500 shrink-0" />
            RESOLVED
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="font-mono text-[11px]">
            {status}
          </Badge>
        );
    }
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'CRITICAL':
        return (
          <Badge
            variant="outline"
            className="bg-rose-500/15 text-rose-400 border-rose-500/30 font-mono text-[10px] font-bold px-2 py-0.5"
          >
            CRITICAL
          </Badge>
        );
      case 'HIGH':
        return (
          <Badge
            variant="outline"
            className="bg-orange-500/15 text-orange-400 border-orange-500/30 font-mono text-[10px] font-bold px-2 py-0.5"
          >
            HIGH
          </Badge>
        );
      case 'WARNING':
        return (
          <Badge
            variant="outline"
            className="bg-amber-500/15 text-amber-400 border-amber-500/30 font-mono text-[10px] font-bold px-2 py-0.5"
          >
            WARNING
          </Badge>
        );
      case 'INFO':
        return (
          <Badge
            variant="outline"
            className="bg-blue-500/15 text-blue-400 border-blue-500/30 font-mono text-[10px] font-bold px-2 py-0.5"
          >
            INFO
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="font-mono text-[10px]">
            {severity}
          </Badge>
        );
    }
  };

  const getTimelineNodeIcon = (type: string) => {
    switch (type) {
      case 'CREATED':
        return (
          <div className="size-5 rounded-full bg-rose-500/15 border border-rose-500/30 text-rose-500 flex items-center justify-center">
            <HugeiconsIcon icon={Alert02Icon} className="size-2.5" />
          </div>
        );
      case 'ALERT_ATTACHED':
        return (
          <div className="size-5 rounded-full bg-orange-500/15 border border-orange-500/30 text-orange-400 flex items-center justify-center">
            <HugeiconsIcon icon={FlashIcon} className="size-2.5" />
          </div>
        );
      case 'SEVERITY_CHANGED':
        return (
          <div className="size-5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center">
            <HugeiconsIcon icon={AlertCircleIcon} className="size-2.5" />
          </div>
        );
      case 'ACKNOWLEDGED':
        return (
          <div className="size-5 rounded-full bg-sky-500/15 border border-sky-500/30 text-sky-400 flex items-center justify-center">
            <HugeiconsIcon icon={Clock01Icon} className="size-2.5" />
          </div>
        );
      case 'ALERT_RESOLVED':
      case 'RESOLVED':
        return (
          <div className="size-5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center">
            <HugeiconsIcon icon={Tick01Icon} className="size-2.5" />
          </div>
        );
      default:
        return (
          <div className="size-5 rounded-full bg-muted border border-border text-muted-foreground flex items-center justify-center">
            <span className="size-1 rounded-full bg-muted-foreground" />
          </div>
        );
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-2xl bg-card border-border overflow-y-auto p-4 sm:p-6 font-mono text-xs"
      >
        <SheetHeader className="text-left border-b border-border pb-3.5">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className="font-mono text-xs px-2 py-0.5 font-bold border-border">
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
              className="h-6 gap-1 text-[11px] font-mono"
            >
              <HugeiconsIcon icon={ArrowReloadHorizontalIcon} className={`size-3 ${isLoading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </Button>
          </div>

          <SheetTitle className="text-base font-bold mt-2 text-foreground font-sans">
            {incident?.title || 'Incident Details'}
          </SheetTitle>
          <SheetDescription className="text-xs font-mono text-muted-foreground">
            {incident?.description || 'Operational incident correlated across monitor probe alerts.'}
          </SheetDescription>
        </SheetHeader>

        {isLoading && !incident ? (
          <div className="py-12 text-center text-xs font-mono text-muted-foreground">
            Loading incident details...
          </div>
        ) : incident ? (
          <div className="py-4 space-y-5 text-xs">
            {/* Quick Actions Bar */}
            <div className="flex items-center justify-between gap-2 p-3 bg-muted/20 border border-border rounded flex-wrap">
              <span className="text-[11px] font-semibold text-muted-foreground">
                Workflow Actions:
              </span>

              <div className="flex items-center gap-2">
                {incident.status === 'OPEN' && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleAcknowledge}
                    disabled={isActionLoading}
                    className="h-7 text-xs font-mono border-amber-500/30 text-amber-500 hover:bg-amber-500/10 gap-1.5"
                  >
                    <HugeiconsIcon icon={Clock01Icon} className="size-3.5" />
                    <span>Acknowledge</span>
                  </Button>
                )}

                {incident.status !== 'RESOLVED' && (
                  <Button
                    variant="default"
                    size="sm"
                    onClick={handleResolve}
                    disabled={isActionLoading}
                    className="h-7 text-xs font-mono bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 font-bold"
                  >
                    <HugeiconsIcon icon={CheckmarkCircle02Icon} className="size-3.5" />
                    <span>Resolve Incident</span>
                  </Button>
                )}

                {incident.status === 'RESOLVED' && (
                  <Badge variant="outline" className="border-emerald-500/30 text-emerald-500 bg-emerald-500/10 font-mono py-1 px-2.5">
                    ✓ Incident Resolved & Closed
                  </Badge>
                )}
              </div>
            </div>

            {/* Metrics Overview Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-muted/20 p-3 rounded border border-border">
              <div>
                <span className="text-muted-foreground block text-[10px] uppercase">Service / API</span>
                <span className="font-semibold text-foreground truncate block font-mono text-xs">
                  {incident.api?.name || 'All APIs'}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[10px] uppercase">Environment</span>
                <span className="font-semibold text-foreground truncate block font-mono text-xs">
                  {incident.environment?.name || 'Production'}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[10px] uppercase">Duration</span>
                <span className="font-mono font-bold text-xs text-foreground block">
                  {formatDuration(incident.durationSeconds)}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[10px] uppercase">Correlated Alerts</span>
                <span className="font-mono font-bold text-xs text-foreground block">
                  {alerts.length}
                </span>
              </div>
            </div>

            {/* Timestamps Details */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] p-2.5 bg-muted/10 border border-border rounded text-muted-foreground font-mono">
              <div>
                <span className="block font-semibold text-foreground">Triggered:</span>
                <span>{new Date(incident.startedAt).toLocaleString()}</span>
              </div>
              <div>
                <span className="block font-semibold text-foreground">Acknowledged:</span>
                <span>
                  {incident.acknowledgedAt
                    ? `${new Date(incident.acknowledgedAt).toLocaleTimeString()} by ${incident.acknowledgedBy || 'User'}`
                    : 'Unacknowledged'}
                </span>
              </div>
              <div>
                <span className="block font-semibold text-foreground">Resolved:</span>
                <span>
                  {incident.resolvedAt
                    ? `${new Date(incident.resolvedAt).toLocaleTimeString()} by ${incident.resolvedBy || 'System'}`
                    : 'Active / Unresolved'}
                </span>
              </div>
            </div>

            {/* Correlated Alerts Section */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-foreground">
                  Correlated Alert Instances ({alerts.length})
                </span>
                <span className="text-[10px] text-muted-foreground">
                  Multi-alert correlation
                </span>
              </div>

              {alerts.length === 0 ? (
                <div className="p-4 text-center border border-dashed border-border text-muted-foreground text-xs rounded">
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
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-foreground group-hover:text-primary transition-colors">
                            {al.alertRule?.name || 'Alert Rule'}
                          </span>
                          {al.status === 'FIRING' ? (
                            <Badge
                              variant="outline"
                              className="bg-rose-500/10 text-rose-500 border-rose-500/30 text-[10px] font-mono py-0 h-4 gap-1 font-bold"
                            >
                              <span className="size-1 rounded-full bg-rose-500 animate-pulse" />
                              FIRING
                            </Badge>
                          ) : al.status === 'PENDING' ? (
                            <Badge
                              variant="outline"
                              className="bg-amber-500/10 text-amber-500 border-amber-500/30 text-[10px] font-mono py-0 h-4 gap-1"
                            >
                              <span className="size-1 rounded-full bg-amber-500" />
                              PENDING
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="bg-emerald-500/10 text-emerald-500 border-emerald-500/30 text-[10px] font-mono py-0 h-4"
                            >
                              RESOLVED
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-[11px] text-muted-foreground font-mono">
                          <span>Metric: {al.alertRule?.metric}</span>
                          <span>•</span>
                          <span>Value: {al.currentValue ?? 'N/A'} (Threshold: {al.threshold})</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 text-[11px] text-muted-foreground group-hover:text-primary shrink-0">
                        <span>Inspect</span>
                        <HugeiconsIcon icon={ArrowRight01Icon} className="size-3.5" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Notifications Dispatched Section */}
            <div className="space-y-2 pt-2 border-t border-border">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <HugeiconsIcon icon={Notification01Icon} className="size-3.5 text-muted-foreground" />
                  <span>Notifications Dispatched ({notifications.length})</span>
                </span>
                <span className="text-[10px] text-muted-foreground">
                  Contact point delivery log
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
                            variant="outline"
                            className={`text-[9px] px-1.5 py-0 h-4 font-mono ${
                              n.eventType === 'FIRING'
                                ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                                : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            }`}
                          >
                            {n.eventType}
                          </Badge>
                        </div>
                        <div className="text-[10px] text-muted-foreground font-mono">
                          Policy: {n.policy?.name || 'Default'} • {new Date(n.createdAt).toLocaleTimeString()}
                        </div>
                        {n.errorMessage && (
                          <div className="text-[10px] text-rose-500 font-mono truncate max-w-sm">
                            {n.errorMessage}
                          </div>
                        )}
                      </div>

                      <div className="shrink-0 font-mono">
                        {n.status === 'SENT' ? (
                          <span className="text-emerald-500 font-semibold flex items-center gap-1 text-[11px]">
                            <HugeiconsIcon icon={CheckmarkCircle02Icon} className="size-3.5" />
                            DELIVERED
                          </span>
                        ) : n.status === 'PENDING' ? (
                          <span className="text-amber-500 font-semibold flex items-center gap-1 text-[11px]">
                            <HugeiconsIcon icon={Clock01Icon} className="size-3.5" />
                            RETRYING ({n.attemptCount})
                          </span>
                        ) : n.status === 'SENDING' ? (
                          <span className="text-sky-400 font-semibold flex items-center gap-1 text-[11px]">
                            <span className="animate-spin text-xs">⟳</span> SENDING
                          </span>
                        ) : (
                          <span className="text-rose-500 font-semibold flex items-center gap-1 text-[11px]">
                            FAILED
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Vertical Incident Timeline Section */}
            <div className="space-y-3 pt-2 border-t border-border">
              <span className="text-xs font-semibold text-foreground block">
                Incident Timeline &amp; Audit Trail
              </span>

              {timeline.length === 0 ? (
                <div className="p-4 text-center border border-dashed border-border text-muted-foreground text-xs rounded">
                  No timeline events recorded yet.
                </div>
              ) : (
                <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-border">
                  {timeline.map((evt) => (
                    <div key={evt.id} className="relative group">
                      {/* Timeline Node Icon */}
                      <div className="absolute -left-6 top-0.5 z-10 bg-card rounded-full">
                        {getTimelineNodeIcon(evt.type)}
                      </div>

                      {/* Event Details */}
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-[10px] text-muted-foreground">
                            {new Date(evt.createdAt).toLocaleTimeString()}
                          </span>
                          <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 font-mono uppercase border-border">
                            {evt.type.replace('_', ' ')}
                          </Badge>
                          <span className="text-[10px] text-muted-foreground flex items-center gap-1 font-mono">
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

export default IncidentDetailSheet;

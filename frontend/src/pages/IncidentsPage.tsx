import { useState, useEffect, useCallback } from 'react';
import { PageContainer } from '@/components/layout/PageContainer';
import { Card, CardContent } from '@/components/ui/card';
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
import { HugeiconsIcon } from '@hugeicons/react';
import {
  AlertCircleIcon,
  CheckmarkCircle02Icon,
  Clock01Icon,
  ArrowReloadHorizontalIcon,
  Search01Icon,
  ViewIcon,
} from '@hugeicons/core-free-icons';
import {
  api,
  type Incident,
  type IncidentSummary,
  type AlertInstance,
} from '@/lib/api';
import { IncidentDetailSheet } from '@/components/incidents/IncidentDetailSheet';
import { AlertDetailSheet } from '@/components/alerts/AlertDetailSheet';

export function IncidentsPage() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [summary, setSummary] = useState<IncidentSummary>({
    open: 0,
    acknowledged: 0,
    resolved: 0,
    total: 0,
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [severityFilter, setSeverityFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Sheet modals
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(null);
  const [isIncidentSheetOpen, setIsIncidentSheetOpen] = useState<boolean>(false);

  const [selectedAlert, setSelectedAlert] = useState<AlertInstance | null>(null);
  const [isAlertSheetOpen, setIsAlertSheetOpen] = useState<boolean>(false);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [incRes, sumRes] = await Promise.all([
        api.getIncidents({
          status: statusFilter !== 'ALL' ? statusFilter : undefined,
          severity: severityFilter !== 'ALL' ? severityFilter : undefined,
          search: searchQuery || undefined,
        }),
        api.getIncidentSummary(),
      ]);

      if (Array.isArray(incRes)) {
        setIncidents(incRes);
      } else if (incRes && Array.isArray((incRes as any).items)) {
        setIncidents((incRes as any).items);
      } else {
        setIncidents([]);
      }

      if (sumRes) {
        setSummary(sumRes);
      }
    } catch (err) {
      console.error('Failed to load incidents data:', err);
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter, severityFilter, searchQuery]);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 10000); // 10s live polling
    return () => clearInterval(interval);
  }, [loadData]);

  const handleOpenIncident = (id: string) => {
    setSelectedIncidentId(id);
    setIsIncidentSheetOpen(true);
  };

  const handleAlertClickFromIncident = (alert: AlertInstance) => {
    setSelectedAlert(alert);
    setIsAlertSheetOpen(true);
  };

  const handleAcknowledgeQuick = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      await api.acknowledgeIncident(id);
      loadData();
    } catch (err) {
      console.error('Failed to acknowledge incident:', err);
    }
  };

  const handleResolveQuick = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      await api.resolveIncident(id);
      loadData();
    } catch (err) {
      console.error('Failed to resolve incident:', err);
    }
  };

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
          <Badge className="bg-destructive/20 text-destructive border-destructive/30 font-mono text-[11px] gap-1">
            <span className="size-1.5 rounded-full bg-destructive animate-ping" />
            🔴 OPEN
          </Badge>
        );
      case 'ACKNOWLEDGED':
        return (
          <Badge className="bg-amber-500/20 text-amber-500 border-amber-500/30 font-mono text-[11px] gap-1">
            <span className="size-1.5 rounded-full bg-amber-500" />
            🟡 ACK
          </Badge>
        );
      case 'RESOLVED':
        return (
          <Badge className="bg-emerald-500/20 text-emerald-500 border-emerald-500/30 font-mono text-[11px] gap-1">
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

  return (
    <PageContainer
      title="Incident Management"
      description="Correlated multi-alert incidents, root-cause tracking, acknowledgment workflows, and audit timelines."
      breadcrumbs={[{ label: 'Sentinel', href: '/dashboard' }, { label: 'Incidents' }]}
      action={
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadData}
            disabled={isLoading}
            className="h-8 gap-1.5 text-xs border-border"
          >
            <HugeiconsIcon icon={ArrowReloadHorizontalIcon} className="size-3.5" />
            <span>Refresh</span>
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Section 25: Summary KPI Cards Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card
            onClick={() => setStatusFilter(statusFilter === 'OPEN' ? 'ALL' : 'OPEN')}
            className={`cursor-pointer transition-all border ${
              statusFilter === 'OPEN'
                ? 'border-destructive bg-destructive/10'
                : 'hover:border-destructive/40 bg-card/60'
            }`}
          >
            <CardContent className="p-4 flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-destructive animate-pulse" />
                  Open Outages
                </span>
                <div className="text-2xl font-bold font-mono text-destructive">
                  {summary.open}
                </div>
              </div>
              <div className="size-8 rounded-full bg-destructive/10 text-destructive flex items-center justify-center">
                <HugeiconsIcon icon={AlertCircleIcon} className="size-4" />
              </div>
            </CardContent>
          </Card>

          <Card
            onClick={() => setStatusFilter(statusFilter === 'ACKNOWLEDGED' ? 'ALL' : 'ACKNOWLEDGED')}
            className={`cursor-pointer transition-all border ${
              statusFilter === 'ACKNOWLEDGED'
                ? 'border-amber-500 bg-amber-500/10'
                : 'hover:border-amber-500/40 bg-card/60'
            }`}
          >
            <CardContent className="p-4 flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-amber-500" />
                  Acknowledged
                </span>
                <div className="text-2xl font-bold font-mono text-amber-500">
                  {summary.acknowledged}
                </div>
              </div>
              <div className="size-8 rounded-full bg-amber-500/10 text-amber-500 flex items-center justify-center">
                <HugeiconsIcon icon={Clock01Icon} className="size-4" />
              </div>
            </CardContent>
          </Card>

          <Card
            onClick={() => setStatusFilter(statusFilter === 'RESOLVED' ? 'ALL' : 'RESOLVED')}
            className={`cursor-pointer transition-all border ${
              statusFilter === 'RESOLVED'
                ? 'border-emerald-500 bg-emerald-500/10'
                : 'hover:border-emerald-500/40 bg-card/60'
            }`}
          >
            <CardContent className="p-4 flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-emerald-500" />
                  Resolved
                </span>
                <div className="text-2xl font-bold font-mono text-emerald-500">
                  {summary.resolved}
                </div>
              </div>
              <div className="size-8 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                <HugeiconsIcon icon={CheckmarkCircle02Icon} className="size-4" />
              </div>
            </CardContent>
          </Card>

          <Card
            onClick={() => {
              setStatusFilter('ALL');
              setSeverityFilter('ALL');
            }}
            className={`cursor-pointer transition-all border ${
              statusFilter === 'ALL' && severityFilter === 'ALL'
                ? 'border-primary bg-primary/10'
                : 'hover:border-primary/40 bg-card/60'
            }`}
          >
            <CardContent className="p-4 flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">Total Incidents</span>
                <div className="text-2xl font-bold font-mono text-foreground">
                  {summary.total}
                </div>
              </div>
              <div className="size-8 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                <span className="font-mono text-xs font-bold">ALL</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Section 26: Search & Filter Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-muted/20 p-3 rounded border border-border">
          <div className="flex items-center gap-2 flex-1 min-w-[240px]">
            <div className="relative flex-1 max-w-sm">
              <HugeiconsIcon
                icon={Search01Icon}
                className="absolute left-2.5 top-2.5 size-4 text-muted-foreground"
              />
              <Input
                placeholder="Search incident title, description, or API..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9 text-xs bg-card"
              />
            </div>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-9 px-3 text-xs bg-card border border-border rounded text-foreground focus:outline-none"
            >
              <option value="ALL">All Statuses</option>
              <option value="OPEN">🔴 Open</option>
              <option value="ACKNOWLEDGED">🟡 Acknowledged</option>
              <option value="RESOLVED">✓ Resolved</option>
            </select>

            {/* Severity Filter */}
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="h-9 px-3 text-xs bg-card border border-border rounded text-foreground focus:outline-none"
            >
              <option value="ALL">All Severities</option>
              <option value="CRITICAL">Critical</option>
              <option value="HIGH">High</option>
              <option value="WARNING">Warning</option>
              <option value="INFO">Info</option>
            </select>
          </div>

          {(statusFilter !== 'ALL' || severityFilter !== 'ALL' || searchQuery) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setStatusFilter('ALL');
                setSeverityFilter('ALL');
                setSearchQuery('');
              }}
              className="h-8 text-xs text-muted-foreground hover:text-foreground"
            >
              Reset Filters
            </Button>
          )}
        </div>

        {/* Incidents Table */}
        <Card className="border border-border bg-card">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="w-[120px] text-xs">Incident ID</TableHead>
                  <TableHead className="text-xs">Title & Scope</TableHead>
                  <TableHead className="w-[100px] text-xs">Severity</TableHead>
                  <TableHead className="w-[120px] text-xs">Status</TableHead>
                  <TableHead className="w-[110px] text-xs">Duration</TableHead>
                  <TableHead className="w-[100px] text-xs text-center">Alerts</TableHead>
                  <TableHead className="w-[140px] text-xs text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && incidents.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-32 text-center text-xs text-muted-foreground">
                      Loading incidents...
                    </TableCell>
                  </TableRow>
                ) : incidents.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-40 text-center text-xs text-muted-foreground">
                      <div className="flex flex-col items-center justify-center space-y-2">
                        <div className="size-10 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                          <HugeiconsIcon icon={CheckmarkCircle02Icon} className="size-5" />
                        </div>
                        <span className="font-semibold text-foreground">No Incidents Found</span>
                        <span className="text-[11px] text-muted-foreground max-w-sm">
                          {statusFilter === 'OPEN'
                            ? 'All monitored APIs are running smoothly without active outages.'
                            : 'No incident matches the current filters.'}
                        </span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  incidents.map((inc) => (
                    <TableRow
                      key={inc.id}
                      onClick={() => handleOpenIncident(inc.id)}
                      className="border-border hover:bg-muted/30 cursor-pointer transition-colors"
                    >
                      <TableCell className="font-mono text-xs font-semibold text-foreground">
                        INC-{inc.id.slice(0, 8)}
                      </TableCell>
                      <TableCell>
                        <div className="space-y-0.5">
                          <div className="font-semibold text-xs text-foreground hover:text-primary transition-colors">
                            {inc.title}
                          </div>
                          <div className="flex items-center gap-2 text-[11px] text-muted-foreground font-mono">
                            <span>{inc.api?.name || 'All APIs'}</span>
                            <span>•</span>
                            <span>{inc.environment?.name || 'All Environments'}</span>
                            <span>•</span>
                            <span>{new Date(inc.startedAt).toLocaleTimeString()}</span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{getSeverityBadge(inc.severity)}</TableCell>
                      <TableCell>{getStatusBadge(inc.status)}</TableCell>
                      <TableCell className="font-mono text-xs font-medium text-foreground">
                        {formatDuration(inc.durationSeconds)}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className="text-xs font-mono">
                          {inc._count?.alerts ?? inc.alerts?.length ?? 1}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          {inc.status === 'OPEN' && (
                            <Button
                              variant="outline"
                              size="xs"
                              onClick={(e) => handleAcknowledgeQuick(e, inc.id)}
                              className="h-6 text-[11px] border-amber-500/30 text-amber-500 hover:bg-amber-500/10 px-2"
                              title="Acknowledge Incident"
                            >
                              Ack
                            </Button>
                          )}
                          {inc.status !== 'RESOLVED' && (
                            <Button
                              variant="outline"
                              size="xs"
                              onClick={(e) => handleResolveQuick(e, inc.id)}
                              className="h-6 text-[11px] border-emerald-500/30 text-emerald-500 hover:bg-emerald-500/10 px-2"
                              title="Resolve Incident"
                            >
                              Resolve
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="xs"
                            onClick={() => handleOpenIncident(inc.id)}
                            className="h-6 text-[11px] text-muted-foreground hover:text-foreground px-1.5"
                          >
                            <HugeiconsIcon icon={ViewIcon} className="size-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Incident Detail Drawer Sheet */}
      <IncidentDetailSheet
        incidentId={selectedIncidentId}
        open={isIncidentSheetOpen}
        onOpenChange={setIsIncidentSheetOpen}
        onAlertClick={handleAlertClickFromIncident}
        onIncidentUpdated={loadData}
      />

      {/* Alert Detail Drawer Sheet (Navigated from Incident) */}
      <AlertDetailSheet
        alert={selectedAlert}
        open={isAlertSheetOpen}
        onOpenChange={setIsAlertSheetOpen}
      />
    </PageContainer>
  );
}

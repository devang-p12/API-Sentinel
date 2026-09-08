import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useApi } from '@/context/ApiContext';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Eye,
  Loader2,
  MessageSquare,
  RefreshCw,
  RotateCcw,
  Send,
  ShieldAlert,
  UserCheck,
  X,
  Activity,
  Check,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import type {
  Incident,
  TimelineEvent,
  IncidentStatus,
  IncidentSeverity,
  TimelineEventType,
  ListIncidentsQuery,
} from '@/types/incidents';
import {
  fetchIncidents,
  fetchIncidentById,
  fetchIncidentTimeline,
  acknowledgeIncident,
  resolveIncident,
  addIncidentNote,
} from '@/services/incidents.service';

const STATUS_OPTIONS: { value: IncidentStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All Statuses' },
  { value: 'OPEN', label: 'Open' },
  { value: 'ACKNOWLEDGED', label: 'Acknowledged' },
  { value: 'RESOLVED', label: 'Resolved' },
];

const SEVERITY_OPTIONS: { value: IncidentSeverity | 'all'; label: string }[] = [
  { value: 'all', label: 'All Severities' },
  { value: 'CRITICAL', label: 'Critical' },
  { value: 'WARNING', label: 'Warning' },
  { value: 'INFO', label: 'Info' },
];

const ENVIRONMENTS = [
  { value: 'all', label: 'All Environments' },
  { value: 'production', label: 'Production' },
  { value: 'staging', label: 'Staging' },
  { value: 'development', label: 'Development' },
];

function formatDuration(startedAt: string, resolvedAt: string | null): string {
  const start = new Date(startedAt).getTime();
  const end = resolvedAt ? new Date(resolvedAt).getTime() : Date.now();
  const diffMs = Math.max(0, end - start);

  const seconds = Math.floor(diffMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days}d ${hours % 24}h`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
}

function formatCondition(
  metric: string | null,
  operator: string | null,
  threshold: number | string | null
): string {
  if (!metric) return 'Threshold breached';
  const opMap: Record<string, string> = {
    GREATER_THAN: '>',
    LESS_THAN: '<',
    GREATER_THAN_OR_EQUAL: '>=',
    LESS_THAN_OR_EQUAL: '<=',
    EQUALS: '==',
  };
  const op = operator ? opMap[operator] || operator : '>';
  const metricMap: Record<string, { label: string; unit: string }> = {
    RESPONSE_TIME: { label: 'Response Time', unit: 'ms' },
    ERROR_RATE: { label: 'Error Rate', unit: '%' },
    HTTP_STATUS: { label: 'HTTP Status', unit: '' },
    API_UNAVAILABLE: { label: 'Unavailable', unit: '' },
    UPTIME: { label: 'Uptime', unit: '%' },
    CONSECUTIVE_FAILURES: { label: 'Consecutive Failures', unit: 'checks' },
  };
  const info = metricMap[metric] || { label: metric, unit: '' };
  const unitStr = info.unit ? ` ${info.unit}` : '';

  if (metric === 'API_UNAVAILABLE') {
    return `Unavailable (${op} ${threshold ?? 1})`;
  }
  return `${info.label} ${op} ${threshold ?? 0}${unitStr}`;
}

export const IncidentsPage: React.FC = () => {
  const { apis } = useApi();

  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<IncidentStatus | 'all'>('all');
  const [severityFilter, setSeverityFilter] = useState<IncidentSeverity | 'all'>('all');
  const [envFilter, setEnvFilter] = useState<string>('all');
  const [apiFilter, setApiFilter] = useState<string>('all');

  // Sheet detail & timeline state
  const [isSheetOpen, setIsSheetOpen] = useState<boolean>(false);
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [isLoadingDetails, setIsLoadingDetails] = useState<boolean>(false);
  const [actionNote, setActionNote] = useState<string>('');
  const [newNoteText, setNewNoteText] = useState<string>('');
  const [isSubmittingAction, setIsSubmittingAction] = useState<boolean>(false);
  const [isSubmittingNote, setIsSubmittingNote] = useState<boolean>(false);
  const [sheetMessage, setSheetMessage] = useState<string | null>(null);
  const [sheetError, setSheetError] = useState<string | null>(null);

  // Available numeric APIs from context
  const numericApis = useMemo(() => {
    return apis.filter((a) => !isNaN(parseInt(a.id, 10)));
  }, [apis]);

  // Load incidents with server-side query parameters
  const loadIncidents = useCallback(async () => {
    setIsLoading(true);
    try {
      const query: ListIncidentsQuery = {};
      if (apiFilter !== 'all') {
        query.api_id = parseInt(apiFilter, 10);
      }
      if (envFilter !== 'all') {
        query.environment = envFilter;
      }
      if (statusFilter !== 'all') {
        query.status = statusFilter;
      }
      if (severityFilter !== 'all') {
        query.severity = severityFilter;
      }

      const result = await fetchIncidents(query);
      setIncidents(result.incidents);
      setTotalCount(result.total);
      setErrorMessage(null);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to retrieve incidents.');
    } finally {
      setIsLoading(false);
    }
  }, [apiFilter, envFilter, statusFilter, severityFilter]);

  useEffect(() => {
    loadIncidents();
  }, [loadIncidents]);

  const hasActiveFilters =
    statusFilter !== 'all' ||
    severityFilter !== 'all' ||
    envFilter !== 'all' ||
    apiFilter !== 'all';

  const clearFilters = () => {
    setStatusFilter('all');
    setSeverityFilter('all');
    setEnvFilter('all');
    setApiFilter('all');
  };

  // Open detail sheet and load timeline
  const handleOpenDetails = async (incident: Incident) => {
    setSelectedIncident(incident);
    setActionNote('');
    setNewNoteText('');
    setSheetMessage(null);
    setSheetError(null);
    setIsSheetOpen(true);
    setIsLoadingDetails(true);

    try {
      const [freshIncident, timelineEvents] = await Promise.all([
        fetchIncidentById(incident.id),
        fetchIncidentTimeline(incident.id),
      ]);
      setSelectedIncident(freshIncident);
      setTimeline(timelineEvents);
    } catch (err: any) {
      setSheetError(err.message || 'Failed to fetch incident details.');
    } finally {
      setIsLoadingDetails(false);
    }
  };

  // Inline Acknowledge
  const handleInlineAcknowledge = async (incident: Incident) => {
    try {
      const updated = await acknowledgeIncident(incident.id);
      setSuccessMessage(`Incident #${incident.id} acknowledged.`);
      setIncidents((prev) =>
        prev.map((i) => (i.id === incident.id ? { ...i, status: updated.status } : i))
      );
      loadIncidents();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to acknowledge incident.');
    }
  };

  // Inline Resolve
  const handleInlineResolve = async (incident: Incident) => {
    try {
      const updated = await resolveIncident(incident.id);
      setSuccessMessage(`Incident #${incident.id} marked as resolved.`);
      setIncidents((prev) =>
        prev.map((i) =>
          i.id === incident.id
            ? { ...i, status: updated.status, resolvedAt: updated.resolvedAt }
            : i
        )
      );
      loadIncidents();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to resolve incident.');
    }
  };

  // Sheet Acknowledge
  const handleSheetAcknowledge = async () => {
    if (!selectedIncident) return;
    setIsSubmittingAction(true);
    setSheetError(null);

    try {
      const updated = await acknowledgeIncident(
        selectedIncident.id,
        actionNote.trim() || undefined
      );
      setSelectedIncident(updated);
      setSheetMessage('Incident acknowledged successfully.');
      setActionNote('');
      const updatedTimeline = await fetchIncidentTimeline(selectedIncident.id);
      setTimeline(updatedTimeline);
      loadIncidents();
    } catch (err: any) {
      setSheetError(err.message || 'Failed to acknowledge incident.');
    } finally {
      setIsSubmittingAction(false);
    }
  };

  // Sheet Resolve
  const handleSheetResolve = async () => {
    if (!selectedIncident) return;
    setIsSubmittingAction(true);
    setSheetError(null);

    try {
      const updated = await resolveIncident(
        selectedIncident.id,
        actionNote.trim() || undefined
      );
      setSelectedIncident(updated);
      setSheetMessage('Incident resolved successfully.');
      setActionNote('');
      const updatedTimeline = await fetchIncidentTimeline(selectedIncident.id);
      setTimeline(updatedTimeline);
      loadIncidents();
    } catch (err: any) {
      setSheetError(err.message || 'Failed to resolve incident.');
    } finally {
      setIsSubmittingAction(false);
    }
  };

  // Add note inside sheet
  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedIncident) return;
    if (!newNoteText.trim()) {
      setSheetError('Note cannot be empty.');
      return;
    }

    setIsSubmittingNote(true);
    setSheetError(null);

    try {
      await addIncidentNote(selectedIncident.id, newNoteText.trim());
      setNewNoteText('');
      setSheetMessage('Note added to timeline.');
      const updatedTimeline = await fetchIncidentTimeline(selectedIncident.id);
      setTimeline(updatedTimeline);
    } catch (err: any) {
      setSheetError(err.message || 'Failed to add note.');
    } finally {
      setIsSubmittingNote(false);
    }
  };

  // Helper helpers
  const getApiName = (apiId: number, fallbackName?: string | null) => {
    const found = apis.find((a) => String(a.id) === String(apiId));
    return found ? found.name : fallbackName || `API #${apiId}`;
  };

  const renderStatusBadge = (status: IncidentStatus) => {
    if (status === 'OPEN') {
      return (
        <Badge
          variant="outline"
          className="border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400 font-semibold text-[11px] gap-1.5"
        >
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
          </span>
          OPEN
        </Badge>
      );
    }
    if (status === 'ACKNOWLEDGED') {
      return (
        <Badge
          variant="outline"
          className="border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400 font-semibold text-[11px] gap-1.5"
        >
          <span className="h-2 w-2 rounded-full bg-amber-500 inline-block"></span>
          ACKNOWLEDGED
        </Badge>
      );
    }
    return (
      <Badge
        variant="outline"
        className="border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold text-[11px] gap-1.5"
      >
        <span className="h-2 w-2 rounded-full bg-emerald-500 inline-block"></span>
        RESOLVED
      </Badge>
    );
  };

  const renderSeverityBadge = (severity: IncidentSeverity) => {
    if (severity === 'CRITICAL') {
      return (
        <Badge
          variant="outline"
          className="border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400 font-semibold text-[10px]"
        >
          CRITICAL
        </Badge>
      );
    }
    if (severity === 'WARNING') {
      return (
        <Badge
          variant="outline"
          className="border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400 font-semibold text-[10px]"
        >
          WARNING
        </Badge>
      );
    }
    return (
      <Badge
        variant="outline"
        className="border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400 font-semibold text-[10px]"
      >
        INFO
      </Badge>
    );
  };

  const renderTimelineIcon = (type: TimelineEventType) => {
    switch (type) {
      case 'ALERT_TRIGGERED':
        return <AlertTriangle className="h-3.5 w-3.5 text-red-500" />;
      case 'ACKNOWLEDGED':
        return <UserCheck className="h-3.5 w-3.5 text-amber-500" />;
      case 'NOTE_ADDED':
        return <MessageSquare className="h-3.5 w-3.5 text-blue-500" />;
      case 'RESOLVED':
        return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />;
      default:
        return <Activity className="h-3.5 w-3.5 text-muted-foreground" />;
    }
  };

  // Summary counts
  const openCount = incidents.filter((i) => i.status === 'OPEN').length;
  const ackCount = incidents.filter((i) => i.status === 'ACKNOWLEDGED').length;
  const resolvedCount = incidents.filter((i) => i.status === 'RESOLVED').length;
  const total = totalCount || incidents.length;

  return (
    <div className="min-h-full bg-background p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">Incidents</h1>
            <Badge variant="outline" className="text-xs">
              {total} total
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Track, investigate, acknowledge, and resolve API incidents.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadIncidents} disabled={isLoading}>
            <RefreshCw className={cn('mr-1.5 h-3.5 w-3.5', isLoading && 'animate-spin')} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Success / Error Banners */}
      {errorMessage && (
        <div className="flex items-center justify-between gap-2 rounded-lg border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-600 dark:text-red-400">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => setErrorMessage(null)}
            className="text-red-600 hover:bg-red-500/20"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      {successMessage && (
        <div className="flex items-center justify-between gap-2 rounded-lg border border-green-500/20 bg-green-500/10 p-4 text-sm text-green-600 dark:text-green-400">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{successMessage}</span>
          </div>
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => setSuccessMessage(null)}
            className="text-green-600 hover:bg-green-500/20"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      {/* KPI Cards Summary */}
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
        <Card className="border-black/10 dark:border-white/10 shadow-none">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between text-red-600 dark:text-red-400">
              <span className="text-xs font-medium uppercase tracking-wider">Open Incidents</span>
              <AlertCircle className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold text-red-600 dark:text-red-400">{openCount}</div>
            <p className="text-[11px] text-muted-foreground mt-0.5">requiring urgent triage</p>
          </CardContent>
        </Card>

        <Card className="border-black/10 dark:border-white/10 shadow-none">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between text-amber-600 dark:text-amber-400">
              <span className="text-xs font-medium uppercase tracking-wider">Acknowledged</span>
              <Clock className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">{ackCount}</div>
            <p className="text-[11px] text-muted-foreground mt-0.5">under active investigation</p>
          </CardContent>
        </Card>

        <Card className="border-black/10 dark:border-white/10 shadow-none">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400">
              <span className="text-xs font-medium uppercase tracking-wider">Resolved</span>
              <CheckCircle2 className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {resolvedCount}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">successfully mitigated</p>
          </CardContent>
        </Card>

        <Card className="border-black/10 dark:border-white/10 shadow-none">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-medium uppercase tracking-wider">Total</span>
              <ShieldAlert className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold">{total}</div>
            <p className="text-[11px] text-muted-foreground mt-0.5">recorded incidents</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Table Card */}
      <Card className="border-black/10 dark:border-white/10 shadow-none overflow-hidden">
        <CardHeader className="border-b p-4 sm:p-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <CardTitle className="text-lg">Incident Log</CardTitle>
              <CardDescription className="text-xs mt-0.5">
                Real-time breach alerts triggered by the automated background evaluator.
              </CardDescription>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Status */}
              <Select
                value={statusFilter}
                onValueChange={(val) => val && setStatusFilter(val as IncidentStatus | 'all')}
              >
                <SelectTrigger className="w-[140px] h-8 text-xs">
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Severity */}
              <Select
                value={severityFilter}
                onValueChange={(val) => val && setSeverityFilter(val as IncidentSeverity | 'all')}
              >
                <SelectTrigger className="w-[130px] h-8 text-xs">
                  <SelectValue placeholder="Severity" />
                </SelectTrigger>
                <SelectContent>
                  {SEVERITY_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Environment */}
              <Select value={envFilter} onValueChange={(val) => val && setEnvFilter(val)}>
                <SelectTrigger className="w-[140px] h-8 text-xs">
                  <SelectValue placeholder="Environment" />
                </SelectTrigger>
                <SelectContent>
                  {ENVIRONMENTS.map((env) => (
                    <SelectItem key={env.value} value={env.value}>
                      {env.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* API */}
              <Select value={apiFilter} onValueChange={(val) => val && setApiFilter(val)}>
                <SelectTrigger className="w-[160px] h-8 text-xs">
                  <SelectValue placeholder="All APIs" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All APIs</SelectItem>
                  {numericApis.map((api) => (
                    <SelectItem key={api.id} value={String(api.id)}>
                      {api.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Clear */}
              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearFilters}
                  className="h-8 text-xs text-muted-foreground hover:text-foreground"
                >
                  <RotateCcw className="h-3 w-3 mr-1" />
                  Clear
                </Button>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center p-12 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
              <span className="text-sm">Loading incidents...</span>
            </div>
          ) : incidents.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-center">
              <div className="rounded-full bg-muted p-4 mb-3">
                <CheckCircle2 className="h-8 w-8 text-emerald-500/70" />
              </div>
              <h3 className="text-base font-medium text-foreground">
                {hasActiveFilters ? 'No matching incidents' : 'All systems normal'}
              </h3>
              <p className="mt-1 text-xs text-muted-foreground max-w-sm">
                {hasActiveFilters
                  ? 'No incidents match your selected filter criteria. Try resetting or broadening your filters.'
                  : 'Zero active or historical incidents recorded. When rules breach thresholds, alerts will surface here.'}
              </p>
              {hasActiveFilters && (
                <div className="mt-4">
                  <Button variant="outline" size="sm" onClick={clearFilters}>
                    <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                    Clear Filters
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="pl-6">Status</TableHead>
                    <TableHead>Severity</TableHead>
                    <TableHead>API</TableHead>
                    <TableHead>Environment</TableHead>
                    <TableHead>Condition</TableHead>
                    <TableHead className="text-center">Failed Checks</TableHead>
                    <TableHead>Started</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead className="pr-6 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {incidents.map((incident) => {
                    const envLower = incident.environment.toLowerCase();
                    const envVariant =
                      envLower === 'production'
                        ? 'production'
                        : envLower === 'staging'
                        ? 'staging'
                        : 'development';

                    const startDate = new Date(incident.startedAt);

                    return (
                      <TableRow key={incident.id} className="transition-colors">
                        {/* Status */}
                        <TableCell className="pl-6 font-medium">
                          {renderStatusBadge(incident.status)}
                        </TableCell>

                        {/* Severity */}
                        <TableCell>{renderSeverityBadge(incident.severity)}</TableCell>

                        {/* API Name */}
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium text-foreground">
                              {getApiName(incident.apiId, incident.apiName)}
                            </span>
                            <span className="text-[11px] text-muted-foreground font-mono">
                              incident #{incident.id}
                            </span>
                          </div>
                        </TableCell>

                        {/* Environment */}
                        <TableCell>
                          <Badge variant={envVariant} className="text-[11px] capitalize">
                            {incident.environment}
                          </Badge>
                        </TableCell>

                        {/* Condition */}
                        <TableCell>
                          <code className="rounded bg-muted px-2 py-0.5 text-xs font-semibold text-foreground font-mono">
                            {formatCondition(
                              incident.ruleMetric,
                              incident.ruleOperator,
                              incident.ruleThreshold
                            )}
                          </code>
                        </TableCell>

                        {/* Failed Checks */}
                        <TableCell className="text-center">
                          <span className="text-xs font-medium text-foreground">
                            {incident.failedChecksCount}x
                          </span>
                        </TableCell>

                        {/* Started */}
                        <TableCell>
                          <div className="flex flex-col text-xs leading-tight">
                            <span className="font-medium text-foreground">
                              {startDate.toLocaleDateString()}
                            </span>
                            <span className="text-muted-foreground text-[10px]">
                              {startDate.toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </div>
                        </TableCell>

                        {/* Duration */}
                        <TableCell>
                          <span className="text-xs text-muted-foreground font-mono">
                            {formatDuration(incident.startedAt, incident.resolvedAt)}
                          </span>
                        </TableCell>

                        {/* Actions */}
                        <TableCell className="pr-6 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {incident.status === 'OPEN' && (
                              <Button
                                variant="outline"
                                size="xs"
                                onClick={() => handleInlineAcknowledge(incident)}
                                className="text-amber-600 border-amber-500/30 hover:bg-amber-500/10 text-[11px]"
                              >
                                Acknowledge
                              </Button>
                            )}
                            {(incident.status === 'OPEN' ||
                              incident.status === 'ACKNOWLEDGED') && (
                              <Button
                                variant="outline"
                                size="xs"
                                onClick={() => handleInlineResolve(incident)}
                                className="text-emerald-600 border-emerald-500/30 hover:bg-emerald-500/10 text-[11px]"
                              >
                                Resolve
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="xs"
                              onClick={() => handleOpenDetails(incident)}
                              className="text-xs hover:bg-muted"
                            >
                              <Eye className="h-3 w-3 mr-1" />
                              View
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Incident Detail & Timeline Sheet */}
      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent side="right" className="w-full sm:max-w-xl p-0 flex flex-col">
          {selectedIncident && (
            <div className="flex flex-col h-full overflow-hidden">
              <SheetHeader className="p-6 border-b">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <SheetTitle className="text-lg">Incident #{selectedIncident.id}</SheetTitle>
                    {renderStatusBadge(selectedIncident.status)}
                    {renderSeverityBadge(selectedIncident.severity)}
                  </div>
                </div>
                <SheetDescription className="text-xs">
                  {getApiName(selectedIncident.apiId, selectedIncident.apiName)} •{' '}
                  <span className="capitalize">{selectedIncident.environment}</span>
                </SheetDescription>
              </SheetHeader>

              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* Status Feedback in Sheet */}
                {sheetError && (
                  <div className="flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-600 dark:text-red-400">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>{sheetError}</span>
                  </div>
                )}
                {sheetMessage && (
                  <div className="flex items-center gap-2 rounded-lg border border-green-500/20 bg-green-500/10 p-3 text-xs text-green-600 dark:text-green-400">
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    <span>{sheetMessage}</span>
                  </div>
                )}

                {/* Summary Details */}
                <div className="rounded-lg border bg-muted/20 p-4 space-y-3">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Incident Summary
                  </h4>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-muted-foreground">Condition:</span>
                      <p className="font-semibold font-mono text-foreground mt-0.5">
                        {formatCondition(
                          selectedIncident.ruleMetric,
                          selectedIncident.ruleOperator,
                          selectedIncident.ruleThreshold
                        )}
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Consecutive Failures:</span>
                      <p className="font-semibold text-foreground mt-0.5">
                        {selectedIncident.failedChecksCount} failed checks
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Started:</span>
                      <p className="text-foreground mt-0.5">
                        {new Date(selectedIncident.startedAt).toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Duration:</span>
                      <p className="text-foreground font-mono mt-0.5">
                        {formatDuration(
                          selectedIncident.startedAt,
                          selectedIncident.resolvedAt
                        )}
                      </p>
                    </div>
                    {selectedIncident.resolvedAt && (
                      <div className="col-span-2">
                        <span className="text-muted-foreground">Resolved:</span>
                        <p className="text-emerald-600 dark:text-emerald-400 mt-0.5">
                          {new Date(selectedIncident.resolvedAt).toLocaleString()}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Trigger Details */}
                  {selectedIncident.triggerDetails && (
                    <div className="pt-2 border-t border-black/5 dark:border-white/5">
                      <span className="text-[11px] text-muted-foreground font-medium">
                        Trigger Details:
                      </span>
                      <p className="text-xs font-mono bg-muted/60 p-2 rounded mt-1 text-foreground break-all">
                        {selectedIncident.triggerDetails}
                      </p>
                    </div>
                  )}

                  {/* Error Info */}
                  {selectedIncident.errorInfo && (
                    <div className="pt-2 border-t border-black/5 dark:border-white/5">
                      <span className="text-[11px] text-red-500 font-medium">
                        Error Information:
                      </span>
                      <p className="text-xs font-mono bg-red-500/10 text-red-600 dark:text-red-400 p-2 rounded mt-1 break-all">
                        {selectedIncident.errorInfo}
                      </p>
                    </div>
                  )}
                </div>

                {/* Action Section (Acknowledge / Resolve) */}
                {selectedIncident.status !== 'RESOLVED' && (
                  <div className="rounded-lg border p-4 space-y-3 bg-card">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Triage Actions
                    </h4>
                    <div className="space-y-1.5">
                      <Label htmlFor="action_note" className="text-xs">
                        Action Note (Optional)
                      </Label>
                      <Textarea
                        id="action_note"
                        placeholder="Provide investigation notes or resolution root-cause..."
                        value={actionNote}
                        onChange={(e) => setActionNote(e.target.value)}
                        className="text-xs min-h-[60px]"
                      />
                    </div>
                    <div className="flex items-center gap-2 pt-1">
                      {selectedIncident.status === 'OPEN' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={handleSheetAcknowledge}
                          disabled={isSubmittingAction}
                          className="text-amber-600 border-amber-500/30 hover:bg-amber-500/10 text-xs"
                        >
                          {isSubmittingAction ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                          ) : (
                            <UserCheck className="h-3.5 w-3.5 mr-1.5" />
                          )}
                          Acknowledge
                        </Button>
                      )}
                      <Button
                        size="sm"
                        onClick={handleSheetResolve}
                        disabled={isSubmittingAction}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
                      >
                        {isSubmittingAction ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                        ) : (
                          <Check className="h-3.5 w-3.5 mr-1.5" />
                        )}
                        Resolve Incident
                      </Button>
                    </div>
                  </div>
                )}

                {/* Timeline Feed */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Incident Timeline
                    </h4>
                    <span className="text-[11px] text-muted-foreground">
                      {timeline.length} events
                    </span>
                  </div>

                  {isLoadingDetails ? (
                    <div className="flex items-center justify-center p-6 text-muted-foreground text-xs">
                      <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading timeline...
                    </div>
                  ) : timeline.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic py-3">
                      No timeline events recorded yet.
                    </p>
                  ) : (
                    <div className="relative pl-6 space-y-4 border-l border-border ml-2">
                      {timeline.map((event) => (
                        <div key={event.id} className="relative group">
                          {/* Dot / Icon */}
                          <div className="absolute -left-[31px] top-0.5 rounded-full bg-background p-1 border shadow-xs">
                            {renderTimelineIcon(event.eventType)}
                          </div>

                          <div className="flex flex-col text-xs">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-semibold text-foreground">
                                {event.eventType.replace(/_/g, ' ')}
                              </span>
                              <span className="text-[10px] text-muted-foreground font-mono">
                                {new Date(event.timestamp).toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>
                            </div>
                            {event.description && (
                              <p className="mt-1 text-muted-foreground bg-muted/30 p-2 rounded text-[11px]">
                                {event.description}
                              </p>
                            )}
                            <span className="text-[10px] text-muted-foreground/70 mt-0.5">
                              {new Date(event.timestamp).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Add Note Composer */}
                <form onSubmit={handleAddNote} className="space-y-2 pt-2 border-t">
                  <Label htmlFor="new_note" className="text-xs font-semibold">
                    Add Operator Note
                  </Label>
                  <Textarea
                    id="new_note"
                    placeholder="Document ongoing troubleshooting, context, or handover notes..."
                    value={newNoteText}
                    onChange={(e) => setNewNoteText(e.target.value)}
                    className="text-xs min-h-[60px]"
                  />
                  <div className="flex justify-end">
                    <Button
                      type="submit"
                      size="sm"
                      disabled={isSubmittingNote || !newNoteText.trim()}
                      className="text-xs"
                    >
                      {isSubmittingNote ? (
                        <>
                          <Loader2 className="h-3 w-3 animate-spin mr-1.5" />
                          Adding...
                        </>
                      ) : (
                        <>
                          <Send className="h-3 w-3 mr-1.5" />
                          Add Note
                        </>
                      )}
                    </Button>
                  </div>
                </form>
              </div>

              <SheetFooter className="p-4 border-t mt-auto flex flex-row justify-end">
                <Button variant="outline" size="sm" onClick={() => setIsSheetOpen(false)}>
                  Close
                </Button>
              </SheetFooter>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
};

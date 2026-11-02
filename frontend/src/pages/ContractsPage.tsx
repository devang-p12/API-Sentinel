import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  FileCodeIcon,
  CheckmarkCircle01Icon,
  Search01Icon,
  ArrowRight01Icon,
  ArrowReloadHorizontalIcon,
  Tick01Icon,
  ViewIcon,
  Add01Icon,
  PlayIcon,
} from '@hugeicons/core-free-icons';
import { PageContainer } from '@/components/layout/PageContainer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { SetBaseSchemaDialog } from '@/components/contracts/SetBaseSchemaDialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  api,
  type ApiSchemaSummary,
  type SchemaChangeItem,
  type Api,
} from '@/lib/api';

export function ContractsPage() {
  const navigate = useNavigate();
  const [schemas, setSchemas] = useState<ApiSchemaSummary[]>([]);
  const [changes, setChanges] = useState<SchemaChangeItem[]>([]);
  const [apis, setApis] = useState<Api[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [activeTab, setActiveTab] = useState<'schemas' | 'changes'>('schemas');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedApiId, setSelectedApiId] = useState<string>('ALL');
  const [selectedSeverity, setSelectedSeverity] = useState<string>('ALL');

  // Selected Schema for Inspection Modal
  const [inspectSchema, setInspectSchema] = useState<ApiSchemaSummary | null>(null);
  const [isApproving, setIsApproving] = useState(false);
  const [approvalSuccess, setApprovalSuccess] = useState<string | null>(null);

  // Set Base Schema Dialog State
  const [isSetBaselineOpen, setIsSetBaselineOpen] = useState(false);

  // Schema Verification State
  const [verifyingSchemaId, setVerifyingSchemaId] = useState<string | null>(null);
  const [verificationBanner, setVerificationBanner] = useState<{
    schemaId: string;
    hasBreakingChanges: boolean;
    summary: string;
    statusCode?: number;
    durationMs?: number;
  } | null>(null);

  // Acknowledging State
  const [acknowledgingId, setAcknowledgingId] = useState<string | null>(null);

  const fetchData = useCallback(async (showRefreshing = false) => {
    if (showRefreshing) setIsRefreshing(true);
    else setIsLoading(true);
    setError(null);

    try {
      const [fetchedSchemas, fetchedChanges, fetchedApis] = await Promise.all([
        api.getAllSchemas().catch(() => []),
        api.getAllSchemaChanges({ limit: 100 }).catch(() => []),
        api.getApis().catch(() => []),
      ]);

      setSchemas(fetchedSchemas);
      setChanges(fetchedChanges);
      setApis(fetchedApis);
    } catch (err: any) {
      setError(err?.message || 'Failed to load contract and schema monitoring data.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Handle Approving a New Baseline
  const handleApproveBaseline = async (schemaId: string, versionId: string) => {
    setIsApproving(true);
    setApprovalSuccess(null);
    try {
      await api.approveBaseline(schemaId, versionId);
      setApprovalSuccess('New baseline approved successfully. Conformance restored.');
      // Refresh schema data
      await fetchData(true);
      if (inspectSchema && inspectSchema.id === schemaId) {
        const refreshed = await api.getSchemaById(schemaId).catch(() => null);
        if (refreshed) setInspectSchema(refreshed);
      }
    } catch (err: any) {
      alert(err?.message || 'Failed to approve new baseline.');
    } finally {
      setIsApproving(false);
    }
  };

  // Handle Verify Schema Now (Live Request)
  const handleVerifySchema = async (schemaId: string) => {
    setVerifyingSchemaId(schemaId);
    setVerificationBanner(null);
    try {
      const result = await api.verifySchema(schemaId);
      setVerificationBanner({
        schemaId,
        hasBreakingChanges: result.hasBreakingChanges,
        summary: result.summary,
        statusCode: result.statusCode,
        durationMs: result.durationMs,
      });
      // Refresh data so newly detected breaking drift immediately registers in state
      await fetchData(true);
    } catch (err: any) {
      alert(err?.message || 'Failed to verify schema against endpoint.');
    } finally {
      setVerifyingSchemaId(null);
    }
  };

  // Handle Acknowledge Change
  const handleAcknowledgeChange = async (changeId: string) => {
    setAcknowledgingId(changeId);
    try {
      await api.acknowledgeSchemaChange(changeId);
      setChanges((prev) =>
        prev.map((c) => (c.id === changeId ? { ...c, isAcknowledged: true } : c)),
      );
    } catch (err: any) {
      alert(err?.message || 'Failed to acknowledge change.');
    } finally {
      setAcknowledgingId(null);
    }
  };

  // KPIs
  const totalSchemas = schemas.length;
  const breakingChangesCount = changes.filter((c) => c.severity === 'BREAKING').length;
  const activeBaselinesCount = schemas.filter((s) => s.activeBaselineVersionId).length;
  const conformingCount = schemas.filter(
    (s) => !s.changes?.some((c) => c.severity === 'BREAKING'),
  ).length;
  const conformanceRate = totalSchemas > 0 ? Math.round((conformingCount / totalSchemas) * 100) : 100;

  // Filtered Schemas
  const filteredSchemas = useMemo(() => {
    return schemas.filter((s) => {
      const matchesSearch =
        !searchQuery ||
        s.endpoint.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.api?.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesApi = selectedApiId === 'ALL' || s.apiId === selectedApiId;
      return matchesSearch && matchesApi;
    });
  }, [schemas, searchQuery, selectedApiId]);

  // Filtered Changes
  const filteredChanges = useMemo(() => {
    return changes.filter((c) => {
      const matchesSearch =
        !searchQuery ||
        c.fieldPath.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.schema?.endpoint.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.schema?.api?.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesSeverity =
        selectedSeverity === 'ALL' || c.severity === selectedSeverity;
      const matchesApi =
        selectedApiId === 'ALL' || c.schema?.api?.name === selectedApiId || c.schema?.api?.name === selectedApiId;
      return matchesSearch && matchesSeverity && matchesApi;
    });
  }, [changes, searchQuery, selectedSeverity, selectedApiId]);

  return (
    <PageContainer
      title="Contract & Schema Monitoring"
      description="Detect unintended payload and schema contract changes even when endpoints return HTTP 200 OK."
      breadcrumbs={[{ label: 'Sentinel', href: '/dashboard' }, { label: 'Contract & Schema' }]}
      action={
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchData(true)}
            disabled={isRefreshing || isLoading}
            className="h-8 text-xs font-mono"
          >
            <HugeiconsIcon
              icon={ArrowReloadHorizontalIcon}
              className={`size-3.5 mr-1.5 ${isRefreshing ? 'animate-spin' : ''}`}
            />
            {isRefreshing ? 'Refreshing...' : 'Refresh'}
          </Button>
          <Button
            size="sm"
            onClick={() => setIsSetBaselineOpen(true)}
            className="h-8 text-xs font-mono font-bold"
          >
            <HugeiconsIcon icon={Add01Icon} className="size-3.5 mr-1.5" />
            Set Base Schema
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/api-tester')}
            className="h-8 text-xs font-mono"
          >
            <HugeiconsIcon icon={FileCodeIcon} className="size-3.5 mr-1.5" />
            Test API Schema
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Error Alert */}
        {error && (
          <div className="p-3 bg-destructive/10 border border-destructive/20 text-destructive text-xs font-mono rounded">
            {error}
          </div>
        )}

        {/* Top Operational KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card className="rounded-none border-border">
            <CardHeader className="py-2.5 px-3">
              <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wide">
                Monitored Contracts
              </span>
            </CardHeader>
            <CardContent className="px-3 pb-3 pt-0">
              <div className="text-2xl font-bold font-mono text-foreground">{totalSchemas}</div>
              <span className="text-[10px] text-muted-foreground font-mono mt-0.5 block">
                Tracked API endpoints
              </span>
            </CardContent>
          </Card>

          <Card className="rounded-none border-border">
            <CardHeader className="py-2.5 px-3">
              <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wide">
                Breaking Violations
              </span>
            </CardHeader>
            <CardContent className="px-3 pb-3 pt-0">
              <div
                className={`text-2xl font-bold font-mono ${
                  breakingChangesCount > 0 ? 'text-rose-500' : 'text-emerald-500'
                }`}
              >
                {breakingChangesCount}
              </div>
              <span className="text-[10px] text-muted-foreground font-mono mt-0.5 block">
                {breakingChangesCount > 0 ? 'Silent breaking changes detected' : 'Zero breaking contract drift'}
              </span>
            </CardContent>
          </Card>

          <Card className="rounded-none border-border">
            <CardHeader className="py-2.5 px-3">
              <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wide">
                Active Baselines
              </span>
            </CardHeader>
            <CardContent className="px-3 pb-3 pt-0">
              <div className="text-2xl font-bold font-mono text-foreground">{activeBaselinesCount}</div>
              <span className="text-[10px] text-muted-foreground font-mono mt-0.5 block">
                Established schema contracts
              </span>
            </CardContent>
          </Card>

          <Card className="rounded-none border-border">
            <CardHeader className="py-2.5 px-3">
              <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wide">
                Contract Conformance
              </span>
            </CardHeader>
            <CardContent className="px-3 pb-3 pt-0">
              <div
                className={`text-2xl font-bold font-mono ${
                  conformanceRate >= 95 ? 'text-emerald-500' : conformanceRate >= 80 ? 'text-amber-500' : 'text-rose-500'
                }`}
              >
                {conformanceRate}%
              </div>
              <span className="text-[10px] text-muted-foreground font-mono mt-0.5 block">
                {conformingCount} of {totalSchemas} schemas conforming
              </span>
            </CardContent>
          </Card>
        </div>

        {/* Filters and View Switcher */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 bg-card border border-border">
          {/* Tabs Switcher */}
          <div className="flex items-center gap-1 p-0.5 bg-muted/40 border border-border text-xs font-mono">
            <button
              type="button"
              onClick={() => setActiveTab('schemas')}
              className={`px-3 py-1.5 transition-colors ${
                activeTab === 'schemas'
                  ? 'bg-background text-foreground font-semibold shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Contract Baselines ({filteredSchemas.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('changes')}
              className={`px-3 py-1.5 transition-colors flex items-center gap-1.5 ${
                activeTab === 'changes'
                  ? 'bg-background text-foreground font-semibold shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <span>Changes Audit Feed</span>
              {breakingChangesCount > 0 && (
                <span className="px-1.5 py-0.2 bg-rose-500 text-white text-[9px] rounded-full font-bold">
                  {breakingChangesCount}
                </span>
              )}
            </button>
          </div>

          {/* Search & Dropdown Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-56 flex-1 sm:flex-initial">
              <HugeiconsIcon
                icon={Search01Icon}
                className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                placeholder="Search endpoint or API..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 pl-8 text-xs font-mono"
              />
            </div>

            {apis.length > 0 && (
              <select
                value={selectedApiId}
                onChange={(e) => setSelectedApiId(e.target.value)}
                className="h-8 px-2.5 text-xs bg-background border border-input rounded-none focus:outline-none focus:border-ring font-mono text-foreground"
              >
                <option value="ALL">All APIs</option>
                {apis.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            )}

            {activeTab === 'changes' && (
              <select
                value={selectedSeverity}
                onChange={(e) => setSelectedSeverity(e.target.value)}
                className="h-8 px-2.5 text-xs bg-background border border-input rounded-none focus:outline-none focus:border-ring font-mono text-foreground"
              >
                <option value="ALL">All Severities</option>
                <option value="BREAKING">BREAKING</option>
                <option value="WARNING">WARNING</option>
                <option value="INFO">INFO</option>
              </select>
            )}
          </div>
        </div>

        {/* TAB 1: SCHEMAS / CONTRACT BASELINES */}
        {activeTab === 'schemas' && (
          <div className="space-y-4">
            {isLoading ? (
              <div className="p-8 text-center text-xs text-muted-foreground font-mono">
                Loading contract baselines...
              </div>
            ) : filteredSchemas.length === 0 ? (
              <Card className="rounded-none border-border p-12 text-center">
                <HugeiconsIcon icon={FileCodeIcon} className="size-10 text-muted-foreground mx-auto mb-3" />
                <h3 className="text-sm font-semibold text-foreground mb-1">No Contract Baselines Found</h3>
                <p className="text-xs text-muted-foreground max-w-md mx-auto mb-4 font-mono">
                  {searchQuery || selectedApiId !== 'ALL'
                    ? 'No schemas match the current filter criteria.'
                    : 'Run a health check or execute a probe in the API Tester. Sentinel automatically establishes baseline contracts on the first successful 200 OK response.'}
                </p>
                <div className="flex items-center justify-center gap-2">
                  <Button
                    size="sm"
                    onClick={() => setIsSetBaselineOpen(true)}
                    className="h-8 text-xs font-mono font-bold"
                  >
                    <HugeiconsIcon icon={Add01Icon} className="size-3.5 mr-1.5" />
                    Establish Base Schema
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate('/api-tester')}
                    className="h-8 text-xs font-mono"
                  >
                    Open API Tester
                  </Button>
                </div>
              </Card>
            ) : (
              <div className="border border-border bg-card divide-y divide-border">
                {filteredSchemas.map((schema) => {
                  const hasBreaking = schema.changes?.some((c) => c.severity === 'BREAKING');
                  const baselineVersion = schema.versions?.find((v) => v.isBaseline);

                  return (
                    <div
                      key={schema.id}
                      className="p-4 flex flex-col sm:flex-row sm:items-start justify-between gap-4 hover:bg-muted/10 transition-colors"
                    >
                      <div className="space-y-2 flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge
                            variant="outline"
                            className={`text-[10px] font-mono font-bold ${
                              schema.method === 'GET'
                                ? 'text-emerald-500 border-emerald-500/30'
                                : schema.method === 'POST'
                                ? 'text-blue-500 border-blue-500/30'
                                : schema.method === 'PUT'
                                ? 'text-amber-500 border-amber-500/30'
                                : 'text-purple-500 border-purple-500/30'
                            }`}
                          >
                            {schema.method}
                          </Badge>
                          <span className="font-mono text-sm font-semibold text-foreground truncate">
                            {schema.endpoint}
                          </span>
                          <Badge
                            variant="outline"
                            className={`text-[10px] font-mono ${
                              hasBreaking
                                ? 'border-rose-500/30 text-rose-500 bg-rose-500/10 font-bold'
                                : 'border-emerald-500/30 text-emerald-500 bg-emerald-500/10'
                            }`}
                          >
                            {hasBreaking ? '● Breaking Violation' : '✓ Conforming'}
                          </Badge>
                        </div>

                        <div className="flex items-center gap-3 text-xs text-muted-foreground font-mono flex-wrap">
                          <span>
                            API: <strong className="text-foreground">{schema.api?.name || 'Unassigned'}</strong>
                          </span>
                          {schema.environment && (
                            <span>
                              Env: <strong className="text-foreground">{schema.environment.name}</strong>
                            </span>
                          )}
                          <span>
                            Baseline:{' '}
                            <strong className="text-foreground">
                              {baselineVersion ? `v${baselineVersion.versionNumber}` : 'Pending'}
                            </strong>
                          </span>
                          <span>
                            Versions:{' '}
                            <strong className="text-foreground">{schema._count?.versions || 1}</strong>
                          </span>
                          <span>
                            Changes:{' '}
                            <strong className="text-foreground">{schema._count?.changes || 0}</strong>
                          </span>
                        </div>

                        {verificationBanner?.schemaId === schema.id && (
                          <div
                            className={`p-2.5 text-xs font-mono rounded border flex items-center justify-between ${
                              verificationBanner.hasBreakingChanges
                                ? 'bg-rose-500/10 border-rose-500/30 text-rose-500 font-bold'
                                : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500'
                            }`}
                          >
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span>
                                {verificationBanner.hasBreakingChanges
                                  ? '● BREAKING CONTRACT DRIFT (200 OK)'
                                  : '✓ CONTRACT CONFORMS'}
                              </span>
                              {verificationBanner.statusCode && (
                                <span>(HTTP {verificationBanner.statusCode} OK)</span>
                              )}
                              <span>— {verificationBanner.summary}</span>
                            </div>
                            {verificationBanner.durationMs !== undefined && (
                              <span className="text-[10px] opacity-75 shrink-0 ml-2">
                                {verificationBanner.durationMs}ms
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Action Buttons */}
                      <div className="flex items-center gap-2 shrink-0 pt-1 sm:pt-0">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleVerifySchema(schema.id)}
                          disabled={verifyingSchemaId === schema.id}
                          className="h-8 text-xs font-mono border-primary/40 hover:bg-primary/10 text-primary"
                          title="Trigger live probe and detect schema deviations on HTTP 200 OK"
                        >
                          <HugeiconsIcon
                            icon={PlayIcon}
                            className={`size-3.5 mr-1.5 ${
                              verifyingSchemaId === schema.id ? 'animate-spin' : ''
                            }`}
                          />
                          {verifyingSchemaId === schema.id ? 'Verifying...' : 'Verify Schema'}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setInspectSchema(schema)}
                          className="h-8 text-xs font-mono"
                        >
                          <HugeiconsIcon icon={ViewIcon} className="size-3.5 mr-1.5" />
                          Inspect Contract
                        </Button>
                        {schema.apiId && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => navigate(`/apis/${schema.apiId}`)}
                            className="h-8 text-xs font-mono"
                          >
                            API Details
                            <HugeiconsIcon icon={ArrowRight01Icon} className="size-3.5 ml-1" />
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: SCHEMA CHANGES AUDIT FEED */}
        {activeTab === 'changes' && (
          <div className="space-y-4">
            {isLoading ? (
              <div className="p-8 text-center text-xs text-muted-foreground font-mono">
                Loading schema change events...
              </div>
            ) : filteredChanges.length === 0 ? (
              <Card className="rounded-none border-border p-12 text-center">
                <HugeiconsIcon icon={CheckmarkCircle01Icon} className="size-10 text-emerald-500 mx-auto mb-3" />
                <h3 className="text-sm font-semibold text-foreground mb-1">All Payloads Conform to Baseline</h3>
                <p className="text-xs text-muted-foreground max-w-md mx-auto font-mono">
                  No contract deviations or schema drifts have been recorded for the selected filter.
                </p>
              </Card>
            ) : (
              <div className="border border-border bg-card divide-y divide-border">
                {filteredChanges.map((change) => (
                  <div key={change.id} className="p-4 space-y-2 hover:bg-muted/10 transition-colors">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className={`text-[10px] font-mono font-bold ${
                            change.severity === 'BREAKING'
                              ? 'border-rose-500/30 text-rose-500 bg-rose-500/10'
                              : change.severity === 'WARNING'
                              ? 'border-amber-500/30 text-amber-500 bg-amber-500/10'
                              : 'border-blue-500/30 text-blue-400 bg-blue-500/10'
                          }`}
                        >
                          {change.severity}
                        </Badge>
                        <span className="font-mono text-xs font-semibold px-1.5 py-0.5 bg-muted rounded text-foreground">
                          {change.changeType}
                        </span>
                        <span className="font-mono text-xs text-primary font-bold">
                          {change.fieldPath}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-mono text-muted-foreground">
                          {new Date(change.detectedAt).toLocaleString()}
                        </span>
                        {change.isAcknowledged ? (
                          <Badge variant="outline" className="text-[9px] font-mono text-muted-foreground border-border">
                            ✓ Acknowledged
                          </Badge>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleAcknowledgeChange(change.id)}
                            disabled={acknowledgingId === change.id}
                            className="h-6 text-[10px] font-mono px-2"
                          >
                            {acknowledgingId === change.id ? 'Saving...' : 'Acknowledge'}
                          </Button>
                        )}
                      </div>
                    </div>

                    <p className="text-xs text-muted-foreground font-mono">
                      {change.description}
                    </p>

                    <div className="flex items-center gap-4 text-[11px] font-mono text-muted-foreground pt-1 border-t border-border/50">
                      <span>
                        Endpoint:{' '}
                        <strong className="text-foreground">
                          {change.schema?.method} {change.schema?.endpoint}
                        </strong>
                      </span>
                      {change.schema?.api && (
                        <span>
                          API: <strong className="text-foreground">{change.schema.api.name}</strong>
                        </span>
                      )}
                      {change.previousType && (
                        <span>
                          Expected Type: <strong className="text-foreground">{change.previousType}</strong>
                        </span>
                      )}
                      {change.currentType && (
                        <span>
                          Received Type: <strong className="text-rose-400">{change.currentType}</strong>
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* INSPECT CONTRACT MODAL */}
      {inspectSchema && (
        <Dialog open={Boolean(inspectSchema)} onOpenChange={(open) => !open && setInspectSchema(null)}>
          <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto bg-card border-border">
            <DialogHeader>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs font-mono font-bold">
                  {inspectSchema.method}
                </Badge>
                <DialogTitle className="text-base font-mono font-semibold truncate">
                  {inspectSchema.endpoint}
                </DialogTitle>
              </div>
              <DialogDescription className="text-xs font-mono">
                Contract definition and baseline schema AST for {inspectSchema.api?.name || 'API endpoint'}.
              </DialogDescription>
            </DialogHeader>

            {approvalSuccess && (
              <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-xs font-mono rounded">
                {approvalSuccess}
              </div>
            )}

            <div className="space-y-4 py-2 text-xs font-mono">
              {/* Baseline Metadata */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-3 bg-muted/20 border border-border">
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase block">Active Baseline</span>
                  <span className="font-semibold text-foreground">
                    {inspectSchema.activeBaselineVersionId ? 'Established' : 'Pending'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase block">Total Versions</span>
                  <span className="font-semibold text-foreground">
                    {inspectSchema.versions?.length || inspectSchema._count?.versions || 1}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase block">Recorded Changes</span>
                  <span className="font-semibold text-foreground">
                    {inspectSchema._count?.changes ?? inspectSchema.changes?.length ?? 0}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase block">Created</span>
                  <span className="font-semibold text-foreground">
                    {new Date(inspectSchema.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>

              {/* Baseline Normalized Schema Tree */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-foreground">Normalized Baseline Schema AST</span>
                  <span className="text-[10px] text-muted-foreground">JSON Structure</span>
                </div>
                <pre className="p-3 bg-muted/40 border border-border text-[11px] font-mono text-foreground overflow-x-auto max-h-72 rounded">
                  {inspectSchema.versions?.find((v) => v.isBaseline)?.normalizedSchema
                    ? JSON.stringify(
                        inspectSchema.versions.find((v) => v.isBaseline)?.normalizedSchema,
                        null,
                        2,
                      )
                    : inspectSchema.versions?.[0]?.normalizedSchema
                    ? JSON.stringify(inspectSchema.versions[0].normalizedSchema, null, 2)
                    : '// Baseline payload captured upon first 200 OK'}
                </pre>
              </div>

              {/* Version History & Baseline Approval */}
              {inspectSchema.versions && inspectSchema.versions.length > 0 && (
                <div className="space-y-2">
                  <span className="font-semibold text-foreground block">Version History &amp; Approval</span>
                  <div className="divide-y divide-border border border-border">
                    {inspectSchema.versions.map((ver) => (
                      <div key={ver.id} className="p-2.5 flex items-center justify-between text-xs">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-foreground">v{ver.versionNumber}</span>
                            {ver.isBaseline && (
                              <Badge variant="outline" className="text-[9px] font-mono bg-primary/10 text-primary border-primary/30">
                                Active Baseline
                              </Badge>
                            )}
                            {ver.checksum && (
                              <span className="text-[10px] text-muted-foreground truncate max-w-40">
                                #{ver.checksum.slice(0, 12)}
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-muted-foreground">
                            Captured {new Date(ver.createdAt).toLocaleString()}
                          </span>
                        </div>

                        {!ver.isBaseline && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleApproveBaseline(inspectSchema.id, ver.id)}
                            disabled={isApproving}
                            className="h-7 text-xs font-mono"
                          >
                            <HugeiconsIcon icon={Tick01Icon} className="size-3 mr-1" />
                            {isApproving ? 'Approving...' : 'Approve Baseline'}
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* SET BASE SCHEMA MODAL */}
      <SetBaseSchemaDialog
        open={isSetBaselineOpen}
        onOpenChange={setIsSetBaselineOpen}
        apis={apis}
        onSuccess={() => {
          fetchData(true);
        }}
      />
    </PageContainer>
  );
}
export default ContractsPage;

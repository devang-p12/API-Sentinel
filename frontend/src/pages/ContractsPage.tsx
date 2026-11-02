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
  Edit01Icon,
  Alert02Icon,
  ArrowDown01Icon,
} from '@hugeicons/core-free-icons';
import { PageContainer } from '@/components/layout/PageContainer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { SetBaseSchemaDialog } from '@/components/contracts/SetBaseSchemaDialog';
import { ModifyBaseSchemaDialog } from '@/components/contracts/ModifyBaseSchemaDialog';
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

interface EndpointChangeGroup {
  schemaId: string;
  schema?: ApiSchemaSummary;
  apiId?: string;
  apiName: string;
  method: string;
  endpoint: string;
  environmentName?: string;
  totalChanges: number;
  breakingCount: number;
  warningCount: number;
  infoCount: number;
  unacknowledgedCount: number;
  latestDetectedAt: string;
  latestVersionNumber?: number;
  changes: SchemaChangeItem[];
}

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
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'UNACKNOWLEDGED' | 'ACKNOWLEDGED'>('ALL');
  const [changesViewMode, setChangesViewMode] = useState<'grouped' | 'feed'>('grouped');

  // Collapsible Endpoint Groups state (by default, breaking endpoints start open)
  const [expandedEndpoints, setExpandedEndpoints] = useState<Record<string, boolean>>({});

  // Selected Schema for Inspection Modal
  const [inspectSchema, setInspectSchema] = useState<ApiSchemaSummary | null>(null);
  const [isApproving, setIsApproving] = useState(false);
  const [approvalSuccess, setApprovalSuccess] = useState<string | null>(null);

  // Set & Modify Base Schema Dialog State
  const [isSetBaselineOpen, setIsSetBaselineOpen] = useState(false);
  const [modifySchemaTarget, setModifySchemaTarget] = useState<ApiSchemaSummary | null>(null);
  const [isModifyBaselineOpen, setIsModifyBaselineOpen] = useState(false);

  // Promoting current schema to baseline state
  const [promotingSchemaId, setPromotingSchemaId] = useState<string | null>(null);

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
  const [acknowledgingEndpointId, setAcknowledgingEndpointId] = useState<string | null>(null);

  const fetchData = useCallback(async (showRefreshing = false) => {
    if (showRefreshing) setIsRefreshing(true);
    else setIsLoading(true);
    setError(null);

    try {
      const [fetchedSchemas, fetchedChanges, fetchedApis] = await Promise.all([
        api.getAllSchemas().catch(() => []),
        api.getAllSchemaChanges({ limit: 150 }).catch(() => []),
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

  // Handle Approving a Specific Schema Version as Baseline
  const handleApproveBaseline = async (schemaId: string, versionId: string) => {
    setIsApproving(true);
    setApprovalSuccess(null);
    try {
      await api.approveBaseline(schemaId, versionId);
      setApprovalSuccess('New baseline approved successfully. Conformance restored.');
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

  // Handle Setting Current Schema as Baseline in 1 click
  const handleSetCurrentAsBaseline = async (schemaId: string) => {
    setPromotingSchemaId(schemaId);
    try {
      await api.setCurrentAsBaseline(schemaId);
      setVerificationBanner(null);
      await fetchData(true);
      if (inspectSchema && inspectSchema.id === schemaId) {
        const refreshed = await api.getSchemaById(schemaId).catch(() => null);
        if (refreshed) setInspectSchema(refreshed);
      }
    } catch (err: any) {
      alert(err?.message || 'Failed to set current schema as baseline.');
    } finally {
      setPromotingSchemaId(null);
    }
  };

  // Handle Verify Schema Now (Live Probe Request)
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
      await fetchData(true);
    } catch (err: any) {
      alert(err?.message || 'Failed to verify schema against endpoint.');
    } finally {
      setVerifyingSchemaId(null);
    }
  };

  // Handle Acknowledge Single Change
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

  // Handle Acknowledge All Changes for an Endpoint
  const handleAcknowledgeAll = async (schemaId: string) => {
    setAcknowledgingEndpointId(schemaId);
    try {
      await api.acknowledgeAllSchemaChanges(schemaId);
      await fetchData(true);
    } catch (err: any) {
      alert(err?.message || 'Failed to acknowledge changes.');
    } finally {
      setAcknowledgingEndpointId(null);
    }
  };

  // Open Modify Base Schema Dialog
  const handleOpenModifyBase = (schema: ApiSchemaSummary) => {
    setModifySchemaTarget(schema);
    setIsModifyBaselineOpen(true);
  };

  const toggleEndpointExpand = (key: string) => {
    setExpandedEndpoints((prev) => ({
      ...prev,
      [key]: prev[key] === undefined ? false : !prev[key],
    }));
  };

  // Filtered Schemas for Tab 1
  const filteredSchemas = useMemo(() => {
    return schemas.filter((schema) => {
      if (selectedApiId !== 'ALL' && schema.apiId !== selectedApiId) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const endpoint = schema.endpoint.toLowerCase();
        const apiName = (schema.api?.name || '').toLowerCase();
        if (!endpoint.includes(q) && !apiName.includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [schemas, selectedApiId, searchQuery]);

  // Grouped Changes for Tab 2 (Organized by API & Endpoint)
  const endpointChangeGroups = useMemo(() => {
    const filtered = changes.filter((change) => {
      if (selectedApiId !== 'ALL' && change.schema?.api?.id !== selectedApiId) {
        return false;
      }
      if (selectedSeverity !== 'ALL' && change.severity !== selectedSeverity) {
        return false;
      }
      if (statusFilter === 'UNACKNOWLEDGED' && change.isAcknowledged) {
        return false;
      }
      if (statusFilter === 'ACKNOWLEDGED' && !change.isAcknowledged) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const endpoint = (change.schema?.endpoint || '').toLowerCase();
        const apiName = (change.schema?.api?.name || '').toLowerCase();
        const field = (change.fieldPath || '').toLowerCase();
        const desc = (change.description || '').toLowerCase();
        if (!endpoint.includes(q) && !apiName.includes(q) && !field.includes(q) && !desc.includes(q)) {
          return false;
        }
      }
      return true;
    });

    const groupsMap = new Map<string, EndpointChangeGroup>();

    for (const c of filtered) {
      const key = c.schemaId || `${c.schema?.method}_${c.schema?.endpoint}_${c.schema?.api?.name}`;
      let group = groupsMap.get(key);
      if (!group) {
        const fullSchema = schemas.find((s) => s.id === c.schemaId);
        group = {
          schemaId: c.schemaId,
          schema: fullSchema,
          apiId: c.schema?.api?.id || fullSchema?.apiId,
          apiName: c.schema?.api?.name || fullSchema?.api?.name || 'API Service',
          method: c.schema?.method || fullSchema?.method || 'GET',
          endpoint: c.schema?.endpoint || fullSchema?.endpoint || '/',
          environmentName: fullSchema?.environment?.name,
          totalChanges: 0,
          breakingCount: 0,
          warningCount: 0,
          infoCount: 0,
          unacknowledgedCount: 0,
          latestDetectedAt: c.detectedAt,
          latestVersionNumber: c.version?.versionNumber,
          changes: [],
        };
        groupsMap.set(key, group);
      }

      group.totalChanges += 1;
      if (c.severity === 'BREAKING') group.breakingCount += 1;
      else if (c.severity === 'WARNING') group.warningCount += 1;
      else group.infoCount += 1;

      if (!c.isAcknowledged) group.unacknowledgedCount += 1;

      if (new Date(c.detectedAt) > new Date(group.latestDetectedAt)) {
        group.latestDetectedAt = c.detectedAt;
        if (c.version?.versionNumber) group.latestVersionNumber = c.version.versionNumber;
      }

      group.changes.push(c);
    }

    return Array.from(groupsMap.values()).sort((a, b) => {
      // Prioritize breaking changes first, then unacknowledged, then by timestamp
      if (a.breakingCount !== b.breakingCount) return b.breakingCount - a.breakingCount;
      if (a.unacknowledgedCount !== b.unacknowledgedCount) return b.unacknowledgedCount - a.unacknowledgedCount;
      return new Date(b.latestDetectedAt).getTime() - new Date(a.latestDetectedAt).getTime();
    });
  }, [changes, schemas, selectedApiId, selectedSeverity, statusFilter, searchQuery]);

  // Flat Filtered Changes (for timeline feed mode)
  const filteredChanges = useMemo(() => {
    return changes.filter((change) => {
      if (selectedApiId !== 'ALL' && change.schema?.api?.id !== selectedApiId) {
        return false;
      }
      if (selectedSeverity !== 'ALL' && change.severity !== selectedSeverity) {
        return false;
      }
      if (statusFilter === 'UNACKNOWLEDGED' && change.isAcknowledged) {
        return false;
      }
      if (statusFilter === 'ACKNOWLEDGED' && !change.isAcknowledged) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const endpoint = (change.schema?.endpoint || '').toLowerCase();
        const apiName = (change.schema?.api?.name || '').toLowerCase();
        const field = (change.fieldPath || '').toLowerCase();
        const desc = (change.description || '').toLowerCase();
        if (!endpoint.includes(q) && !apiName.includes(q) && !field.includes(q) && !desc.includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [changes, selectedApiId, selectedSeverity, statusFilter, searchQuery]);

  // Overall KPIs
  const totalSchemas = schemas.length;
  const breakingChangesCount = changes.filter((c) => c.severity === 'BREAKING' && !c.isAcknowledged).length;
  const activeBaselinesCount = schemas.filter((s) => s.activeBaselineVersionId).length;
  const conformingCount = schemas.filter(
    (s) => !s.changes?.some((c) => c.severity === 'BREAKING' && !c.isAcknowledged),
  ).length;
  const conformanceRate = totalSchemas > 0 ? Math.round((conformingCount / totalSchemas) * 100) : 100;
  const affectedEndpointsCount = endpointChangeGroups.filter((g) => g.unacknowledgedCount > 0).length;

  return (
    <PageContainer
      title="API Contract & Schema Monitoring"
      description="Automated schema drift detection, baseline contract governance, and breaking change prevention across probe executions."
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
        </div>
      }
    >
      <div className="space-y-6">
        {/* Error notification */}
        {error && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs font-mono rounded">
            {error}
          </div>
        )}

        {/* Global Contract Governance KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card className="rounded-none border-border">
            <CardHeader className="p-3 pb-1">
              <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                Managed Contracts
              </span>
            </CardHeader>
            <CardContent className="p-3 pt-0">
              <div className="text-xl font-bold font-mono text-foreground">{totalSchemas}</div>
              <span className="text-[10px] text-muted-foreground font-mono mt-0.5 block">
                {activeBaselinesCount} active baseline{activeBaselinesCount !== 1 ? 's' : ''}
              </span>
            </CardContent>
          </Card>

          <Card className="rounded-none border-border">
            <CardHeader className="p-3 pb-1">
              <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                Breaking Drift
              </span>
            </CardHeader>
            <CardContent className="p-3 pt-0">
              <div
                className={`text-xl font-bold font-mono ${
                  breakingChangesCount > 0 ? 'text-rose-500' : 'text-emerald-500'
                }`}
              >
                {breakingChangesCount}
              </div>
              <span className="text-[10px] text-muted-foreground font-mono mt-0.5 block">
                {breakingChangesCount > 0 ? 'Active violation(s) detected' : 'Zero breaking violations'}
              </span>
            </CardContent>
          </Card>

          <Card className="rounded-none border-border">
            <CardHeader className="p-3 pb-1">
              <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                Affected Endpoints
              </span>
            </CardHeader>
            <CardContent className="p-3 pt-0">
              <div
                className={`text-xl font-bold font-mono ${
                  affectedEndpointsCount > 0 ? 'text-amber-500' : 'text-foreground'
                }`}
              >
                {affectedEndpointsCount}
              </div>
              <span className="text-[10px] text-muted-foreground font-mono mt-0.5 block">
                {affectedEndpointsCount > 0 ? 'Endpoints with unacknowledged drift' : 'All endpoints synchronized'}
              </span>
            </CardContent>
          </Card>

          <Card className="rounded-none border-border">
            <CardHeader className="p-3 pb-1">
              <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                Contract Conformance
              </span>
            </CardHeader>
            <CardContent className="p-3 pt-0">
              <div
                className={`text-xl font-bold font-mono ${
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
              <span>Schema Changes Feed</span>
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
                placeholder="Search endpoint, API, or field..."
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
              <>
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

                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  className="h-8 px-2.5 text-xs bg-background border border-input rounded-none focus:outline-none focus:border-ring font-mono text-foreground"
                >
                  <option value="ALL">All Status</option>
                  <option value="UNACKNOWLEDGED">Unacknowledged Only</option>
                  <option value="ACKNOWLEDGED">Acknowledged Only</option>
                </select>

                {/* View Mode Toggle */}
                <div className="flex items-center gap-0.5 p-0.5 bg-muted/40 border border-border text-[11px] font-mono">
                  <button
                    type="button"
                    onClick={() => setChangesViewMode('grouped')}
                    className={`px-2 py-1 transition-colors ${
                      changesViewMode === 'grouped'
                        ? 'bg-background text-foreground font-semibold shadow-xs'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                    title="Group changes neatly by API and endpoint"
                  >
                    By Endpoint
                  </button>
                  <button
                    type="button"
                    onClick={() => setChangesViewMode('feed')}
                    className={`px-2 py-1 transition-colors ${
                      changesViewMode === 'feed'
                        ? 'bg-background text-foreground font-semibold shadow-xs'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                    title="Show global chronological stream"
                  >
                    Timeline
                  </button>
                </div>
              </>
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
                    : 'Sentinel automatically detects schema drift when monitors probe your endpoints. Click below to establish your initial base schema.'}
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
                  const hasBreaking = schema.changes?.some((c) => c.severity === 'BREAKING' && !c.isAcknowledged);
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
                          <span className="font-mono text-sm font-bold text-foreground truncate">
                            {schema.endpoint}
                          </span>
                          {schema.api && (
                            <Badge variant="outline" className="text-[10px] font-mono text-muted-foreground border-border">
                              {schema.api.name}
                            </Badge>
                          )}
                          {schema.environment && (
                            <span className="text-[11px] text-muted-foreground font-mono">
                              ({schema.environment.name})
                            </span>
                          )}
                        </div>

                        {/* Baseline Status & Checksum */}
                        <div className="flex items-center gap-3 text-xs font-mono text-muted-foreground flex-wrap">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] uppercase">Baseline:</span>
                            {baselineVersion ? (
                              <span className="text-foreground font-semibold">
                                v{baselineVersion.versionNumber} ({new Date(baselineVersion.createdAt).toLocaleDateString()})
                              </span>
                            ) : (
                              <span className="text-amber-500 font-semibold">Pending First Probe</span>
                            )}
                          </div>
                          {baselineVersion?.checksum && (
                            <div className="flex items-center gap-1">
                              <span className="text-[10px] uppercase">SHA:</span>
                              <span className="text-muted-foreground text-[10px]">
                                #{baselineVersion.checksum.slice(0, 8)}
                              </span>
                            </div>
                          )}
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] uppercase">Changes:</span>
                            <span className="text-foreground font-semibold">
                              {schema._count?.changes ?? schema.changes?.length ?? 0}
                            </span>
                          </div>
                        </div>

                        {/* Conformance Indicator */}
                        <div className="flex items-center gap-2 pt-0.5">
                          {hasBreaking ? (
                            <Badge
                              variant="outline"
                              className="text-[10px] font-mono bg-rose-500/10 text-rose-500 border-rose-500/30 flex items-center gap-1 font-bold"
                            >
                              <HugeiconsIcon icon={Alert02Icon} className="size-3" />
                              Breaking Schema Drift Detected
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="text-[10px] font-mono bg-emerald-500/10 text-emerald-500 border-emerald-500/30 flex items-center gap-1 font-semibold"
                            >
                              <HugeiconsIcon icon={CheckmarkCircle01Icon} className="size-3" />
                              Contract Conforms (200 OK)
                            </Badge>
                          )}
                        </div>

                        {/* Live Verification Banner with 1-click 'Set Current as Base' */}
                        {verificationBanner && verificationBanner.schemaId === schema.id && (
                          <div
                            className={`p-2.5 text-xs font-mono border rounded flex items-center justify-between gap-3 flex-wrap ${
                              verificationBanner.hasBreakingChanges
                                ? 'bg-rose-500/10 border-rose-500/30 text-rose-500'
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

                            <div className="flex items-center gap-2">
                              {verificationBanner.durationMs !== undefined && (
                                <span className="text-[10px] opacity-75 shrink-0">
                                  {verificationBanner.durationMs}ms
                                </span>
                              )}
                              {verificationBanner.hasBreakingChanges && (
                                <Button
                                  size="sm"
                                  onClick={() => handleSetCurrentAsBaseline(schema.id)}
                                  disabled={promotingSchemaId === schema.id}
                                  className="h-6 text-[10px] font-mono font-bold bg-rose-600 hover:bg-rose-700 text-white"
                                >
                                  {promotingSchemaId === schema.id ? 'Setting...' : 'Set Current as Base'}
                                </Button>
                              )}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Action Buttons */}
                      <div className="flex items-center gap-2 shrink-0 pt-1 sm:pt-0 flex-wrap">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleVerifySchema(schema.id)}
                          disabled={verifyingSchemaId === schema.id}
                          className="h-8 text-xs font-mono border-primary/40 hover:bg-primary/10 text-primary"
                          title="Trigger live probe and evaluate contract schema conformance"
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
                          onClick={() => handleOpenModifyBase(schema)}
                          className="h-8 text-xs font-mono"
                          title="Directly edit the baseline schema JSON definition"
                        >
                          <HugeiconsIcon icon={Edit01Icon} className="size-3.5 mr-1.5" />
                          Modify Base
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

        {/* TAB 2: SCHEMA CHANGES (ORGANIZED & GROUPED BY ENDPOINT) */}
        {activeTab === 'changes' && (
          <div className="space-y-4">
            {isLoading ? (
              <div className="p-8 text-center text-xs text-muted-foreground font-mono">
                Loading schema change events...
              </div>
            ) : endpointChangeGroups.length === 0 ? (
              <Card className="rounded-none border-border p-12 text-center">
                <HugeiconsIcon icon={CheckmarkCircle01Icon} className="size-10 text-emerald-500 mx-auto mb-3" />
                <h3 className="text-sm font-semibold text-foreground mb-1">All Payloads Conform to Baseline Contracts</h3>
                <p className="text-xs text-muted-foreground max-w-md mx-auto font-mono text-center">
                  No active contract deviations or schema drifts have been recorded for the selected filter. Sentinel automatically monitors all probe runs in the background.
                </p>
              </Card>
            ) : changesViewMode === 'grouped' ? (
              /* GROUPED VIEW: One card per Endpoint with summarized changes */
              <div className="space-y-4">
                <div className="flex items-center justify-between text-xs font-mono text-muted-foreground px-1">
                  <span>
                    Showing <strong>{endpointChangeGroups.length}</strong> impacted endpoint{endpointChangeGroups.length !== 1 ? 's' : ''} across services
                  </span>
                  <span className="text-[11px]">
                    Probes automatically evaluate response structures and log schema drift after alert evaluations
                  </span>
                </div>

                {endpointChangeGroups.map((group) => {
                  const isExpanded = expandedEndpoints[group.schemaId] !== false; // Default expanded for ease of reading
                  const matchingSchema = group.schema || schemas.find((s) => s.id === group.schemaId);

                  return (
                    <div
                      key={group.schemaId}
                      className="border border-border bg-card transition-colors shadow-xs"
                    >
                      {/* Endpoint Group Header */}
                      <div className="p-3.5 bg-muted/20 border-b border-border flex flex-col md:flex-row md:items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5 flex-wrap flex-1 min-w-0">
                          <button
                            type="button"
                            onClick={() => toggleEndpointExpand(group.schemaId)}
                            className="p-1 hover:bg-muted text-muted-foreground hover:text-foreground rounded transition-colors"
                            title={isExpanded ? 'Collapse changes' : 'Expand changes'}
                          >
                            <HugeiconsIcon
                              icon={ArrowDown01Icon}
                              className={`size-3.5 transition-transform duration-200 ${
                                isExpanded ? 'rotate-0' : '-rotate-90'
                              }`}
                            />
                          </button>

                          <Badge
                            variant="outline"
                            className={`text-[10px] font-mono font-bold ${
                              group.method === 'GET'
                                ? 'text-emerald-500 border-emerald-500/30'
                                : group.method === 'POST'
                                ? 'text-blue-500 border-blue-500/30'
                                : group.method === 'PUT'
                                ? 'text-amber-500 border-amber-500/30'
                                : 'text-purple-500 border-purple-500/30'
                            }`}
                          >
                            {group.method}
                          </Badge>

                          <span className="font-mono text-sm font-bold text-foreground">
                            {group.endpoint}
                          </span>

                          <Badge variant="outline" className="text-[10px] font-mono text-foreground bg-muted/50 border-border">
                            {group.apiName}
                          </Badge>

                          {group.environmentName && (
                            <span className="text-[11px] font-mono text-muted-foreground">
                              ({group.environmentName})
                            </span>
                          )}

                          {/* Change Count Badges */}
                          <div className="flex items-center gap-1.5 ml-1">
                            {group.breakingCount > 0 && (
                              <Badge className="bg-rose-500/10 text-rose-500 border-rose-500/30 text-[10px] font-mono font-bold">
                                {group.breakingCount} Breaking
                              </Badge>
                            )}
                            {group.warningCount > 0 && (
                              <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/30 text-[10px] font-mono font-bold">
                                {group.warningCount} Warning
                              </Badge>
                            )}
                            {group.infoCount > 0 && (
                              <Badge className="bg-blue-500/10 text-blue-400 border-blue-500/30 text-[10px] font-mono">
                                {group.infoCount} Additive
                              </Badge>
                            )}
                            {group.unacknowledgedCount > 0 ? (
                              <Badge variant="outline" className="text-[9px] font-mono text-amber-500 border-amber-500/30">
                                {group.unacknowledgedCount} Unacknowledged
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-[9px] font-mono text-emerald-500 border-emerald-500/30">
                                ✓ All Acknowledged
                              </Badge>
                            )}
                          </div>
                        </div>

                        {/* Quick Governance Actions for this Endpoint */}
                        <div className="flex items-center gap-2 shrink-0 flex-wrap">
                          {/* 1-CLICK PROMOTE CURRENT TO BASE SCHEMA */}
                          <Button
                            size="sm"
                            onClick={() => handleSetCurrentAsBaseline(group.schemaId)}
                            disabled={promotingSchemaId === group.schemaId}
                            className="h-7 text-xs font-mono font-bold bg-primary hover:bg-primary/90 text-primary-foreground"
                            title="Promote latest detected response structure to active baseline contract"
                          >
                            <HugeiconsIcon
                              icon={Tick01Icon}
                              className={`size-3 mr-1 ${
                                promotingSchemaId === group.schemaId ? 'animate-spin' : ''
                              }`}
                            />
                            {promotingSchemaId === group.schemaId ? 'Setting...' : 'Set Current as Base'}
                          </Button>

                          {/* DIRECT MODIFY BASE SCHEMA */}
                          {matchingSchema && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleOpenModifyBase(matchingSchema)}
                              className="h-7 text-xs font-mono"
                              title="Directly edit the baseline schema JSON definition"
                            >
                              <HugeiconsIcon icon={Edit01Icon} className="size-3 mr-1" />
                              Modify Base
                            </Button>
                          )}

                          {/* ACKNOWLEDGE ALL */}
                          {group.unacknowledgedCount > 0 && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleAcknowledgeAll(group.schemaId)}
                              disabled={acknowledgingEndpointId === group.schemaId}
                              className="h-7 text-xs font-mono text-muted-foreground hover:text-foreground"
                            >
                              {acknowledgingEndpointId === group.schemaId ? 'Saving...' : 'Acknowledge All'}
                            </Button>
                          )}

                          {matchingSchema && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setInspectSchema(matchingSchema)}
                              className="h-7 text-xs font-mono px-2 text-muted-foreground"
                            >
                              <HugeiconsIcon icon={ViewIcon} className="size-3.5" />
                            </Button>
                          )}
                        </div>
                      </div>

                      {/* Endpoint Group Changes List (Visible when expanded) */}
                      {isExpanded && (
                        <div className="divide-y divide-border/60">
                          <div className="p-2.5 bg-muted/10 text-[11px] font-mono text-muted-foreground flex items-center justify-between">
                            <span>
                              Detected Field Deviations ({group.changes.length}) — Latest shift detected at{' '}
                              <strong className="text-foreground">
                                {new Date(group.latestDetectedAt).toLocaleString()}
                              </strong>
                              {group.latestVersionNumber ? ` (v${group.latestVersionNumber})` : ''}
                            </span>
                            <span className="text-[10px]">Expected vs Received Structure</span>
                          </div>

                          {group.changes.map((change) => (
                            <div
                              key={change.id}
                              className="p-3.5 space-y-1.5 hover:bg-muted/10 transition-colors"
                            >
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <Badge
                                    variant="outline"
                                    className={`text-[9px] font-mono font-bold ${
                                      change.severity === 'BREAKING'
                                        ? 'border-rose-500/30 text-rose-500 bg-rose-500/10'
                                        : change.severity === 'WARNING'
                                        ? 'border-amber-500/30 text-amber-500 bg-amber-500/10'
                                        : 'border-blue-500/30 text-blue-400 bg-blue-500/10'
                                    }`}
                                  >
                                    {change.severity}
                                  </Badge>

                                  <span className="font-mono text-xs font-bold px-1.5 py-0.5 bg-muted rounded text-foreground">
                                    {change.changeType}
                                  </span>

                                  <span className="font-mono text-xs font-bold text-primary">
                                    {change.fieldPath}
                                  </span>
                                </div>

                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] font-mono text-muted-foreground">
                                    {new Date(change.detectedAt).toLocaleTimeString()}
                                  </span>

                                  {change.isAcknowledged ? (
                                    <Badge
                                      variant="outline"
                                      className="text-[9px] font-mono text-muted-foreground border-border"
                                    >
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

                              {(change.previousType || change.currentType) && (
                                <div className="flex items-center gap-3 text-[11px] font-mono pt-1 text-muted-foreground">
                                  {change.previousType && (
                                    <span>
                                      Expected in Base:{' '}
                                      <strong className="text-foreground line-through opacity-75">
                                        {change.previousType}
                                      </strong>
                                    </span>
                                  )}
                                  {change.currentType && (
                                    <span>
                                      ➔ Current Payload:{' '}
                                      <strong className="text-rose-400 font-bold">
                                        {change.currentType}
                                      </strong>
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              /* TIMELINE FEED VIEW (Chronological list with clear endpoint badges) */
              <div className="border border-border bg-card divide-y divide-border">
                {filteredChanges.map((change) => (
                  <div key={change.id} className="p-4 space-y-2 hover:bg-muted/10 transition-colors">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
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
                        {change.schemaId && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleSetCurrentAsBaseline(change.schemaId)}
                            disabled={promotingSchemaId === change.schemaId}
                            className="h-6 text-[10px] font-mono px-2 text-primary"
                            title="Set this schema version as the baseline"
                          >
                            {promotingSchemaId === change.schemaId ? 'Setting...' : 'Set as Base'}
                          </Button>
                        )}
                      </div>
                    </div>

                    <p className="text-xs text-muted-foreground font-mono">
                      {change.description}
                    </p>

                    <div className="flex items-center gap-4 text-[11px] font-mono text-muted-foreground pt-1 border-t border-border/50 flex-wrap">
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
                          Expected: <strong className="text-foreground line-through">{change.previousType}</strong>
                        </span>
                      )}
                      {change.currentType && (
                        <span>
                          Received: <strong className="text-rose-400">{change.currentType}</strong>
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
          <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto bg-card border-border font-mono text-xs">
            <DialogHeader>
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs font-mono font-bold">
                    {inspectSchema.method}
                  </Badge>
                  <DialogTitle className="text-base font-mono font-semibold truncate text-foreground">
                    {inspectSchema.endpoint}
                  </DialogTitle>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const target = inspectSchema;
                      setInspectSchema(null);
                      handleOpenModifyBase(target);
                    }}
                    className="h-7 text-xs font-mono"
                  >
                    <HugeiconsIcon icon={Edit01Icon} className="size-3 mr-1" />
                    Modify Base
                  </Button>

                  <Button
                    size="sm"
                    onClick={() => handleSetCurrentAsBaseline(inspectSchema.id)}
                    disabled={promotingSchemaId === inspectSchema.id}
                    className="h-7 text-xs font-mono font-bold"
                  >
                    <HugeiconsIcon icon={Tick01Icon} className="size-3 mr-1" />
                    {promotingSchemaId === inspectSchema.id ? 'Setting...' : 'Set Current as Base'}
                  </Button>
                </div>
              </div>
              <DialogDescription className="text-xs font-mono text-muted-foreground">
                Contract definition and baseline schema AST for {inspectSchema.api?.name || 'API endpoint'}.
              </DialogDescription>
            </DialogHeader>

            {approvalSuccess && (
              <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-xs font-mono rounded">
                {approvalSuccess}
              </div>
            )}

            <div className="space-y-4 py-2">
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
                            {isApproving ? 'Approving...' : 'Approve as Baseline'}
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

      {/* MODIFY BASE SCHEMA MODAL */}
      <ModifyBaseSchemaDialog
        schema={modifySchemaTarget}
        open={isModifyBaselineOpen}
        onOpenChange={setIsModifyBaselineOpen}
        onSuccess={() => {
          fetchData(true);
        }}
      />

      {/* INITIAL SET BASE SCHEMA MODAL */}
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

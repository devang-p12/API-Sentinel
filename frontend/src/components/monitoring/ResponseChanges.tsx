import React, { useState, useEffect, useCallback } from 'react';
import {
  getCurrentSchema,
  getSchemaHistory,
  getSchemaChanges,
  acknowledgeSchemaChange,
} from '@/services/schema.service';
import type {
  ApiSchema,
  SchemaVersionHistory,
  ApiSchemaChange,
  SchemaDiffSeverity,
} from '@/types/schema';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Layers,
  Clock,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Info,
  ChevronRight,
  ChevronDown,
  RefreshCw,
  Copy,
  Check,
  Code2,
  FileCode,
  ShieldCheck,
  ArrowRight,
  PlusCircle,
  MinusCircle,
  ListFilter,
} from 'lucide-react';

interface ResponseChangesProps {
  apiId: number | string;
  environment?: string;
}

export const ResponseChanges: React.FC<ResponseChangesProps> = ({
  apiId: rawApiId,
  environment = 'development',
}) => {
  const apiId = typeof rawApiId === 'string' ? parseInt(rawApiId, 10) : rawApiId;

  const [currentSchema, setCurrentSchema] = useState<ApiSchema | null>(null);
  const [history, setHistory] = useState<SchemaVersionHistory[]>([]);
  const [changes, setChanges] = useState<ApiSchemaChange[]>([]);
  const [selectedChange, setSelectedChange] = useState<ApiSchemaChange | null>(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [acknowledgingId, setAcknowledgingId] = useState<number | null>(null);
  const [copiedRaw, setCopiedRaw] = useState(false);
  const [schemaViewMode, setSchemaViewMode] = useState<'tree' | 'json'>('tree');

  const fetchData = useCallback(
    async (isRefresh = false) => {
      if (!apiId || isNaN(apiId)) return;
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);

      try {
        const [schemaRes, historyRes, changesRes] = await Promise.all([
          getCurrentSchema(apiId, environment),
          getSchemaHistory(apiId, environment, 50),
          getSchemaChanges(apiId, environment, 50, 0),
        ]);

        setCurrentSchema(schemaRes);
        setHistory(historyRes);
        setChanges(changesRes);

        if (changesRes.length > 0) {
          setSelectedChange((prev) => {
            if (!prev) return changesRes[0];
            const updated = changesRes.find((c) => c.id === prev.id);
            return updated || changesRes[0];
          });
        } else {
          setSelectedChange(null);
        }
      } catch (err: any) {
        console.error('Failed to load response schema data:', err);
        setError(err.message || 'Failed to load schema data');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [apiId, environment]
  );

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleAcknowledge = async (changeId: number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      setAcknowledgingId(changeId);
      await acknowledgeSchemaChange(changeId);
      setChanges((prev) =>
        prev.map((c) => (c.id === changeId ? { ...c, isAcknowledged: true } : c))
      );
      if (selectedChange?.id === changeId) {
        setSelectedChange((prev) => (prev ? { ...prev, isAcknowledged: true } : null));
      }
    } catch (err: any) {
      console.error('Failed to acknowledge schema change:', err);
      alert(err.message || 'Failed to acknowledge schema change');
    } finally {
      setAcknowledgingId(null);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedRaw(true);
    setTimeout(() => setCopiedRaw(false), 2000);
  };

  const renderSeverityBadge = (severity: SchemaDiffSeverity) => {
    if (severity === 'CRITICAL') {
      return (
        <Badge
          variant="outline"
          className="border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400 font-semibold text-[10px] gap-1"
        >
          <AlertCircle className="h-3 w-3" />
          CRITICAL
        </Badge>
      );
    }
    if (severity === 'WARNING') {
      return (
        <Badge
          variant="outline"
          className="border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400 font-semibold text-[10px] gap-1"
        >
          <AlertTriangle className="h-3 w-3" />
          WARNING
        </Badge>
      );
    }
    return (
      <Badge
        variant="outline"
        className="border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400 font-semibold text-[10px] gap-1"
      >
        <Info className="h-3 w-3" />
        INFO
      </Badge>
    );
  };

  // Loading State
  if (loading) {
    return (
      <div className="p-12 text-center text-muted-foreground flex flex-col items-center justify-center gap-3">
        <RefreshCw className="h-6 w-6 animate-spin text-primary/70" />
        <p className="text-sm">Loading response schema...</p>
      </div>
    );
  }

  // Error State
  if (error) {
    return (
      <Card className="border-red-500/20 bg-red-500/5">
        <CardContent className="p-6 flex flex-col items-center justify-center text-center gap-3">
          <AlertCircle className="h-8 w-8 text-red-500" />
          <div>
            <h3 className="text-base font-semibold text-red-600 dark:text-red-400">
              Error Loading Schema
            </h3>
            <p className="text-sm text-muted-foreground mt-1">{error}</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => fetchData(true)} className="mt-2">
            <RefreshCw className="mr-2 h-4 w-4" /> Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Empty State: No baseline exists yet
  if (!currentSchema) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-12 px-6 flex flex-col items-center justify-center text-center gap-3">
          <div className="p-3 bg-muted rounded-full text-muted-foreground">
            <FileCode className="h-8 w-8" />
          </div>
          <div>
            <h3 className="text-lg font-semibold tracking-tight">
              No response schema baseline has been detected yet.
            </h3>
            <p className="text-sm text-muted-foreground max-w-md mt-1">
              API-Sentinel automatically creates version 1 baseline as soon as a successful JSON
              response is recorded during automated monitoring checks in environment{' '}
              <span className="font-semibold text-foreground">'{environment}'</span>.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchData(true)}
            disabled={refreshing}
            className="mt-2"
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Check for Baseline
          </Button>
        </CardContent>
      </Card>
    );
  }

  const previousVersionRecord = history.find((v) => v.version < currentSchema.version);
  const unacknowledgedCount = changes.filter((c) => !c.isAcknowledged).length;

  return (
    <div className="space-y-6">
      {/* Overview Cards Row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-5 flex items-center gap-4">
            <div className="p-3 bg-primary/10 text-primary rounded-lg">
              <Layers className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Current Version</p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-2xl font-bold">v{currentSchema.version}</span>
                {currentSchema.isBaseline && (
                  <Badge variant="outline" className="text-[10px] text-emerald-500 border-emerald-500/30 bg-emerald-500/10">
                    Baseline
                  </Badge>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5 flex items-center gap-4">
            <div className="p-3 bg-blue-500/10 text-blue-500 rounded-lg">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Recorded Versions</p>
              <p className="text-2xl font-bold">{history.length}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5 flex items-center gap-4">
            <div className="p-3 bg-amber-500/10 text-amber-500 rounded-lg">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Detected Changes</p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-2xl font-bold">{changes.length}</span>
                {unacknowledgedCount > 0 && (
                  <Badge variant="destructive" className="text-[10px]">
                    {unacknowledgedCount} unacknowledged
                  </Badge>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Active Environment</p>
              <p className="text-sm font-semibold capitalize mt-1">{environment}</p>
              <p className="text-[11px] text-muted-foreground">
                Updated {new Date(currentSchema.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={() => fetchData(true)}
              disabled={refreshing}
              title="Refresh response schemas"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Sub-Tabs */}
      <Tabs defaultValue="changes" className="w-full">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
          <TabsList>
            <TabsTrigger value="changes" className="gap-2">
              <AlertTriangle className="h-4 w-4" />
              Change History ({changes.length})
            </TabsTrigger>
            <TabsTrigger value="current" className="gap-2">
              <Code2 className="h-4 w-4" />
              Current Schema (v{currentSchema.version})
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-2">
              <Clock className="h-4 w-4" />
              Version History ({history.length})
            </TabsTrigger>
          </TabsList>
        </div>

        {/* ========================================================================= */}
        {/* TAB 1: Change History & Details */}
        {/* ========================================================================= */}
        <TabsContent value="changes" className="mt-0 space-y-6">
          {changes.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-12 px-6 flex flex-col items-center justify-center text-center gap-2">
                <CheckCircle2 className="h-8 w-8 text-emerald-500" />
                <h3 className="text-base font-semibold">No response schema changes detected.</h3>
                <p className="text-sm text-muted-foreground max-w-md">
                  All monitoring responses currently match the baseline schema (v{currentSchema.version}).
                  Any future structural additions, removals, or type shifts will appear here.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-6 lg:grid-cols-12">
              {/* Left Column: Changes List */}
              <div className="lg:col-span-5 space-y-3">
                <div className="flex items-center justify-between px-1">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <ListFilter className="h-4 w-4" /> Detected Change Events
                  </h3>
                  <span className="text-xs text-muted-foreground">{changes.length} events</span>
                </div>

                <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
                  {changes.map((change) => {
                    const isSelected = selectedChange?.id === change.id;
                    const totalDiffs =
                      (change.addedFields?.length || 0) +
                      (change.removedFields?.length || 0) +
                      (change.changedFieldTypes?.length || 0);

                    return (
                      <div
                        key={change.id}
                        onClick={() => setSelectedChange(change)}
                        className={`p-3.5 rounded-lg border text-left cursor-pointer transition-all ${
                          isSelected
                            ? 'border-primary bg-primary/5 shadow-xs'
                            : 'border-border hover:bg-muted/40'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <div className="flex items-center gap-2">
                            {renderSeverityBadge(change.severity)}
                            <span className="text-xs font-mono text-muted-foreground">
                              #{change.id}
                            </span>
                          </div>
                          <span className="text-[11px] text-muted-foreground">
                            {new Date(change.detectedAt).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>

                        <div className="text-xs font-medium text-foreground flex items-center justify-between">
                          <span>
                            {totalDiffs} {totalDiffs === 1 ? 'difference' : 'differences'} detected
                          </span>
                          <span className="text-[11px] text-muted-foreground">
                            HTTP {change.statusCode}
                          </span>
                        </div>

                        {/* Badges preview */}
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {change.addedFields?.length > 0 && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-sm bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-mono">
                              +{change.addedFields.length} added
                            </span>
                          )}
                          {change.removedFields?.length > 0 && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-sm bg-red-500/10 text-red-600 dark:text-red-400 font-mono">
                              -{change.removedFields.length} removed
                            </span>
                          )}
                          {change.changedFieldTypes?.length > 0 && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-sm bg-amber-500/10 text-amber-600 dark:text-amber-400 font-mono">
                              ~{change.changedFieldTypes.length} type shifts
                            </span>
                          )}
                        </div>

                        {/* Acknowledge status / action */}
                        <div className="mt-2.5 pt-2 border-t border-border/50 flex items-center justify-between">
                          {change.isAcknowledged ? (
                            <span className="text-[11px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                              <ShieldCheck className="h-3 w-3" /> Acknowledged
                            </span>
                          ) : (
                            <span className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">
                              Pending review
                            </span>
                          )}

                          {!change.isAcknowledged && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 px-2 text-[11px] text-primary hover:text-primary hover:bg-primary/10"
                              onClick={(e) => handleAcknowledge(change.id, e)}
                              disabled={acknowledgingId === change.id}
                            >
                              {acknowledgingId === change.id ? (
                                <RefreshCw className="h-3 w-3 animate-spin mr-1" />
                              ) : (
                                <Check className="h-3 w-3 mr-1" />
                              )}
                              Acknowledge
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Right Column: Selected Change Breakdown */}
              <div className="lg:col-span-7">
                {selectedChange ? (
                  <Card className="border">
                    <CardHeader className="pb-4">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <CardTitle className="text-base">
                              Change Details #{selectedChange.id}
                            </CardTitle>
                            {renderSeverityBadge(selectedChange.severity)}
                          </div>
                          <CardDescription className="text-xs mt-1">
                            Detected {new Date(selectedChange.detectedAt).toLocaleString()}
                          </CardDescription>
                        </div>

                        {!selectedChange.isAcknowledged && (
                          <Button
                            size="sm"
                            onClick={() => handleAcknowledge(selectedChange.id)}
                            disabled={acknowledgingId === selectedChange.id}
                            className="w-fit"
                          >
                            {acknowledgingId === selectedChange.id ? (
                              <RefreshCw className="h-3.5 w-3.5 animate-spin mr-1.5" />
                            ) : (
                              <Check className="h-3.5 w-3.5 mr-1.5" />
                            )}
                            Acknowledge Change
                          </Button>
                        )}
                      </div>
                    </CardHeader>

                    <CardContent className="space-y-5 pt-0">
                      {/* Added Fields */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                            <PlusCircle className="h-4 w-4" /> Added Fields (
                            {selectedChange.addedFields?.length || 0})
                          </h4>
                        </div>
                        {selectedChange.addedFields && selectedChange.addedFields.length > 0 ? (
                          <div className="p-3 bg-emerald-500/5 border border-emerald-500/20 rounded-md space-y-1.5">
                            {selectedChange.addedFields.map((field) => (
                              <div
                                key={field}
                                className="text-xs font-mono text-emerald-700 dark:text-emerald-300 break-all flex items-center gap-2"
                              >
                                <span className="text-emerald-500 font-bold">+</span>
                                <code>{field}</code>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground italic pl-5">
                            No added fields.
                          </p>
                        )}
                      </div>

                      {/* Removed Fields */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-semibold text-red-600 dark:text-red-400 flex items-center gap-1.5">
                            <MinusCircle className="h-4 w-4" /> Removed Fields (
                            {selectedChange.removedFields?.length || 0})
                          </h4>
                        </div>
                        {selectedChange.removedFields && selectedChange.removedFields.length > 0 ? (
                          <div className="p-3 bg-red-500/5 border border-red-500/20 rounded-md space-y-1.5">
                            {selectedChange.removedFields.map((field) => (
                              <div
                                key={field}
                                className="text-xs font-mono text-red-700 dark:text-red-300 break-all flex items-center gap-2"
                              >
                                <span className="text-red-500 font-bold">-</span>
                                <code>{field}</code>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground italic pl-5">
                            No removed fields.
                          </p>
                        )}
                      </div>

                      {/* Changed Field Types */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                            <AlertTriangle className="h-4 w-4" /> Changed Field Types (
                            {selectedChange.changedFieldTypes?.length || 0})
                          </h4>
                        </div>
                        {selectedChange.changedFieldTypes &&
                        selectedChange.changedFieldTypes.length > 0 ? (
                          <div className="p-3 bg-amber-500/5 border border-amber-500/20 rounded-md space-y-2">
                            {selectedChange.changedFieldTypes.map((change) => (
                              <div
                                key={change.path}
                                className="text-xs font-mono flex flex-wrap items-center gap-2 text-foreground"
                              >
                                <code className="font-semibold text-amber-600 dark:text-amber-400">
                                  {change.path}
                                </code>
                                <span className="text-muted-foreground">:</span>
                                <Badge variant="outline" className="text-[10px] text-red-500 border-red-500/20">
                                  {change.previousType}
                                </Badge>
                                <ArrowRight className="h-3 w-3 text-muted-foreground" />
                                <Badge variant="outline" className="text-[10px] text-emerald-500 border-emerald-500/20">
                                  {change.newType}
                                </Badge>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground italic pl-5">
                            No changed field types.
                          </p>
                        )}
                      </div>

                      {/* Inspect Schemas Collapse */}
                      <div className="pt-2">
                        <details className="text-xs group border rounded-md p-3">
                          <summary className="cursor-pointer font-medium text-muted-foreground hover:text-foreground flex items-center justify-between">
                            <span>Inspect Raw Transition Schemas</span>
                            <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
                          </summary>
                          <div className="grid sm:grid-cols-2 gap-3 mt-3 pt-3 border-t">
                            <div>
                              <p className="text-[11px] font-semibold text-muted-foreground mb-1">
                                Previous Schema Definition
                              </p>
                              <pre className="p-2.5 bg-muted/40 rounded-sm text-[11px] font-mono overflow-x-auto max-h-48 border">
                                {JSON.stringify(selectedChange.previousSchema, null, 2)}
                              </pre>
                            </div>
                            <div>
                              <p className="text-[11px] font-semibold text-muted-foreground mb-1">
                                New Schema Definition
                              </p>
                              <pre className="p-2.5 bg-muted/40 rounded-sm text-[11px] font-mono overflow-x-auto max-h-48 border">
                                {JSON.stringify(selectedChange.newSchema, null, 2)}
                              </pre>
                            </div>
                          </div>
                        </details>
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="p-8 text-center text-muted-foreground border rounded-lg">
                    Select a schema change event on the left to inspect its detailed differences.
                  </div>
                )}
              </div>
            </div>
          )}
        </TabsContent>

        {/* ========================================================================= */}
        {/* TAB 2: Current Schema */}
        {/* ========================================================================= */}
        <TabsContent value="current" className="mt-0 space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <CardTitle className="text-base">
                    Active Normalized Schema (v{currentSchema.version})
                  </CardTitle>
                  {currentSchema.isBaseline && (
                    <Badge variant="outline" className="text-emerald-500 border-emerald-500/20 bg-emerald-500/10 text-[10px]">
                      Baseline
                    </Badge>
                  )}
                </div>
                <CardDescription className="text-xs mt-1">
                  Normalized representation without dynamic values. Created{' '}
                  {new Date(currentSchema.createdAt).toLocaleString()}.
                </CardDescription>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex rounded-md border p-0.5 bg-muted/30 text-xs">
                  <button
                    type="button"
                    onClick={() => setSchemaViewMode('tree')}
                    className={`px-2 py-1 rounded-xs transition-colors ${
                      schemaViewMode === 'tree'
                        ? 'bg-background text-foreground shadow-2xs font-medium'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Tree View
                  </button>
                  <button
                    type="button"
                    onClick={() => setSchemaViewMode('json')}
                    className={`px-2 py-1 rounded-xs transition-colors ${
                      schemaViewMode === 'json'
                        ? 'bg-background text-foreground shadow-2xs font-medium'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Raw JSON
                  </button>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyToClipboard(JSON.stringify(currentSchema.schemaDefinition, null, 2))}
                  className="h-8"
                >
                  {copiedRaw ? (
                    <Check className="h-3.5 w-3.5 text-emerald-500 mr-1.5" />
                  ) : (
                    <Copy className="h-3.5 w-3.5 mr-1.5" />
                  )}
                  {copiedRaw ? 'Copied' : 'Copy'}
                </Button>
              </div>
            </CardHeader>

            <CardContent>
              {schemaViewMode === 'tree' ? (
                <div className="border rounded-md p-4 bg-muted/20">
                  <SchemaTreeRenderer schema={currentSchema.schemaDefinition} />
                </div>
              ) : (
                <pre className="p-4 bg-muted/40 rounded-md text-xs font-mono overflow-x-auto max-h-[500px] border">
                  {JSON.stringify(currentSchema.schemaDefinition, null, 2)}
                </pre>
              )}

              {/* Sample Response Preview if available */}
              {currentSchema.sampleResponse && (
                <div className="mt-4 pt-4 border-t">
                  <details className="text-xs group">
                    <summary className="cursor-pointer font-medium text-muted-foreground hover:text-foreground flex items-center gap-1.5">
                      <ChevronRight className="h-3.5 w-3.5 transition-transform group-open:rotate-90" />
                      View Captured Sample Response
                    </summary>
                    <pre className="mt-2 p-3 bg-muted/40 rounded-md text-xs font-mono overflow-x-auto max-h-60 border">
                      {typeof currentSchema.sampleResponse === 'string'
                        ? (currentSchema.sampleResponse as string)
                        : JSON.stringify(currentSchema.sampleResponse, null, 2)}
                    </pre>
                  </details>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ========================================================================= */}
        {/* TAB 3: Version History & Previous Schema */}
        {/* ========================================================================= */}
        <TabsContent value="history" className="mt-0 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Schema Version History</CardTitle>
              <CardDescription className="text-xs">
                All version revisions established for environment '{environment}' in newest-first order.
              </CardDescription>
            </CardHeader>

            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Version</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Created At</TableHead>
                      <TableHead>Last Updated</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {history.map((ver) => {
                      const isCurrent = ver.version === currentSchema.version;
                      return (
                        <TableRow key={ver.version}>
                          <TableCell className="font-semibold font-mono">
                            v{ver.version} {isCurrent && <span className="text-xs text-primary font-normal">(Current)</span>}
                          </TableCell>
                          <TableCell>
                            {ver.isBaseline ? (
                              <Badge variant="outline" className="text-emerald-500 border-emerald-500/20 bg-emerald-500/10 text-[10px]">
                                Baseline
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-muted-foreground text-[10px]">
                                Revision
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {new Date(ver.createdAt).toLocaleString()}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {new Date(ver.updatedAt).toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right">
                            <details className="inline-block text-left">
                              <summary className="cursor-pointer text-xs text-primary hover:underline">
                                View Schema
                              </summary>
                              <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
                                <div className="bg-background border rounded-lg max-w-2xl w-full p-5 max-h-[80vh] overflow-y-auto shadow-lg space-y-3">
                                  <div className="flex items-center justify-between pb-2 border-b">
                                    <h4 className="text-sm font-semibold">
                                      Schema Definition v{ver.version}
                                    </h4>
                                    <button
                                      type="button"
                                      className="text-xs text-muted-foreground hover:text-foreground"
                                      onClick={(e) => {
                                        const detailsEl = (e.target as HTMLElement).closest('details');
                                        if (detailsEl) detailsEl.open = false;
                                      }}
                                    >
                                      Close
                                    </button>
                                  </div>
                                  <pre className="p-3 bg-muted/40 rounded-md text-xs font-mono overflow-x-auto max-h-96 border">
                                    {JSON.stringify(ver.schemaDefinition, null, 2)}
                                  </pre>
                                </div>
                              </div>
                            </details>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Previous Schema Comparison Note */}
              <div className="mt-6 pt-4 border-t text-xs text-muted-foreground">
                {previousVersionRecord ? (
                  <div className="flex items-center gap-2">
                    <Info className="h-4 w-4 text-primary" />
                    <span>
                      Previous version <strong>v{previousVersionRecord.version}</strong> was detected at{' '}
                      {new Date(previousVersionRecord.createdAt).toLocaleString()}.
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Info className="h-4 w-4 text-muted-foreground" />
                    <span>No previous schema version available. Initial baseline (v1) is current.</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

// =========================================================================
// Tree View Recursive Renderer for Normalized Schema
// =========================================================================

interface SchemaTreeRendererProps {
  schema: any;
  pathPrefix?: string;
}

const SchemaTreeRenderer: React.FC<SchemaTreeRendererProps> = ({
  schema,
  pathPrefix = '',
}) => {
  if (!schema || typeof schema !== 'object') {
    return <span className="text-xs font-mono text-muted-foreground">{String(schema)}</span>;
  }

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'string':
        return 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
      case 'number':
        return 'text-blue-600 dark:text-blue-400 bg-blue-500/10 border-blue-500/20';
      case 'boolean':
        return 'text-purple-600 dark:text-purple-400 bg-purple-500/10 border-purple-500/20';
      case 'object':
        return 'text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/20';
      case 'array':
        return 'text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 border-indigo-500/20';
      case 'null':
        return 'text-slate-500 bg-slate-500/10 border-slate-500/20';
      default:
        return 'text-muted-foreground bg-muted border-border';
    }
  };

  // Object with properties
  if (schema.type === 'object' && schema.properties) {
    const propEntries = Object.entries(schema.properties);
    if (propEntries.length === 0) {
      return <span className="text-xs font-mono text-muted-foreground">{'{} (empty object)'}</span>;
    }

    return (
      <div className="space-y-1.5 font-mono text-xs">
        {propEntries.map(([key, val]: [string, any]) => {
          const currentPath = pathPrefix ? `${pathPrefix}.${key}` : key;

          return (
            <div key={key} className="pl-3 border-l-2 border-muted-foreground/20 hover:border-primary/50 transition-colors">
              <div className="flex items-center gap-2 py-0.5">
                <span className="font-semibold text-foreground">{key}</span>
                <span className="text-muted-foreground/60">:</span>
                <Badge variant="outline" className={`text-[10px] px-1.5 py-0 font-mono ${getTypeColor(val?.type || 'unknown')}`}>
                  {val?.type || typeof val}
                  {val?.type === 'array' && val?.itemType ? `<${val.itemType}>` : ''}
                </Badge>
              </div>

              {/* Recurse for nested objects */}
              {val?.type === 'object' && val?.properties && (
                <div className="mt-1">
                  <SchemaTreeRenderer schema={val} pathPrefix={currentPath} />
                </div>
              )}

              {/* Recurse for array of objects */}
              {val?.type === 'array' && val?.items?.properties && (
                <div className="mt-1 pl-2">
                  <span className="text-[10px] text-muted-foreground italic">items:</span>
                  <SchemaTreeRenderer schema={val.items} pathPrefix={`${currentPath}[*]`} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  // Array schema
  if (schema.type === 'array') {
    return (
      <div className="text-xs font-mono space-y-1">
        <Badge variant="outline" className={`text-[10px] ${getTypeColor('array')}`}>
          array{schema.itemType ? `<${schema.itemType}>` : ''}
        </Badge>
        {schema.items?.properties && (
          <div className="pl-3 border-l-2 border-muted-foreground/20 mt-1">
            <span className="text-[10px] text-muted-foreground italic">item structure:</span>
            <SchemaTreeRenderer schema={schema.items} pathPrefix={pathPrefix ? `${pathPrefix}[*]` : '[*]'} />
          </div>
        )}
      </div>
    );
  }

  // Fallback for primitive or unknown
  return (
    <pre className="text-xs font-mono overflow-x-auto text-muted-foreground">
      {JSON.stringify(schema, null, 2)}
    </pre>
  );
};

export default ResponseChanges;

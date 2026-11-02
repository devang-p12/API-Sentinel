import React, { useState, useEffect, useMemo } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  FileCodeIcon,
  PlayIcon,
  CheckmarkCircle01Icon,
} from '@hugeicons/core-free-icons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { api, type Api, type Environment, type ApiSchemaSummary, type Monitor } from '@/lib/api';

interface SetBaseSchemaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  apis: Api[];
  initialApiId?: string;
  onSuccess: (schema: ApiSchemaSummary) => void;
}

const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const;

export function SetBaseSchemaDialog({
  open,
  onOpenChange,
  apis,
  initialApiId,
  onSuccess,
}: SetBaseSchemaDialogProps) {
  const [selectedApiId, setSelectedApiId] = useState<string>(initialApiId || (apis[0]?.id ?? ''));
  const [selectedEnvId, setSelectedEnvId] = useState<string>('');
  const [method, setMethod] = useState<string>('GET');
  const [endpoint, setEndpoint] = useState<string>('/');

  // Registered Monitors / Endpoints
  const [monitors, setMonitors] = useState<Monitor[]>([]);
  const [selectedMonitorId, setSelectedMonitorId] = useState<string>('');
  const [isCustomEndpoint, setIsCustomEndpoint] = useState<boolean>(false);

  // Advanced Config (Headers, Body)
  const [showConfig, setShowConfig] = useState(false);
  const [headersJson, setHeadersJson] = useState<string>('{\n  "Content-Type": "application/json"\n}');
  const [requestBodyJson, setRequestBodyJson] = useState<string>('{\n  \n}');

  // Baseline Definition Mode
  const [baselineMode, setBaselineMode] = useState<'fetchLive' | 'pasteJson'>('fetchLive');
  const [samplePayloadText, setSamplePayloadText] = useState<string>(
    '{\n  "status": "success",\n  "data": {\n    "id": "item_123",\n    "name": "Sample Record",\n    "active": true\n  }\n}',
  );

  // Status & Feedback
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch all registered monitors when dialog opens
  useEffect(() => {
    if (open) {
      api
        .getMonitors()
        .then((mons) => setMonitors(mons))
        .catch(() => []);
    }
  }, [open]);

  // Sync selected API if initial changes
  useEffect(() => {
    if (initialApiId) {
      setSelectedApiId(initialApiId);
    } else if (!selectedApiId && apis.length > 0) {
      setSelectedApiId(apis[0].id);
    }
  }, [initialApiId, apis, selectedApiId]);

  // Selected API Record & Environments
  const currentApi = useMemo(() => {
    return apis.find((a) => a.id === selectedApiId) || null;
  }, [apis, selectedApiId]);

  const environments = useMemo(() => {
    return currentApi?.environments || [];
  }, [currentApi]);

  // Sync environment if API changes
  useEffect(() => {
    if (environments.length > 0 && (!selectedEnvId || !environments.some((e) => e.id === selectedEnvId))) {
      setSelectedEnvId(environments[0].id);
    }
  }, [environments, selectedEnvId]);

  const selectedEnvironment: Environment | undefined = useMemo(() => {
    return environments.find((e) => e.id === selectedEnvId);
  }, [environments, selectedEnvId]);

  // Filter monitors for currently selected API
  const apiMonitors = useMemo(() => {
    return monitors.filter((m) => {
      const mApiId = (m as any).apiId || m.environment?.apiId;
      return mApiId === selectedApiId;
    });
  }, [monitors, selectedApiId]);

  // When selected API or its monitors change, auto-select the first registered endpoint
  useEffect(() => {
    if (apiMonitors.length > 0) {
      const first = apiMonitors[0];
      setSelectedMonitorId(first.id);
      setIsCustomEndpoint(false);
      setMethod(first.method || 'GET');
      setEndpoint(first.url || (first as any).endpoint || '/');
      if (first.environmentId) setSelectedEnvId(first.environmentId);
      if (first.headers && Object.keys(first.headers).length > 0) {
        setHeadersJson(JSON.stringify(first.headers, null, 2));
      }
      if (first.body) {
        setRequestBodyJson(
          typeof first.body === 'string' ? first.body : JSON.stringify(first.body, null, 2),
        );
      }
    } else {
      setSelectedMonitorId('__ROOT__');
      setIsCustomEndpoint(false);
      setMethod('GET');
      setEndpoint('/');
    }
  }, [selectedApiId, apiMonitors]);

  // Handle Endpoint Dropdown Selection
  const handleEndpointSelect = (value: string) => {
    if (value === '__CUSTOM__') {
      setSelectedMonitorId('__CUSTOM__');
      setIsCustomEndpoint(true);
      return;
    }

    setIsCustomEndpoint(false);
    if (value === '__ROOT__') {
      setSelectedMonitorId('__ROOT__');
      setEndpoint('/');
      setMethod('GET');
      return;
    }

    setSelectedMonitorId(value);
    const found = apiMonitors.find((m) => m.id === value);
    if (found) {
      setMethod(found.method || 'GET');
      setEndpoint(found.url || (found as any).endpoint || '/');
      if (found.environmentId) setSelectedEnvId(found.environmentId);
      if (found.headers && Object.keys(found.headers).length > 0) {
        setHeadersJson(JSON.stringify(found.headers, null, 2));
      } else {
        setHeadersJson('{\n  "Content-Type": "application/json"\n}');
      }
      if (found.body) {
        setRequestBodyJson(
          typeof found.body === 'string' ? found.body : JSON.stringify(found.body, null, 2),
        );
      } else {
        setRequestBodyJson('{\n  \n}');
      }
    }
  };

  // Full Resolved Target URL
  const resolvedFullUrl = useMemo(() => {
    const cleanEndpoint = endpoint.trim();
    if (cleanEndpoint.startsWith('http://') || cleanEndpoint.startsWith('https://')) {
      return cleanEndpoint;
    }
    const baseUrl = selectedEnvironment?.baseUrl || currentApi?.environments?.[0]?.baseUrl;
    if (baseUrl) {
      const cleanBase = baseUrl.replace(/\/+$/, '');
      const path = cleanEndpoint.startsWith('/') ? cleanEndpoint : `/${cleanEndpoint}`;
      return `${cleanBase}${path}`;
    }
    return cleanEndpoint;
  }, [endpoint, selectedEnvironment, currentApi]);

  // Reset errors when inputs change
  useEffect(() => {
    setError(null);
  }, [selectedApiId, selectedEnvId, method, endpoint, baselineMode]);

  // Parse JSON helper
  const parseJsonSafe = (str: string, fieldName: string) => {
    if (!str.trim()) return undefined;
    try {
      return JSON.parse(str);
    } catch (err: any) {
      throw new Error(`Invalid JSON in ${fieldName}: ${err.message}`);
    }
  };

  const formatJson = (setter: React.Dispatch<React.SetStateAction<string>>, current: string) => {
    try {
      const parsed = JSON.parse(current);
      setter(JSON.stringify(parsed, null, 2));
    } catch {
      // ignore
    }
  };

  // Handle Save / Establish Base Schema
  const handleSubmit = async () => {
    if (!selectedApiId) {
      setError('Please select a registered API.');
      return;
    }
    if (!endpoint.trim()) {
      setError('Please select or specify an endpoint path.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const parsedHeaders = parseJsonSafe(headersJson, 'Request Headers');
      const parsedBody = ['POST', 'PUT', 'PATCH'].includes(method)
        ? parseJsonSafe(requestBodyJson, 'Request Body')
        : undefined;

      let payloadToSend: any = undefined;
      if (baselineMode === 'pasteJson') {
        payloadToSend = parseJsonSafe(samplePayloadText, 'Sample JSON Payload');
      }

      const res = await api.setBaseSchema({
        apiId: selectedApiId,
        environmentId: selectedEnvId || undefined,
        endpoint: endpoint.trim(),
        method,
        samplePayload: payloadToSend,
        headers: parsedHeaders,
        body: parsedBody,
        fetchLive: baselineMode === 'fetchLive',
      });

      onSuccess(res.schema);
      onOpenChange(false);
    } catch (err: any) {
      setError(err?.message || 'Failed to establish base schema contract.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto bg-card border-border font-mono text-xs">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-primary/10 text-primary border border-primary/20 rounded">
              <HugeiconsIcon icon={FileCodeIcon} className="size-4" />
            </span>
            <DialogTitle className="text-sm font-bold font-mono text-foreground">
              Establish Contract Base Schema
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs font-mono text-muted-foreground">
            Select directly from your registered APIs and endpoints. Sentinel will continuously
            monitor responses against this baseline contract and detect silent schema drift—even on
            HTTP 200 OK.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="p-3 bg-destructive/10 border border-destructive/20 text-destructive text-xs rounded">
            {error}
          </div>
        )}

        <div className="space-y-4 py-2">
          {/* STEP 1: Select Registered API */}
          <div className="p-3 bg-muted/20 border border-border space-y-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
              1. Select Registered API
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-semibold text-foreground block mb-1">
                  API Service *
                </label>
                <select
                  value={selectedApiId}
                  onChange={(e) => setSelectedApiId(e.target.value)}
                  className="w-full h-8 px-2.5 text-xs bg-background border border-input rounded-none focus:outline-none focus:border-ring font-mono text-foreground"
                >
                  {apis.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.service || 'Service'})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-foreground block mb-1">
                  Environment
                </label>
                <select
                  value={selectedEnvId}
                  onChange={(e) => setSelectedEnvId(e.target.value)}
                  className="w-full h-8 px-2.5 text-xs bg-background border border-input rounded-none focus:outline-none focus:border-ring font-mono text-foreground"
                >
                  <option value="">Default Environment</option>
                  {environments.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name} {e.baseUrl ? `(${e.baseUrl})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* STEP 2: Choose Registered Endpoint (Direct Selection) */}
          <div className="p-3 bg-muted/20 border border-border space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                2. Registered Endpoint
              </span>
              {apiMonitors.length > 0 && !isCustomEndpoint && (
                <span className="text-[10px] text-emerald-500 font-semibold flex items-center gap-1">
                  ✓ Config auto-loaded from registered API
                </span>
              )}
            </div>

            {/* Dropdown of Endpoints */}
            <div>
              <label className="text-[11px] font-semibold text-foreground block mb-1">
                Select Registered Endpoint / Monitor
              </label>
              <select
                value={selectedMonitorId}
                onChange={(e) => handleEndpointSelect(e.target.value)}
                className="w-full h-8 px-2.5 text-xs bg-background border border-input rounded-none focus:outline-none focus:border-ring font-mono text-foreground font-semibold"
              >
                {apiMonitors.map((m) => (
                  <option key={m.id} value={m.id}>
                    [{m.method}] {m.name} — {m.url || (m as any).endpoint} ({m.environment?.name || 'Default'})
                  </option>
                ))}
                <option value="__ROOT__">
                  [GET] API Base URL Root (/) {selectedEnvironment?.baseUrl ? `— ${selectedEnvironment.baseUrl}` : ''}
                </option>
                <option value="__CUSTOM__">+ Custom Endpoint Path (Manual)...</option>
              </select>
            </div>

            {/* Auto-populated Target Summary (Zero Manual Typing) */}
            {!isCustomEndpoint ? (
              <div className="p-2.5 bg-background border border-border space-y-1.5 text-xs font-mono">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge
                    variant="outline"
                    className={`text-[10px] font-mono font-bold ${
                      method === 'GET'
                        ? 'text-emerald-500 border-emerald-500/30 bg-emerald-500/10'
                        : method === 'POST'
                        ? 'text-blue-500 border-blue-500/30 bg-blue-500/10'
                        : method === 'PUT'
                        ? 'text-amber-500 border-amber-500/30 bg-amber-500/10'
                        : 'text-purple-500 border-purple-500/30 bg-purple-500/10'
                    }`}
                  >
                    {method}
                  </Badge>
                  <span className="font-semibold text-foreground break-all">
                    {resolvedFullUrl}
                  </span>
                </div>

                <div className="flex items-center gap-3 text-[10px] text-muted-foreground pt-1 border-t border-border/40 flex-wrap">
                  <span>
                    Environment: <strong className="text-foreground">{selectedEnvironment?.name || 'Default'}</strong>
                  </span>
                  {selectedEnvironment?.baseUrl && (
                    <span>
                      Base URL: <strong className="text-foreground">{selectedEnvironment.baseUrl}</strong>
                    </span>
                  )}
                  {['POST', 'PUT', 'PATCH'].includes(method) && (
                    <Badge variant="outline" className="text-[9px] px-1 py-0">
                      Payload Configured
                    </Badge>
                  )}
                </div>
              </div>
            ) : (
              /* Manual Input ONLY if user specifically selects Custom */
              <div className="space-y-2 pt-1 border-t border-border/40">
                <div className="flex flex-col sm:flex-row items-stretch gap-2">
                  <div className="w-full sm:w-28 shrink-0">
                    <select
                      value={method}
                      onChange={(e) => setMethod(e.target.value)}
                      className="w-full h-8 px-2 text-xs font-bold bg-background border border-input rounded-none focus:outline-none font-mono text-foreground"
                    >
                      {HTTP_METHODS.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex-1">
                    <Input
                      value={endpoint}
                      onChange={(e) => setEndpoint(e.target.value)}
                      placeholder="/api/v1/users or https://api.com/users"
                      className="h-8 text-xs font-mono"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Collapsible Headers / Body Config */}
            <div className="pt-1">
              <button
                type="button"
                onClick={() => setShowConfig(!showConfig)}
                className="text-[11px] text-primary hover:underline font-mono flex items-center gap-1"
              >
                <span>{showConfig ? '▲ Hide' : '▼ Inspect / Edit'} Request Headers &amp; Payload</span>
              </button>

              {showConfig && (
                <div className="mt-2.5 space-y-3 border-t border-border/50 pt-2.5">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[11px] font-semibold text-foreground">
                        Request Headers (JSON)
                      </label>
                      <button
                        type="button"
                        onClick={() => formatJson(setHeadersJson, headersJson)}
                        className="text-[10px] text-muted-foreground hover:text-foreground"
                      >
                        Format
                      </button>
                    </div>
                    <textarea
                      value={headersJson}
                      onChange={(e) => setHeadersJson(e.target.value)}
                      rows={3}
                      className="w-full p-2 bg-background border border-input font-mono text-[11px] focus:outline-none focus:border-ring text-foreground"
                    />
                  </div>

                  {['POST', 'PUT', 'PATCH'].includes(method) && (
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[11px] font-semibold text-foreground">
                          Request Body (JSON payload sent to {method})
                        </label>
                        <button
                          type="button"
                          onClick={() => formatJson(setRequestBodyJson, requestBodyJson)}
                          className="text-[10px] text-muted-foreground hover:text-foreground"
                        >
                          Format
                        </button>
                      </div>
                      <textarea
                        value={requestBodyJson}
                        onChange={(e) => setRequestBodyJson(e.target.value)}
                        rows={4}
                        className="w-full p-2 bg-background border border-input font-mono text-[11px] focus:outline-none focus:border-ring text-foreground"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* STEP 3: Baseline Definition Mode */}
          <div className="p-3 bg-muted/20 border border-border space-y-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
              3. Baseline Contract (v1)
            </span>

            {/* Mode Switcher */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setBaselineMode('fetchLive')}
                className={`flex-1 py-2 px-3 border text-xs font-mono text-left transition-colors ${
                  baselineMode === 'fetchLive'
                    ? 'border-primary bg-primary/10 text-foreground font-semibold'
                    : 'border-border bg-card text-muted-foreground hover:text-foreground'
                }`}
              >
                <div className="flex items-center gap-1.5 font-bold mb-0.5">
                  <HugeiconsIcon icon={PlayIcon} className="size-3.5 text-primary" />
                  <span>Probe Live Endpoint (1-Click)</span>
                </div>
                <div className="text-[10px] text-muted-foreground font-normal">
                  Sentinel probes the selected registered endpoint, extracts the 200 OK schema AST,
                  and saves it as active baseline.
                </div>
              </button>

              <button
                type="button"
                onClick={() => setBaselineMode('pasteJson')}
                className={`flex-1 py-2 px-3 border text-xs font-mono text-left transition-colors ${
                  baselineMode === 'pasteJson'
                    ? 'border-primary bg-primary/10 text-foreground font-semibold'
                    : 'border-border bg-card text-muted-foreground hover:text-foreground'
                }`}
              >
                <div className="flex items-center gap-1.5 font-bold mb-0.5">
                  <HugeiconsIcon icon={FileCodeIcon} className="size-3.5 text-primary" />
                  <span>Paste Sample JSON Payload</span>
                </div>
                <div className="text-[10px] text-muted-foreground font-normal">
                  Provide custom expected response JSON manually instead of live probing.
                </div>
              </button>
            </div>

            {baselineMode === 'pasteJson' && (
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-semibold text-foreground">
                    Expected Canonical JSON Response:
                  </label>
                  <button
                    type="button"
                    onClick={() => formatJson(setSamplePayloadText, samplePayloadText)}
                    className="text-[10px] text-muted-foreground hover:text-foreground"
                  >
                    Format JSON
                  </button>
                </div>
                <textarea
                  value={samplePayloadText}
                  onChange={(e) => setSamplePayloadText(e.target.value)}
                  rows={5}
                  className="w-full p-2 bg-background border border-input font-mono text-[11px] focus:outline-none focus:border-ring text-foreground"
                  placeholder='{\n  "id": "item_123",\n  "status": "active"\n}'
                />
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
            className="h-8 text-xs font-mono"
          >
            Cancel
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={handleSubmit}
            disabled={isLoading}
            className="h-8 text-xs font-mono font-bold"
          >
            <HugeiconsIcon
              icon={baselineMode === 'fetchLive' ? PlayIcon : CheckmarkCircle01Icon}
              className={`size-3.5 mr-1.5 ${isLoading ? 'animate-spin' : ''}`}
            />
            {isLoading
              ? baselineMode === 'fetchLive'
                ? 'Probing & Capturing...'
                : 'Saving Baseline...'
              : 'Establish Baseline & Start Monitoring'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

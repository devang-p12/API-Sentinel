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
import { api, type Api, type Environment, type ApiSchemaSummary } from '@/lib/api';

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
  const [endpoint, setEndpoint] = useState<string>('/api/v1/');
  
  // Advanced Config (Headers, Body)
  const [showConfig, setShowConfig] = useState(false);
  const [headersJson, setHeadersJson] = useState<string>('{\n  "Content-Type": "application/json"\n}');
  const [requestBodyJson, setRequestBodyJson] = useState<string>('{\n  \n}');

  // Baseline Definition Mode
  const [baselineMode, setBaselineMode] = useState<'fetchLive' | 'pasteJson'>('fetchLive');
  const [samplePayloadText, setSamplePayloadText] = useState<string>('{\n  "status": "success",\n  "data": {\n    "id": "item_123",\n    "name": "Sample Record",\n    "active": true\n  }\n}');

  // Status & Feedback
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      setError('Please enter an endpoint path or URL.');
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
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto bg-card border-border font-mono text-xs">
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
            Configure an API endpoint and establish its base schema contract. Sentinel continuously
            monitors responses and detects silent schema violations—even when the API returns HTTP 200 OK.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="p-3 bg-destructive/10 border border-destructive/20 text-destructive text-xs rounded">
            {error}
          </div>
        )}

        <div className="space-y-4 py-2">
          {/* STEP 1: Select API & Environment */}
          <div className="p-3 bg-muted/20 border border-border space-y-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
              1. Target API &amp; Environment
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-semibold text-foreground block mb-1">
                  Registered API *
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
                  Target Environment
                </label>
                <select
                  value={selectedEnvId}
                  onChange={(e) => setSelectedEnvId(e.target.value)}
                  className="w-full h-8 px-2.5 text-xs bg-background border border-input rounded-none focus:outline-none focus:border-ring font-mono text-foreground"
                >
                  <option value="">No specific environment</option>
                  {environments.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name} {e.baseUrl ? `(${e.baseUrl})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {selectedEnvironment?.baseUrl && (
              <div className="text-[10px] text-muted-foreground">
                Base URL:{' '}
                <strong className="text-foreground font-mono">{selectedEnvironment.baseUrl}</strong>
              </div>
            )}
          </div>

          {/* STEP 2: Endpoint & Method Configuration */}
          <div className="p-3 bg-muted/20 border border-border space-y-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
              2. Endpoint &amp; Method (Configurable Mode)
            </span>

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
                  placeholder="/api/v1/orders or https://api.mycorp.com/v1/orders"
                  className="h-8 text-xs font-mono"
                />
              </div>
            </div>

            {/* Toggle advanced Headers / Body for POST/PUT */}
            <div className="pt-1">
              <button
                type="button"
                onClick={() => setShowConfig(!showConfig)}
                className="text-[11px] text-primary hover:underline font-mono flex items-center gap-1"
              >
                <span>{showConfig ? '▲ Hide' : '▼ Show'} Request Headers &amp; Body Config</span>
                {['POST', 'PUT', 'PATCH'].includes(method) && !showConfig && (
                  <Badge variant="outline" className="text-[9px] px-1 py-0 bg-primary/10 text-primary">
                    Required for {method}
                  </Badge>
                )}
              </button>

              {showConfig && (
                <div className="mt-3 space-y-3 border-t border-border/50 pt-3">
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

          {/* STEP 3: Base Schema Definition Mode */}
          <div className="p-3 bg-muted/20 border border-border space-y-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
              3. Set Base Schema (Baseline v1)
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
                  <span>Probe Live Endpoint (Instant)</span>
                </div>
                <div className="text-[10px] text-muted-foreground font-normal">
                  Sentinel calls the endpoint, captures 200 OK response, and normalizes schema AST.
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
                  Paste the canonical JSON structure you expect the endpoint to return.
                </div>
              </button>
            </div>

            {baselineMode === 'pasteJson' && (
              <div className="space-y-1.5 pt-2">
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
                  rows={6}
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
                ? 'Probing & Establishing...'
                : 'Saving Baseline...'
              : 'Establish Baseline & Start Monitoring'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

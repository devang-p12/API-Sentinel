import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  ArrowLeft01Icon,
  PlayIcon,
  Add01Icon,
  Delete02Icon,
  CheckmarkCircle01Icon,
} from '@hugeicons/core-free-icons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';
import type { Project, Api, Environment, LoadTestMode } from '@/lib/api';

export function CreateLoadTestPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Selection data
  const [projects, setProjects] = useState<Project[]>([]);
  const [apis, setApis] = useState<Api[]>([]);
  const [environments, setEnvironments] = useState<Environment[]>([]);
  const [isLoadingMetadata, setIsLoadingMetadata] = useState(true);

  // Form state
  const [name, setName] = useState(searchParams.get('name') || 'API Stress Test');
  const [description, setDescription] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [selectedApiId, setSelectedApiId] = useState<string>('');
  const [selectedEnvironmentId, setSelectedEnvironmentId] = useState<string>('');

  // Request state
  const [method, setMethod] = useState<'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'>('GET');
  const [urlPath, setUrlPath] = useState('/');
  const [timeout, setTimeoutSeconds] = useState(5);

  // Headers and query params state
  const [headers, setHeaders] = useState<Array<{ key: string; value: string }>>([
    { key: '', value: '' },
  ]);
  const [queryParams, setQueryParams] = useState<Array<{ key: string; value: string }>>([
    { key: '', value: '' },
  ]);

  // Auth state
  const [authType, setAuthType] = useState<'none' | 'bearer' | 'basic' | 'apiKey'>('none');
  const [bearerToken, setBearerToken] = useState('');
  const [basicUser, setBasicUser] = useState('');
  const [basicPass, setBasicPass] = useState('');
  const [apiKeyName, setApiKeyName] = useState('X-API-Key');
  const [apiKeyValue, setApiKeyValue] = useState('');
  const [apiKeyPlacement, setApiKeyPlacement] = useState<'header' | 'query'>('header');

  // Body state
  const [body, setBody] = useState('{\n  "query": "test"\n}');
  const [bodyError, setBodyError] = useState<string | null>(null);

  // Load configuration
  const [virtualUsers, setVirtualUsers] = useState(20);
  const [mode, setMode] = useState<LoadTestMode>('DURATION');
  const [duration, setDuration] = useState(60);
  const [requestCount, setRequestCount] = useState(10000);

  // Submit status
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Load initial projects
  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      try {
        const projs = await api.getProjects();
        if (!isMounted) return;
        setProjects(projs);
        if (projs.length > 0) {
          const preselectedApiId = searchParams.get('apiId');
          let matchedProj = projs[0];
          let matchedApi = matchedProj.apis?.[0];

          if (preselectedApiId) {
            for (const p of projs) {
              const a = p.apis?.find((apiItem) => apiItem.id === preselectedApiId);
              if (a) {
                matchedProj = p;
                matchedApi = a;
                break;
              }
            }
          }

          setSelectedProjectId(matchedProj.id);
          if (matchedProj.apis && matchedProj.apis.length > 0) {
            setApis(matchedProj.apis);
            const targetApi = matchedApi || matchedProj.apis[0];
            setSelectedApiId(targetApi.id);
            if (targetApi.environments && targetApi.environments.length > 0) {
              setEnvironments(targetApi.environments);
              setSelectedEnvironmentId(targetApi.environments[0].id);
            }
          }
        }
      } catch (err: any) {
        if (isMounted) setSubmitError(`Failed to load projects: ${err.message}`);
      } finally {
        if (isMounted) setIsLoadingMetadata(false);
      }
    }
    loadData();
    return () => {
      isMounted = false;
    };
  }, []);

  // Update APIs when Project changes
  const handleProjectChange = (projId: string) => {
    setSelectedProjectId(projId);
    const proj = projects.find((p) => p.id === projId);
    if (proj && proj.apis && proj.apis.length > 0) {
      setApis(proj.apis);
      const firstApi = proj.apis[0];
      setSelectedApiId(firstApi.id);
      if (firstApi.environments && firstApi.environments.length > 0) {
        setEnvironments(firstApi.environments);
        setSelectedEnvironmentId(firstApi.environments[0].id);
      } else {
        setEnvironments([]);
        setSelectedEnvironmentId('');
      }
    } else {
      setApis([]);
      setSelectedApiId('');
      setEnvironments([]);
      setSelectedEnvironmentId('');
    }
  };

  // Update Environments when API changes
  const handleApiChange = (apiId: string) => {
    setSelectedApiId(apiId);
    const selectedApi = apis.find((a) => a.id === apiId);
    if (selectedApi && selectedApi.environments && selectedApi.environments.length > 0) {
      setEnvironments(selectedApi.environments);
      setSelectedEnvironmentId(selectedApi.environments[0].id);
    } else {
      setEnvironments([]);
      setSelectedEnvironmentId('');
    }
  };

  // Validate JSON body on change
  const handleBodyChange = (text: string) => {
    setBody(text);
    if (!text.trim()) {
      setBodyError(null);
      return;
    }
    try {
      JSON.parse(text);
      setBodyError(null);
    } catch (e: any) {
      setBodyError('Invalid JSON syntax');
    }
  };

  // Resolve current Environment Base URL
  const selectedEnv = environments.find((e) => e.id === selectedEnvironmentId);
  const resolvedBaseUrl = selectedEnv?.baseUrl?.replace(/\/+$/, '') || '';

  // Calculate full effective target URL for preview
  let fullTargetUrl = urlPath.trim();
  if (!fullTargetUrl.startsWith('http://') && !fullTargetUrl.startsWith('https://')) {
    const cleanPath = fullTargetUrl.startsWith('/') ? fullTargetUrl : `/${fullTargetUrl}`;
    fullTargetUrl = resolvedBaseUrl ? `${resolvedBaseUrl}${cleanPath}` : cleanPath;
  }

  // Header helpers
  const handleAddHeader = () => {
    setHeaders([...headers, { key: '', value: '' }]);
  };
  const handleRemoveHeader = (idx: number) => {
    setHeaders(headers.filter((_, i) => i !== idx));
  };
  const handleHeaderChange = (idx: number, field: 'key' | 'value', val: string) => {
    const next = [...headers];
    next[idx][field] = val;
    setHeaders(next);
  };

  // Query parameter helpers
  const handleAddQueryParam = () => {
    setQueryParams([...queryParams, { key: '', value: '' }]);
  };
  const handleRemoveQueryParam = (idx: number) => {
    setQueryParams(queryParams.filter((_, i) => i !== idx));
  };
  const handleQueryParamChange = (idx: number, field: 'key' | 'value', val: string) => {
    const next = [...queryParams];
    next[idx][field] = val;
    setQueryParams(next);
  };

  // Submit test
  const handleRunLoadTest = async () => {
    setSubmitError(null);

    if (!name.trim()) {
      setSubmitError('Please enter a load test name.');
      return;
    }
    if (!selectedProjectId) {
      setSubmitError('Please select a project.');
      return;
    }
    if (!urlPath.trim()) {
      setSubmitError('Please enter an endpoint URL or path.');
      return;
    }
    if (['POST', 'PUT', 'PATCH'].includes(method) && bodyError) {
      setSubmitError('Please fix the JSON syntax error in the request body.');
      return;
    }

    // Construct headers object
    const headersObj: Record<string, string> = {};
    for (const h of headers) {
      if (h.key.trim()) {
        headersObj[h.key.trim()] = h.value.trim();
      }
    }

    // Construct query params object
    const queryParamsObj: Record<string, string> = {};
    for (const q of queryParams) {
      if (q.key.trim()) {
        queryParamsObj[q.key.trim()] = q.value.trim();
      }
    }

    // Auth object
    let authObj: any = { type: authType };
    if (authType === 'bearer') {
      authObj.token = bearerToken;
    } else if (authType === 'basic') {
      authObj.username = basicUser;
      authObj.password = basicPass;
    } else if (authType === 'apiKey') {
      authObj.key = apiKeyName;
      authObj.value = apiKeyValue;
      authObj.addTo = apiKeyPlacement;
    }

    setIsSubmitting(true);

    try {
      const created = await api.createLoadTest({
        name: name.trim(),
        description: description.trim() || undefined,
        projectId: selectedProjectId,
        apiId: selectedApiId || undefined,
        environmentId: selectedEnvironmentId || undefined,
        method,
        url: urlPath.trim(),
        headers: headersObj,
        queryParams: queryParamsObj,
        body: ['POST', 'PUT', 'PATCH'].includes(method) ? body : undefined,
        authentication: authType !== 'none' ? authObj : undefined,
        virtualUsers: Number(virtualUsers),
        mode,
        duration: mode === 'DURATION' ? Number(duration) : undefined,
        requestCount: mode === 'REQUEST_COUNT' ? Number(requestCount) : undefined,
        timeout: Number(timeout),
      });

      // Redirect immediately to detail page
      navigate(`/load-tests/${created.id}`);
    } catch (err: any) {
      setSubmitError(err.message || 'Failed to start load test.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex items-center gap-3 pb-4 border-b border-border/40">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/load-tests')}
          className="h-8 px-2 text-muted-foreground hover:text-foreground"
        >
          <HugeiconsIcon icon={ArrowLeft01Icon} className="w-4 h-4 mr-1" />
          Load Tests
        </Button>
        <span className="text-border">/</span>
        <h1 className="text-lg font-semibold tracking-tight text-foreground">
          New Load Test
        </h1>
      </div>

      {submitError && (
        <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 rounded-md text-xs text-rose-600 dark:text-rose-400 font-mono">
          {submitError}
        </div>
      )}

      {/* Two-Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN: Configuration */}
        <div className="lg:col-span-8 space-y-6">
          {/* Section 1: General Info */}
          <div className="border border-border/50 rounded-lg bg-card/40 p-5 space-y-4">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground font-mono">
              1. General Information
            </h2>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">
                  Load Test Name <span className="text-rose-500">*</span>
                </label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Checkout API Stress Test"
                  className="h-8 text-xs font-sans"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-foreground mb-1">
                  Description
                </label>
                <Input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Optional context or notes"
                  className="h-8 text-xs font-sans"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">
                    Project <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={selectedProjectId}
                    onChange={(e) => handleProjectChange(e.target.value)}
                    className="w-full h-8 px-2.5 text-xs bg-background border border-border rounded-md font-sans focus:outline-none focus:ring-1 focus:ring-ring"
                    disabled={isLoadingMetadata}
                  >
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">
                    API (Target Service)
                  </label>
                  <select
                    value={selectedApiId}
                    onChange={(e) => handleApiChange(e.target.value)}
                    className="w-full h-8 px-2.5 text-xs bg-background border border-border rounded-md font-sans focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    <option value="">None (Custom Target)</option>
                    {apis.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">
                    Environment
                  </label>
                  <select
                    value={selectedEnvironmentId}
                    onChange={(e) => setSelectedEnvironmentId(e.target.value)}
                    className="w-full h-8 px-2.5 text-xs bg-background border border-border rounded-md font-sans focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    <option value="">None (Direct URL)</option>
                    {environments.map((env) => (
                      <option key={env.id} value={env.id}>
                        {env.name} {env.baseUrl ? `(${env.baseUrl})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: HTTP Request Configuration */}
          <div className="border border-border/50 rounded-lg bg-card/40 p-5 space-y-4">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground font-mono">
              2. Target HTTP Request
            </h2>

            <div className="space-y-4">
              {/* Method + URL */}
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">
                  Method & Endpoint Path / URL <span className="text-rose-500">*</span>
                </label>
                <div className="flex gap-2">
                  <select
                    value={method}
                    onChange={(e) => setMethod(e.target.value as any)}
                    className="h-8 px-2 text-xs font-mono font-semibold bg-background border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-ring shrink-0"
                  >
                    <option value="GET">GET</option>
                    <option value="POST">POST</option>
                    <option value="PUT">PUT</option>
                    <option value="PATCH">PATCH</option>
                    <option value="DELETE">DELETE</option>
                  </select>
                  <Input
                    value={urlPath}
                    onChange={(e) => setUrlPath(e.target.value)}
                    placeholder={resolvedBaseUrl ? '/api/v1/checkout' : 'https://httpbin.org/status/200'}
                    className="h-8 text-xs font-mono flex-1"
                  />
                </div>
                {resolvedBaseUrl && !urlPath.startsWith('http://') && !urlPath.startsWith('https://') && (
                  <p className="text-[11px] text-muted-foreground font-mono mt-1">
                    Target: <span className="text-foreground">{resolvedBaseUrl}{urlPath.startsWith('/') ? '' : '/'}{urlPath}</span>
                  </p>
                )}
              </div>

              {/* Headers */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-medium text-foreground">Headers</label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleAddHeader}
                    className="h-6 px-2 text-[11px] text-muted-foreground hover:text-foreground"
                  >
                    <HugeiconsIcon icon={Add01Icon} className="w-3 h-3 mr-1" />
                    Add Header
                  </Button>
                </div>
                <div className="space-y-1.5">
                  {headers.map((h, idx) => (
                    <div key={idx} className="flex gap-2 items-center">
                      <Input
                        value={h.key}
                        onChange={(e) => handleHeaderChange(idx, 'key', e.target.value)}
                        placeholder="Key (e.g. Accept)"
                        className="h-7 text-xs font-mono w-1/3"
                      />
                      <Input
                        value={h.value}
                        onChange={(e) => handleHeaderChange(idx, 'value', e.target.value)}
                        placeholder="Value (e.g. application/json)"
                        className="h-7 text-xs font-mono flex-1"
                      />
                      {headers.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveHeader(idx)}
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-rose-500"
                        >
                          <HugeiconsIcon icon={Delete02Icon} className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Query Parameters */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-medium text-foreground">Query Parameters</label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleAddQueryParam}
                    className="h-6 px-2 text-[11px] text-muted-foreground hover:text-foreground"
                  >
                    <HugeiconsIcon icon={Add01Icon} className="w-3 h-3 mr-1" />
                    Add Parameter
                  </Button>
                </div>
                <div className="space-y-1.5">
                  {queryParams.map((q, idx) => (
                    <div key={idx} className="flex gap-2 items-center">
                      <Input
                        value={q.key}
                        onChange={(e) => handleQueryParamChange(idx, 'key', e.target.value)}
                        placeholder="Param name (e.g. limit)"
                        className="h-7 text-xs font-mono w-1/3"
                      />
                      <Input
                        value={q.value}
                        onChange={(e) => handleQueryParamChange(idx, 'value', e.target.value)}
                        placeholder="Param value (e.g. 100)"
                        className="h-7 text-xs font-mono flex-1"
                      />
                      {queryParams.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveQueryParam(idx)}
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-rose-500"
                        >
                          <HugeiconsIcon icon={Delete02Icon} className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Authentication */}
              <div className="pt-2 border-t border-border/40 space-y-2">
                <label className="text-xs font-medium text-foreground block">
                  Authentication
                </label>
                <div className="flex gap-4 text-xs font-mono">
                  {(['none', 'bearer', 'basic', 'apiKey'] as const).map((t) => (
                    <label key={t} className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="authType"
                        value={t}
                        checked={authType === t}
                        onChange={() => setAuthType(t)}
                        className="text-primary focus:ring-0"
                      />
                      <span className="capitalize">{t === 'apiKey' ? 'API Key' : t}</span>
                    </label>
                  ))}
                </div>

                {authType === 'bearer' && (
                  <div className="pt-2">
                    <Input
                      value={bearerToken}
                      onChange={(e) => setBearerToken(e.target.value)}
                      placeholder="Enter Bearer Token (token value only)"
                      type="password"
                      className="h-8 text-xs font-mono"
                    />
                  </div>
                )}

                {authType === 'basic' && (
                  <div className="grid grid-cols-2 gap-2 pt-2">
                    <Input
                      value={basicUser}
                      onChange={(e) => setBasicUser(e.target.value)}
                      placeholder="Username"
                      className="h-8 text-xs font-mono"
                    />
                    <Input
                      value={basicPass}
                      onChange={(e) => setBasicPass(e.target.value)}
                      placeholder="Password"
                      type="password"
                      className="h-8 text-xs font-mono"
                    />
                  </div>
                )}

                {authType === 'apiKey' && (
                  <div className="grid grid-cols-3 gap-2 pt-2">
                    <Input
                      value={apiKeyName}
                      onChange={(e) => setApiKeyName(e.target.value)}
                      placeholder="Header/Query Key"
                      className="h-8 text-xs font-mono"
                    />
                    <Input
                      value={apiKeyValue}
                      onChange={(e) => setApiKeyValue(e.target.value)}
                      placeholder="API Key Secret"
                      type="password"
                      className="h-8 text-xs font-mono"
                    />
                    <select
                      value={apiKeyPlacement}
                      onChange={(e) => setApiKeyPlacement(e.target.value as any)}
                      className="h-8 px-2 text-xs font-mono bg-background border border-border rounded-md"
                    >
                      <option value="header">Add to Header</option>
                      <option value="query">Add to Query</option>
                    </select>
                  </div>
                )}
              </div>

              {/* Request Body (Only shown for POST, PUT, PATCH) */}
              {['POST', 'PUT', 'PATCH'].includes(method) && (
                <div className="pt-2 border-t border-border/40">
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-medium text-foreground">
                      Request Body (JSON)
                    </label>
                    {bodyError ? (
                      <span className="text-[11px] text-rose-500 font-mono">{bodyError}</span>
                    ) : (
                      <span className="text-[11px] text-emerald-500 font-mono inline-flex items-center gap-1">
                        <HugeiconsIcon icon={CheckmarkCircle01Icon} className="w-3 h-3" /> Valid JSON
                      </span>
                    )}
                  </div>
                  <textarea
                    value={body}
                    onChange={(e) => handleBodyChange(e.target.value)}
                    rows={5}
                    className="w-full p-2.5 text-xs font-mono bg-background border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-ring"
                    placeholder="{}"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Section 3: Load Configuration */}
          <div className="border border-border/50 rounded-lg bg-card/40 p-5 space-y-4">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground font-mono">
              3. Concurrency & Load Parameters
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Virtual Users */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium text-foreground">
                    Virtual Users (VUs)
                  </label>
                  <span className="text-xs font-mono text-muted-foreground">{virtualUsers} VUs</span>
                </div>
                <Input
                  type="number"
                  min={1}
                  max={500}
                  value={virtualUsers}
                  onChange={(e) => setVirtualUsers(Math.max(1, Math.min(500, parseInt(e.target.value || '1', 10))))}
                  className="h-8 text-xs font-mono"
                />
                <p className="text-[11px] text-muted-foreground mt-1">
                  Concurrent simulated clients (Limit: 500)
                </p>
              </div>

              {/* Request Timeout */}
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">
                  Per-Request Timeout (seconds)
                </label>
                <Input
                  type="number"
                  min={1}
                  max={60}
                  value={timeout}
                  onChange={(e) => setTimeoutSeconds(Math.max(1, Math.min(60, parseInt(e.target.value || '1', 10))))}
                  className="h-8 text-xs font-mono"
                />
                <p className="text-[11px] text-muted-foreground mt-1">
                  Fail request if no response within this threshold
                </p>
              </div>
            </div>

            {/* Test Mode */}
            <div className="pt-3 border-t border-border/40 space-y-3">
              <label className="text-xs font-medium text-foreground block">
                Execution Mode
              </label>

              <div className="grid grid-cols-2 gap-3">
                <div
                  onClick={() => setMode('DURATION')}
                  className={`border rounded-lg p-3 cursor-pointer transition-colors ${
                    mode === 'DURATION'
                      ? 'border-primary bg-primary/5'
                      : 'border-border/60 hover:border-border'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="mode"
                      checked={mode === 'DURATION'}
                      onChange={() => setMode('DURATION')}
                      className="text-primary"
                    />
                    <span className="text-xs font-semibold text-foreground">Fixed Duration</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1 ml-5">
                    Run continuous load for a fixed duration of time.
                  </p>
                </div>

                <div
                  onClick={() => setMode('REQUEST_COUNT')}
                  className={`border rounded-lg p-3 cursor-pointer transition-colors ${
                    mode === 'REQUEST_COUNT'
                      ? 'border-primary bg-primary/5'
                      : 'border-border/60 hover:border-border'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="mode"
                      checked={mode === 'REQUEST_COUNT'}
                      onChange={() => setMode('REQUEST_COUNT')}
                      className="text-primary"
                    />
                    <span className="text-xs font-semibold text-foreground">Total Request Count</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1 ml-5">
                    Distribute an exact request count among virtual users.
                  </p>
                </div>
              </div>

              {/* Mode parameter */}
              {mode === 'DURATION' ? (
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">
                    Duration (seconds)
                  </label>
                  <Input
                    type="number"
                    min={1}
                    max={3600}
                    value={duration}
                    onChange={(e) => setDuration(Math.max(1, Math.min(3600, parseInt(e.target.value || '1', 10))))}
                    className="h-8 text-xs font-mono max-w-xs"
                  />
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Duration between 1 and 3600 seconds (e.g. 60 = 1 minute)
                  </p>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">
                    Target Request Count
                  </label>
                  <Input
                    type="number"
                    min={1}
                    max={1000000}
                    value={requestCount}
                    onChange={(e) => setRequestCount(Math.max(1, Math.min(1000000, parseInt(e.target.value || '1', 10))))}
                    className="h-8 text-xs font-mono max-w-xs"
                  />
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Total requests to execute across all virtual users (Limit: 1,000,000)
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Sticky Summary & Run Trigger */}
        <div className="lg:col-span-4 sticky top-6 space-y-4">
          <div className="border border-border/50 rounded-lg bg-card/60 p-5 space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground font-mono">
              Execution Preview
            </h3>

            <div className="space-y-3 text-xs">
              <div>
                <span className="text-muted-foreground block text-[11px]">Test Name</span>
                <span className="font-medium text-foreground">{name || '—'}</span>
              </div>

              <div className="pt-2 border-t border-border/40">
                <span className="text-muted-foreground block text-[11px]">Target Endpoint</span>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="px-1.5 py-0.5 rounded bg-muted/60 text-foreground font-mono text-[10px] font-bold">
                    {method}
                  </span>
                  <span className="font-mono text-foreground text-[11px] truncate">
                    {fullTargetUrl}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border/40">
                <div>
                  <span className="text-muted-foreground block text-[11px]">Virtual Users</span>
                  <span className="font-mono font-semibold text-foreground">{virtualUsers} VUs</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">Timeout</span>
                  <span className="font-mono font-semibold text-foreground">{timeout}s</span>
                </div>
              </div>

              <div className="pt-2 border-t border-border/40">
                <span className="text-muted-foreground block text-[11px]">Execution Limit</span>
                <span className="font-mono font-semibold text-foreground">
                  {mode === 'DURATION' ? `${duration} seconds` : `${requestCount.toLocaleString()} requests`}
                </span>
              </div>

              <div className="pt-2 border-t border-border/40">
                <span className="text-muted-foreground block text-[11px]">Engine</span>
                <span className="font-mono text-foreground text-[11px]">
                  k6 (Local Subprocess / BullMQ Worker)
                </span>
              </div>
            </div>

            <div className="pt-3">
              <Button
                onClick={handleRunLoadTest}
                disabled={isSubmitting || isLoadingMetadata}
                className="w-full h-9 text-xs font-medium font-sans"
              >
                <HugeiconsIcon icon={PlayIcon} className="w-4 h-4 mr-1.5" />
                {isSubmitting ? 'Queueing Test...' : 'Run Load Test'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

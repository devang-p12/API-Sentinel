import { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  api,
  type HttpMethod,
  type Project,
  type Api,
  type Environment,
  type ApiCollection,
  type SavedApiRequest,
  type ApiRequestHistory,
  type ApiExecutionResult,
  type ApiTesterAuth,
  type ApiTesterBodyType,
  type ApiTesterAssertion,
} from '@/lib/api';
import { PageContainer } from '@/components/layout/PageContainer';
import { EnvironmentVariablesBar } from '@/components/api-tester/EnvironmentVariablesBar';
import { RequestUrlBar } from '@/components/api-tester/RequestUrlBar';
import { ParamsEditor, type ParamRow } from '@/components/api-tester/ParamsEditor';
import { HeadersEditor, type HeaderRow } from '@/components/api-tester/HeadersEditor';
import { AuthEditor } from '@/components/api-tester/AuthEditor';
import { BodyEditor } from '@/components/api-tester/BodyEditor';
import { TestsEditor } from '@/components/api-tester/TestsEditor';
import { ResponseViewer } from '@/components/api-tester/ResponseViewer';
import { CollectionsTree } from '@/components/api-tester/CollectionsTree';
import { RequestHistoryList } from '@/components/api-tester/RequestHistoryList';
import { CurlModal } from '@/components/api-tester/CurlModal';
import { SaveRequestDialog } from '@/components/api-tester/SaveRequestDialog';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  Folder01Icon,
  Clock01Icon,
  SidebarLeft01Icon,
  SidebarRight01Icon,
} from '@hugeicons/core-free-icons';

export function ApiTesterPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // Context Selection State
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [apis, setApis] = useState<Api[]>([]);
  const [selectedApiId, setSelectedApiId] = useState<string>('');
  const [environments, setEnvironments] = useState<Environment[]>([]);
  const [selectedEnvironmentId, setSelectedEnvironmentId] = useState<string>('');

  // Collections and History State
  const [collections, setCollections] = useState<ApiCollection[]>([]);
  const [history, setHistory] = useState<ApiRequestHistory[]>([]);
  const [leftTab, setLeftTab] = useState<'collections' | 'history'>('collections');
  const [isLeftCollapsed, setIsLeftCollapsed] = useState(false);

  // Active Request State
  const [activeSavedRequest, setActiveSavedRequest] = useState<SavedApiRequest | null>(null);
  const [requestName, setRequestName] = useState('New API Request');
  const [method, setMethod] = useState<HttpMethod>('GET');
  const [url, setUrl] = useState('https://httpbin.org/get');
  const [timeout, setTimeoutSeconds] = useState(10);

  // Editors State
  const [params, setParams] = useState<ParamRow[]>([
    { id: '1', enabled: true, key: '', value: '' },
  ]);
  const [headers, setHeaders] = useState<HeaderRow[]>([
    { id: '1', enabled: true, key: 'Accept', value: 'application/json' },
  ]);
  const [auth, setAuth] = useState<ApiTesterAuth>({ type: 'none' });
  const [bodyType, setBodyType] = useState<ApiTesterBodyType>('none');
  const [body, setBody] = useState('{\n  "query": "sentinel"\n}');
  const [tests, setTests] = useState<ApiTesterAssertion[]>([
    {
      id: 'test-1',
      name: 'Status code is 200',
      type: 'status_code_equals',
      expected: 200,
      enabled: true,
    },
  ]);

  // Request & Response Execution State
  const [activeTab, setActiveTab] = useState<'params' | 'auth' | 'headers' | 'body' | 'tests'>(
    'params',
  );
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionResult, setExecutionResult] = useState<ApiExecutionResult | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Dialogs State
  const [isCurlModalOpen, setIsCurlModalOpen] = useState(false);
  const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);

  // Load Projects and initial data
  useEffect(() => {
    let isMounted = true;
    async function init() {
      try {
        const projs = await api.getProjects();
        if (!isMounted) return;
        setProjects(projs);

        if (projs.length > 0) {
          const firstProj = projs[0];
          setSelectedProjectId(firstProj.id);
          if (firstProj.apis && firstProj.apis.length > 0) {
            setApis(firstProj.apis);
          }
          // Load collections and history for this project
          loadCollectionsAndHistory(firstProj.id);
        }

        // Handle URL search parameters pre-population (e.g. from "Open in API Tester")
        const queryUrl = searchParams.get('url');
        const queryMethod = searchParams.get('method') as HttpMethod;
        const queryApiId = searchParams.get('apiId');
        const queryEnvId = searchParams.get('environmentId');

        if (queryUrl) setUrl(queryUrl);
        if (queryMethod) setMethod(queryMethod);
        if (queryApiId) setSelectedApiId(queryApiId);
        if (queryEnvId) setSelectedEnvironmentId(queryEnvId);
      } catch (err) {
        console.error('Failed to initialize API Tester:', err);
      }
    }
    init();
    return () => {
      isMounted = false;
    };
  }, [searchParams]);

  const loadCollectionsAndHistory = async (projId: string) => {
    try {
      const [cols, hist] = await Promise.all([
        api.getCollections(projId),
        api.getTesterHistory(projId),
      ]);
      setCollections(cols);
      setHistory(hist);
    } catch (err) {
      console.error('Failed to load collections/history:', err);
    }
  };

  // When project changes, refresh apis, collections, history
  const handleSelectProject = (projId: string) => {
    setSelectedProjectId(projId);
    const p = projects.find((proj) => proj.id === projId);
    if (p && p.apis) {
      setApis(p.apis);
      setSelectedApiId('');
      setEnvironments([]);
      setSelectedEnvironmentId('');
    } else {
      setApis([]);
      setSelectedApiId('');
      setEnvironments([]);
      setSelectedEnvironmentId('');
    }
    loadCollectionsAndHistory(projId);
  };

  // When API changes, update available environments
  const handleSelectApi = (apiId: string) => {
    setSelectedApiId(apiId);
    const currentApi = apis.find((a) => a.id === apiId);
    if (currentApi && currentApi.environments && currentApi.environments.length > 0) {
      setEnvironments(currentApi.environments);
      setSelectedEnvironmentId(currentApi.environments[0].id);
    } else {
      setEnvironments([]);
      setSelectedEnvironmentId('');
    }
  };

  // Compute active variables map for the environment
  const activeVariables = useRef<Record<string, string>>({});
  const selectedEnv = environments.find((e) => e.id === selectedEnvironmentId);
  const varsMap: Record<string, string> = {};
  if (selectedEnv) {
    if (selectedEnv.baseUrl) {
      varsMap['baseUrl'] = selectedEnv.baseUrl.replace(/\/+$/, '');
    }
    if (selectedEnv.variables) {
      for (const [k, v] of Object.entries(selectedEnv.variables)) {
        if (v !== undefined && v !== null) varsMap[k] = String(v);
      }
    }
  }
  activeVariables.current = varsMap;

  // Real-time resolved URL preview
  const resolvedUrlPreview = (() => {
    let resolved = url;
    for (const [k, v] of Object.entries(varsMap)) {
      resolved = resolved.replace(new RegExp(`\\{\\{\\s*${k}\\s*\\}\\}`, 'g'), v);
    }
    return resolved;
  })();

  // Synchronize query parameters to URL string
  const handleParamsChange = (newParams: ParamRow[]) => {
    setParams(newParams);
    try {
      const urlObj = new URL(url.includes('://') ? url : `http://dummy.com${url.startsWith('/') ? '' : '/'}${url}`);
      urlObj.search = '';
      for (const p of newParams) {
        if (p.enabled && p.key.trim()) {
          urlObj.searchParams.append(p.key.trim(), p.value);
        }
      }
      if (url.includes('://')) {
        setUrl(urlObj.toString());
      } else {
        const queryStr = urlObj.search;
        const cleanPath = url.split('?')[0];
        setUrl(`${cleanPath}${queryStr}`);
      }
    } catch {}
  };

  // Execute request
  const handleSend = async () => {
    if (!url.trim()) return;

    setIsExecuting(true);
    setExecutionResult(null);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    // Build headers map
    const headersMap: Record<string, string> = {};
    for (const h of headers) {
      if (h.enabled && h.key.trim()) {
        headersMap[h.key.trim()] = h.value;
      }
    }

    // Build query params map
    const queryMap: Record<string, string> = {};
    for (const p of params) {
      if (p.enabled && p.key.trim()) {
        queryMap[p.key.trim()] = p.value;
      }
    }

    try {
      const result = await api.executeRequest(
        {
          method,
          url: url.trim(),
          headers: headersMap,
          queryParams: queryMap,
          body: ['POST', 'PUT', 'PATCH'].includes(method) && bodyType !== 'none' ? body : undefined,
          bodyType,
          auth,
          timeout: timeout * 1000,
          variables: varsMap,
          tests,
          projectId: selectedProjectId || undefined,
          apiId: selectedApiId || undefined,
          environmentId: selectedEnvironmentId || undefined,
          saveToHistory: true,
        },
        controller.signal,
      );

      setExecutionResult(result);
      // Refresh history in background
      if (selectedProjectId) {
        api.getTesterHistory(selectedProjectId).then(setHistory).catch(() => {});
      }
    } catch (err: any) {
      if (err.name === 'AbortError' || controller.signal.aborted) {
        setExecutionResult({
          status: null,
          statusText: 'Cancelled',
          headers: {},
          cookies: [],
          body: null,
          rawBody: '',
          contentType: 'text/plain',
          size: 0,
          durationMs: 0,
          timing: { totalMs: 0 },
          testResults: [],
          testsSummary: { total: 0, passed: 0, failed: 0 },
          error: 'Request was cancelled by user.',
          finalUrl: url,
        });
      } else {
        setExecutionResult({
          status: null,
          statusText: 'Error',
          headers: {},
          cookies: [],
          body: null,
          rawBody: '',
          contentType: 'text/plain',
          size: 0,
          durationMs: 0,
          timing: { totalMs: 0 },
          testResults: [],
          testsSummary: { total: 0, passed: 0, failed: 0 },
          error: err.message || 'Execution error',
          finalUrl: url,
        });
      }
    } finally {
      setIsExecuting(false);
      abortControllerRef.current = null;
    }
  };

  const handleCancel = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  // Keyboard Shortcuts: Ctrl+Enter (Send), Escape (Cancel), Ctrl+S (Save)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        if (isExecuting) handleCancel();
        else handleSend();
      } else if (e.key === 'Escape' && isExecuting) {
        e.preventDefault();
        handleCancel();
      } else if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        setIsSaveDialogOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isExecuting, url, method, headers, params, auth, body, tests]);

  // Copy as cURL command
  const handleCopyCurl = () => {
    const resolved = resolvedUrlPreview || url;
    let cmd = `curl -X ${method} '${resolved}'`;

    for (const h of headers) {
      if (h.enabled && h.key.trim()) {
        cmd += ` \\\n  -H '${h.key.trim()}: ${h.value}'`;
      }
    }

    if (auth.type === 'bearer' && auth.token) {
      cmd += ` \\\n  -H 'Authorization: Bearer ${auth.token}'`;
    } else if (auth.type === 'basic' && (auth.username || auth.password)) {
      cmd += ` \\\n  -u '${auth.username || ''}:${auth.password || ''}'`;
    } else if (auth.type === 'apiKey' && auth.apiKeyPlacement !== 'query' && auth.apiKeyName) {
      cmd += ` \\\n  -H '${auth.apiKeyName}: ${auth.apiKeyValue || ''}'`;
    }

    if (['POST', 'PUT', 'PATCH'].includes(method) && bodyType !== 'none' && body) {
      const escapedBody = body.replace(/'/g, "'\\''");
      cmd += ` \\\n  -d '${escapedBody}'`;
    }

    navigator.clipboard.writeText(cmd);
  };

  // Import cURL command handler
  const handleImportCurl = (parsed: {
    method: HttpMethod;
    url: string;
    headers: Record<string, string>;
    body?: string;
  }) => {
    setMethod(parsed.method);
    setUrl(parsed.url);

    // Convert headers
    const newHeaders: HeaderRow[] = Object.entries(parsed.headers).map(([k, v], i) => ({
      id: `header-import-${i}`,
      enabled: true,
      key: k,
      value: v,
    }));
    if (newHeaders.length > 0) setHeaders(newHeaders);

    // Convert body
    if (parsed.body) {
      setBody(parsed.body);
      try {
        JSON.parse(parsed.body);
        setBodyType('json');
      } catch {
        setBodyType('raw');
      }
      setActiveTab('body');
    }
  };

  // Open saved request
  const handleSelectSavedRequest = (req: SavedApiRequest) => {
    setActiveSavedRequest(req);
    setRequestName(req.name);
    setMethod(req.method as HttpMethod);
    setUrl(req.url);
    setTimeoutSeconds(Math.round((req.timeout || 10000) / 1000));

    // Headers
    if (req.headers && typeof req.headers === 'object') {
      const newHeaders: HeaderRow[] = Object.entries(req.headers).map(([k, v], i) => ({
        id: `header-saved-${i}`,
        enabled: true,
        key: k,
        value: String(v),
      }));
      setHeaders(newHeaders.length > 0 ? newHeaders : [{ id: '1', enabled: true, key: '', value: '' }]);
    }

    // Body
    if (req.body) {
      setBody(req.body);
      setBodyType((req.bodyType as ApiTesterBodyType) || 'json');
    } else {
      setBodyType('none');
    }

    // Auth
    if (req.auth && typeof req.auth === 'object') {
      setAuth(req.auth);
    } else {
      setAuth({ type: 'none' });
    }

    // Tests
    if (req.tests && Array.isArray(req.tests)) {
      setTests(req.tests);
    }
  };

  // Open history item
  const handleSelectHistory = (item: ApiRequestHistory) => {
    setMethod(item.method as HttpMethod);
    setUrl(item.url);
    setRequestName(`History: ${item.method} ${item.url.slice(0, 30)}`);
  };

  // Save request handler
  const handleSaveRequest = async (data: {
    name: string;
    description?: string;
    collectionId?: string;
    newCollectionName?: string;
  }) => {
    if (!selectedProjectId) throw new Error('Please select a project first.');

    let targetColId = data.collectionId;
    if (data.newCollectionName) {
      const createdCol = await api.createCollection({
        projectId: selectedProjectId,
        name: data.newCollectionName,
      });
      targetColId = createdCol.id;
    }

    const headersMap: Record<string, string> = {};
    for (const h of headers) {
      if (h.enabled && h.key.trim()) headersMap[h.key.trim()] = h.value;
    }

    const queryMap: Record<string, any> = {};
    for (const p of params) {
      if (p.enabled && p.key.trim()) queryMap[p.key.trim()] = p.value;
    }

    const saved = await api.saveTesterRequest({
      projectId: selectedProjectId,
      collectionId: targetColId || undefined,
      apiId: selectedApiId || undefined,
      environmentId: selectedEnvironmentId || undefined,
      name: data.name,
      description: data.description,
      method,
      url,
      headers: headersMap,
      queryParams: queryMap,
      body: bodyType !== 'none' ? body : undefined,
      bodyType,
      auth,
      tests,
      timeout: timeout * 1000,
    });

    setRequestName(saved.name);
    setActiveSavedRequest(saved);
    await loadCollectionsAndHistory(selectedProjectId);
  };

  // Collections CRUD
  const handleCreateCollection = async (name: string) => {
    if (!selectedProjectId) return;
    await api.createCollection({ projectId: selectedProjectId, name });
    await loadCollectionsAndHistory(selectedProjectId);
  };

  const handleRenameCollection = async (id: string, name: string) => {
    await api.updateCollection(id, { name });
    if (selectedProjectId) await loadCollectionsAndHistory(selectedProjectId);
  };

  const handleDeleteCollection = async (id: string) => {
    if (window.confirm('Delete this collection and all its saved requests?')) {
      await api.deleteCollection(id);
      if (selectedProjectId) await loadCollectionsAndHistory(selectedProjectId);
    }
  };

  const handleDeleteRequest = async (id: string) => {
    if (window.confirm('Delete this saved request?')) {
      await api.deleteSavedTesterRequest(id);
      if (selectedProjectId) await loadCollectionsAndHistory(selectedProjectId);
      if (activeSavedRequest?.id === id) setActiveSavedRequest(null);
    }
  };

  const handleDuplicateRequest = async (req: SavedApiRequest) => {
    if (!selectedProjectId) return;
    await api.saveTesterRequest({
      projectId: selectedProjectId,
      collectionId: req.collectionId || undefined,
      apiId: req.apiId || undefined,
      environmentId: req.environmentId || undefined,
      name: `${req.name} (Copy)`,
      description: req.description || undefined,
      method: req.method,
      url: req.url,
      headers: req.headers,
      queryParams: req.queryParams,
      body: req.body || undefined,
      bodyType: req.bodyType,
      auth: req.auth,
      tests: req.tests,
      timeout: req.timeout,
    });
    await loadCollectionsAndHistory(selectedProjectId);
  };

  const handleClearHistory = async () => {
    if (selectedProjectId) {
      await api.clearTesterHistory(selectedProjectId);
      await loadCollectionsAndHistory(selectedProjectId);
    }
  };

  // Promote to Monitor
  const handlePromoteToMonitor = () => {
    const params = new URLSearchParams({
      name: requestName || 'API Monitor',
      method,
      url: resolvedUrlPreview || url,
      apiId: selectedApiId || '',
      environmentId: selectedEnvironmentId || '',
    });
    navigate(`/monitors?${params.toString()}`);
  };

  // Promote to Load Test
  const handlePromoteToLoadTest = () => {
    const params = new URLSearchParams({
      name: `${requestName || 'API'} Load Test`,
      method,
      url: resolvedUrlPreview || url,
      projectId: selectedProjectId || '',
      apiId: selectedApiId || '',
      environmentId: selectedEnvironmentId || '',
    });
    navigate(`/load-tests/new?${params.toString()}`);
  };

  return (
    <PageContainer
      title="API Tester"
      description="Postman-like on-demand API test workbench with variables, assertions, and execution telemetry."
      breadcrumbs={[{ label: 'Sentinel', href: '/dashboard' }, { label: 'API Tester' }]}
    >
      <div className="flex flex-col border border-border bg-card shadow-xs -mx-4 sm:-mx-6 -my-4 h-[calc(100vh-8.5rem)]">
        {/* Environment & Project Context Bar */}
        <EnvironmentVariablesBar
          projects={projects}
          selectedProjectId={selectedProjectId}
          onSelectProject={handleSelectProject}
          apis={apis}
          selectedApiId={selectedApiId}
          onSelectApi={handleSelectApi}
          environments={environments}
          selectedEnvironmentId={selectedEnvironmentId}
          onSelectEnvironment={setSelectedEnvironmentId}
          activeVariables={activeVariables.current}
          onOpenImportCurl={() => setIsCurlModalOpen(true)}
          onOpenSaveRequest={() => setIsSaveDialogOpen(true)}
          onOpenCreateMonitor={handlePromoteToMonitor}
          onOpenLoadTest={handlePromoteToLoadTest}
        />

        {/* Main Content Area: Left Collections/History Sidebar + Right Editor & Response Workspace */}
        <div className="flex flex-1 min-h-0 overflow-hidden">
          {/* Left Collections & History Pane */}
          <div
            className={`border-r border-border bg-muted/10 flex flex-col transition-all duration-150 shrink-0 ${
              isLeftCollapsed ? 'w-10' : 'w-64 md:w-72'
            }`}
          >
            {isLeftCollapsed ? (
              <div className="py-2 flex flex-col items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsLeftCollapsed(false)}
                  className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted"
                  title="Expand sidebar"
                >
                  <HugeiconsIcon icon={SidebarRight01Icon} className="size-4" />
                </button>
              </div>
            ) : (
              <>
                {/* Left Tabs Toggle */}
                <div className="border-b border-border flex items-center justify-between px-2 bg-muted/20">
                  <div className="flex items-center">
                    <button
                      type="button"
                      onClick={() => setLeftTab('collections')}
                      className={`flex items-center gap-1.5 px-3 py-2 text-xs font-mono border-b-2 ${
                        leftTab === 'collections'
                          ? 'border-primary text-foreground font-semibold'
                          : 'border-transparent text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <HugeiconsIcon icon={Folder01Icon} className="size-3.5" />
                      <span>Collections</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setLeftTab('history')}
                      className={`flex items-center gap-1.5 px-3 py-2 text-xs font-mono border-b-2 ${
                        leftTab === 'history'
                          ? 'border-primary text-foreground font-semibold'
                          : 'border-transparent text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <HugeiconsIcon icon={Clock01Icon} className="size-3.5" />
                      <span>History</span>
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsLeftCollapsed(true)}
                    className="p-1 text-muted-foreground hover:text-foreground"
                    title="Collapse sidebar"
                  >
                    <HugeiconsIcon icon={SidebarLeft01Icon} className="size-3.5" />
                  </button>
                </div>

                {/* Left Panel Body */}
                <div className="flex-1 overflow-y-auto p-2">
                  {leftTab === 'collections' ? (
                    <CollectionsTree
                      collections={collections}
                      activeRequestId={activeSavedRequest?.id}
                      onSelectRequest={handleSelectSavedRequest}
                      onCreateCollection={handleCreateCollection}
                      onRenameCollection={handleRenameCollection}
                      onDeleteCollection={handleDeleteCollection}
                      onDeleteRequest={handleDeleteRequest}
                      onDuplicateRequest={handleDuplicateRequest}
                    />
                  ) : (
                    <RequestHistoryList
                      history={history}
                      onSelectHistory={handleSelectHistory}
                      onClearHistory={handleClearHistory}
                    />
                  )}
                </div>
              </>
            )}
          </div>

          {/* Right Center: Request Builder + Bottom: Response Panel */}
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
            {/* Request Configuration Section */}
            <div className="flex-1 flex flex-col border-b border-border min-h-[340px] overflow-hidden">
              {/* URL & Method Bar */}
              <div className="p-3 border-b border-border/60 bg-card">
                <RequestUrlBar
                  method={method}
                  onMethodChange={(m) => {
                    setMethod(m);
                    if (['POST', 'PUT', 'PATCH'].includes(m) && bodyType === 'none') {
                      setBodyType('json');
                    }
                  }}
                  url={url}
                  onUrlChange={setUrl}
                  isExecuting={isExecuting}
                  onSend={handleSend}
                  onCancel={handleCancel}
                  onCopyCurl={handleCopyCurl}
                  resolvedUrlPreview={resolvedUrlPreview}
                />
              </div>

              {/* Request Configuration Tabs */}
              <div className="border-b border-border bg-muted/10 flex items-center justify-between px-3">
                <div className="flex items-center">
                  {(
                    [
                      { id: 'params', label: `Params ${params.filter((p) => p.enabled && p.key).length > 0 ? `(${params.filter((p) => p.enabled && p.key).length})` : ''}` },
                      { id: 'auth', label: `Auth ${auth.type !== 'none' ? `(${auth.type})` : ''}` },
                      { id: 'headers', label: `Headers (${headers.filter((h) => h.enabled && h.key).length})` },
                      { id: 'body', label: `Body ${bodyType !== 'none' ? `(${bodyType})` : ''}` },
                      { id: 'tests', label: `Tests (${tests.filter((t) => t.enabled !== false).length})` },
                    ] as const
                  ).map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveTab(tab.id as any)}
                      className={`px-3 py-2 text-xs font-mono border-b-2 transition-colors ${
                        activeTab === tab.id
                          ? 'border-primary text-foreground font-semibold bg-background'
                          : 'border-transparent text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-1.5 text-xs font-mono text-muted-foreground">
                  <span>Timeout:</span>
                  <input
                    type="number"
                    min={1}
                    max={60}
                    value={timeout}
                    onChange={(e) => setTimeoutSeconds(Math.max(1, parseInt(e.target.value, 10) || 10))}
                    className="w-12 h-6 px-1 text-center font-mono text-xs bg-background border border-border rounded-none"
                  />
                  <span>s</span>
                </div>
              </div>

              {/* Tab Content Pane */}
              <div className="flex-1 overflow-y-auto p-4 bg-background/50">
                {activeTab === 'params' && (
                  <ParamsEditor params={params} onChange={handleParamsChange} />
                )}
                {activeTab === 'headers' && (
                  <HeadersEditor headers={headers} onChange={setHeaders} />
                )}
                {activeTab === 'auth' && <AuthEditor auth={auth} onChange={setAuth} />}
                {activeTab === 'body' && (
                  <BodyEditor
                    bodyType={bodyType}
                    onBodyTypeChange={setBodyType}
                    body={body}
                    onBodyChange={setBody}
                  />
                )}
                {activeTab === 'tests' && <TestsEditor tests={tests} onChange={setTests} />}
              </div>
            </div>

            {/* Bottom: Response Telemetry and Inspector */}
            <div className="flex-1 min-h-[260px] overflow-hidden bg-card">
              <ResponseViewer result={executionResult} isExecuting={isExecuting} />
            </div>
          </div>
        </div>
      </div>

      {/* cURL Import Dialog */}
      <CurlModal
        open={isCurlModalOpen}
        onOpenChange={setIsCurlModalOpen}
        onImport={handleImportCurl}
      />

      {/* Save Request Dialog */}
      <SaveRequestDialog
        open={isSaveDialogOpen}
        onOpenChange={setIsSaveDialogOpen}
        collections={collections}
        currentName={requestName}
        currentCollectionId={activeSavedRequest?.collectionId || undefined}
        onSave={handleSaveRequest}
      />
    </PageContainer>
  );
}

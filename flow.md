# System Execution Flow (flow.md)

This document maps out the end-to-end execution flow of **API Sentinel**. It specifies exactly how requests, background jobs, database updates, and external network interactions travel through the system, including component names and function call chains.

---

## 1. Domain Hierarchy Overview

```text
Organization (Multi-tenant Root)
    │
    ├── User (Members with Roles: OWNER, ADMIN, MEMBER, VIEWER)
    │
    └── Project (Product / Domain Boundary)
            │
            └── API (Service Boundary)
                    │
                    └── Environment (Development, Staging, Production)
                            │
                            └── Monitor (Scheduled Probe Configuration)
                                    │
                                    ├── MonitorExecution (Historical Execution Log)
                                    │
                                    └── Alert / Incident (Phase 2 alerting pipeline)
```

---

## 2. Core Execution Flows

### Flow 0: API Registration (End-to-End Frontend ──► Backend ──► PostgreSQL)

Before an endpoint can be monitored, the service hierarchy must be established. The actual end-to-end execution flow for API registration:

```text
1. User Interaction & Form Submission:
   User clicks "Register API" on /apis
      │
      ▼
   frontend/src/pages/ApisPage.tsx opens <CreateApiDialog />
      │
      ▼
   frontend/src/components/apis/CreateApiDialog.tsx:
   - Validates required inputs (name: non-empty, projectId: selected UUID)
   - Dispatches handleSubmit()
      │
      ▼
   Frontend API Client: api.createApi() (frontend/src/lib/api.ts)
   Dispatches: POST /api/v1/apis
   Headers: { "Content-Type": "application/json" }
   Body: JSON.stringify({ name, description, projectId })

2. Gateway & Proxy Forwarding:
   Vite Dev Server Proxy (vite.config.ts regex ^/api/)
   Forwards: http://localhost:5174/api/v1/apis ──► http://localhost:3001/api/v1/apis

3. Backend Validation & Persistence:
   NestJS ApisController.create() (backend/src/apis/apis.controller.ts)
      │
      ▼
   NestJS ValidationPipe (CreateApiDto validation):
   - name: @IsString(), @IsNotEmpty()
   - description: @IsString(), @IsOptional()
   - projectId: @IsUUID(), @IsNotEmpty()
      │
      ▼
   NestJS ApisService.create() (backend/src/apis/apis.service.ts):
   - Verifies project existence: prisma.project.findUnique({ where: { id: dto.projectId } })
     (Throws NotFoundException 404 if project is missing)
   - Inserts record into database:
     prisma.api.create({
       data: { name: dto.name, description: dto.description, projectId: dto.projectId },
       include: { environments: true }
     })
      │
      ▼
   PostgreSQL Database: Table "Api"
   Inserts row with foreign key relation Api_projectId_fkey ──► Project(id)

4. Response & UI Hydration:
   Backend returns HTTP 201 Created:
   { id: "uuid", name: "...", description: "...", projectId: "...", environments: [], ... }
      │
      ▼
   ApisPage.tsx handleCreateApi():
   - Awaits api.createApi()
   - Closes CreateApiDialog (isCreateOpen = false)
   - Executes loadData() ──► Promise.all([api.getApis(), api.getProjects()])
   - Updates apis state array, dynamically rendering the new API card in the catalog grid
   - On page refresh, loadData() re-runs and hydrates the persisted API from PostgreSQL
```

---

### Flow 1: Monitor Creation & Immediate Scheduling

When a user defines a new API monitor in the frontend application:

```text
React Component (CreateMonitorModal / MonitorForm)
      │
      ▼  (HTTP POST /api/v1/monitors with MonitorCreateDto)
API Client (Axios / Fetch with JWT Bearer Token)
      │
      ▼
NestJS HTTP Ingress (Main Listener)
      │
      ▼
JwtAuthGuard.canActivate() ──► Extracts userId & organizationId from JWT payload
      │
      ▼
ValidationPipe ──► Validates payload using class-validator (MonitorCreateDto)
      │            - URL format, HTTP Method enum, intervalSeconds >= 10, timeoutMs
      │
      ▼
MonitorsController.create(user, createDto)
      │
      ▼
MonitorsService.create(organizationId, createDto)
      │
      ├── 1. Verify Ownership & Scope:
      │      PrismaService.environment.findFirst({
      │        where: { id: environmentId, api: { project: { organizationId } } }
      │      })
      │
      ├── 2. Persist Desired State:
      │      PrismaService.monitor.create({
      │        data: { ...createDto, isActive: true }
      │      })
      │
      └── 3. Register with Background Scheduler:
             MonitorSchedulerService.scheduleJob(monitor)
                   │
                   ▼
             BullMQ Queue: monitorQueue.add(
               'execute-monitor',
               { monitorId: monitor.id },
               {
                 repeat: { every: monitor.intervalSeconds * 1000 },
                 jobId: `monitor-${monitor.id}`
               }
             )
      │
      ▼
MonitorsController ──► Returns serialized MonitorResponseDto (HTTP 201)
      │
      ▼
React UI ──► Optimistically updates monitor list and renders active status indicator
```

---

### Flow 2: Agentless Background Monitor Execution

How scheduled monitoring jobs execute asynchronously and capture telemetry:

```text
BullMQ Repeatable Timer (Redis Event Loop)
      │  (Timer triggers based on monitor.intervalSeconds)
      ▼
BullMQ Worker Pool: MonitorWorker.process(job: Job<MonitorJobData>)
      │
      ▼
MonitorExecutionService.execute(job.data.monitorId)
      │
      ├── 1. Fetch Current Monitor Config:
      │      PrismaService.monitor.findUnique({
      │        where: { id: monitorId },
      │        include: { environment: true }
      │      })
      │      (If !monitor || !monitor.isActive -> skip execution)
      │
      ├── 2. Resolve Dynamic Variables & Target URL:
      │      Target URL = environment.baseUrl + monitor.url (or standalone URL)
      │      Merge environment-level default headers with monitor-specific headers
      │
      ├── 3. Initiate Outbound Probe (Agentless Network Call):
      │      HttpClientService.probe({
      │        method: monitor.method,
      │        url: resolvedUrl,
      │        headers: resolvedHeaders,
      │        body: monitor.body,
      │        timeout: monitor.timeoutMs
      │      })
      │
      │      ┌────────────────────────────────────────────────────────┐
      │      │ High-Resolution Timer Started: t0 = performance.now()  │
      │      │                                                        │
      │      │  External Target API (Customer Endpoint)               │
      │      │        ▲                │                              │
      │      │        │ Outbound HTTP  │ Inbound HTTP Response        │
      │      │        │                ▼                              │
      │      │                                                        │
      │      │ High-Resolution Timer Stopped: t1 = performance.now()  │
      │      │ Response Time (ms) = Math.round(t1 - t0)               │
      │      └────────────────────────────────────────────────────────┘
      │
      ├── 4. Evaluate Assertions:
      │      AssertionEngine.evaluate(monitor.assertions, {
      │        statusCode: response.status,
      │        responseTimeMs,
      │        headers: response.headers,
      │        body: response.data
      │      })
      │      - Checks expected HTTP status (e.g., 200 OK)
      │      - Checks max response time threshold (e.g., < 500ms)
      │      - Validates JSON body schema / JSONPath checks
      │
      └── 5. Persist Execution Telemetry:
             PrismaService.monitorExecution.create({
               data: {
                 monitorId: monitor.id,
                 status: assertionResult.passed ? 'SUCCESS' : 'FAILED',
                 statusCode: response.status,
                 responseTimeMs,
                 responseSize: response.sizeBytes,
                 assertionResults: assertionResult.details,
                 errorMessage: assertionResult.errorMessage,
                 executedAt: new Date()
               }
             })
      │
      ▼
MonitorWorker calls IncidentEvaluatorService.evaluateMonitor(monitor.id)
      │
      ├── Reads enabled alerts for monitor
      ├── Counts consecutive failures from recent executions
      ├── If consecutiveFailures >= threshold and no active incident:
      │      Prisma: prisma.incident.create({ status: 'TRIGGERED', ... })
      └── If recent probe is SUCCESS and active incident exists:
             Prisma: prisma.incident.update({ status: 'RESOLVED', resolvedAt: now() })
      │
      ▼
Job Completed ──► Worker acknowledges job completion to Redis
```

---

### Flow 3: Querying Historical Metrics & Availability

When a user opens the monitor dashboard to inspect uptime, response times, and error rates:

```text
React Component (MonitorAnalyticsView / UptimeGraph)
      │
      ▼  (HTTP GET /api/v1/monitors/:id/analytics?from=...&to=...&interval=1h)
API Client (Axios)
      │
      ▼
JwtAuthGuard.canActivate() ──► Validates JWT & organization tenant scope
      │
      ▼
MonitorsController.getAnalytics(id, queryDto)
      │
      ▼
MonitorsAnalyticsService.getMetrics(organizationId, monitorId, queryDto)
      │
      ├── 1. Verify tenant access:
      │      PrismaService.monitor.findFirst({
      │        where: { id: monitorId, environment: { api: { project: { organizationId } } } }
      │      })
      │
      ├── 2. Query Time-Series Range from PostgreSQL:
      │      PrismaService.monitorExecution.findMany({
      │        where: {
      │          monitorId,
      │          executedAt: { gte: queryDto.from, lte: queryDto.to }
      │        },
      │        orderBy: { executedAt: 'asc' }
      │      })
      │      (Uses composite index: idx_executions_monitor_time)
      │
      └── 3. Calculate Aggregates in Service:
             - Availability Percentage = (successCount / totalCount) * 100
             - Average Response Time (ms)
             - P95 / P99 Latency (percentile calculation)
             - Time-bucketed series for chart rendering
      │
      ▼
MonitorsController ──► Returns AnalyticsResponseDto
      │
      ▼
React Dashboard ──► Renders Uptime Bar, Latency Line Chart, and Status Badges
```

---

### Flow 4: Contract Drift & Response Schema Validation

How Sentinel detects silent API breaking changes:

```text
HttpProbeService.probe(target)
      │
      ├── 1. Make HTTP call & extract response text
      ├── 2. Locate schema assertion:
      │      const schemaAssertion = target.assertions.find(a => a.type === 'schema')
      ├── 3. Parse JSON response body
      ├── 4. Evaluate Required Keys:
      │      Check target keys exist on parsed object
      ├── 5. Evaluate Property Types:
      │      Validate types (string, number, boolean, array, object)
      │
      ├── IF VALID:
      │      assertionResults: [{ type: 'schema', passed: true }]
      │      status: 'SUCCESS'
      │
      └── IF INVALID (Contract Drift):
             assertionResults: [{ type: 'schema', passed: false, errors: ['Missing required field: "..."'] }]
             status: 'FAILED'
             errorMessage: 'Schema contract violation: Missing required field: "..."'
      │
      ▼
MonitorExecutionService.recordExecution(monitorId, result)
      │
      ▼
IncidentEvaluatorService.evaluateMonitor(monitorId)
      │  (If consecutive schema failures exceed alert threshold -> triggers Incident)
```

---

### Flow 5: Frontend Dashboard User Interactions & State Lifecycle

How the user interacts with the React / shadcn frontend:

```text
React Dashboard (frontend/src/App.tsx)
      │
      ├── 1. Initial Mount & Recurring Poll (every 10s):
      │      Promise.all([
      │        api.getMonitors(),
      │        api.getIncidents(),
      │        api.getEnvironments(),
      │        api.getProjects()
      │      ])
      │      │
      │      ▼
      │      Vite Dev Proxy (http://localhost:5174/api/* ──► http://localhost:3001/api/v1/*)
      │      │
      │      ▼
      │      NestJS Controllers (Monitors, Incidents, Environments, Projects)
      │      │
      │      ▼
      │      React State Updates:
      │      - MetricsOverview recomputes Availability SLA % and Average Latency
      │      - MonitorsTable renders live status badges and latency indicators
      │      - IncidentBanner animates if active outages exist
      │
      ├── 2. Manual Immediate Probe ("Run" button):
      │      User clicks "Run" on a monitor row
      │      │
      │      ▼
      │      POST /api/v1/monitors/:id/run
      │      │
      │      ▼
      │      BullMQ Scheduler queues immediate one-off job in Redis
      │      │
      │      ▼
      │      Worker executes probe & writes to PostgreSQL
      │      │
      │      ▼
      │      Frontend auto-refreshes state within 1200ms
      │
      ├── 3. Register New Monitor ("Register Monitor" button):
      │      User fills CreateMonitorDialog modal
      │      │
      │      ▼
      │      POST /api/v1/monitors
      │      │
      │      ▼
      │      Persisted in PostgreSQL + Scheduled in BullMQ + Immediate run triggered
      │      │
      │      ▼
      │      Modal closes; MonitorsTable displays new endpoint with live metrics
      │
      └── 4. Inspect Telemetry & SLAs (Click Monitor Row):
             MonitorDetailSheet slides in from right
             │
             ▼
             Loads /monitors/:id/analytics (SLA %, P50, P90, P95, P99)
             Loads /monitors/:id/executions (Recent 25 probe logs)
```

---

### Flow 6: App Shell & Routing Execution Flow

The real execution flow for client-side navigation, shell composition, and dynamic parameter resolution across API Sentinel:

```text
Browser (Navigates to URL, e.g., http://localhost:5174/monitors/probe-health-check)
   │
   ▼
index.html (Loads HTML root container: <div id="root"></div>)
   │
   ▼
src/main.tsx
   │  createRoot(document.getElementById("root")!).render(
   │    <StrictMode>
   │      <ThemeProvider>
   │        <App />
   │      </ThemeProvider>
   │    </StrictMode>
   │  )
   ▼
src/App.tsx
   │  <BrowserRouter>
   │    <Routes>
   │      <Route element={<AppLayout />}>
   │        <Route index element={<Navigate to="/dashboard" replace />} />
   │        <Route path="dashboard" element={<DashboardPage />} />
   │        <Route path="apis" element={<ApisPage />} />
   │        <Route path="apis/:id" element={<ApiDetailPage />} />
   │        <Route path="monitors" element={<MonitorsPage />} />
   │        <Route path="monitors/:id" element={<MonitorDetailPage />} />
   │        <Route path="incidents" element={<IncidentsPage />} />
   │        <Route path="alerts" element={<AlertsPage />} />
   │        <Route path="dashboards" element={<DashboardsPage />} />
   │        <Route path="settings" element={<SettingsPage />} />
   │        <Route path="*" element={<NotFoundPage />} />
   │      </Route>
   │    </Routes>
   │  </BrowserRouter>
   │
   ▼
src/components/layout/AppLayout.tsx
   │  Renders persistent application shell:
   │  ├── Desktop Sidebar (hidden md:flex)
   │  ├── Mobile Drawer (<Sheet open={mobileNavOpen}> <Sidebar /> </Sheet>)
   │  ├── Header (<Header onOpenMobileNav={() => setMobileNavOpen(true)} />)
   │  └── Main Content (<main><Outlet /></main>)
   │
   ├──► src/components/layout/Sidebar.tsx
   │       Renders brand header, organization badge, and <NavLink> elements
   │       Active URL automatically matches `isActive` to apply `bg-sidebar-accent`
   │
   ├──► src/components/layout/Header.tsx
   │       Renders context indicators, theme toggle button (useTheme()), and mobile hamburger
   │
   ▼
React Router Route Resolution (<Outlet />)
   │  Matches URL path `/monitors/probe-health-check` against `<Route path="monitors/:id" />`
   │
   ▼
src/pages/MonitorDetailPage.tsx
   │  Extracts dynamic route parameter:
   │  const { id } = useParams<{ id: string }>() // "probe-health-check"
   │
   ▼
src/components/layout/PageContainer.tsx
   │  Wraps page with standardized breadcrumbs, title, and action buttons:
   │  Breadcrumbs: Sentinel / Monitors / probe-health-check
   │
   ▼
shadcn Preset Primitives & Design Tokens
      Renders <Card>, <Badge>, <Button>, and OKLCH theme variables without fake monitoring data.
```

---

### Flow 7: Environment Management Execution Flows

Detailed execution flows for Environment CRUD operations under API services:

#### 1. Create Environment Flow
```text
User clicks "+ Add Environment" on /apis/:id
   │
   ▼
frontend/src/pages/ApiDetailPage.tsx opens <EnvironmentFormDialog />
   │  Form state: { name: "Development", baseUrl: "http://localhost:4000" }
   │
   ▼
frontend/src/components/environments/EnvironmentFormDialog.tsx handleSubmit()
   │  Client-side validation: verifies non-empty name and http/https protocol
   │
   ▼
Frontend API Client: api.createEnvironment(apiId, { name, baseUrl }) (frontend/src/lib/api.ts)
   │  Dispatches: POST /api/v1/apis/:apiId/environments
   │  Headers: { "Content-Type": "application/json" }
   │  Body: JSON.stringify({ name, baseUrl })
   │
   ▼
Vite Dev Server Proxy (regex ^/api/ forwards to http://localhost:3001)
   │
   ▼
NestJS ApisController.createEnvironment() (backend/src/apis/apis.controller.ts)
   │  ValidationPipe checks CreateEnvironmentDto:
   │  - name: @IsString(), @IsNotEmpty()
   │  - baseUrl: @IsUrl({ require_tld: false, require_protocol: true, protocols: ['http', 'https'] })
   │
   ▼
NestJS EnvironmentsService.create(dto, apiId) (backend/src/environments/environments.service.ts)
   │  1. Verifies parent API existence:
   │     prisma.api.findUnique({ where: { id: apiId } }) ──► Throws 404 if missing
   │  2. Checks compound uniqueness:
   │     prisma.environment.findUnique({ where: { apiId_name: { apiId, name } } }) ──► Throws 409 if duplicate
   │  3. Inserts into PostgreSQL:
   │     prisma.environment.create({
   │       data: { name, baseUrl, variables: {}, apiId },
   │       include: { monitors: true }
   │     })
   │
   ▼
PostgreSQL Database: Table "environments"
   │  Row persisted with foreign key relation api_id ──► apis(id)
   │
   ▼
Backend returns HTTP 201 Created
   │  { id: "uuid", name: "Development", baseUrl: "http://localhost:4000", apiId: "...", monitors: [] }
   │
   ▼
ApiDetailPage.tsx handleCreateOrUpdate()
   │  1. Modal closes (isFormOpen = false)
   │  2. Re-fetches live data: await loadData()
   │  3. environments state array updates, re-rendering the Environments Table
   │  4. Data persists across browser refreshes via GET /api/v1/apis/:id/environments
```

#### 2. Get Environments Flow
```text
ApiDetailPage.tsx loadData() executes on mount or after mutations:
   │
   ▼
Frontend API Client: api.getApiEnvironments(apiId) (frontend/src/lib/api.ts)
   │  Dispatches: GET /api/v1/apis/:apiId/environments
   │
   ▼
NestJS ApisController.findEnvironments(apiId) (backend/src/apis/apis.controller.ts)
   │
   ▼
NestJS EnvironmentsService.findAll(apiId) (backend/src/environments/environments.service.ts)
   │  prisma.environment.findMany({
   │    where: { apiId },
   │    include: { monitors: true },
   │    orderBy: { createdAt: 'asc' }
   │  })
   │
   ▼
Returns HTTP 200 OK with Environment[] array ──► UI updates Table rows
```

#### 3. Update Environment Flow
```text
User clicks [Edit] on an environment row in ApiDetailPage.tsx
   │
   ▼
EnvironmentFormDialog opens pre-populated with { name, baseUrl }
   │
   ▼
User updates field (e.g. name: "Testing" ──► "UAT") and submits
   │
   ▼
Frontend API Client: api.updateEnvironment(envId, { name, baseUrl }) (frontend/src/lib/api.ts)
   │  Dispatches: PATCH /api/v1/environments/:id
   │
   ▼
NestJS EnvironmentsController.update(id, dto) (backend/src/environments/environments.controller.ts)
   │  ValidationPipe checks UpdateEnvironmentDto
   │
   ▼
NestJS EnvironmentsService.update(id, dto) (backend/src/environments/environments.service.ts)
   │  1. Verifies environment exists (throws 404 if missing)
   │  2. Checks for naming conflict under same apiId (throws 409 if conflict)
   │  3. Executes: prisma.environment.update({ where: { id }, data: { name, baseUrl } })
   │
   ▼
Returns HTTP 200 OK ──► ApiDetailPage re-fetches via loadData() ──► UI updates
```

#### 4. Delete Environment Flow
```text
User clicks [Delete] on an environment row in ApiDetailPage.tsx
   │  Confirms browser prompt
   │
   ▼
Frontend API Client: api.deleteEnvironment(envId) (frontend/src/lib/api.ts)
   │  Dispatches: DELETE /api/v1/environments/:id
   │
   ▼
NestJS EnvironmentsController.delete(id) (backend/src/environments/environments.controller.ts)
   │
   ▼
NestJS EnvironmentsService.delete(id) (backend/src/environments/environments.service.ts)
   │  prisma.environment.delete({ where: { id } })
   │  (Cascades deletion to any child monitors configured for this environment)
   │
   ▼
Returns HTTP 200 OK ──► ApiDetailPage re-fetches via loadData() ──► Row removed
```

---

### Flow 8: Monitor Management (End-to-End Frontend ──► Backend ──► PostgreSQL)

The complete execution flows for defining, reading, modifying, toggling, and deleting outside-in probe configurations:

#### 1. Create Monitor Flow
```text
User interaction on /monitors or /apis/:id
   │
   ▼
User clicks "+ Create Monitor"
   │  Opens frontend/src/components/monitors/MonitorFormDialog.tsx
   │
   ▼
Cascaded Dropdown Resolution:
   1. Component invokes api.getApis() (frontend/src/lib/api.ts) ──► GET /api/v1/apis
   2. User selects an API (e.g., "Payment Service")
   3. Component immediately triggers api.getEnvironments(selectedApiId) ──► GET /api/v1/environments?apiId=...
   4. Environment dropdown populates exclusively with environments belonging to that API
   5. User specifies:
      - Monitor Name: "Payment Health Check"
      - Description: "Checks whether payment gateway returns 200 OK"
      - HTTP Method: GET
      - Endpoint: "/health"
      - Interval: 60 (seconds)
      - Timeout: 5 (seconds, validated < interval)
      - Expected HTTP Status: 200
      - Enabled: true
   │
   ▼
Client-Side Validation & Composed URL Preview:
   - Validates name is non-empty
   - Validates environmentId is selected
   - Sanitizes endpoint to enforce leading slash (e.g. "health" ──► "/health")
   - Displays real-time Composed Request: "GET http://localhost:4000/health"
   - Validates interval >= 5s and timeout < interval
   │
   ▼
Frontend API Client: api.createMonitor(...) (frontend/src/lib/api.ts)
   Dispatches: POST /api/v1/monitors
   Headers: { "Content-Type": "application/json" }
   Body: JSON.stringify({
     name: "Payment Health Check",
     description: "Checks whether payment gateway returns 200 OK",
     environmentId: "...",
     method: "GET",
     endpoint: "/health",
     intervalSeconds: 60,
     timeoutMs: 5000,
     expectedStatusCode: 200,
     isActive: true
   })
   │
   ▼
NestJS MonitorsController.create(dto) (backend/src/monitors/monitors.controller.ts)
   │  ValidationPipe checks CreateMonitorDto (backend/src/monitors/dto/create-monitor.dto.ts):
   │  - @IsString() & @IsNotEmpty() name
   │  - @IsUUID('4') environmentId
   │  - @IsEnum(HttpMethod) method
   │  - @Min(5) @Max(86400) intervalSeconds
   │  - @Min(500) @Max(60000) timeoutMs
   │  - @Min(100) @Max(599) expectedStatusCode
   │
   ▼
NestJS MonitorsService.create(dto, organizationId?) (backend/src/monitors/monitors.service.ts)
   │  1. Verifies target Environment existence & ownership traversal:
   │     prisma.environment.findUnique({
   │       where: { id: dto.environmentId },
   │       include: { api: { include: { project: true } } }
   │     })
   │     (Throws NotFoundException if environment does not exist)
   │     (Throws ForbiddenException if environment.api.project.organizationId != tenant)
   │  2. Enforces constraint: timeoutMs < intervalSeconds * 1000
   │     (Throws BadRequestException if timeout >= interval)
   │  3. Normalizes endpoint path to guarantee leading slash
   │  4. Builds assertions array containing default statusCode assertion
   │  5. Executes database insertion:
   │     prisma.monitor.create({
   │       data: {
   │         name: dto.name.trim(),
   │         description: dto.description?.trim() || null,
   │         method: dto.method,
   │         url: endpointPath,
   │         headers: dto.headers ?? {},
   │         body: dto.body || null,
   │         intervalSeconds,
   │         timeoutMs,
   │         isActive,
   │         assertions: [{ type: "statusCode", expected: 200 }],
   │         environmentId: dto.environmentId
   │       },
   │       include: { environment: { include: { api: true } } }
   │     })
   │
   ▼
Returns HTTP 201 Created with persisted Monitor record
   │
   ▼
Frontend:
   - MonitorFormDialog closes
   - MonitorsPage re-fetches via fetchData()
   - Newly created monitor appears in the table with "● Enabled" badge

---

#### 2. Read Monitors List & Filter Flow
```text
User navigates to /monitors
   │
   ▼
frontend/src/pages/MonitorsPage.tsx executes fetchData() in useEffect:
   - api.getMonitors() ──► GET /api/v1/monitors
   - api.getApis() ──► GET /api/v1/apis
   │
   ▼
NestJS MonitorsController.findAll(environmentId?, apiId?) (backend/src/monitors/monitors.controller.ts)
   │
   ▼
NestJS MonitorsService.findAll(filter) (backend/src/monitors/monitors.service.ts)
   │  Executes:
   │  prisma.monitor.findMany({
   │    where: {
   │      ...(filter?.environmentId ? { environmentId: filter.environmentId } : {}),
   │      ...(filter?.apiId ? { environment: { apiId: filter.apiId } } : {})
   │    },
   │    include: {
   │      environment: { include: { api: true } },
   │      executions: { take: 1, orderBy: { executedAt: 'desc' } }
   │    },
   │    orderBy: { createdAt: 'desc' }
   │  })
   │
   ▼
Returns HTTP 200 OK with Monitor[] array
   │
   ▼
Frontend renders table:
   - Name & description with link to /monitors/:id
   - API Badge
   - Environment Badge & Base URL
   - HTTP Method Badge (GET, POST, PUT, DELETE)
   - Endpoint Path (e.g. /health)
   - Interval (e.g. 60s, timeout: 5s)
   - Status Toggle: "● Enabled" / "○ Disabled"
   - Actions: View, Edit, Delete
```

---

#### 3. Monitor Detail & Empty State Execution Flow
```text
User clicks on a monitor in table ──► navigates to /monitors/:id
   │
   ▼
frontend/src/pages/MonitorDetailPage.tsx:
   - Extracts :id via useParams<{ id: string }>()
   - Dispatches api.getMonitor(id) ──► GET /api/v1/monitors/:id
   │
   ▼
NestJS MonitorsController.findOne(id) (backend/src/monitors/monitors.controller.ts)
   │
   ▼
NestJS MonitorsService.findOne(id, organizationId?) (backend/src/monitors/monitors.service.ts)
   │  prisma.monitor.findUnique({
   │    where: { id },
   │    include: {
   │      environment: { include: { api: { include: { project: true } } } },
   │      executions: { take: 10, orderBy: { executedAt: 'desc' } }
   │    }
   │  })
   │  (Verifies multi-tier organization ownership chain)
   │
   ▼
Returns HTTP 200 OK with complete Monitor configuration
   │
   ▼
Frontend renders:
   - Full configuration summary grid (API, Environment, Interval, Timeout, Expected Status)
   - Composed HTTP Request banner: "GET http://localhost:4000/health"
   - Zero-Fake-Metrics Empty State Card:
     "No monitoring executions yet.
      Monitoring results will appear here once the monitoring worker is enabled."
```

---

#### 4. Enable / Disable Toggle Flow
```text
User clicks status button ("● Enabled" or "○ Disabled") on /monitors or /monitors/:id
   │
   ▼
Frontend API Client: api.toggleMonitor(id, nextActiveState) (frontend/src/lib/api.ts)
   Dispatches: PATCH /api/v1/monitors/:id/toggle
   Body: JSON.stringify({ enabled: false })
   │
   ▼
NestJS MonitorsController.toggle(id, enabled) (backend/src/monitors/monitors.controller.ts)
   │
   ▼
NestJS MonitorsService.toggle(id, enabled, organizationId?) (backend/src/monitors/monitors.service.ts)
   │  1. Verifies monitor existence and tenant ownership
   │  2. Resolves newActiveState: enabled !== undefined ? enabled : !existing.isActive
   │  3. Executes:
   │     prisma.monitor.update({
   │       where: { id },
   │       data: { isActive: newActiveState },
   │       include: { environment: { include: { api: true } } }
   │     })
   │
   ▼
Returns HTTP 200 OK with updated Monitor record
   │
   ▼
Frontend UI updates toggle badge immediately to reflect configuration state ("○ Disabled")
```

---

#### 5. Update Monitor Flow
```text
User clicks [Edit] button ──► opens MonitorFormDialog pre-populated with monitor data
   │
   ▼
User modifies configuration (e.g. interval: 60s ──► 30s, endpoint: /health ──► /healthz)
   │
   ▼
Frontend API Client: api.updateMonitor(id, dto) (frontend/src/lib/api.ts)
   Dispatches: PATCH /api/v1/monitors/:id
   Body: JSON.stringify({ ... })
   │
   ▼
NestJS MonitorsController.update(id, dto) (backend/src/monitors/monitors.controller.ts)
   │  ValidationPipe checks UpdateMonitorDto (backend/src/monitors/dto/update-monitor.dto.ts)
   │
   ▼
NestJS MonitorsService.update(id, dto, organizationId?) (backend/src/monitors/monitors.service.ts)
   │  1. Verifies monitor exists & organization boundary
   │  2. If environmentId changed, verifies target environment belongs to same tenant
   │  3. Validates timeoutMs < intervalSeconds * 1000 constraint
   │  4. Executes:
   │     prisma.monitor.update({
   │       where: { id },
   │       data: { name, description, method, url, intervalSeconds, timeoutMs, isActive, assertions, environmentId }
   │     })
   │
   ▼
Returns HTTP 200 OK ──► Dialog closes ──► Monitor list / detail view refreshes with new values
```

---

#### 6. Delete Monitor Flow
```text
User clicks [Delete] button
   │  Opens frontend/src/components/monitors/DeleteMonitorDialog.tsx
   │  User confirms permanent deletion
   │
   ▼
Frontend API Client: api.deleteMonitor(id) (frontend/src/lib/api.ts)
   Dispatches: DELETE /api/v1/monitors/:id
   │
   ▼
NestJS MonitorsController.delete(id) (backend/src/monitors/monitors.controller.ts)
   │
   ▼
NestJS MonitorsService.delete(id, organizationId?) (backend/src/monitors/monitors.service.ts)
   │  1. Verifies monitor existence and organization ownership
   │  2. Unschedules background job from scheduler
   │  3. Executes: prisma.monitor.delete({ where: { id } })
   │
   ▼
Returns HTTP 200 OK ──► Dialog closes ──► Item removed from list / navigates back to /monitors
```




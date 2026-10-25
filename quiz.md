# Quiz Log

## QUIZ-001 — Application Architecture

**Feature:**
Sentinel App Shell and Routing

**Date:**
2026-10-25

**Concepts:**
- React entry point
- routing
- application layout
- sidebar navigation
- shadcn components
- page composition
- static UI structure vs dynamic application data
- zero-fake-data discipline
- frontend-to-backend communication

---

### Questions

1. **React Entry Point**:
   In a modern Vite + React 19 application like Sentinel, what is the exact entry point sequence? What is the role of `index.html`, `main.tsx`, and `createRoot(document.getElementById('root')!)`?

2. **Client-Side Routing**:
   Why does a Single-Page Application (SPA) like API Sentinel require client-side routing (e.g., React Router) rather than standard browser server-side page requests when navigating between `/dashboard`, `/apis`, and `/monitors`?

3. **AppLayout & Outlet Architecture**:
   How does the `AppLayout` component function as a persistent shell? How does React Router's `<Outlet />` pattern ensure that the Sidebar and Header do not re-render or lose state when the user navigates between different sub-routes?

4. **Sidebar Navigation & Active State**:
   How does the Sidebar know which navigation link is currently active? What is the difference between an HTML `<a>` tag and a React Router `<NavLink>` or `<Link>` component during navigation?

5. **Route-to-Page Execution & Dynamic Matching**:
   When a user navigates to `/monitors/mon-12345`, how does the router match this path to the correct component, and how does the page access the identifier `mon-12345`?

6. **Role of the shadcn/ui Preset**:
   What is shadcn's role in Sentinel's architecture compared to a monolithic UI framework like Material UI or Ant Design? Why do shadcn components live in `src/components/ui/` as copy-pasted source code instead of inside `node_modules`?

7. **Static UI Structure vs. Dynamic Application Data**:
   What constitutes "static UI structure" in the App Shell versus "dynamic application data"? Give two examples of each for API Sentinel.

8. **Zero Fake Data Principle**:
   Why is hardcoding mock metrics, fake latency graphs, or mock incidents harmful when constructing the initial frontend shell of an observability platform? What should pages render instead when data has not yet been fetched from the backend?

9. **Frontend-to-Backend Communication**:
   How does the frontend development server communicate with the NestJS backend running on port 3001 without running into Cross-Origin Resource Sharing (CORS) issues in development?

---

### My Answers

User deferred direct answering to proceed with App Shell & Routing implementation, requesting questions to be preserved for learning and evaluation.

---

### Evaluation

Implementation verified via `pnpm build` (exit 0) and live route testing across `/`, `/dashboard`, `/apis`, `/apis/:id`, `/monitors`, `/monitors/:id`, `/incidents`, `/alerts`, `/dashboards`, `/settings`.

---

### Score

Pending user answer submission.

---

### Status

Recorded / In-Log

---

### Misunderstood Concepts

None recorded.

---

### Follow-up

Proceed to QUIZ-002 for code-tracing evaluation of the actual implementation.

---

## QUIZ-002 — App Shell & Routing Code Tracing

**Feature:**
Sentinel App Shell & Routing Implementation

**Date:**
2026-10-25

**Concepts:**
- Vite + React 19 execution tree
- Root mounting (`main.tsx`)
- Declarative route nesting (`App.tsx`)
- Persistent layout & outlet rendering (`AppLayout.tsx`)
- Sidebar navigation & link interception (`Sidebar.tsx`, `<NavLink>`)
- Parameterized dynamic route matching (`/apis/:id`, `/monitors/:id`, `useParams`)
- shadcn/ui components & theme tokens (`base-lyra`)
- Static structural layout vs dynamic telemetry entities
- Dev server proxy disambiguation (`^/api/`)

---

### Questions

1. **Frontend Entry Point**:
   What is the exact sequence of files executed when a user opens the browser at `http://localhost:5174/`? Trace from the browser HTML load down to the React DOM mount.

2. **Mounting & Theme Context**:
   In `frontend/src/main.tsx`, which function mounts the application, and which provider wraps the entire tree to provide light/dark theme styling across all routes?

3. **Router Matching & Execution Tree**:
   In `frontend/src/App.tsx`, how does `BrowserRouter` determine which page component to render? Where does `AppLayout` fit into this route hierarchy?

4. **Component Isolation & Navigation**:
   Which component renders the persistent navigation sidebar? When a user clicks the "APIs" link:
   - What component intercepts the click?
   - How is the URL updated in the browser?
   - Does the browser initiate a network request or refresh the page?

5. **Static vs Parameterized Routes**:
   In `frontend/src/App.tsx`, how does the route `<Route path="apis" element={<ApisPage />} />` differ from `<Route path="apis/:id" element={<ApiDetailPage />} />`? In `src/pages/ApiDetailPage.tsx`, what exact hook and code is used to extract the `:id` value?

6. **Persistent Shell & `<Outlet />`**:
   Why don't the `Sidebar` and `Header` re-render or reset their internal state when the user navigates from `/dashboard` to `/monitors`? What specific React Router component makes this possible?

7. **shadcn Components in the App Shell**:
   Identify four components from `src/components/ui/` used in the new App Shell and page layouts. Why are their source files checked directly into `src/components/ui/` instead of imported from an npm package?

8. **Zero Fake Data vs Static Structure**:
   In `src/pages/DashboardPage.tsx` and `src/components/layout/Sidebar.tsx`, identify which pieces of text are considered static application structure and which pieces of data are dynamic telemetry metrics. How did we design the empty states to uphold the zero-fake-data discipline?

9. **Vite Proxy Disambiguation**:
   In `frontend/vite.config.ts`, why was the proxy rule configured as `^/api/` instead of `/api`? What bug would occur if the proxy rule was left as a plain `/api` prefix?

---

### My Answers

Do not fill this section until I answer the quiz.

---

### Evaluation

Do not fill this section until my answers have been evaluated.

---

### Score

Pending

---

### Status

Pending

---

### Misunderstood Concepts

Pending

---

### Follow-up

Pending

---

## QUIZ-003 — API Registration Flow & End-to-End Debugging

**Feature:**
API Registration Debugging & End-to-End Persistence

**Date:**
2026-10-25

**Concepts:**
- End-to-end request tracing
- DTO validation and foreign key constraints (`projectId`)
- React form state and Dialog lifecycle
- API client abstraction (`fetchJson`)
- Optimistic vs re-fetch state updates
- PostgreSQL relational constraints

---

### Questions

1. **Frontend Request Trigger**:
   Why did clicking "Register API" in the previous `ApisPage` placeholder fail to trigger any HTTP network request in the browser DevTools?

2. **Relational Dependency (`projectId`)**:
   In Sentinel's domain hierarchy (`Organization -> Project -> API -> Environment`), why does `POST /api/v1/apis` require a `projectId`? What HTTP status code and error payload does NestJS return if the client sends only `{ name: "My Service" }`?

3. **Database Referential Integrity**:
   What Prisma/PostgreSQL error would be thrown if the frontend submitted an arbitrary UUID for `projectId` that does not exist in the database, and which NestJS service check prevents this before Prisma executes the insert?

4. **State Refresh & Verification**:
   After a `POST /api/v1/apis` request succeeds, what must the frontend component do to ensure the newly created API appears in the UI and remains visible after a page refresh?

---

### My Answers

Do not fill this section until I answer the quiz.

---

### Evaluation

Implementation applied and verified end-to-end:
1. `api.createApi()` and `api.getApi()` added to `frontend/src/lib/api.ts`.
2. `CreateApiDialog` built in `frontend/src/components/apis/CreateApiDialog.tsx` using shadcn dialog primitives with input validation and project selection.
3. `ApisPage.tsx` connected to live API data with state hydration on mount, modal submission, and immediate list re-fetch.
4. `ApiDetailPage.tsx` connected to live API details by UUID.
5. Full end-to-end flow verified: User clicks "Register API" ──► enters details ──► `POST /api/v1/apis` returns 201 Created ──► row persisted in PostgreSQL table `Api` ──► card renders in catalog ──► page refresh retains persisted data.

---

### Score

Awaiting user quiz answers.

---

### Status

Implementation Verified / Awaiting User Answers

---

### Misunderstood Concepts

Pending

---

### Follow-up

Pending

---

## QUIZ-004 — Environment Management

**Feature:**
Environment Management (API ──► Environment CRUD)

**Date:**
2026-10-25

**Status:**
Stored

**Implementation Gate:**
None

**Purpose:**
Review after implementation

### Concepts
- API vs Environment
- Database relationships
- Foreign keys
- CRUD
- Controller/service separation
- Frontend/backend request flow
- Persistence

### Questions

1. Why is Environment related directly to an API?
2. Why should Development, Testing and Production not be hard-coded?
3. What is the difference between an API and an Environment?
4. Why should database/business logic not be placed directly inside the controller?
5. Trace the request from clicking "Create Environment" until the data reaches PostgreSQL.
6. What should happen when the supplied API ID does not exist?
7. Why should the frontend re-fetch environments after creating one?
8. What is the purpose of the Environment `apiId` foreign key?
9. Why should environment data survive a browser refresh?
10. What would happen if environments were stored only in React state?

---

## QUIZ — Monitor Management

**Feature:**
Monitor Management

**Date:**
2026-10-25

**Status:**
Stored

**Implementation Gate:**
None (stored for review after implementation)

**Purpose:**
Understand the Monitor entity, its relationship with API/Environment,
and the request flow through the backend and frontend.

### Questions

1. What is the difference between an API, Environment, Monitor, and MonitorExecution?

2. Why should a Monitor belong to an Environment instead of directly storing monitoring configuration on the API?

3. If an API has Development, Testing, and Production environments, why might each environment need different monitors?

4. What happens when the frontend sends:
   `POST /monitors` ?
   Trace the request through the application.

5. Why should Monitor Management NOT perform the actual HTTP monitoring request yet?

6. What is the difference between:
   "Monitor Enabled"
   and
   "API Healthy"?

7. Why should authorization verify the ownership chain instead of trusting only the monitor ID?

8. Why do we store the endpoint separately from the Environment base URL?

9. What will MonitorExecution represent in the next phase?

10. Later, how will a monitoring worker use the Monitor configuration?

---

## QUIZ — Monitoring Worker & MonitorExecution

**Feature:**
Monitoring Worker + Redis/BullMQ + MonitorExecution

**Date:**
2026-10-25

**Status:**
Stored for Learning & Review

**Implementation Gate:**
None (stored for review after implementation)

**Purpose:**
Understand background job scheduling, Redis/BullMQ queue mechanics, worker isolation, execution status categorization, and persistence.

### Questions:

1. Why should monitoring HTTP requests run in a background worker?

2. What problem does Redis solve in this architecture?

3. What problem does BullMQ solve?

4. Why should a queue job contain monitorId instead of copying the entire Monitor configuration?

5. What is the difference between a Monitor and a MonitorExecution?

6. What happens when a monitored API returns HTTP 500 while the expected status is 200?

7. What is the difference between FAILED, TIMEOUT, and ERROR?

8. Why should one failed API request not crash the monitoring worker?

9. Why should the Run Now button enqueue a job instead of performing the HTTP request directly from the API controller?

10. Why should the response body generally not be stored in MonitorExecution?

11. Why must recurring jobs avoid duplicate schedules?

12. Trace a scheduled monitor execution from Redis/BullMQ to PostgreSQL.

13. How will Prometheus eventually fit into this architecture?

14. Why are MonitorExecution records important for historical analytics?

15. Why should latency percentiles (P50, P90, P95, P99) be computed on the backend/database rather than in frontend React components?

16. Why should the monitoring worker avoid automatic retries on failed probes by default? How can aggressive retries distort observability metrics during an outage?

---

## QUIZ — Grafana-Style Dashboard Builder

**Feature:**
Grafana-Style Custom Dashboards & Visualization Engine

**Date:**
2026-10-25

**Status:**
Stored for Learning & Review

**Implementation Gate:**
None (stored for review after implementation)

**Purpose:**
Understand configuration-driven dashboard architectures, metric registry design, MetricQueryService data source isolation, visualization rendering separation, and layout persistence.

### Questions:

1. Why should Sentinel dashboards be configuration-driven instead of hard-coded?

2. What is the difference between a Dashboard and a DashboardWidget?

3. Why should a widget store a metric identifier rather than the metric's current value?

4. What is the purpose of a Metric Registry?

5. Why should metric calculation be separated from visualization rendering?

6. What problem does MetricQueryService solve?

7. Why should DashboardWidget not directly depend on Prisma?

8. How will Prometheus eventually fit into MetricQueryService?

9. What happens when a user adds a P95 latency visualization?

10. Trace the request from:
   "Add Visualization"
   to
   "Widget appears on Dashboard."

11. Trace the request from:
   "Open Dashboard"
   to
   "Chart is rendered."

12. Why should dashboard layout be stored separately from metric data?

13. Why should the frontend not contain hard-coded monitoring values?

14. What is the difference between:
   Metric
   Metric Query
   Visualization
   Widget?

15. Why is this architecture closer to Grafana than a fixed monitoring dashboard?

---

## QUIZ-007 — Grafana-Style Interactive Workspace UX & Multi-Pane Layout

**Feature:**
Grafana-Inspired Interactive Observability Workspace

**Date:**
2026-10-25

**Status:**
Stored for Learning & Review

**Purpose:**
Understand multi-region adjustable workspace architecture, pointer capture resizing, workspace state vs telemetry state separation, debounced autosave mechanics, pane exclusivity coordination, and resilient widget boundaries.

### Questions:

1. **Workspace vs. Static Dashboard**:
   Why is an adjustable multi-pane workspace (with sliding drawers, resizable panes, and view/edit modes) fundamentally superior to a static collection of dashboard cards for API observability?

2. **Pointer Capture Resizing**:
   How does the `ResizeHandle` use native `setPointerCapture` and `releasePointerCapture` to maintain smooth dragging even when the cursor moves outside the handle or browser window? Why is this superior to listening only to `mousemove` on the handle element?

3. **Separation of Workspace State from Telemetry**:
   Why is workspace UI state (`sidebarWidth`, `rightDrawerOpen`, `bottomPaneHeight`, `editMode`) maintained separately in `useWorkspaceState` rather than stored in the database or combined with `DashboardDataResponse`?

4. **In-Context Drawer & Live Preview**:
   When a user clicks "+ Add visualization", why is it critical that the right-side drawer slides in over the existing canvas rather than navigating to a dedicated `/dashboards/widgets/new` page? How does the live telemetry preview work before saving?

5. **Pane Exclusivity Principle**:
   Why does the Sentinel workspace strictly enforce a maximum of ONE active right drawer and ONE active bottom configuration pane at any time? What UX failure does this prevent?

6. **Debounced Autosave (600ms)**:
   When dragging or resizing widgets in Edit Mode, why is saving debounced by 600ms instead of persisting on every pointer move event or requiring a modal confirmation dialog?

7. **Independent Widget Loading & Error Boundaries**:
   If one widget's metric query fails (e.g. database timeout on P99 latency calculation), why must it fail in isolation with its own error badge while adjacent widgets (Availability, Error Rate) render normally?

8. **View Mode vs. Edit Mode**:
   Why should normal dashboard consumption occur in "View Mode" where dragging and resizing are disabled? What problem occurs if chart inspection interactions conflict with layout drag handles?

9. **Sidebar Collapsed & Resizable Dynamics**:
   How does the Sentinel sidebar maintain navigation usability when collapsed to 64px width? Why are tooltips required in collapsed mode, and why must navigation not be dependent solely on hover?

10. **Responsive Behavior**:
    How does the 12-column grid adapt when viewed on smaller tablet or laptop screens, and how do the right drawer and bottom pane adjust to prevent horizontal page overflow?

---

## QUIZ-008 — Dashboard Drag-and-Drop Panel Placement & Canvas Spatial Flow

**Feature:**
Grafana-Style Intuitive Drag-and-Drop Panel Placement

**Date:**
2026-10-26

**Status:**
Stored for Learning & Review

**Purpose:**
Understand intuitive spatial manipulation on a 12-column responsive grid, visual insertion indicators, drag lifecycle states, dynamic layout coordinate recalculation, and eliminating modal/menu friction in observability workspaces.

### Questions:

1. **Direct Manipulation vs. Menu-Based Shifting**:
   Why is direct canvas drag-and-drop vastly superior to hiding spatial shifting controls ("Shift Left", "Shift Right", "Row Above", "Row Below") inside a three-dot dropdown menu? What cognitive load does menu-based layout shifting impose on an engineer?

2. **Precision Drop Detection (`before` vs `after`)**:
   In `handleDragOverCard`, how does measuring the cursor's client X position relative to the target element's bounding rect midpoint (`mouseX < rect.left + rect.width / 2`) determine whether the dragged widget should be inserted before or after the hovered card?

3. **Visual Affordances & Drop Indicators**:
   Why are glowing insertion lines (e.g. blue pulse bar on the target's left/right border) and active drag ghost states (`opacity-35 scale-[0.98] border-dashed ring-2 ring-primary`) critical during spatial rearrangement? What happens to the user experience if visual feedback is missing?

4. **Dynamic Coordinate Calculation (`calculateLayout`)**:
   Why is recomputing `x` and `y` dynamically based on cumulative column widths (`curX + width > 12`) and `newRow` breaks superior to hardcoding coordinates with fixed card step increments (e.g. `(idx * 6) % 12`)?

5. **Dedicated Canvas Drop Zones**:
   How does providing a dedicated bottom drop zone ("Drop visualization here to place at the bottom on a new row") allow users to break cards into new rows without manually opening configuration panes or fiddling with row settings?

---

## Historical Architecture Quizzes Archive

### Phase 1 & 2: Backend Architecture & Reliability Intelligence Archive

<details>
<summary>Click to view Backend Architecture & Reliability Intelligence Quizzes</summary>

#### Phase 1: Core Architecture & Vertical Slice
1. **Worker Isolation**: Why is executing recurring monitoring probes in a BullMQ background worker fundamentally superior to executing them inside the NestJS HTTP request/response handler or using a simple in-memory `setInterval()`?
2. **Redis vs PostgreSQL**: What are the distinct roles of Redis and PostgreSQL in this architecture? Why couldn't we build this entire platform using only PostgreSQL or only Redis?
3. **Entity Separation (`Monitor` vs `MonitorExecution`)**: Why do we separate `Monitor` (desired state) and `MonitorExecution` (observed state) into two separate tables instead of appending recent runs into an array/JSON column on the `Monitor` record?
4. **Agentless Monitoring**: Why is outside-in agentless monitoring a core design principle for API Sentinel? What failure modes can external probing detect that an internal application agent might miss?
5. **End-to-End Monitor Lifecycle**: Trace what happens from the moment a client sends `POST /api/v1/monitors` to the moment a background probe runs.
6. **Job Deduplication**: What mechanism prevents Sentinel from scheduling duplicate recurring jobs for the same monitor if the backend server restarts?
7. **Data Persistence**: Where does the worker persist the result of a probe, and what specific fields are recorded for a successful check?
8. **Timeout Handling**: If an API takes 10s to respond, but the monitor is configured with `timeoutMs: 3000`, what happens?
9. **HTTP 500 Error**: If the monitored API returns a `500 Internal Server Error`, is this a worker error or an assertion failure?
10. **DNS Failure**: What happens if the target domain does not exist? How does `HttpProbeService` catch network-level exceptions?

#### Phase 2: Reliability Intelligence & Analytics
11. **Uptime & SLA Calculation**: Given 1,000 executions over 24 hours with 990 `SUCCESS`, 8 `FAILED`, and 2 `TIMEOUT`, what is the availability percentage? How does the composite index `(monitorId, executedAt DESC)` allow calculating this in single-digit milliseconds?
12. **Alert Flapping & State Machines**: Why shouldn't an alert trigger an incident on a single transient 500 error? How does tracking consecutive failure counts prevent alert fatigue?
13. **Contract Drift (Schema Validation)**: If an API returns HTTP 200 OK but deletes a required field (e.g. `user.id`), why does standard HTTP status monitoring miss this, and how does JSON Schema validation protect consumers?

</details>

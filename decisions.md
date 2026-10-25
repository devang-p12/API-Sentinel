# Architecture Decision Log (decisions.md)

This document records the architectural and technical decisions made for **API Sentinel**. Each record follows the Architecture Decision Record (ADR) standard to document context, alternatives considered, tradeoffs, and consequences.

---

## ADR-001: Technology Stack Selection (NestJS, PostgreSQL, Prisma)

**Decision:**
Use **NestJS** with TypeScript for the backend application layer, **PostgreSQL** as the primary relational database, and **Prisma** as the Object-Relational Mapping (ORM) and migration tool.

**Reason:**
- **NestJS** enforces a battle-tested modular architecture out-of-the-box using inversion of control (IoC) and dependency injection (DI). For a system with multiple bounded domains (Authentication, Organizations, Monitors, Scheduler, Alerting, Metrics), this prevents spaghetti code, enforces separation of concerns (Controllers vs Services vs Repositories), and standardizes validation (via `class-validator` DTOs) and exception filters.
- **PostgreSQL** is an ACID-compliant, highly reliable relational database that natively supports both relational integrity (essential for strict multi-tenant ownership hierarchies like Organization -> Project -> API -> Environment) and high-performance `JSONB` indexing (essential for flexible HTTP assertions, custom headers, and dynamic response payloads).
- **Prisma** provides declarative schema modeling with end-to-end type safety generated directly into TypeScript client types. This eliminates runtime type mismatches between the database schema and application code, provides robust migration workflows (`prisma migrate`), and offers clear relationship semantics.

**Alternatives considered:**
- *Express.js / Fastify alone*: Lightweight and fast, but lacks architectural structure. Developers must invent their own DI, module patterns, and validation layers, which leads to divergence as the codebase grows.
- *MongoDB / Document DB*: High write throughput, but lacks relational integrity enforcement and cascading constraints required for multi-tenant SaaS structures. Enforcing referential consistency at the application layer is error-prone.
- *TypeORM / Drizzle / Kysely*: TypeORM has active maintenance challenges and fragile decorator-based migrations. Drizzle and Kysely are excellent SQL query builders, but Prisma's declarative schema syntax and developer velocity make it ideal for Phase 1 domain modeling.

**Why alternatives were rejected:**
- Plain Express creates maintainability debt when scaling beyond basic CRUD.
- Document databases force relational management into application logic, creating data inconsistency risks (e.g., orphaned monitors or execution logs when an organization or project is deleted).

**Tradeoff accepted:**
- NestJS has an initial learning curve and boilerplate (modules, providers, decorators).
- Prisma has an abstraction overhead and query generation nuances compared to raw SQL, but its safety, migration tooling, and DX outweigh the overhead for Phase 1.

**Consequences:**
- The codebase follows strict NestJS module conventions (`*.module.ts`, `*.controller.ts`, `*.service.ts`).
- Schema changes are driven declaratively from `prisma/schema.prisma` and applied via Prisma migrations.

**Date:**
2026-10-25

---

## ADR-002: Agentless Core API Monitoring

**Decision:**
The core monitoring engine must operate in an **agentless** manner. Sentinel initiates outbound HTTP/HTTPS requests to the target API endpoint from external worker runners, rather than requiring the customer to embed an SDK or telemetry agent inside their service.

**Reason:**
- **Zero Friction Onboarding**: Customers can monitor any API within seconds simply by providing an endpoint URL and expected behavior, with zero code changes or deployment cycles.
- **True Outside-In Observability**: External monitoring measures the exact experience of end users and external clients, including external network transit, DNS resolution time, SSL handshake overhead, CDN latency, and gateway failures. Internal agents often miss DNS/gateway/ingress issues because they run inside the private network.
- **Black-Box Reliability**: Works across any programming language, framework, or vendor (Node, Go, Python, Java, Rust, third-party APIs like Stripe or AWS).

**Alternatives considered:**
- *Agent-Based Monitoring (APM / OpenTelemetry SDK)*: Requiring the target API to push metrics or traces directly to Sentinel via an embedded client.

**Why alternatives were rejected:**
- Demanding SDK installation introduces adoption friction, language-specific maintenance burdens, and security review hurdles for customer teams. Agent-based monitoring also cannot evaluate third-party APIs that the customer does not control.

**Tradeoff accepted:**
- Agentless monitoring cannot inspect internal application runtime internals (e.g., database query execution times, CPU/memory consumption, internal function stack traces). It treats the target as a black box.

**Consequences:**
- High network I/O concurrency is required on Sentinel workers.
- The engine must gracefully handle timeouts, SSL certificate validation errors, DNS lookup failures, and redirect loops without crashing worker processes.

**Date:**
2026-10-25

---

## ADR-003: Separation of Monitor (Desired State) and MonitorExecution (Time-Series State)

**Decision:**
Model `Monitor` (the configuration of what to test) and `MonitorExecution` (the historical record of an actual run) as two separate, related database entities.

**Reason:**
- **Different Write/Read Profiles**:
  - `Monitor` records are low-frequency write, high-frequency read. They hold configuration: target URL, HTTP method, headers, request body, schedule frequency, and assertion rules.
  - `MonitorExecution` records are append-only, high-frequency write. Every monitor run generates a new execution record (status code, response time, timestamp, assertion passes/failures, error details).
- **Time-Series Query Optimization**:
  - Separating execution records enables composite indexing on `(monitorId, executedAt DESC)` for instant time-series range queries, SLA calculation, and uptime graphing.
  - Keeps the `Monitor` table compact and fast to scan during scheduler polling cycles without table lock contention.
- **Retention & Data Lifecycle**:
  - Historical execution records will eventually require retention pruning or partitioning (e.g., deleting or rolling up executions older than 30 or 90 days). Storing executions in a dedicated table allows partitioned tables or batch deletions without touching the configuration table.

**Alternatives considered:**
- *Embedding recent executions inside a JSON array on the Monitor entity*: Causes severe row growth, write amplification, and PostgreSQL MVCC bloat.
- *Directly writing to Prometheus/TimescaleDB in Phase 1*: Rejected to avoid premature infrastructure complexity before the domain model and core execution engine are proven.

**Why alternatives were rejected:**
- JSON array embedding limits queryability and destroys database performance at scale.
- Introducing a secondary time-series database in Phase 1 adds deployment operational overhead while PostgreSQL with targeted indexes easily handles initial execution volumes.

**Tradeoff accepted:**
- `MonitorExecution` table will grow rapidly in row count. We must enforce strict index design `(monitorId, executedAt)` and plan for scheduled data retention pruning.

**Consequences:**
- Every check writes an immutable row to `MonitorExecution`.
- Aggregations (uptime percentage, average response time, p95 latency) are calculated across `MonitorExecution` rows filtered by time ranges.

**Date:**
2026-10-25

---

## ADR-004: Asynchronous Job Processing via Redis and BullMQ

**Decision:**
Decouple monitor scheduling and execution from the HTTP API server using **Redis** and **BullMQ** for job queuing.

**Reason:**
- **Non-Blocking Architecture**: Network calls to external APIs have unpredictable latency (ranging from 50ms to 30,000ms on timeouts). If executions were run directly inside the API server process or synchronous request cycles, thread pools and event loops would suffer under load.
- **Durable Scheduling**: BullMQ repeatable jobs and delayed queues provide durable scheduling backed by Redis. If an application instance restarts, scheduled jobs remain persistent in Redis.
- **Scalability and Failure Isolation**: Worker processes can be scaled independently of the API gateway. A failure in external network requests or a surge in scheduled checks does not degrade the API dashboard's responsiveness.
- **Rate Limiting & Concurrency Control**: BullMQ provides built-in concurrency knobs and rate-limiting to prevent Sentinel from unintentionally DDoS-ing customer endpoints.

**Alternatives considered:**
- *In-memory timers (`setInterval` / Node `setTimeout`)*: Disappears upon server reboot, impossible to distribute across multiple server instances without duplicate executions.
- *Cron via Node-cron or OS cron*: Node-cron runs in a single process without distributed coordination, leading to duplicate runs when scaling to multiple containers.
- *Kafka / RabbitMQ*: Powerful, but excessive operational overhead for Phase 1. Redis and BullMQ provide delayed scheduling, repeatable jobs, and queue management in a single lightweight service.

**Why alternatives were rejected:**
- In-memory scheduling cannot scale horizontally and loses state on restart.
- Kafka lacks native support for delayed/repeatable job scheduling without external frameworks.

**Tradeoff accepted:**
- Requires Redis as an infrastructure dependency alongside PostgreSQL.

**Consequences:**
- The system is architected as two cooperating components: the API Producer (schedules/enqueues jobs) and the Worker Consumer (executes HTTP probes, records results).

**Date:**
2026-10-25

---

## ADR-005: Multi-Tenancy Hierarchy (Organization -> Project -> API -> Environment)

**Decision:**
Implement a hierarchical multi-tenant structure:
`Organization` -> `Project` -> `API` -> `Environment` -> `Monitor` -> `MonitorExecution`.
Users belong to Organizations via an explicit `User` entity linked to `Organization` (with role support: `OWNER`, `ADMIN`, `MEMBER`, `VIEWER`).

**Reason:**
- **Real-World Engineering Alignment**:
  - An **Organization** is the company or billing boundary (e.g., "Acme Corp").
  - A **Project** represents a distinct product or domain (e.g., "E-Commerce", "Internal Tools").
  - An **API** represents a logical microservice or backend system within that project (e.g., "Payment Service", "Authentication Service").
  - An **Environment** captures stage-specific context (e.g., "Production", "Staging", "Development"). APIs have different base URLs and security policies per environment.
  - A **Monitor** tests a specific endpoint/scenario within that environment (e.g., `GET /health` on Production).
- **Fine-Grained Scoping & Security**:
  - Every resource is strictly scoped. Cross-tenant leakage is prevented at the database query level by foreign key hierarchies.
  - Deleting an environment cascades to its monitors and execution records without leaving orphaned state.

**Alternatives considered:**
- *Flat Model (Organization -> Monitor)*: Eliminates intermediate groupings. Simple at first, but completely breaks down in real enterprise scenarios where teams need to distinguish Production from Staging and group monitors by service.
- *Environment at Project Level vs API Level*: Placing Environment under Project (`Project -> Environment -> API`) causes redundancy if APIs share the same environment names. Placing Environment under API (`API -> Environment`) provides maximum flexibility for APIs having distinct deploy stages, URLs, and environment variables.

**Why alternatives were rejected:**
- Flat models create an unmanageable mess of monitors in dashboard lists as soon as a user has more than 5 endpoints across staging and production.

**Tradeoff accepted:**
- Creating a monitor requires an existing Organization, Project, API, and Environment record.
- In the UI, creation wizards or smart defaults will auto-provision default projects and environments for frictionless onboarding.

**Consequences:**
- Cascade deletes (`onDelete: Cascade`) must be configured carefully so deleting a parent resource properly cleans up child telemetry.

**Date:**
2026-10-25

---

## ADR-006: Dedicated Controlled Demo API for Verification

**Decision:**
Build an isolated, lightweight HTTP server (`demo-api`) exposing deterministic test endpoints (`/healthy`, `/slow`, `/error`, `/schema-change`) to run side-by-side with Sentinel during development and testing.

**Reason:**
- **Deterministic Testing**: Real third-party APIs have rate limits, transient external network anomalies, or unpredictable response changes. A controlled local demo API allows testing all positive, latency, failure, and schema anomaly paths deterministically.
- **Safety**: Prevents automated test probes from hammering external production services or getting IP banned during local development.
- **Predictable Latency & Failure Simulation**: Allows mocking intentional timeouts (e.g. 5000ms delay), 500 internal server errors, and payload changes on demand.

**Alternatives considered:**
- *Using public test APIs (e.g., httpbin.org)*: Subject to external rate limiting, public outages, network latency variance, and internet connectivity requirements.
- *Mocking HTTP requests at the unit-test level only (nock/jest.mock)*: Unit test mocks do not test real network sockets, TCP handshakes, DNS timeouts, or BullMQ worker execution over real network interfaces.

**Why alternatives were rejected:**
- External services are unreliable for automated local validation. Unit mocks bypass real socket timing and OS-level network stack behavior.

**Tradeoff accepted:**
- Requires managing an additional small Node process during local testing.

**Consequences:**
- The demo API runs on a distinct port (e.g., `4000`) and serves as the immediate target for Sentinel verification.

**Date:**
2026-10-25

---

## ADR-007: Outbound HTTP Probe Client Architecture & Error Handling

**Decision:**
Implement outbound agentless probing using native Node.js `fetch` (or `axios`) combined with standard `AbortController` and high-resolution `performance.now()` timers, wrapped in an isolated `HttpProbeService`.

**Reason:**
- **Precise Response Timing**: Standard `Date.now()` has millisecond quantization and clock drift vulnerabilities. `performance.now()` uses monotonic timestamps suitable for microsecond-accurate latency measurements ($t_1 - t_0$).
- **Strict Timeout Enforcement**: Network sockets can hang indefinitely (half-open TCP connections, silent packet drop). Using `AbortController` with `setTimeout` guarantees socket abortion at `timeoutMs`, preventing worker thread pool starvation.
- **Worker Crash Immunity**: An unhandled network rejection (e.g. `ENOTFOUND`, `ECONNREFUSED`, `ETIMEDOUT`) in Node.js can terminate the worker process if not caught. The probe service intercepts all socket and HTTP exceptions, categorizing them into `TIMEOUT`, `ERROR`, or `FAILED` execution statuses.

**Alternatives considered:**
- *Node.js raw `http.request`*: Low level and verbose; requires manual buffer aggregation, redirect following, and header parsing.
- *Axios without AbortController*: Relies on axios internal timeouts which occasionally fail to abort hanging TCP connect phases in certain Node runtime versions.

**Why alternatives were rejected:**
- Native `fetch` with `AbortSignal.timeout(ms)` or explicit `AbortController` is standard, modern, zero-dependency in Node 18+, and cleanly decouples timeout signals from payload streams.

**Tradeoff accepted:**
- Measuring network time at the application layer includes Node event loop scheduling latency, but for external agentless monitoring this closely reflects the true end-user experience.

**Consequences:**
- The probe service never throws unhandled exceptions; it always returns a structured `ProbeResult` indicating status code, latency, headers, body, size, and error details.

**Date:**
2026-10-25

---

## ADR-008: BullMQ Repeatable Job Scheduling Strategy

**Decision:**
Use BullMQ's built-in repeatable jobs (`repeat: { every: intervalMs }`) with deterministic `jobId` (`monitor-{monitorId}`) for recurring monitor execution.

**Reason:**
- **Distributed State Persistence**: The schedule is persisted in Redis sorted sets. If the Sentinel backend restarts or redeploys, active recurring monitoring jobs resume automatically without missing checks.
- **De-duplication via Deterministic JobId**: Giving each monitor a deterministic jobId (`monitor-{id}`) prevents duplicate jobs from being scheduled if a service restarts or if an update event triggers re-scheduling.
- **Dynamic Rescheduling**: When a user updates the interval or disables a monitor (`isActive: false`), Sentinel can query BullMQ by jobId, remove the repeatable job, and reschedule with new parameters in single-digit milliseconds.

**Alternatives considered:**
- *Node-cron / node-schedule*: Runs entirely in-memory. If multiple backend replicas run behind a load balancer, each replica executes the cron, resulting in N duplicate probes for every interval.
- *A centralized poller loop that queries PostgreSQL every second*: Constant DB polling creates heavy read load and table lock contention on the `Monitor` table as monitor counts scale.

**Why alternatives were rejected:**
- In-memory crons cannot scale horizontally and drop jobs on process restart.
- Polling PostgreSQL continuously shifts queuing responsibilities to the relational database, degrading its performance.

**Tradeoff accepted:**
- Requires Redis connectivity and understanding BullMQ's repeatable job removal semantics (which require matching pattern/cron keys).

**Consequences:**
- Scheduling operations are encapsulated within `MonitorSchedulerService`, separating database updates from Redis queue manipulations.

**Date:**
2026-10-25

---

## ADR-009: Isolated Local Port Architecture (5433, 6380, 3001)

**Decision:**
Map the local Sentinel Docker services and backend to dedicated non-default ports:
- PostgreSQL: `5433:5432`
- Redis: `6380:6379`
- Sentinel NestJS Backend: `3001`
- Sentinel Demo API: `4000`

**Reason:**
- **Zero Host Collisions**: Developers frequently have native PostgreSQL instances running on `5432`, native Redis running on `6379`, or monitoring tools like Grafana running on `3000`. By configuring Sentinel to use isolated ports in `.env` and `docker-compose.yml`, Sentinel boots up with zero port conflicts, zero permissions issues, and complete sandboxing.

**Alternatives considered:**
- *Attempting to stop host services or overwrite host configurations*: Intrusive, potentially destructive to developer's other local projects.

**Tradeoff accepted:**
- Explicit port specification is required in connection URLs.

**Consequences:**
- Sentinel's local development stack runs completely isolated alongside any ambient developer services.

**Date:**
2026-10-25

---

## ADR-010: Immediate Job Trigger upon Monitor Creation

**Decision:**
When a monitor is created or enabled, `MonitorSchedulerService` immediately enqueues a one-off execution job (`immediate-${monitorId}-${Date.now()}`) in addition to registering the recurring repeatable job timer (`repeat: { every: intervalMs }`).

**Reason:**
- **Instant Developer Feedback**: If a monitor is configured with a 300-second (5 minute) interval, forcing the user or verification suite to wait 5 minutes for the first data point creates a terrible user experience. Enqueuing an immediate check produces initial telemetry within milliseconds of creation.
- **Immediate Failure Detection**: Allows users to immediately verify if their credentials, headers, or URL path are configured correctly without waiting for the first recurring timer tick.

**Alternatives considered:**
- *Only scheduling the repeatable job*: The user must wait the full interval duration before seeing any health status.
- *Running the first check synchronously in the HTTP controller*: Defeats the asynchronous worker architecture and exposes the API to network latency/timeout delays.

**Why alternatives were rejected:**
- Waiting the full interval is bad UX. Synchronous execution in the controller violates worker isolation.

**Tradeoff accepted:**
- One additional job is written to Redis on creation.

**Consequences:**
- The monitor displays its active health status and latency immediately after being created.

**Date:**
2026-10-25

---

## ADR-011: Telemetry Aggregation Strategy (PostgreSQL Index Scanning + Statistical In-Memory Rollups)

**Decision:**
Execute metric aggregations (Availability %, Average Latency, P50/P90/P95/P99 percentiles, and time-bucketed series) by querying bounded time ranges from `monitor_executions` using the `(monitor_id, executed_at DESC)` composite index, and computing exact percentiles in the analytics service.

**Reason:**
- **Zero Ingestion Overhead**: Calculating rollups during the read phase avoids complex distributed streaming workers or trigger locks on the write path.
- **Accurate Percentiles**: Standard SQL `AVG` obscures latency spikes. Calculating nearest-rank percentiles ($P_{95}$, $P_{99}$) on ordered latency distributions accurately captures the long tail of slow requests experienced by actual users.
- **Dynamic Time Windows**: Users can inspect arbitrary intervals (e.g., last 15 minutes, last 24 hours, custom date range) without being locked into predefined static rollups.

**Alternatives considered:**
- *Database-level Continuous Materialized Views (TimescaleDB / Postgres triggers)*: Increases write latency during high-frequency execution insertion.
- *Writing metrics to Prometheus in Phase 1*: Rejected to keep the architecture self-contained without requiring additional operational infrastructure.

**Tradeoff accepted:**
- For massive datasets (> 10 million rows per monitor), full index range scans will need downsampling or summary rollups. For initial volumes (1,000–500,000 runs per monitor), composite index scans execute in under 15ms.

**Consequences:**
- The Analytics service returns rich metric summaries and chart-ready time buckets from a single query.

**Date:**
2026-10-25

---

## ADR-012: Automated Incident Lifecycle & Flapping Protection State Machine

**Decision:**
Implement an automated alerting state machine where incidents are triggered only after a configured threshold of consecutive failures (e.g. 3 failures), and automatically resolved after consecutive successes (e.g. 2 successes).

**Reason:**
- **Alert Fatigue Prevention**: Transient network glitches (a single dropped packet or 1-second timeout) happen frequently on the public internet. Opening an incident on every single failure creates severe alert fatigue.
- **Automated MTTR & Downtime Tracking**: When an API recovers, Sentinel automatically marks the incident as `RESOLVED`, sets `resolvedAt`, and calculates exact duration (Mean Time To Recovery), eliminating manual incident closure by on-call engineers.
- **Incident Deduplication**: An ongoing outage updates the existing active incident rather than creating duplicate incidents on every failure check.

**Alternatives considered:**
- *Stateless alerting (alert on every failure)*: Spams users and creates dozens of fragmented incidents for a single continuous outage.
- *Manual incident closure only*: On-call engineers forget to close incidents, polluting metrics with false prolonged outages.

**Tradeoff accepted:**
- Adds an evaluation step in the worker pipeline after each execution.

**Consequences:**
- Incidents cleanly reflect actual service degradations, not transient network noise.

**Date:**
2026-10-25

---

## ADR-013: Response Schema Validation Engine for Contract Drift

**Decision:**
Embed JSON Schema validation inside the `HttpProbeService` to evaluate response payloads against declared structural contracts, capturing schema drift as distinct assertion failures.

**Reason:**
- **Detecting Silent Breaking Changes**: Many real-world API outages return HTTP 200 OK while returning completely corrupted payloads (e.g., missing required fields, altered property types, empty arrays). Status-only monitoring is blind to this failure mode.
- **Decoupled Assertion Engine**: Schema validation runs as a configurable assertion without altering the core network probing logic.

**Alternatives considered:**
- *Strict string matching*: Extremely brittle; fails on whitespace or reordered JSON keys.
- *Only checking HTTP status codes*: Completely misses contract breaks that return HTTP 200.

**Tradeoff accepted:**
- JSON parsing and schema validation adds ~0.5ms of CPU time per probe.

**Consequences:**
- Sentinel provides true semantic API reliability monitoring, not just network pinging.

**Date:**
2026-10-25

---

## ADR-014: Frontend Design System via shadcn/ui Preset (`b3egUSUVOc`, base-lyra, Base UI)

**Decision:**
Standardize the API Sentinel frontend on the shadcn/ui preset `b3egUSUVOc` (`base-lyra` style) with `@base-ui/react` primitives, Tailwind CSS v4, and `@hugeicons/react` icon system, scaffolded in Vite with TypeScript.

**Reason:**
- **Developer & Observability Aesthetic**: The `base-lyra` preset delivers high information density, compact controls (`h-8`, `h-7`, `h-6` inputs and buttons), sharp 1px borders, and a subdued olive-tinted OKLCH palette that looks closer to Datadog/Grafana than a generic marketing page.
- **Source Code Ownership & No Vendor Lock-in**: Unlike monolithic UI packages (MUI, Ant Design), shadcn components are checked directly into `src/components/ui/*.tsx`. We have 100% control over component markup, accessibility attributes (`data-slot`), and variant styling (`cva`).
- **Tailwind v4 & CSS Variables**: Full dark/light theming is driven by native CSS custom properties defined in `src/index.css` with zero runtime CSS-in-JS parsing overhead.
- **Accessible Headless Primitives**: Backed by `@base-ui/react` (MUI's unstyled next-gen primitive engine), providing bulletproof ARIA attributes, keyboard navigation, and focus management.

**Alternatives considered:**
- *Material UI (MUI)*: Heavy runtime styling overhead, opinionated design language that feels too consumer-centric and low-density for metrics-heavy observability platforms.
- *Ant Design / Chakra UI*: Clashes with Tailwind v4, introduces heavy bundle bloat, and makes custom data visualizations hard to style cohesively.
- *Custom Handcrafted Tailwind from Scratch*: Reinventing accessible dialogs, selects, dropdowns, and table layouts consumes vast engineering time and produces subtle accessibility/keyboard trap bugs.

**Why alternatives were rejected:**
- Monolithic component libraries bloat bundle sizes and restrict layout density.
- Hand-rolled Tailwind without headless primitives compromises keyboard accessibility and ARIA standards.

**Tradeoff accepted:**
- Components are maintained directly in the project codebase (`src/components/ui/`), meaning upstream bug fixes must be pulled via CLI (`pnpm dlx shadcn add [component] --overwrite`) rather than automatic `npm update`.

**Consequences:**
- All Sentinel UI features must strictly build upon the established shadcn components (`Button`, `Card`, `Badge`, `Table`, `Tabs`, `Dialog`, `Input`, `Select`, `Separator`).
- No generic, one-off color utility hacks; all colors must draw from theme variables (`var(--primary)`, `var(--muted)`, `var(--border)`, `var(--card)`).

**Date:**
2026-10-25

---

## ADR-015: Client-Side Routing Architecture (React Router v7) & Persistent App Shell Composition

**Decision:**
Adopt **React Router v7** (`react-router-dom`) for client-side routing, structured around an `AppLayout` persistent shell component with persistent `Sidebar`, `Header`, and responsive drawer navigation enclosing nested `<Route>` definitions.

**Reason:**
- **Zero Full-Page Reloads**: Observability platforms require continuous telemetry streaming and seamless navigation. Client-side routing intercepts URL transitions via the HTML5 History API (`pushState`), avoiding browser round-trips that tear down DOM state and reset in-memory caches.
- **Persistent Shell with `<Outlet />`**: By nesting route components inside an `AppLayout` route (`<Route element={<AppLayout />}>`), persistent UI elements (`Sidebar`, `Header`) remain mounted in the DOM across page transitions. Only the child route outlet re-renders, preventing sidebar scroll resets, layout flashing, and unnecessary re-renders.
- **Dynamic Parameter Matching**: Native support for route parameters (`/apis/:id`, `/monitors/:id`) allows deterministic deep-linking directly to specific service or probe entities using React Router's `useParams()` hook.
- **Active Navigation Styling**: `<NavLink>` automatically computes active state based on current URL path matching, applying semantic highlight classes (`bg-sidebar-accent`, border accents) without manual state management.
- **Proxy Disambiguation (`^/api/`)**: Configured the Vite proxy regex to strictly intercept `^/api/` rather than a loose `/api` prefix, ensuring client-side SPA routes like `/apis` and `/apis/:id` resolve to the frontend index HTML rather than colliding with the NestJS backend API gateway.

**Alternatives considered:**
- *Handcrafted window.location / hash routing*: Extremely brittle, complicates deep-linking, breaks browser forward/back buttons, and requires reinvention of path matching and parameter extraction.
- *TanStack Router*: Strong end-to-end type safety, but requires extensive route tree generation boilerplate that adds unnecessary complexity during initial App Shell scaffolding.
- *Next.js / Remix SSR framework*: Complete architectural rewrite that conflicts with the user-mandated Vite + React 19 + shadcn preset foundation.

**Why alternatives were rejected:**
- In-house routing reinvents basic web platform primitives.
- SSR frameworks introduce unnecessary server orchestration when Sentinel's backend is already decoupled as a dedicated NestJS service.

**Tradeoff accepted:**
- Introduces `react-router-dom` (~124kB gzipped in production bundle).
- Requires careful handling of Vite development proxy routing to prevent SPA route prefixes (`/apis`) from clashing with API proxy prefixes (`/api/v1`).

**Consequences:**
- All platform navigation must use `<Link>` or `<NavLink>` from `react-router-dom` rather than standard `<a>` tags.
- Route parameters are accessed declaratively using `useParams<{ id: string }>()`.
- All platform pages are mounted within `src/components/layout/AppLayout.tsx`.

**Date:**
2026-10-25

---

## ADR-016: Environment Resource Scoping and REST Nested Sub-Resource Architecture

**Decision:**
Scope `Environment` directly to `Api` (`Api 1 ──► N Environment`) with dynamic names (`@@unique([apiId, name])`) and explicit base URLs. Expose collection operations as nested sub-resources (`POST /apis/:apiId/environments`, `GET /apis/:apiId/environments`) and item operations as root resources (`GET /environments/:id`, `PATCH /environments/:id`, `DELETE /environments/:id`).

**Reason:**
- **True Domain Hierarchy**: In multi-service architectures, different APIs have completely different hostnames and deployment topologies (e.g. `Payment API` in Development might point to `http://localhost:4000`, while `Identity API` points to `http://localhost:5000`). Base URLs are property of the API's environment deployment, not global to the project.
- **Dynamic Extensibility**: Avoiding hard-coded database ENUMs (`DEVELOPMENT`, `TESTING`, `PRODUCTION`) allows teams to configure custom environments like `UAT`, `Staging-EU`, `Sandbox`, or ephemeral PR preview deployments.
- **Clean RESTful Semantics**: Scoping creation and listing under `/apis/:apiId/environments` makes the parent service relationship explicit in the URL path, preventing orphaned environments. Managing specific environments by `/environments/:id` simplifies item mutations (`PATCH`, `DELETE`) without requiring redundant parent path parameters.
- **Compound Uniqueness & Data Integrity**: PostgreSQL enforces `@@unique([apiId, name])`, preventing duplicate environment names under the same API service while allowing different APIs to share common environment names ("Development", "Production").

**Alternatives considered:**
- *Project-Level Global Environments*: Declaring environments at the `Project` level with variable replacement. Rejected because individual microservices frequently reside on different subdomains, internal gateway ports, or separate serverless endpoints.
- *Hardcoded Database Enum*: Creating an `enum EnvironmentType { DEV, STAGING, PROD }`. Rejected because it creates rigid database constraints that prevent customers from introducing staging, performance, or regional environments.

**Tradeoff accepted:**
- Requires parent API validation (`findUnique({ where: { id: apiId } })`) prior to environment insertion.
- Requires dual controller exposure: `ApisController` delegates nested routes to `EnvironmentsService`, while `EnvironmentsController` handles item-level mutations.

**Consequences:**
- Deleting an `Api` cascades down to delete its associated `Environment` records and their scheduled probes.
**Date:**
2026-10-25

---

## ADR-017: Normalized Monitor Entity Decoupled from Environment and Execution State

**Decision:**
Introduce a discrete, normalized `Monitor` entity positioned strictly between `Environment` and `MonitorExecution` (`Organization ──► Project ──► API ──► Environment 1 ──► N Monitor ──► N MonitorExecution`). The Monitor encapsulates probe configuration and instructions (name, description, HTTP method, endpoint path, frequency interval, network timeout, expected status code, headers, payload, and active state) completely decoupled from runtime execution telemetry.

**Reason:**
- **Multiple Endpoint Probes per Environment**: A single service environment (e.g., `Production` at `https://api.example.com`) exposes dozens of distinct functional endpoints (e.g., `/health`, `/auth/login`, `/orders`, `/webhooks/stripe`). Storing monitoring configuration on the `Environment` entity would either restrict an environment to a single endpoint or force an anti-pattern of appending probe objects into an un-indexable JSON blob on the environment row.
- **Independent Telemetry & Assertion Lifecycles**: Different endpoints have vastly different operational profiles:
  - A lightweight `/health` check can run every 10–15 seconds with a tight 1,000ms timeout expecting status 200.
  - A heavy `/reports/generate` check might run every 5 minutes with a 15,000ms timeout expecting status 202.
  Decoupling monitors allows tailored intervals, timeouts, assertions, and alert thresholds per endpoint.
- **Configuration Status vs Operational Health**: Decoupling separates the administrative configuration state (`isActive` / `enabled`) from observed operational health (`HEALTHY`, `DEGRADED`, `DOWN`). A monitor can be enabled before any network probe executes.

**Alternatives considered:**
- *Storing Monitoring Configuration Directly on Environment*:
  - *Why rejected*: Severely limits scalability. A team would have to create redundant duplicate environments (e.g., "Production - Health", "Production - Checkout") just to monitor multiple endpoints on the same host.
- *One Monitor per API*:
  - *Why rejected*: Ignores that staging and production often have different paths, mock headers, or assertion requirements, and completely breaks when services have multiple routes.
- *Flat Global Monitors with Loose Environment Strings*:
  - *Why rejected*: Violates relational integrity. If an environment or API is deleted, orphaned monitor rows would linger and trigger invalid background probes.

**Tradeoff accepted:**
- Resolving the full probe target requires runtime composition: `Environment.baseUrl + Monitor.endpoint` (with safe slash normalization).
- Authorization requires verifying the full ownership traversal chain: `Monitor ──► Environment ──► API ──► Project ──► Organization`.

**Consequences:**
- An API can have multiple environments (Development, Staging, Production), and each environment can independently host multiple distinct monitors.
- CRUD operations for monitors are exposed via standard REST endpoints (`/monitors`, `/monitors/:id`).
- Enabling/disabling a monitor is an immediate configuration toggle that will control whether background probe workers pick up the job without deleting historical telemetry.
**Date:**
2026-10-25

---

## ADR-018: Background Monitoring Pipeline via BullMQ, Redis, and Resilient Outbound Probing

**Decision:**
Implement all active HTTP health check executions asynchronously in a dedicated background worker pipeline powered by **Redis** and **BullMQ**, persisting immutable execution records in a dedicated `MonitorExecution` table. The API gateway never executes probe requests synchronously during HTTP request cycles. Manual "Run Now" actions and scheduled recurring probes enqueue lightweight job descriptors (`{ monitorId }`) that worker processes consume independently.

**Reason:**
- **Decoupling I/O Latency from API Handlers**: Network calls to arbitrary customer endpoints have non-deterministic response times (ranging from 5ms to 30,000ms on timeouts). Executing checks synchronously inside REST controllers (`POST /monitors` or `POST /monitors/:id/run`) would tie up HTTP request worker threads, exhaust connection pools, and block frontend clients.
- **Durable Distributed Repeatable Scheduling**: BullMQ repeatable jobs (`repeat: { every: intervalMs }`) backed by Redis persist scheduling state across server restarts. In a clustered deployment, BullMQ prevents duplicate execution ticks across multiple worker replicas through Redis distributed locks.
- **Configuration Freshness via ID-Only Job Payloads**: Enqueueing only `{ monitorId }` rather than the serialized monitor configuration guarantees that workers load the latest database state at execution time. If an administrator edits the endpoint, headers, or expected status code, subsequent ticks immediately apply the new configuration without requiring queue purging.
- **Strict Worker Crash Immunity**: Network probes inevitably encounter DNS lookup failures (`ENOTFOUND`), connection resets (`ECONNRESET`), socket timeouts, or bad TLS certificates. The `HttpProbeService` intercepts all socket and network rejections and maps them into structured execution statuses without throwing unhandled exceptions that could crash the Node.js worker process.
- **Granular Four-State Execution Model**:
  - `SUCCESS`: The HTTP request completed within `timeoutMs` AND the returned status code matched `expectedStatusCode` (e.g. 200).
  - `FAILED`: The HTTP request completed, but returned an unexpected status code (e.g. 500, 404, or 401).
  - `TIMEOUT`: The target endpoint failed to reply within the monitor's configured timeout (aborted by `AbortController`).
  - `ERROR`: Network-level failure prior to receiving an HTTP response (DNS failure, connection refused, TLS handshake failure).

**Alternatives considered:**
- *In-memory `setInterval()` / `setTimeout()`*:
  - *Why rejected*: State is lost whenever the server process restarts or hot-reloads. Cannot be distributed across multiple containers without causing $N$-fold duplicate probes for every interval.
- *Node-cron / OS crontab*:
  - *Why rejected*: Lacks dynamic scheduling controls (adding/removing intervals per-monitor at runtime requires parsing crontabs). Does not provide concurrency throttles, dead-letter queues, or distributed coordination across container replicas.
- *PostgreSQL Polling Loop (`SELECT * FROM monitors WHERE next_run <= NOW()`)*:
  - *Why rejected*: Constant 1-second polling creates severe read lock contention and MVCC churn on the relational database as monitor count scales into thousands. Shifts queuing responsibilities to PostgreSQL, degrading dashboard responsiveness.
- *BullMQ with Redis*:
  - *Why accepted*: Battle-tested Redis-backed queue providing deterministic job deduplication (`jobId: monitor-${id}`), microsecond delay precision, concurrency limits, and clean separation between API server and worker nodes.

**Tradeoff accepted:**
- Requires Redis as a permanent infrastructure service alongside PostgreSQL.
- Requires careful handling of BullMQ repeatable job key lifecycle to ensure inactive or deleted monitors are properly unscheduled (`removeRepeatableByKey`).

**Worker Concurrency & Reliability Policy:**
- Concurrency is throttled to 10 concurrent requests per worker instance to prevent outbound socket exhaustion and avoid unintentionally overwhelming target services.
- Queue failures (e.g. Redis disconnect) are treated distinctly from target API failures. An HTTP 500 returned by a target service records a `FAILED` execution; it does NOT fail the BullMQ job or trigger infinite queue retries.

**Security & SSRF Mitigation Strategy:**
- **SSRF Risk**: Outbound probes make requests to URLs specified by users. In multi-tenant environments, malicious actors could configure monitors targeting internal cloud metadata endpoints (`http://169.254.169.254/latest/meta-data/`), internal services (`http://localhost:5432`, `http://10.0.0.1`), or private VPC endpoints.
- **Mitigations Implemented & Planned**:
  - URLs are strictly scoped to `Environment.baseUrl + Monitor.endpoint`.
  - For local development and demonstration, private network access (`http://localhost:4000`) is permitted for the controlled Demo API.
  - In production deployments, egress proxies or DNS rebind filters must restrict resolution of private RFC 1918 addresses and link-local cloud metadata IPs.
- **Credential Protection**: Outbound probe headers (e.g. `Authorization: Bearer ...`) are never written to standard application logs or error messages.
- **Telemetry Data Leak Prevention**: Full HTTP response bodies are never persisted to the `MonitorExecution` database table. Only `responseSize` (in bytes) and structured assertion diffs are recorded.

**Consequences:**
- The platform reliably executes health checks in the background without degrading the NestJS API server.
- The UI can inspect actual execution history with precise response times and status codes.
- Manual "Run Now" actions enqueue one-off jobs via `POST /monitors/:id/run` and immediately reflect results.

**Date:**
2026-10-25

---

## ADR-019: Grafana-Style Dynamic Dashboard Architecture, Metric Registry, and MetricQueryService Abstraction

**Decision:**
Implement a flexible, configuration-driven dashboard and visualization engine where dashboards are compositions of user-configured `DashboardWidget` entities rather than static, hard-coded UI cards. Establish a centralized **Metric Registry** defining standardized telemetry catalog entries and introduce a **`MetricQueryService`** abstraction layer that decouples visualization rendering from PostgreSQL `MonitorExecution` persistence. This architecture guarantees future drop-in compatibility with Prometheus without altering dashboard or widget schemas.

**Reason:**
- **Customizable Observability vs. Fixed Layouts**: Different engineering teams have distinct reliability concerns. Infrastructure engineers require P95/P99 latency distributions, SRE teams focus on error budgets and availability SLAs, and support teams track HTTP status code breakdowns. A hard-coded dashboard creates rigid constraints; a dynamic dashboard builder empowers users to arrange tailored views across multiple APIs, environments, and monitors.
- **Widgets Store Queries, Not Values**: A widget record stores query intent (`metric: "p95_latency"`, `filters: { environmentId }`, `visualizationType: "time_series"`). Persisting computed metric values inside the widget entity would produce stale data, synchronization bugs, and excessive database writes.
- **Metric Registry as Single Source of Truth**: Exposing arbitrary SQL or unstructured queries to the frontend creates security vulnerabilities and maintenance debt. The `Metric Registry` categorizes metrics into Reliability, Performance, Traffic, and Errors, defining compatible visualizations and units.
- **Decoupled Data Source via `MetricQueryService`**: The dashboard layer must never query PostgreSQL or Prisma directly. `MetricQueryService` accepts a standardized `MetricQueryOptions` payload and returns a typed `MetricQueryResult`. When Prometheus is introduced in the next phase, `MetricQueryService` can route queries to Prometheus TSDB without touching the frontend or widget controllers.
- **Separation of Visualization Rendering**: The frontend dashboard grid provides raw metric data to dedicated renderers (`StatRenderer`, `TimeSeriesRenderer`, `BarChartRenderer`, `GaugeRenderer`, `TableRenderer`). The dashboard container remains agnostic to chart mechanics.
- **Batch Layout Persistence**: Drag-and-drop and resize operations update local UI state first. Layout coordinates `(x, y, width, height)` are batch-committed via `PATCH /dashboards/:id/layout`, preventing high-frequency API chatter during drag operations.

**Alternatives considered:**
- *Hard-coded dashboard with static tabs*:
  - *Why rejected*: Fails the core requirement of an observability platform; cannot adapt to varying client APIs, environments, or SLA requirements.
- *Direct Prisma queries in Dashboard controllers*:
  - *Why rejected*: Tightly couples the dashboard feature to the relational database. Migrating to Prometheus or adding time-series aggregation engines would necessitate rewriting all dashboard endpoints.
- *Persisting rendered metric values in `DashboardWidget`*:
  - *Why rejected*: Values become stale within seconds; violates database normalization and turns read-heavy dashboard loads into write operations.

**Consequences:**
- Users can dynamically create, edit, duplicate, resize, and delete visualization panels across a 12-column responsive grid.
- All visualization panels render real telemetry from `MonitorExecution` records with zero fake data.
- The platform is primed for Prometheus integration in the next milestone.

**Date:**
2026-10-25

---

## ADR-020: Grafana-Style Interactive Observability Workspace Architecture

**Decision:**
Redesign the Sentinel dashboard into a **Grafana-inspired, highly interactive observability workspace**. The workspace comprises four independently adjustable regions:
1. **Collapsible & Resizable Sidebar**: Toggles between expanded (`256px` default, resizable between `200px` and `380px`) and collapsed (`64px` icon-only with accessible tooltips). Width and collapsed state persist in `localStorage`.
2. **Main Dashboard Canvas with Edit/View Modes**: 12-column grid supporting draggable panels, corner/edge resizing, contextual widget menus (Edit, Duplicate, Delete), and independent widget loading boundaries.
3. **Right-Side Sliding Visualization Drawer**: Slides in smoothly on "+ Add visualization", resizable horizontally (`320px` to `720px`), featuring a searchable metric catalog, instant live telemetry query preview, and visualization switcher.
4. **Bottom Vertically Resizable Query/Metric Configuration Pane**: Opens on widget editing or deep configuration, resizable vertically (`160px` to `520px`), collapsible to an unobtrusive toolbar, allowing real-time query parameter tuning (API, Environment, Monitor, Visualization Type, Time Range).
5. **Debounced Layout Autosave (600ms)**: Layout coordinates `(x, y, width, height)` are debounced locally and committed via `PATCH /api/v1/dashboards/:id/layout` with a non-intrusive status indicator (`✓ Saved`, `Saving...`, `Couldn't save`).
6. **Strict Pane Exclusivity**: Workspace enforces maximum one active right drawer and one active bottom configuration pane, preventing nested drawer/modal cascades.

**Reason:**
- **In-Context Observability vs Context Switching**: Professional observability workflows require tuning queries and inspecting live previews without leaving the dashboard or losing visual reference to adjacent widgets.
- **Native PointerCapture Resizing**: Legacy grid and panel libraries depend on `findDOMNode` or outdated React internals incompatible with React 19. A lightweight, accessible `ResizeHandle` using native `PointerEvents` and `setPointerCapture` provides 60fps buttery-smooth resizing across horizontal and vertical splitters with zero dependency risk.
- **Separation of Workspace UI State from Persisted Telemetry**: UI transient state (sidebar width, drawer visibility, bottom pane height, edit mode) is encapsulated in `useWorkspaceState` and `localStorage`, cleanly decoupled from `DashboardDataResponse` and database-persisted `DashboardWidget` entities.
- **Safe Network Consumption via Debouncing**: Dragging and resizing fire high-frequency pointer updates. Debouncing layout commits by 600ms prevents network storms while guaranteeing immediate UI feedback.
- **Graceful Failure Isolation**: Each widget renders within its own error boundary and loading skeleton. A failure in one metric query never breaks the rest of the workspace canvas.

**Alternatives considered:**
- *Full-page route navigation for widget configuration (`/dashboards/:id/widgets/new`)*:
  - *Why rejected*: Forcing full-page navigation interrupts user inspection, destroys transient dashboard filters, and makes comparing new visualizations against existing dashboard panels impossible.
- *Unconstrained multi-drawer / modal stacking*:
  - *Why rejected*: Spawning drawers from drawers leads to severe UX confusion, z-index bugs, and mobile screen obstruction.
- *Synchronous per-pixel layout persistence*:
  - *Why rejected*: Floods NestJS and PostgreSQL with hundreds of PATCH requests per second during drag/resize interactions.
- *Third-party React grid libraries*:
  - *Why rejected*: Most popular npm packages (e.g. older react-grid-layout versions) fail under React 19 due to deprecated lifecycle methods and `findDOMNode` removals.

**Tradeoffs accepted:**
- Managing custom pointer drag math and clamping logic requires explicit minimum/maximum dimension bounds in workspace state.
- Coordinated draft state must be synchronized between the right drawer and bottom pane when switching between quick metric selection and deep query editing.

**Consequences:**
- The Sentinel dashboard behaves as a high-performance, information-dense observability workspace.
- Users can smoothly adjust workspace regions, customize telemetry panels, and inspect metrics in real time.
- All visualization panels continue to query real telemetry through `MetricQueryService` with zero fake data.

**Date:**
2026-10-25





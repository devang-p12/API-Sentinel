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

---

## ADR-021: Direct Drag-and-Drop Canvas Spatial Placement & Simplified Context Menus

**Decision:**
Replace manual menu-driven position shifting ("Shift Left", "Shift Right", "Row Above", "Row Below") with **direct HTML5 Drag-and-Drop spatial canvas reordering** and a clean, lightweight three-dot contextual menu:
1. **Direct Drag-and-Drop Placement**:
   - Each visualization panel in Edit Mode features a dedicated `[⠿ Drag]` grip handle with `cursor-grab active:cursor-grabbing` and draggable outer wrapper.
   - Hovering over adjacent panels uses precision midpoint detection (`mouseX < rect.left + rect.width / 2`) to distinguish `before` vs `after` insertion targets.
   - Vivid visual drop indicators: glowing blue pulse vertical insertion bars on target card edges (`-left-2 top-0 bottom-0 w-1.5 bg-primary shadow-[0_0_12px_rgba(59,130,246,0.9)]`) and active drag ghost states (`opacity-35 scale-[0.98] border-dashed ring-2 ring-primary/60`).
   - Dedicated Canvas Bottom Drop Zone: allows dragging any panel to the bottom to instantly place it on a fresh row.
2. **Dynamic Coordinate Recalculation (`calculateLayout`)**:
   - Dropping a panel recomputes `x` and `y` offsets based on accumulated column widths (`curX + width > 12`) and `newRow` breaks, avoiding coordinate collisions and preserving the responsive 12-column layout.
3. **Simplified Three-Dot Contextual Menu**:
   - Removed cluttered position shifting buttons ("Shift Left", "Shift Right", "Row Above", "Row Below", and redundant resize buttons) from the dropdown menu.
   - Retained only essential panel lifecycle actions: `Edit Query`, `Duplicate`, `Start on New Row (↵)`, and `Delete Panel`.
   - Direct arrow buttons for width (`[←] 6/12 [→]`) and height (`[↑] 3 rows [↓]`) remain immediately accessible on the panel header bar for fast single-click sizing.

**Reason:**
- **Cognitive Load of Menu-Based Layout Shifting**: Navigating into a dropdown menu to click "Shift Left" or "Row Above" repeated times is tedious and unintuitive. Engineers expect to drag and drop panels directly to their desired position on an observability canvas.
- **Immediate Spatial Feedback**: Visual insertion bars show exactly where the panel will land before releasing the mouse.
- **Clean Information Hierarchy**: Eliminating shifting controls from the three-dot menu makes the menu clean, fast, and focused on panel query configuration and lifecycle.

**Consequences:**
- Visualizations are freely movable across rows and columns via natural drag and drop.
- Layout coordinates automatically persist with debounced autosave.
- Three-dot menu is decluttered and streamlined.

**Date:**
2026-10-26

---

## ADR-022: Core Monitoring Engine, Distributed Worker Architecture, and Telemetry Persistence

**Decision:**
Implement a decoupled, reliable backend monitoring engine for Sentinel adhering to the pipeline:
`API` → `Environment` → `Monitor` → `Scheduler` → `BullMQ / Redis` → `MonitoringWorker` → `MonitorExecutionService` → `HttpMonitorClient` → `Target API` → `MonitorExecution` (`PostgreSQL`) → `Historical Telemetry Data`.

### Key Architectural Pillars:

1. **Why BullMQ with Redis for Queueing:**
   - **Reason:** In-process timers (`setInterval`, `setTimeout`) in Node.js are bound to single-process memory, drift over time, fail across cluster instances, and disappear completely on application restart. BullMQ provides durable, Redis-backed repeatable jobs with deterministic deduplication keys (`monitor-${monitorId}`) and immediate one-off execution queues (`immediate-${monitorId}-${timestamp}`).
   - **Alternatives considered:**
     - *In-memory Node timers*: Unreliable, drifts, lost on restart, cannot scale horizontally across worker nodes.
     - *Cron / node-cron in NestJS*: Lacks job lifecycle state, cannot distribute jobs across worker instances, and offers no visibility into pending or stalled runs.
     - *Kafka / RabbitMQ*: Excessive operational overhead for simple recurring ping schedules.
   - **Consequences:** Scheduling is distributed, crash-resilient, and horizontally scalable across multiple worker pods.

2. **Why Separate `MonitorExecutionService` from `MonitoringWorker`:**
   - **Reason:** Separation of Concerns. The `MonitoringWorker` is strictly an orchestration consumer responsible for pulling jobs from the BullMQ queue, managing concurrency, and handling worker-level failures. The `MonitorExecutionService` encapsulates the full domain lifecycle: loading current monitor & environment state from PostgreSQL, constructing secure URLs & headers, executing the probe, recording the immutable `MonitorExecution` entity, and triggering alert evaluation.
   - **Tradeoffs:** Adds an abstraction layer between BullMQ and the HTTP client, but prevents duplicated execution logic between background worker jobs and manual on-demand executions (`POST /monitors/:id/run`).

3. **Why Separate Dedicated HTTP Client (`HttpProbeService` / `HttpMonitorClient`):**
   - **Reason:** Network I/O mechanics (timeouts, DNS resolution, redirects, response size capping at 32KB, sensitive header redaction, monotonic duration measurement using `performance.now()`) must be isolated from database and business logic. This enables independent unit testing of network anomalies without mocking database calls or BullMQ queues.

4. **Why No Automatic Retries for Probe Failures:**
   - **Reason:** Automatic network retries distort synthetic monitoring telemetry:
     - *Latency distortion*: Retrying a 5-second timeout turns a 5s check into a 15s check.
     - *Traffic amplification*: Hammering a struggling customer server with retries exacerbates cascading failures.
     - *Masked intermittent failures*: Retries hide real transient downtime, giving customers a false sense of reliability.
     - Every execution attempt must be recorded deterministically as `HTTP_ERROR`, `TIMEOUT`, or `NETWORK_ERROR`. Consecutive failure thresholds for alerts belong in the `AlertRule` engine (e.g. "alert after 3 consecutive failures"), not inside the HTTP probe runner.

5. **Why Store Immutable Execution History (`MonitorExecution`):**
   - **Reason:** Observability requires historical context. Recording every execution attempt with `(startedAt, completedAt, durationMs, statusCode, status, errorType, schemaValid, responseSize)` enables accurate uptime SLA calculations, P50/P90/P95/P99 latency trends, error rate distributions, and post-incident root cause forensics.

6. **Why Controlled Worker Concurrency:**
   - **Reason:** Unbounded outbound HTTP requests can exhaust local OS socket descriptors (ephemeral port exhaustion), overload Redis connections, and cause noisy-neighbor interference where slow monitors starve fast monitors. A configurable concurrency pool (`concurrency: 10`, customizable via `MONITOR_WORKER_CONCURRENCY`) ensures deterministic resource allocation.

7. **How SSRF (Server-Side Request Forgery) is Mitigated:**
   - **Reason:** An agentless monitoring service initiates outbound HTTP requests based on user-configured endpoints. Without strict validation, malicious actors could probe local loopback services (`http://localhost`, `http://127.0.0.1`, `http://169.254.169.254` AWS metadata) or internal cloud resources.
   - **Mitigation:**
     - Strict protocol allowlisting: only `http:` and `https:` schemes are permitted; non-HTTP schemes (`file:`, `ftp:`, `gopher:`) are rejected immediately.
     - URL parsing and validation via native `URL` parser before network dispatch.
     - Multi-tenant role-based isolation: a user can only trigger monitors within their authorized Organization and Project hierarchy.
     - Never act as an open proxy: arbitrary user-supplied URLs cannot be passed through open gateway endpoints without belonging to a registered Environment.

**Consequences:**
- The monitoring engine is resilient, secure, observable, and strictly isolated from the dashboard UI.
- All historical data is available via `GET /monitors/:id/executions` with pagination, date ranges, and status filtering.

**Date:**
2026-10-26

---

## ADR-023: Real Metrics Calculation & Dashboard Data Layer (Phase 3)

### Decision:
Implement a centralized backend metric aggregation pipeline (`MetricQueryService` + `MetricDataSource` interface + `MetricRegistry`) for Sentinel. All metric calculations (availability, success/error rates, latency percentiles, request counts, and time-series bucketing) are performed strictly on the backend. The frontend dashboard components (`Stat`, `TimeSeries`, `BarChart`, `Gauge`, `Table`) consume normalized metric results over HTTP and never query raw executions or perform math on the client.

### Architectural Context & Pipeline:
```text
MonitorExecution (PostgreSQL)
       ↓
MetricDataSource (PostgresMetricDataSource)
       ↓
MetricQueryService (validation, scoping, percentile math, dynamic bucketing)
       ↓
MetricRegistry (catalog & visualization constraints)
       ↓
DashboardsController (POST /metrics/query, GET /dashboards/:id/data)
       ↓
DashboardWidget (Stat, TimeSeries, Bar, Gauge, Table)
```

### Detailed Rationale & Architectural Decisions:

1. **Why metrics are calculated on the backend (and why frontend never calculates metrics or runs SQL):**
   - **Data Volume & Network Efficiency**: A busy monitoring service generates millions of `MonitorExecution` records. Sending raw execution logs to a browser would overwhelm client memory, cause multi-second network transfers, and freeze the browser tab. The backend aggregates thousands of rows into a single scalar value or ~60 time-series points.
   - **Single Source of Truth**: Availability, SLA compliance, and percentiles must be calculated identically across dashboards, public status pages, incident triggers, and exported reports. Frontend calculations inevitably lead to discrepancies across different devices, time zones, or browsers.
   - **Zero SQL in Frontend**: Exposing SQL or raw database tables to the frontend violates security boundaries and leaks multi-tenant data structures.

2. **Why `MetricQueryService` exists:**
   - Centralizes validation (metric existence, time range bounds, date sanity, tenant scoping).
   - Encapsulates statistical algorithms (P50/P90/P95/P99 latency calculations, bucketing).
   - Keeps HTTP controllers thin and decouples presentation formats from query mechanics.

3. **Why `MetricDataSource` abstraction exists (and why PostgreSQL is first, Prometheus deferred):**
   - **Abstraction**: `MetricDataSource` defines an interface (`getExecutions({ monitorIds, from, to })`) that decouples `MetricQueryService` from Prisma and PostgreSQL.
   - **PostgreSQL First**: PostgreSQL already stores every `MonitorExecution` with composite indexes (`[monitorId, executedAt(sort: Desc)]`). It provides immediate, zero-infrastructure observability for Phase 3 without introducing additional services.
   - **Prometheus Deferred**: Prometheus, Grafana, Loki, and OpenTelemetry introduce operational complexity (scraping daemons, TSDB storage, PromQL integration). Deferring Prometheus to a later phase proves that synthetic monitoring data flows reliably end-to-end first. When Prometheus is added later, it will plug into `MetricDataSource` as `PrometheusMetricDataSource` without requiring any changes to the dashboard or frontend visualization components.

4. **How Availability and Reliability Metrics are Defined:**
   - **Availability**: `(successful executions / total executions) * 100`. An execution is successful if and only if `status === 'SUCCESS'` (HTTP status matched expectation, probe did not time out, socket did not error, and payload contract was valid).
   - **Success Rate**: Identical to Availability for synthetic probes: `(successCount / totalCount) * 100`.
   - **Error Rate**: `(failedCount / totalCount) * 100`, where failures include `HTTP_ERROR`, `TIMEOUT`, `NETWORK_ERROR`, and `SCHEMA_ERROR`.
   - **Failure Count**: Total count of executions where `status !== 'SUCCESS'`.
   - **Timeout Count**: Strictly executions where canonical status is `TIMEOUT`. Does not infer timeout from duration.
   - **Zero-Division Safety**: When total executions equal 0, rates return `null` (not `NaN` or `Infinity`), enabling UI to cleanly display "No Data".

5. **How Latency Percentiles (P50, P95, P99) are Calculated:**
   - **Deterministic Percentile Algorithm**: Uses the nearest-rank method on sorted arrays of valid response durations (`responseTimeMs !== null`).
     ```typescript
     index = Math.ceil((p / 100) * sorted.length) - 1;
     return sorted[Math.max(0, Math.min(index, sorted.length - 1))];
     ```
   - **Null-Safety**: Executions without valid duration (e.g., aborted socket before handshake or timeout) are excluded from latency calculations. If no valid latencies exist, percentiles return `null`.

6. **How Time Bucketing and Series are Generated:**
   - Instead of returning raw records, the requested time range (`to - from`) is divided into intelligent bucket windows:
     - Range <= 1 hour: 1-minute buckets
     - Range <= 6 hours: 5-minute buckets
     - Range <= 24 hours: 15-minute buckets
     - Range <= 7 days: 1-hour buckets
     - Range <= 30 days: 6-hour buckets
     - Range > 30 days: 24-hour (daily) buckets
   - Each bucket independently calculates aggregate statistics for executions falling within that window.
   - Empty bucket representation:
     - For **request counts**, empty buckets are `0`.
     - For **latency metrics (avg, p50, p95, min, max)**, empty buckets are `null`. Latency must **never** be coerced to `0ms` because 0ms implies an impossibly fast execution rather than the absence of checks.
     - For **rates**, empty buckets are `null`.

7. **Filter Composability and Override Precedence:**
   - Dashboard filters support hierarchical scopes: `organizationId` -> `projectId` -> `apiId` -> `environmentId` -> `monitorId`.
   - Precedence: **Widget-Specific Configuration > Dashboard Global Filter > Default Scope**.
   - If a widget defines `environmentId: "staging-id"`, it retains that environment filter even if the dashboard header selects "Production". If the widget leaves `environmentId` unset, it inherits the dashboard global filter.

8. **Time Range Validation:**
   - Rejects queries where `from > to` with `BadRequestException (400)`.
   - Rejects queries where `to - from > 365 days` to protect database query planners from accidental runaway full-table scans.
   - All internal storage and calculation timestamps use UTC ISO-8601 strings.

### Alternatives Considered:
- *Direct Prisma queries in controller*: Rejected. Violates NestJS separation of concerns and prevents future pluggable data sources.
- *Client-side aggregation of raw execution list*: Rejected. Causes network bloat and UI freezing when monitor executions exceed thousands of rows.
- *Defaulting empty latency to 0ms*: Rejected. Severely distorts min/average latency and mislead users into thinking requests completed in 0 milliseconds.

### Consequences:
- The dashboard is fast, robust, and displays real synthetic probe data.
- Widgets handle loading, empty, and error states gracefully without crashing.
- Future transition to Prometheus or hybrid storage requires zero frontend changes.

**Date:**
2026-10-26

---

## ADR-024: Production-Grade Stateful Alert Engine, Deduplication Fingerprints, Pending Grace Windows, and Advisory Locking

**Context & Problem Statement:**
In previous phases, Sentinel established the synthetic monitoring worker, PostgreSQL `MonitorExecution` historical records, and the `MetricQueryService` custom dashboard layer. However, Sentinel remained a passive monitoring platform: it recorded metrics, but could not proactively detect threshold violations or maintain lifecycle alert states. We needed to transform Sentinel into an active observability platform without implementing a simplistic and noisy `if metric > threshold then alert` approach.

**Decision:**
Implement **Phase 5A: Production-Grade Alert Engine** with the following foundational architectural design choices:

1. **Separation of `AlertRule` and `AlertInstance`:**
   - **`AlertRule` (Definition)**: Defines *intent* — what metric to query, which project/API/environment/monitor scope it targets, what threshold operator to check, what pending duration window to enforce, evaluation frequency, severity, and labels.
   - **`AlertInstance` (State Lifecycle)**: Represents a *concrete, physical occurrence* of an alert rule violating its condition on a specific set of dimensions at a specific time.
   - *Why Separate*: An alert rule is static configuration created once by an engineer. An alert instance is dynamic and ephemeral; a single rule can produce multiple distinct instances over time (e.g. firing today for 10 minutes, resolving, and firing next week). Conflating the rule and its active state violates relational modeling, breaks historical auditability, and causes race conditions when multiple environments match a wildcard rule.

2. **Persistence of Alert State (`NORMAL`, `PENDING`, `FIRING`, `RESOLVED`):**
   - Alert state is maintained explicitly in PostgreSQL rather than calculated purely in-memory.
   - *Why Persisted*: In-memory alerting fails across worker process restarts, server crashes, rolling deployments, and multi-container scaling. Persisting state in PostgreSQL ensures that if Worker A marks an alert `PENDING`, Worker B (or the API server) can inspect `pendingSince` on subsequent ticks and reliably determine whether the FOR duration has elapsed. Furthermore, when an alert resolves, its record is preserved with `resolvedAt` and duration calculations for post-incident review.

3. **Immutable `AlertEvaluation` History:**
   - On every evaluation tick, an `AlertEvaluation` record is written capturing `value`, `threshold`, `conditionMet`, `stateBefore`, `stateAfter`, and `evaluatedAt`.
   - *Why History Exists*: Observability engineers need to answer: *"Why did this alert fire?"* and *"Why did it resolve?"*. Evaluation history provides deterministic proof of telemetry values over time, showing the exact metric readings that pushed an alert through `NORMAL -> PENDING -> FIRING -> RESOLVED`.

4. **Deterministic Deduplication Fingerprints:**
   - Every violation computes a deterministic SHA-256 hash:
     ```text
     fingerprint = hash(ruleId + apiId + environmentId + monitorId + sortedLabels)
     ```
   - *Why Fingerprints*: Without fingerprint deduplication, a rule evaluated every 30 seconds during a 10-minute outage would spawn 20 duplicate firing alert instances. Fingerprints ensure Sentinel finds the existing active instance (`status IN ['PENDING', 'FIRING']`) and updates its current reading rather than creating duplicates.

5. **Configurable `FOR` / Pending Grace Window:**
   - A rule only transitions from `PENDING` to `FIRING` when `now - pendingSince >= durationSeconds`.
   - *Why FOR Windows*: Transient latency spikes and single dropped packets are common in cloud networking. Firing immediately on every threshold crossing causes extreme alert fatigue. The pending window ensures alerts only fire when violations are sustained, while resolving cleanly if transient spikes clear before the duration is reached.

6. **PostgreSQL Advisory Locks for Concurrency Safety:**
   - Evaluator transactions execute `SELECT pg_advisory_xact_lock(hashtext(fingerprint))` before querying or updating alert instances.
   - *Why Advisory Locks*: When multiple background workers or incoming monitor executions evaluate the same monitor simultaneously, application-level checks allow race conditions where two workers concurrently see no active instance and insert duplicate records. Advisory transaction locks serialize execution for the same fingerprint at the database engine level, with zero Redis dependency and automatic lock release on commit/rollback.

7. **Zero Duplicate Metric Calculations:**
   - The alert engine queries the existing `MetricQueryService` directly.
   - *Why Reuse*: Calculating percentiles, error rates, and availability inside the alert worker would duplicate formulas and produce discrepancies between what the dashboard displays and what alerts trigger on. Both consumers share the exact same underlying metric logic.

8. **Scope Boundary: Deferring Incident Engine (Phase 5B) and Notification Routing (Phase 6):**
   - Notification channels (Email, Slack, Webhooks, PagerDuty), contact points, and notification policies are strictly excluded from Phase 5A.
   - *Why Deferred*: Mature observability systems (Grafana Alerting, Prometheus/Alertmanager, Datadog) strictly decouple *Alert Evaluation* (discovering violations and maintaining state) from *Incident Management* (grouping related alerts) and *Notification Routing* (formatting and dispatching to channels). Coupling notification dispatch directly into evaluation loops causes cascading timeouts, rate limiting by webhook providers, and noisy, un-grouped message blasts.

**Consequences:**
- Sentinel possesses a rock-solid, stateful alerting foundation.
- No duplicate firing alerts occur for the same issue.
- Evaluation history provides complete visibility into metric state transitions.
- Phase 5B (Incident Engine) and Phase 6 (Notification Policies) can cleanly consume `AlertInstance` states without redesigning the core engine.

**Date:**
2026-10-26

---

## ADR-025: Incident Management, Alert Correlation, and Multi-Alert Outage Lifecycle (Phase 5B)

**Decision:**
Implement a dedicated **Incident Management & Alert Correlation** layer decoupled from the Alert Engine, grouping multiple related firing `AlertInstance` records into a single operational `Incident` based on deterministic resource scoping (`projectId` + `apiId` + `environmentId`), maintaining an immutable chronological audit trail (`IncidentEvent`), and managing automated resolution only after all correlated alerts recover.

**Reasoning Behind Architectural Decisions:**

1. **Why `Alert` $\neq$ `Incident`:**
   - An *Alert Rule* specifies what metric condition to check (`p95_latency > 1000ms`).
   - An *Alert Instance* represents a specific metric violation on a concrete resource at a given time (`Payment API / Prod: p95 = 1420ms (FIRING)`).
   - An *Incident* represents a broader operational problem or outage that impacts users or systems, which typically triggers multiple correlated alerts across different metrics (e.g. latency, error rate, gateway timeouts).
   - Conflating alerts with incidents leads to alert storm spam, fragmented incident numbers, duplicate communication threads, and inaccurate Mean Time to Detect (MTTD) and Mean Time to Resolve (MTTR) metrics.

2. **Why Multiple Alerts Belong to One Incident:**
   - System failures are cascading: a slow database pool immediately triggers high latency, which causes queue exhaustion, leading to HTTP 504 timeouts, which finally causes an availability drop.
   - Operators investigating an outage need a single source of truth containing all relevant symptoms, not four separate incident tickets. Correlating multiple alerts under one incident gives on-call engineers unified situational awareness.

3. **Why Correlation Uses `projectId` + `apiId` + `environmentId`:**
   - For Phase 5B, a deterministic scoping key (`hash(projectId + apiId + environmentId)`) provides 100% predictable, reproducible grouping behavior without unpredictable machine-learning or black-box heuristics.
   - Outages on `Payment API (Production)` and `Payment API (Production)` correlate into the same operational event, while outages on `User API (Production)` or `Payment API (Development)` remain properly isolated into separate incidents.

4. **Why Complex Machine Learning & Anomaly Correlation is Postponed:**
   - Advanced ML clustering, graph dependency topologies, and automatic root-cause analysis introduce significant non-determinism, require large training datasets, and are prone to false-positive grouping.
   - Establishing a deterministic, rock-solid correlation baseline first ensures that future ML or topological correlation engines (Phase 7+) can be plugged in cleanly without altering the underlying data models.

5. **Why Notification Routing is Deferred to Phase 6:**
   - Notification dispatching (Email, Slack, Discord, Webhooks, PagerDuty), contact points, and notification policies belong strictly to Phase 6.
   - Decoupling correlation from notifications prevents cascading webhook timeouts, API rate limits, and un-grouped notification storms during massive cascading outages.

**Consequences:**
- Incidents automatically aggregate all related alerts occurring within the same service boundary.
- Severity escalates dynamically to the highest severity among all active alerts (`CRITICAL > HIGH > WARNING > INFO`).
- Incidents resolve automatically only when all attached alert instances recover, preventing premature incident closure.
- Concurrency across multiple workers is strictly serialized using PostgreSQL transaction advisory locks on the correlation key.

**Date:**
2026-10-26


# API Sentinel — Incident Management & Alert Correlation

## 1. Overview & Core Philosophy

**API Sentinel Phase 5B** introduces production-grade **Incident Management & Alert Correlation**.

In real-world microservice architectures, an operational degradation rarely manifests as an isolated alert. A downstream database slow-query spike typically causes:
1. P95 API Latency breach (> 1000ms)
2. HTTP 504 Gateway Timeout spike
3. Overall Availability drop (< 99%)
4. High 5xx Error Rate (> 5%)

A naive alerting system generates dozens of disconnected alerts and alarms for every check, fragmenting operator context. Sentinel's incident engine solves this by grouping and correlating related active alert instances into a unified, stateful **Operational Incident**.

```text
MonitorExecution (PostgreSQL)
       ↓
MetricQueryService (12 Core Metrics)
       ↓
AlertRule (What to evaluate)
       ↓
AlertInstance (Concrete occurrence: NORMAL -> PENDING -> FIRING -> RESOLVED)
       ↓
IncidentCorrelationService (Deterministic Correlation Key: project + api + environment)
       ↓
Incident (Aggregated operational outage: OPEN -> ACKNOWLEDGED -> RESOLVED)
       ↓
Incident Timeline (Immutable chronological audit trail)
```

---

## 2. Fundamental Conceptual Separation

Sentinel strictly maintains clear boundaries between these distinct observability domain entities:

| Entity | Definition | Example |
| :--- | :--- | :--- |
| **Alert Rule** | The static user-configured metric condition, threshold, and timing to watch for. | `p95_latency > 1000ms FOR 2 minutes` |
| **Alert Instance** | A concrete occurrence of a specific resource violating an alert rule, tracked by deterministic fingerprint. | `Payment API (Prod): p95_latency = 1420ms (FIRING)` |
| **Incident** | A higher-level operational problem grouping one or more related alert instances affecting a system boundary. | `INC-afec9ae7: Payment API Production Degradation (CRITICAL)` |
| **Evaluation** | An immutable audit record of a single rule check at a discrete point in time. | `12:00:30 - value: 1250ms, conditionMet: true, state: FIRING` |

> **Critical Rule:** Incidents do **not** replace or duplicate AlertInstances. An Incident references its underlying AlertInstances via the `IncidentAlert` relationship table.

---

## 3. Incident Domain Models

### Incident (`backend/prisma/schema.prisma`)
```prisma
model Incident {
  id             String         @id @default(uuid())
  projectId      String         @map("project_id")
  project        Project        @relation(fields: [projectId], references: [id], onDelete: Cascade)
  title          String
  description    String?
  status         IncidentStatus @default(OPEN)
  severity       AlertSeverity  @default(WARNING)
  apiId          String?        @map("api_id")
  api            Api?           @relation(fields: [apiId], references: [id], onDelete: SetNull)
  environmentId  String?        @map("environment_id")
  environment    Environment?   @relation(fields: [environmentId], references: [id], onDelete: SetNull)

  startedAt      DateTime       @default(now()) @map("started_at")
  acknowledgedAt DateTime?      @map("acknowledged_at")
  resolvedAt     DateTime?      @map("resolved_at")
  acknowledgedBy String?        @map("acknowledged_by")
  resolvedBy     String?        @map("resolved_by")

  createdAt      DateTime       @default(now()) @map("created_at")
  updatedAt      DateTime       @updatedAt @map("updated_at")

  alerts         IncidentAlert[]
  events         IncidentEvent[]

  @@index([projectId, status])
  @@index([apiId, environmentId, status])
  @@index([status])
  @@index([startedAt(sort: Desc)])
  @@map("incidents")
}
```

### IncidentAlert (Relationship Table)
```prisma
model IncidentAlert {
  id              String        @id @default(uuid())
  incidentId      String        @map("incident_id")
  incident        Incident      @relation(fields: [incidentId], references: [id], onDelete: Cascade)
  alertInstanceId String        @map("alert_instance_id")
  alertInstance   AlertInstance @relation(fields: [alertInstanceId], references: [id], onDelete: Cascade)
  createdAt       DateTime      @default(now()) @map("created_at")

  @@unique([incidentId, alertInstanceId])
  @@index([incidentId])
  @@index([alertInstanceId])
  @@map("incident_alerts")
}
```

### IncidentEvent (Chronological Audit Timeline)
```prisma
model IncidentEvent {
  id         String            @id @default(uuid())
  incidentId String            @map("incident_id")
  incident   Incident          @relation(fields: [incidentId], references: [id], onDelete: Cascade)
  type       IncidentEventType
  message    String
  actorType  ActorType         @default(SYSTEM) @map("actor_type")
  actorId    String?           @map("actor_id")
  metadata   Json?             @default("{}")
  createdAt  DateTime          @default(now()) @map("created_at")

  @@index([incidentId, createdAt])
  @@map("incident_events")
}
```

---

## 4. Deterministic Correlation Strategy

Sentinel correlates alert instances into incidents using a deterministic scoping key:

$$\text{CorrelationKey} = \text{hash}(\text{projectId} + \text{apiId} + \text{environmentId})$$

### Correlation Rules:
1. **Same Scope Grouping**: When an alert instance fires (`PENDING -> FIRING`), Sentinel looks for an active (`OPEN` or `ACKNOWLEDGED`) incident sharing the same `projectId`, `apiId`, and `environmentId`.
   - If found: The alert instance is attached to the existing incident via `IncidentAlert`.
   - If not found: A new incident is created with `status: OPEN`.
2. **Resource Boundary Isolation**:
   - Alerts for `Payment API / Production` and `Payment API / Production` $\to$ **Same Incident**.
   - Alerts for `Payment API / Production` and `User API / Production` $\to$ **Separate Incidents**.
   - Alerts for `Payment API / Production` and `Payment API / Staging` $\to$ **Separate Incidents**.
3. **Concurrency & Race Condition Prevention**:
   Evaluations across concurrent workers are serialized using PostgreSQL transaction-level advisory locks:
   ```sql
   SELECT pg_advisory_xact_lock(hashtext($1)); -- $1 = correlationKey
   ```
   This guarantees that two workers simultaneously processing latency and error rate alerts for the same API cannot create two duplicate incidents.

---

## 5. Incident Lifecycle & State Transitions

```text
                  Initial Alert Firing
                           │
                           ↓
                        [ OPEN ] ──────────────┐
                           │                   │
               Acknowledge │                   │ All Alerts
               (Engineer)  │                   │ Recover
                           ↓                   │
                    [ ACKNOWLEDGED ]           │
                           │                   │
                All Alerts │                   │
                Recover    │                   │
                           ↓                   ↓
                     [ RESOLVED ] ←────────────┘
```

### 1. Incident Creation (`OPEN`)
- Created automatically when the first AlertInstance transitions into `FIRING`.
- Auto-generates human-readable titles (e.g., `Payment API production Degradation`).
- Initial severity is set to the triggering alert's severity.
- Emits timeline events: `CREATED` and `ALERT_ATTACHED`.

### 2. Severity Escalation
- An incident's severity reflects the **highest severity** among all active correlated alerts:
  $$\text{CRITICAL} > \text{HIGH} > \text{WARNING} > \text{INFO}$$
- If an incident starts at `WARNING` and a `CRITICAL` alert subsequently attaches, the incident's severity escalates to `CRITICAL` and emits a `SEVERITY_CHANGED` event on the timeline.

### 3. Acknowledgment (`ACKNOWLEDGED`)
- Engineers can acknowledge an incident via `POST /incidents/:id/acknowledge`.
- Stores `acknowledgedAt` timestamp and `acknowledgedBy` actor name.
- Emits an `ACKNOWLEDGED` event on the timeline.
- **Important**: Acknowledging an incident signals human engagement but does **not** stop underlying monitoring probes or alter alert states.

### 4. Automatic Resolution (`RESOLVED`)
- An incident does **not** resolve when a single alert recovers if other correlated alerts are still firing.
- When an attached alert recovers, Sentinel records an `ALERT_RESOLVED` event.
- Only when **all attached alert instances** have transitioned to `AlertState.RESOLVED` does Sentinel automatically resolve the incident:
  - Sets `status: RESOLVED`
  - Sets `resolvedAt = now()`
  - Emits `RESOLVED` timeline event: `"Incident automatically resolved — all correlated alerts have recovered"`
- Computes MTTR duration: $\text{durationSeconds} = \text{resolvedAt} - \text{startedAt}$.

### 5. Manual Resolution Safety
- Authorized engineers can manually close an incident via `POST /incidents/:id/resolve`.
- If an alert remains continuously firing after manual incident resolution, Sentinel's alert deduplication prevents infinite incident churn. Only when the alert fully clears and a genuinely new violation cycle begins will a new incident be opened.

---

## 6. Incident Timeline Audit Trail

Every state change, attachment, and operator intervention generates an immutable `IncidentEvent`:

```text
02:13:42 [SYSTEM] 🚨 Incident created: Payment API production Degradation
02:13:42 [SYSTEM] 🔥 Triggering alert "Payment High Latency" fired (average_latency = 1205ms)
02:14:10 [SYSTEM] ⚠️ Severity escalated from WARNING to CRITICAL due to rule "Payment Error Rate"
02:14:10 [SYSTEM] 🔥 Alert "Payment Error Rate" fired (error_rate = 33.33%) and attached to incident
02:15:02 [USER]   👤 Incident acknowledged by Authorized Engineer
02:18:21 [SYSTEM] ✓ Alert "Payment Error Rate" resolved (error_rate recovered)
02:20:14 [SYSTEM] ✓ Alert "Payment High Latency" resolved (average_latency recovered)
02:20:14 [SYSTEM] ✅ Incident automatically resolved — all correlated alerts have recovered
```

---

## 7. REST API Endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/incidents` | List incidents with filters (`status`, `severity`, `projectId`, `apiId`, `environmentId`, `search`, `limit`, `offset`) |
| `GET` | `/incidents/summary` | Real-time counts (`open`, `acknowledged`, `resolved`, `total`) |
| `GET` | `/incidents/:id` | Full incident details with attached alerts, events, and duration |
| `POST` | `/incidents/:id/acknowledge` | Acknowledge active incident |
| `POST` | `/incidents/:id/resolve` | Manually resolve incident |
| `GET` | `/incidents/:id/timeline` | Get chronological audit events |
| `GET` | `/incidents/:id/alerts` | Get correlated alert instances |

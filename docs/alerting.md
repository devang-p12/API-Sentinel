# API Sentinel — Alert Engine Architecture (Phase 5A)

## 1. Overview & Core Philosophy

The API Sentinel Alert Engine transforms Sentinel from an observability platform that merely records API metrics into a system that continuously evaluates metrics against user-defined alert rules and maintains reliable, stateful alert states.

Rather than implementing a simplistic threshold trigger (`if metric > threshold then alert`), Sentinel provides a production-grade, stateful alert engine inspired by Grafana, Datadog, and Prometheus Alertmanager.

```text
MonitorExecution (PostgreSQL)
       ↓
MetricQueryService (Metric Registry & Time-Series Aggregations)
       ↓
Alert Evaluation Service
       ↓
Deterministic Fingerprint Generation
       ↓
Active Alert Instance
       ↓
NORMAL ──(condition true)──→ PENDING ──(FOR duration elapsed)──→ FIRING
  ↑                                                                 │
  └────────────────(condition false / recovered)────────────────────┘
```

---

## 2. Core Domain Models

### AlertRule (Definition)
An `AlertRule` represents the declarative policy configuring what to evaluate, what scope it covers, which threshold condition to check, and timing rules:

| Field | Type | Description |
|---|---|---|
| `id` | UUID | Primary key |
| `name` | String | Human-readable name (e.g. "High Payment API Latency") |
| `description` | String? | Operational summary of the alert policy |
| `projectId` | UUID | Project tenancy scope |
| `metric` | String | Metric identifier (e.g. `p95_latency`, `error_rate`, `availability`) |
| `apiId` | UUID? | Optional API filter (nullable = applies to all APIs in project) |
| `environmentId` | UUID? | Optional Environment filter (nullable = all environments) |
| `monitorId` | UUID? | Optional Monitor filter (nullable = all monitors) |
| `condition` | Enum | Comparison operator: `GREATER_THAN`, `GREATER_THAN_OR_EQUAL`, `LESS_THAN`, `LESS_THAN_OR_EQUAL`, `EQUAL`, `NOT_EQUAL` |
| `threshold` | Float | Numeric threshold value (in metric's native unit, e.g. ms or %) |
| `duration` | Integer | FOR condition in seconds. Must remain true for this window before FIRING |
| `evaluationInterval` | Integer | Evaluation frequency in seconds (e.g. 15s, 30s, 60s) |
| `severity` | Enum | `CRITICAL`, `HIGH`, `WARNING`, `INFO` |
| `labels` | JSONB | Dynamic dimension tags (e.g. `team: payments`, `service: checkout`) |
| `enabled` | Boolean | Whether background evaluation is active |

### AlertInstance (Concrete Incident/Violation)
An `AlertInstance` represents a concrete active or historical violation of an `AlertRule` on a specific resource dimension:

| Field | Type | Description |
|---|---|---|
| `id` | UUID | Primary key |
| `alertRuleId` | UUID | Associated alert rule |
| `fingerprint` | String | Deterministic hash uniquely identifying the rule + dimensions |
| `status` | Enum | `NORMAL`, `PENDING`, `FIRING`, `RESOLVED` |
| `currentValue` | Float? | Metric value recorded at the most recent evaluation |
| `threshold` | Float | Threshold target snapshot |
| `pendingSince` | Timestamp? | Timestamp when condition first became true |
| `startedAt` | Timestamp? | Timestamp when FOR duration elapsed and alert transitioned to `FIRING` |
| `resolvedAt` | Timestamp? | Timestamp when condition cleared and alert transitioned to `RESOLVED` |
| `lastEvaluatedAt` | Timestamp | Timestamp of last evaluation |

### AlertEvaluation (Historical Audit Trail)
An `AlertEvaluation` represents an immutable point-in-time snapshot answering: *"Why did this alert fire or resolve?"*

| Field | Type | Description |
|---|---|---|
| `id` | UUID | Primary key |
| `alertRuleId` | UUID | Associated rule |
| `alertInstanceId` | UUID? | Associated instance |
| `value` | Float? | Exact metric value observed (or null for NO_DATA) |
| `threshold` | Float | Target threshold |
| `conditionMet` | Boolean | Boolean evaluation result |
| `stateBefore` | Enum | Alert state before evaluation |
| `stateAfter` | Enum | Alert state after evaluation |
| `evaluatedAt` | Timestamp | Timestamp of evaluation |

---

## 3. Supported Metrics

The Alert Engine reuses the existing `MetricQueryService` and metric catalog without duplicate metric calculation:

1. **`availability`**: Availability percentage (0-100%)
2. **`success_rate`**: Percentage of 2xx/3xx HTTP responses (0-100%)
3. **`error_rate`**: Percentage of 4xx/5xx HTTP responses (0-100%)
4. **`request_count`**: Total executed requests
5. **`average_latency`**: Arithmetic mean response time in ms
6. **`p50_latency`**: Median response time in ms
7. **`p95_latency`**: 95th percentile response time in ms
8. **`p99_latency`**: 99th percentile response time in ms
9. **`min_latency`**: Minimum response time in ms
10. **`max_latency`**: Maximum response time in ms
11. **`timeout_count`**: Number of requests exceeding timeout
12. **`failure_count`**: Number of network, TLS, or HTTP failures

---

## 4. State Machine & Transitions

The Alert State Machine guarantees deterministic state progression:

```text
                    conditionMet = true
[NORMAL] ──────────────────────────────────────────→ [PENDING]
   ↑                                                     │
   │ conditionMet = false                                │ duration reached
   │ (spike cleared)                                     ↓
   │                                                 [FIRING]
   │                                                     │
   │              conditionMet = false                   │
   └─────────────────────────────────────────────────────┘
                             ↓
                        [RESOLVED]
```

### Transition Truth Table:

| Current State | Condition Met? | Elapsed >= Duration? | New State | Action |
|---|---|---|---|---|
| `NORMAL` | `false` | N/A | `NORMAL` | No-op. Service is healthy. |
| `NORMAL` | `true` | `duration == 0` | `FIRING` | Immediate firing (if duration = 0). |
| `NORMAL` | `true` | `duration > 0` | `PENDING` | Create AlertInstance, record `pendingSince = now`. |
| `PENDING` | `false` | N/A | `RESOLVED` | Transient spike ended before duration reached. |
| `PENDING` | `true` | `elapsed < duration` | `PENDING` | Retain pending status; await duration window. |
| `PENDING` | `true` | `elapsed >= duration` | `FIRING` | Transition to firing, record `startedAt = now`. |
| `FIRING` | `true` | N/A | `FIRING` | Alert remains firing, update `currentValue`. |
| `FIRING` | `false` | N/A | `RESOLVED` | Recovery detected. Set `resolvedAt = now`. |
| `RESOLVED` | `true` | N/A | `PENDING` | New violation cycle starts fresh instance. |

---

## 5. FOR / Pending Duration Window

To eliminate alert fatigue from transient latency spikes or temporary network hiccups, Sentinel enforces a configurable `FOR` duration:

```text
Rule: p95_latency > 1000ms FOR 2 minutes

12:00:00 ->  800ms -> NORMAL   (Condition false)
12:00:30 -> 1200ms -> PENDING  (Condition true, pendingSince = 12:00:30)
12:01:00 -> 1300ms -> PENDING  (Condition true, elapsed = 30s < 120s)
12:01:30 -> 1400ms -> PENDING  (Condition true, elapsed = 60s < 120s)
12:02:30 -> 1500ms -> FIRING   (Condition true, elapsed = 120s >= 120s -> FIRE!)
```

If the condition returns to normal during the pending window, the state transitions without ever spamming or firing an alert.

---

## 6. Deterministic Fingerprints & Deduplication

Alert deduplication prevents noisy duplicate instances when an alert continues to violate a threshold across multiple evaluations:

```text
fingerprint = SHA256(
  alertRuleId + ":" +
  (apiId || "*") + ":" +
  (environmentId || "*") + ":" +
  (monitorId || "*") + ":" +
  sortedLabels
)
```

- When evaluating an alert, Sentinel looks up any active instance with `status IN ['PENDING', 'FIRING']` matching the exact fingerprint.
- If an active instance already exists, Sentinel updates its status and current value. It **never** creates duplicate firing instances.
- When an alert resolves, its status becomes `RESOLVED`. If the violation recurs in the future, a new lifecycle instance is created while preserving historical resolved records.

---

## 7. Concurrency Safety with PostgreSQL Advisory Locks

In multi-worker distributed deployments, concurrent executions could attempt to create alert instances simultaneously. Sentinel guarantees strict isolation by utilizing native PostgreSQL transaction-level advisory locks:

```sql
SELECT pg_advisory_xact_lock(hashtext(fingerprint));
```

1. Worker A and Worker B evaluating the same fingerprint are strictly serialized.
2. The active instance query runs *after* acquiring the lock, ensuring Worker B always sees Worker A's committed changes.
3. Locks are automatically released when the transaction commits or rolls back, requiring zero external distributed lock managers.

---

## 8. Observability of the Alert Engine

Sentinel produces structured logs on every evaluation cycle:

```text
[AlertEngine] rule="Production Payment Latency" metric=p95_latency value=1202 threshold=1000 conditionMet=true previousState=PENDING newState=FIRING fingerprint=0b9159b71bb8f70c77cd1ee177e897f2
```

Logs never output authorization headers, body payloads, or secrets.

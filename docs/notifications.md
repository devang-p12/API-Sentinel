# API Sentinel — Phase 6: Notification & Alert Routing

## Overview

API Sentinel features a decoupled, production-grade notification and alert routing subsystem inspired by Grafana Alerting and Alertmanager. 

The notification architecture separates **violation discovery** (Alert Engine) and **crisis aggregation** (Incident Engine) from **notification dispatch** (Notification Routing Engine):

```text
Monitor
   ↓
MonitorExecution
   ↓
Metrics Layer (MetricQueryService)
   ↓
AlertRule
   ↓
AlertInstance (NORMAL, PENDING, FIRING, RESOLVED)
   ↓
Incident (OPEN, ACKNOWLEDGED, RESOLVED)
   ↓
Notification Routing Service
   ↓
Notification Policy (Label Matchers & Priorities)
   ↓
Contact Point (EMAIL, SLACK, WEBHOOK)
   ↓
Notification Channel (BullMQ Delayed Retries)
```

---

## 1. Contact Points

A **Contact Point** represents an external notification destination. Sentinel supports three native channel types:

| Channel Type | Description | Configuration Schema |
| :--- | :--- | :--- |
| **`EMAIL`** | Team or personal email dispatch | `{"recipients": ["oncall@example.com", "sre@example.com"]}` |
| **`SLACK`** | Slack Incoming Webhook with Block Kit formatting | `{"webhookUrl": "https://hooks.slack.com/services/..."}` |
| **`WEBHOOK`** | Generic HTTP Webhook endpoint | `{"url": "https://...", "method": "POST", "headers": {"Authorization": "Bearer ..."}}` |

### Security & Secret Encryption
- **Encryption at Rest**: Sensitive fields (`webhookUrl`, `url`, `token`, `password`, `headers.Authorization`) are encrypted using **AES-256-GCM** before saving to PostgreSQL via `SecretEncryptionService`.
- **Masking in APIs & UI**: All GET endpoints return masked secrets (e.g. `https://hooks.slack.com/services/••••••••` and `••••••••`), ensuring sensitive credentials never leak to browsers or logs.
- **SSRF Protection**: All outbound webhook and Slack URLs are validated via `WebhookSecurityService` to reject non-HTTP(S) protocols and block unauthorized loopback or private network access.

---

## 2. Notification Policies & Label-Based Routing

A **Notification Policy** determines which alerts and incidents route to which contact points based on label matching rules.

### Matchers & Operators
Policies evaluate consolidated incident and alert labels:
- `severity` (`critical`, `high`, `warning`, `info`)
- `environment` (`production`, `staging`, `development`)
- `service` / `api` (target service name)
- `project` (project name)
- Custom Alert Rule labels (e.g. `team: "payments"`, `tier: "core"`)

Supported Matcher Operators:
- `=` : Case-insensitive exact match (e.g. `severity = critical`)
- `!=` : Negation (e.g. `environment != staging`)
- `contains` : Substring match (e.g. `service contains auth`)
- `regex` : Regular expression matching (e.g. `team regex ^(backend|infra)$`)
- `in` : Comma-separated list membership (e.g. `environment in production,staging`)

### Evaluation Priority & Deduplication
- Policies are sorted by `priority ASC` (Priority 1 evaluates before Priority 2).
- When multiple policies match an incident, Sentinel deduplicates target contact points so an engineer never receives duplicate notifications for the same event.

---

## 3. Notification Delivery Lifecycle & Deduplication

### Incident-Level Grouping
To avoid alert fatigue, Sentinel dispatches notifications at the **Incident** level rather than generating individual alerts for every raw breach. When multiple alerts attach to the same incident, they are summarized into a unified message.

### Event Types
1. **`FIRING`**: Dispatched when an incident transitions to `OPEN` or newly firing alerts attach.
2. **`RECOVERY`**: Dispatched when all correlated alerts recover and the incident resolves (`notifyOnRecovery = true`).
3. **`REPEAT`**: Optional recurring reminder dispatched at `repeatInterval` for unresolved active incidents.
4. **`TEST`**: Safe dry-run test triggered directly from the Contact Points management UI.

### Deterministic Deduplication Keys
To guarantee concurrency safety across distributed workers, Sentinel computes deterministic deduplication keys:
- FIRING: `inc_${incidentId}_pol_${policyId}_cp_${contactPointId}_FIRING`
- RECOVERY: `inc_${incidentId}_pol_${policyId}_cp_${contactPointId}_RECOVERY`
- REPEAT: `inc_${incidentId}_pol_${policyId}_cp_${contactPointId}_REPEAT_${bucket}`

Database unique constraints and PostgreSQL transaction advisory locks (`SELECT pg_advisory_xact_lock(hashtext(key))`) prevent duplicate delivery creation even under high concurrency.

---

## 4. BullMQ Background Worker & Retries

Notification deliveries run asynchronously via the `notification-delivery-queue` in BullMQ.

### Retry Backoff Schedule
Failed deliveries (e.g. target webhook 5xx, 429 rate limit, or socket timeout) are retried with exponential/staged backoff:
- **Attempt 1**: Immediate
- **Attempt 2**: 30 seconds
- **Attempt 3**: 2 minutes (120s)
- **Attempt 4**: 10 minutes (600s)

Non-retryable errors (e.g. HTTP 400 Bad Request, invalid URL) fail immediately without wasteful retries. Error messages are sanitized to strip any tokens or passwords before writing to `NotificationDelivery.errorMessage`.

---

## 5. Maintenance Silences

Sentinel supports **Notification Silences** (`NotificationSilence`):
- Suppresses notification delivery for matching labels during a scheduled maintenance window (`startsAt <= now <= endsAt`).
- Alert evaluation and incident tracking continue normally in the background; only notification dispatch is suppressed.

---

## 6. Environment Configuration

| Variable | Description | Default |
| :--- | :--- | :--- |
| `NOTIFICATION_ENCRYPTION_KEY` | 32-byte master key for AES-256-GCM secret encryption | Auto-derived |
| `REDIS_HOST` | Redis host for BullMQ queues | `localhost` |
| `REDIS_PORT` | Redis port | `6380` |
| `ALLOW_PRIVATE_NETWORK_WEBHOOKS` | Set `true` to allow private IP webhooks in dev/test | `false` |
| `SMTP_HOST` | SMTP server for real email delivery | (Logs to stdout in dev) |

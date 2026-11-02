# Phase 13: Internal Grafana Architecture & Security Specification

## 1. Architectural Overview

In API Sentinel, **Grafana is strictly internal infrastructure**, not the customer-facing product. 

- Customers interact **exclusively** with API Sentinel's native React web application.
- Customer dashboards, widgets, and reports are rendered natively in React via backend APIs.
- Grafana operates inside an isolated, private Docker network alongside Prometheus and PostgreSQL.

```mermaid
graph TD
    User([Customer Browser]) -->|HTTPS| Frontend[API Sentinel Frontend (React)]
    Frontend -->|HTTPS API Requests| Backend[API Sentinel Backend (NestJS)]

    subgraph Internal Isolated Network [sentinel-net (Private Docker Network)]
        Backend -->|Internal REST / Health API| Grafana[Internal Grafana Engine]
        Backend -->|Persist Results| Postgres[(PostgreSQL)]
        Backend -->|Publishes /metrics| Prometheus[(Prometheus TSDB)]
        Prometheus -->|Scrapes /metrics| Backend
        Grafana -->|Queries Metrics| Prometheus
        Grafana -->|Queries Metadata| Postgres
    end

    classDef client fill:#e1f5fe,stroke:#01579b,stroke-width:2px;
    classDef app fill:#e8f5e9,stroke:#2e7d32,stroke-width:2px;
    classDef infra fill:#fff3e0,stroke:#e65100,stroke-width:2px;

    class User,Frontend client;
    class Backend app;
    class Grafana,Prometheus,Postgres infra;
```

---

## 2. Security & Credential Isolation Rules

1. **Server-Only Credentials**:
   - `GRAFANA_URL`, `GRAFANA_ADMIN_USER`, `GRAFANA_ADMIN_PASSWORD`, and API tokens exist exclusively in the backend environment.
   - Credentials are never bundled in client code, never stored in `VITE_` frontend environment variables, and never transmitted in HTTP API responses.

2. **Zero Customer-Facing Iframes**:
   - Customer dashboards NEVER embed Grafana iframes (`/d-solo/` or `/d/`).
   - The React frontend renders charts and tables natively using telemetry provided by `CustomerDashboardService` and `ApisService`.

3. **No Direct External Exposure**:
   - In production (`docker-compose.prod.yml`), Grafana is configured with `expose: - "3000"`, which is visible only within `sentinel-net`.
   - No public ingress or load balancer routes point to Grafana.
   - Only backend containers on `sentinel-net` can communicate with Grafana's HTTP API.

---

## 3. Docker & Private Network Configuration

### Production Docker Compose (`docker-compose.prod.yml`)

```yaml
services:
  # Customer-facing backend API
  backend:
    build: ./backend
    container_name: sentinel-backend
    environment:
      - GRAFANA_URL=http://grafana:3000
      - GRAFANA_ADMIN_USER=admin
      - GRAFANA_ADMIN_PASSWORD=${GRAFANA_ADMIN_PASSWORD}
    networks:
      - sentinel-net

  # Internal Grafana - Isolated to sentinel-net (NO public ports)
  grafana:
    image: grafana/grafana:11.3.0
    container_name: sentinel-grafana-prod
    restart: always
    environment:
      - GF_SECURITY_ALLOW_EMBEDDING=false
      - GF_SECURITY_COOKIE_SECURE=true
      - GF_AUTH_ANONYMOUS_ENABLED=false
      - GF_SECURITY_ADMIN_PASSWORD=${GRAFANA_ADMIN_PASSWORD}
    expose:
      - "3000" # Internal network only, not bound to host
    volumes:
      - grafana_prod_data:/var/lib/grafana
      - ./grafana/provisioning:/etc/grafana/provisioning:ro
      - ./grafana/dashboards:/var/lib/grafana/dashboards:ro
    networks:
      - sentinel-net

  # Internal Prometheus TSDB
  prometheus:
    image: prom/prometheus:v2.51.0
    container_name: sentinel-prometheus-prod
    expose:
      - "9090" # Internal network only
    volumes:
      - ./prometheus/prometheus.yml:/etc/prometheus/prometheus.yml:ro
      - prometheus_prod_data:/prometheus
    networks:
      - sentinel-net

networks:
  sentinel-net:
    driver: bridge
```

---

## 4. Internal Uses of Grafana

Grafana is leveraged internally by operations and backend services for:

1. **Engineering Observability Dashboards**:
   - Internal dashboard `sentinel-internal-engineering.json` tracks monitoring probe throughput, P95 latencies, error types, and system resources.
2. **Advanced Analytics**:
   - Internal data exploration across long-term Prometheus TSDB retention data.
3. **Infrastructure Monitoring**:
   - Tracking Node.js process CPU, memory usage, event loop lag, and connection pools.
4. **Alert Evaluation**:
   - Backend alert rules synchronized via Grafana Provisioning API (`/api/v1/provisioning/alert-rules`).

---

## 5. Backend Health Check API

The backend exposes an authenticated health check endpoint:

```http
GET /api/v1/grafana/health
Authorization: Bearer <jwt-token>
```

**Response Format (Credentials Excluded)**:
```json
{
  "status": "healthy",
  "connected": true,
  "latencyMs": 14,
  "version": "11.3.0",
  "database": "ok",
  "checkedAt": "2026-11-01T15:50:00.000Z"
}
```
If Grafana is restarting or unreachable:
```json
{
  "status": "down",
  "connected": false,
  "latencyMs": 4002,
  "error": "Connection timed out (4000ms)",
  "checkedAt": "2026-11-01T15:50:00.000Z"
}
```

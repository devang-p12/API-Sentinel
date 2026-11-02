# 🛡️ API Sentinel

> **Next-Generation API Observability, Automated Health Probing, Incident Management & Distributed Load Testing Platform.**

API Sentinel is an enterprise-grade API monitoring and reliability platform built for engineering teams. It continuously tracks API endpoints across multiple environments, detects regressions in real-time, alerts on latency degradation and schema deviations, executes distributed load tests, and provides an interactive API playground.

---

## 📑 Table of Contents

- [Architecture Overview](#-architecture-overview)
- [Key Features](#-key-features)
- [Tech Stack](#-tech-stack)
- [Prerequisites](#-prerequisites)
- [Quick Start: Run Locally](#-quick-start-run-locally)
  - [1. Start Infrastructure via Docker](#1-start-infrastructure-via-docker)
  - [2. Configure & Start Backend](#2-configure--start-backend)
  - [3. Configure & Start Frontend](#3-configure--start-frontend)
  - [4. (Optional) Start Demo Target API](#4-optional-start-demo-target-api)
- [Default Ports & Access URLs](#-default-ports--access-urls)
- [Environment Variables Guide](#-environment-variables-guide)
- [Running Test Suites](#-running-test-suites)
- [Project Directory Structure](#-project-directory-structure)
- [Troubleshooting & FAQs](#-troubleshooting--faqs)

---

## 🏛 Architecture Overview

API Sentinel uses an asynchronous, queue-driven architecture:

```text
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│ React 19 Client │ <---> │  NestJS Backend │ <---> │  PostgreSQL 16  │
│  (Vite + TS)    │ :5174 │  REST API :3001 │ :5433 │  (Prisma ORM)   │
└─────────────────┘       └────────┬────────┘       └─────────────────┘
                                   │
                           ┌───────┴───────┐
                           │  Redis Queue  │ :6380
                           │   (BullMQ)    │
                           └───────┬───────┘
                                   │
              ┌────────────────────┼────────────────────┐
              ▼                    ▼                    ▼
     ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
     │ Monitor Worker  │  │ Alert Worker    │  │ LoadTest Worker │
     │ (Probes APIs)   │  │ (Evaluates SLA) │  │ (k6 Executions) │
     └────────┬────────┘  └────────┬────────┘  └─────────────────┘
              │                    │
              ▼                    ▼
     ┌─────────────────┐  ┌─────────────────┐
     │  Target APIs    │  │ Notifications   │
     │ (GET..OPTIONS)  │  │ (Mailpit/Resend)│
     └─────────────────┘  └─────────────────┘
```

---

## ✨ Key Features

- **Full-Spectrum HTTP Probing**: Monitor endpoints with **any** standard HTTP method (`GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `HEAD`, `OPTIONS`), custom headers, query parameters, timeouts, and body payloads.
- **Asynchronous Scheduling & BullMQ Workers**: Scalable queue-based execution decoupling probe triggers from network delays.
- **Telemetry & Percentile Analytics**: Calculates real-time latency percentiles (`p50`, `p90`, `p95`, `p99`), uptime ratios, and payload distributions.
- **Automated Incident Lifecycle**: Detects outages, tracks consecutive failure rules, opens incidents automatically, and resolves them when endpoints recover.
- **Multi-Channel Notifications**:
  - **Local Development**: Built-in Mailpit server intercepts all emails with a web preview.
  - **Production Ready**: Supports Resend (HTTP API) and direct SMTP / Gmail with app passwords.
  - **Webhooks**: Sign payloads with HMAC-SHA256 for external integrations.
- **Distributed Load Testing**: Built-in k6 integration for simulating high-concurrency traffic and generating detailed latency profiles.
- **Interactive API Playground**: In-browser API client for instant test requests and debugging.

---

## 🛠 Tech Stack

| Component | Technologies |
| :--- | :--- |
| **Backend** | NestJS 10, TypeScript, Prisma ORM, BullMQ, Express, RxJS, Nodemailer, Resend SDK |
| **Frontend** | React 19, Vite 8, TypeScript, TailwindCSS v4, shadcn/ui, HugeIcons, Base UI |
| **Database & Cache** | PostgreSQL 16 (isolated port `5433`), Redis 7 (isolated port `6380`) |
| **Email Sandbox** | Mailpit (SMTP `1025`, Web UI `8025`) |
| **Load Engine** | k6 (Grafana) |

---

## 📋 Prerequisites

Before running locally, ensure you have installed:

- **Node.js**: `v20.x` or `v24.x` (LTS recommended)
- **Docker & Docker Compose**: For PostgreSQL, Redis, and Mailpit
- **pnpm** (or `npm`): For frontend dependencies (`npm install -g pnpm`)
- *(Optional)* **k6**: Required only if executing local load tests ([k6 Installation Guide](https://k6.io/docs/get-started/installation/))

---

## 🚀 Quick Start: Run Locally

### 1. Start Infrastructure via Docker

Start PostgreSQL, Redis, and Mailpit containers in detached mode:

```bash
docker compose up -d
```

Verify containers are healthy:
```bash
docker compose ps
```

---

### 2. Configure & Start Backend

Navigate to the `backend/` directory:

```bash
cd backend
```

Create your local environment file:

```bash
cp .env.example .env
```

Install dependencies:

```bash
npm install
```

Generate Prisma client and push/deploy database schema:

```bash
npx prisma generate
npx prisma db push
```

Start the backend development server:

```bash
npm run start:dev
```

The backend is now live at **`http://localhost:3001`** (API prefix: `/api/v1`).

---

### 3. Configure & Start Frontend

Open a new terminal tab and navigate to `frontend/`:

```bash
cd frontend
```

Install dependencies:

```bash
pnpm install
# or: npm install
```

Start the Vite development server:

```bash
pnpm dev
# or: npm run dev
```

The frontend is now accessible at **`http://localhost:5174`** with automatic API proxying to `http://localhost:3001`.

---

### 4. (Optional) Start Demo Target API

API Sentinel includes a lightweight mock server with healthy, slow, failing, and schema-varying endpoints for testing:

Open a new terminal tab:

```bash
cd demo-api
node server.js
```

This mock API runs on **`http://localhost:4000`** and provides:
- `GET /healthy` — 200 OK
- `GET /slow?delay=1500` — Simulated latency
- `GET /error` — 500 Internal Server Error
- `GET /schema-change?v=1|2` — Schema evolution validation

---

## 🌐 Default Ports & Access URLs

| Service | Address | Description |
| :--- | :--- | :--- |
| **Frontend Web App** | [http://localhost:5174](http://localhost:5174) | Sentinel Dashboard & UI |
| **Backend REST API** | [http://localhost:3001/api/v1](http://localhost:3001/api/v1) | NestJS API Server |
| **Grafana Studio & Metrics** | [http://localhost:3002](http://localhost:3002) | Observability dashboards & SQL metrics |
| **PostgreSQL Database** | `localhost:5433` | Database (`sentinel_db`, user: `sentinel`) |
| **Redis Queue** | `localhost:6380` | BullMQ worker broker |
| **Mailpit Web UI** | [http://localhost:8025](http://localhost:8025) | View test alert emails locally |
| **Mailpit SMTP** | `localhost:1025` | Local SMTP capture server |
| **Demo Target API** | [http://localhost:4000](http://localhost:4000) | Mock API for testing probes |

> **Note on Port Isolation**: PostgreSQL uses port **`5433`** and Redis uses port **`6380`** so Sentinel will never conflict with any existing system-wide Postgres (5432) or Redis (6379) services you have installed.

---

## ⚙️ Environment Variables Guide

The backend `.env` file supports the following configurations:

```env
# Database
DATABASE_URL="postgresql://sentinel:sentinel_password@localhost:5433/sentinel_db?schema=public"

# Redis
REDIS_HOST="localhost"
REDIS_PORT=6380

# Server
PORT=3001

# Worker Concurrency
MONITOR_WORKER_CONCURRENCY=10
ALERT_WORKER_CONCURRENCY=5

# Email Delivery (Local Sandbox via Mailpit)
EMAIL_PROVIDER="smtp"
EMAIL_HOST="localhost"
EMAIL_PORT=1025
EMAIL_SECURE=false
EMAIL_FROM="sentinel@localhost"

# Email Delivery (Alternative: Production via Resend)
# EMAIL_PROVIDER="resend"
# RESEND_API_KEY="re_xxxxxxxxxxxx"
# EMAIL_FROM="onboarding@resend.dev"

# Email Delivery (Alternative: Production via Gmail SMTP)
# EMAIL_PROVIDER="smtp"
# EMAIL_HOST="smtp.gmail.com"
# EMAIL_PORT=587
# EMAIL_USER="your-email@gmail.com"
# EMAIL_PASSWORD="your-google-app-password"
# EMAIL_FROM="your-email@gmail.com"

# API Tester Security
API_TEST_MAX_TIMEOUT_MS=30000
API_TEST_MAX_RESPONSE_SIZE=10485760
API_TESTER_ALLOW_PRIVATE_IPS=true

# Load Testing Limits (k6)
LOAD_TEST_MAX_VUS=500
LOAD_TEST_MAX_DURATION=3600
LOAD_TEST_MAX_REQUESTS=1000000
LOAD_TEST_WORKER_CONCURRENCY=2
```

---

## 🧪 Running Test Suites

You can execute end-to-end verification and integration test suites directly from the project root:

```bash
# Run full vertical slice verification (projects, APIs, monitors, executions)
npm run test:verify

# Run complete demo flow (healthy, slow, error, schema drift, recovery)
npm run test:demo

# Run monitor execution and scheduler tests
npm run test:monitors

# Run percentile metrics aggregation tests
npm run test:metrics

# Run alert rules and evaluation tests
npm run test:alerts

# Run incident lifecycle and resolution tests
npm run test:incidents
```

---

## 📁 Project Directory Structure

```text
SentinelProject/
├── backend/                   # NestJS Backend Application
│   ├── prisma/                # Database schema & migrations
│   ├── src/
│   │   ├── alert-rules/       # Alerting evaluation & rules worker
│   │   ├── api-tester/        # Interactive API execution & playground
│   │   ├── apis/              # Registered APIs & endpoints
│   │   ├── environments/      # Environment targets (dev, staging, prod)
│   │   ├── incidents/         # Incident detection & lifecycle
│   │   ├── load-tests/        # k6 load testing execution & workers
│   │   ├── metrics/           # Telemetry, aggregation & percentiles
│   │   ├── monitors/          # Probing workers & scheduler
│   │   ├── notifications/     # Email (SMTP, Resend) & Webhooks
│   │   ├── projects/          # Workspace & project management
│   │   └── queue/             # BullMQ Redis configuration
│   └── package.json
├── frontend/                  # React 19 + Vite Frontend Application
│   ├── src/
│   │   ├── components/        # UI components & charts
│   │   ├── hooks/             # Custom state hooks
│   │   └── pages/             # Dashboard, Monitors, Alerts, Load Testing
│   └── package.json
├── demo-api/                  # Standalone mock API server for probe testing
│   └── server.js
├── docker-compose.yml         # Local Docker infrastructure (Postgres, Redis, Mailpit)
├── test-verification.js       # End-to-end automated verification script
├── package.json               # Root monorepo script runner
└── README.md                  # Project documentation
```

---

## ❓ Troubleshooting & FAQs

### Port Already In Use
- **Postgres (5433) or Redis (6380)**: Run `docker compose ps` to verify container status. If needed, restart with `docker compose down && docker compose up -d`.
- **Frontend (5174)**: If port 5174 is busy, Vite will automatically select the next available port (e.g., 5175). Check your terminal output.
- **Backend (3001)**: Check if another instance is running via `lsof -i :3001` or change `PORT=3002` in `backend/.env`.

### Prisma Schema Changes
If you modify `backend/prisma/schema.prisma`:
```bash
cd backend
npx prisma generate
npx prisma db push
```

### Viewing Emails Locally
When `EMAIL_PROVIDER="smtp"` with `EMAIL_HOST="localhost"` and `EMAIL_PORT=1025`, all notification and alert emails are captured locally. Open **[http://localhost:8025](http://localhost:8025)** in your browser to view them in the Mailpit inbox without needing any real email credentials.

---

## 📄 License

This project is licensed under the UNLICENSED / Private license.

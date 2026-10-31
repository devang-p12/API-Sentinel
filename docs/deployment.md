# API Sentinel — Production Deployment Guide

This guide details how to deploy API Sentinel to production on any cloud virtual machine (AWS EC2, DigitalOcean Droplet, Hetzner, GCP Compute Engine, Ubuntu VPS) or managed container platform.

---

## Architecture Overview

```
                         Internet (HTTPS / Port 80, 443)
                                      │
                                      ▼
                      ┌───────────────────────────────┐
                      │    Nginx (Frontend Container) │
                      │  - Serves React Vite SPA      │
                      │  - Proxies /api/ to Backend   │
                      └───────────────┬───────────────┘
                                      │ (internal net)
                                      ▼
                      ┌───────────────────────────────┐
                      │  NestJS (Backend Container)   │
                      │  - REST API & Auth            │
                      │  - BullMQ Background Workers  │
                      │  - k6 Load Testing Engine     │
                      └───────┬───────────────┬───────┘
                              │               │
                              ▼               ▼
                    ┌──────────────────┐ ┌──────────────────┐
                    │ PostgreSQL 16    │ │ Redis 7          │
                    │ (Persistent Data)│ │ (BullMQ Queues)  │
                    └──────────────────┘ └──────────────────┘
```

---

## Method 1: All-In-One Docker Compose (Recommended)

This method packages PostgreSQL, Redis, NestJS Backend (with k6), and Nginx Frontend into a single orchestrated network with persistent volumes and healthchecks.

### Step 1: Clone Repository & Prepare Environment

```bash
git clone <your-repo-url> api-sentinel
cd api-sentinel

# Copy the production environment template
cp .env.production.example .env.production
```

### Step 2: Configure Environment Variables

Edit `.env.production` with your production values:

```ini
# PostgreSQL
POSTGRES_USER=sentinel
POSTGRES_PASSWORD=your_strong_secret_password_here
POSTGRES_DB=sentinel_db

# Email Notification Configuration (Gmail SMTP)
EMAIL_PROVIDER=smtp
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your_email@gmail.com
EMAIL_PASSWORD=your_16_digit_app_password
EMAIL_FROM=your_email@gmail.com

# Exposed HTTP Port (default 80)
SENTINEL_PORT=80

# Load Testing Configuration (k6 Engine Limits)
LOAD_TEST_MAX_VUS=500
LOAD_TEST_MAX_DURATION=3600
LOAD_TEST_MAX_REQUESTS=1000000
LOAD_TEST_WORKER_CONCURRENCY=2

# API Testing Configuration
API_TEST_MAX_TIMEOUT_MS=30000
API_TEST_MAX_RESPONSE_SIZE=10485760
API_TESTER_ALLOW_PRIVATE_IPS=true
```

### Step 3: Launch Containers

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build
```

### Step 4: Verify Deployment

Check running containers:
```bash
docker compose -f docker-compose.prod.yml ps
```

Check backend startup logs:
```bash
docker logs -f sentinel-backend
```

Open your browser at `http://<your-server-ip>` or `http://<your-domain>`.

---

## Method 2: Adding SSL / HTTPS (Let's Encrypt / Certbot)

To secure your deployment with free SSL certificates from Let's Encrypt:

1. Install Certbot on your host VPS:
   ```bash
   sudo apt update
   sudo apt install -y certbot
   ```

2. Point your domain DNS `A` record (e.g., `sentinel.example.com`) to your server's public IP.

3. Obtain certificate:
   ```bash
   sudo certbot certonly --standalone -d sentinel.example.com
   ```

4. Or put **Cloudflare** in front of your domain with "Full (Strict)" SSL mode and proxy traffic directly to port 80/443.

---

## Method 3: Cloud PaaS (Railway / Render / Fly.io)

If you prefer managed cloud platforms:

1. **Database & Cache**:
   - Provision a PostgreSQL database (e.g., Neon, Supabase, or Railway PostgreSQL).
   - Provision a Redis instance (e.g., Upstash Redis or Railway Redis).

2. **Backend**:
   - Deploy `backend/` using `backend/Dockerfile` (to ensure the `k6` load-testing binary is included).
   - Set environment variables: `DATABASE_URL`, `REDIS_HOST`, `REDIS_PORT`, `EMAIL_USER`, `EMAIL_PASSWORD`, `K6_BIN_PATH=/usr/local/bin/k6`.

3. **Frontend**:
   - Deploy `frontend/` as a static site or container.
   - Point API proxy or `API_BASE` to your backend URL.

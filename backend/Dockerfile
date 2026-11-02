# ==============================================================================
# Multi-stage Dockerfile for API Sentinel Backend (NestJS + Prisma + k6 Engine)
# ==============================================================================

# Stage 1: Build NestJS application and generate Prisma client
FROM node:20-bookworm-slim AS builder

WORKDIR /app

# Install native dependencies required by Prisma engine
RUN apt-get update && apt-get install -y --no-install-recommends \
    openssl \
    ca-certificates \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci
RUN npx prisma generate

COPY tsconfig*.json nest-cli.json ./
COPY src ./src/

RUN npm run build

# Stage 2: Production runtime image with k6 binary
FROM node:20-bookworm-slim AS runner

WORKDIR /app

# Install native dependencies and official k6 binary for load testing engine
RUN apt-get update && apt-get install -y --no-install-recommends \
    openssl \
    ca-certificates \
    curl \
    tar \
    && curl -L https://github.com/grafana/k6/releases/download/v0.54.0/k6-v0.54.0-linux-amd64.tar.gz | tar -xz -C /tmp \
    && mv /tmp/k6-v0.54.0-linux-amd64/k6 /usr/local/bin/k6 \
    && chmod +x /usr/local/bin/k6 \
    && rm -rf /tmp/k6-v0.54.0-linux-amd64 \
    && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV K6_BIN_PATH=/usr/local/bin/k6

COPY package*.json ./
COPY prisma ./prisma/

# Install only production dependencies and prisma CLI for database migration/push
RUN npm ci --omit=dev && npm install prisma@^5.14.0 && npx prisma generate

# Copy compiled NestJS application from builder
COPY --from=builder /app/dist ./dist

EXPOSE 3000

# Start NestJS with schema auto-push to ensure all SaaS tables exist in remote PostgreSQL
CMD ["sh", "-c", "npx prisma db push --skip-generate --accept-data-loss && node dist/main"]


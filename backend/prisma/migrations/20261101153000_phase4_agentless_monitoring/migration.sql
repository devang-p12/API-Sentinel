-- ==============================================================================
-- Migration: 20261101153000_phase4_agentless_monitoring
-- Phase 4: Agentless API Monitoring (MonitorConfig & MonitorResult)
-- ==============================================================================

-- 1. Add api_id to monitors table
ALTER TABLE "monitors" ADD COLUMN IF NOT EXISTS "api_id" TEXT;

-- Backfill api_id from environment
UPDATE "monitors" m
SET "api_id" = e."api_id"
FROM "environments" e
WHERE m."environment_id" = e."id" AND m."api_id" IS NULL;

-- Add foreign key constraint and index
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'monitors_api_id_fkey') THEN
    ALTER TABLE "monitors" ADD CONSTRAINT "monitors_api_id_fkey" FOREIGN KEY ("api_id") REFERENCES "apis"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS "monitors_api_id_idx" ON "monitors"("api_id");

-- 2. Create monitor_configs table
CREATE TABLE IF NOT EXISTS "monitor_configs" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "organization_id" TEXT NOT NULL,
  "api_id" TEXT NOT NULL,
  "environment_id" TEXT NOT NULL,
  "method" "HttpMethod" NOT NULL DEFAULT 'GET',
  "url" TEXT NOT NULL,
  "headers" JSONB DEFAULT '{}',
  "body" TEXT,
  "query_params" JSONB DEFAULT '{}',
  "interval" INTEGER NOT NULL DEFAULT 60,
  "timeout" INTEGER NOT NULL DEFAULT 10000,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "expected_status" INTEGER NOT NULL DEFAULT 200,
  "expected_response" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "monitor_configs_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "monitor_configs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "monitor_configs_api_id_fkey" FOREIGN KEY ("api_id") REFERENCES "apis"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "monitor_configs_environment_id_fkey" FOREIGN KEY ("environment_id") REFERENCES "environments"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "monitor_configs_organization_id_idx" ON "monitor_configs"("organization_id");
CREATE INDEX IF NOT EXISTS "monitor_configs_api_id_idx" ON "monitor_configs"("api_id");
CREATE INDEX IF NOT EXISTS "monitor_configs_environment_id_idx" ON "monitor_configs"("environment_id");
CREATE INDEX IF NOT EXISTS "monitor_configs_enabled_idx" ON "monitor_configs"("enabled");

-- 3. Create monitor_results table
CREATE TABLE IF NOT EXISTS "monitor_results" (
  "id" TEXT NOT NULL,
  "monitor_config_id" TEXT,
  "organization_id" TEXT NOT NULL,
  "api_id" TEXT NOT NULL,
  "environment_id" TEXT NOT NULL,
  "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "status_code" INTEGER,
  "latency_ms" INTEGER NOT NULL,
  "success" BOOLEAN NOT NULL,
  "timeout" BOOLEAN NOT NULL DEFAULT false,
  "error_type" TEXT,
  "response_size" INTEGER,
  "schema_valid" BOOLEAN,
  "error_message" TEXT,
  "response_headers" JSONB,

  CONSTRAINT "monitor_results_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "monitor_results_monitor_config_id_fkey" FOREIGN KEY ("monitor_config_id") REFERENCES "monitor_configs"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "monitor_results_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "monitor_results_api_id_fkey" FOREIGN KEY ("api_id") REFERENCES "apis"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "monitor_results_environment_id_fkey" FOREIGN KEY ("environment_id") REFERENCES "environments"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "monitor_results_organization_id_idx" ON "monitor_results"("organization_id");
CREATE INDEX IF NOT EXISTS "monitor_results_api_id_idx" ON "monitor_results"("api_id");
CREATE INDEX IF NOT EXISTS "monitor_results_environment_id_idx" ON "monitor_results"("environment_id");
CREATE INDEX IF NOT EXISTS "monitor_results_monitor_config_id_timestamp_idx" ON "monitor_results"("monitor_config_id", "timestamp" DESC);
CREATE INDEX IF NOT EXISTS "monitor_results_timestamp_idx" ON "monitor_results"("timestamp" DESC);

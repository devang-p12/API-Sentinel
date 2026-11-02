-- ==============================================================================
-- Migration: 20261101141500_phase2_saas_api_and_environment_model
-- Phase 2 SaaS Refactor: Enhanced API & Environment Model with EnvironmentType
-- ==============================================================================

-- 1. Create EnvironmentType Enum
CREATE TYPE "EnvironmentType" AS ENUM ('DEVELOPMENT', 'UAT', 'STAGING', 'PRODUCTION', 'CUSTOM');

-- 2. Add service column to apis
ALTER TABLE "apis" ADD COLUMN "service" TEXT;

-- 3. Make project_id nullable on apis and drop unique constraint on (project_id, name)
ALTER TABLE "apis" DROP CONSTRAINT IF EXISTS "apis_project_id_name_key";
DROP INDEX IF EXISTS "apis_project_id_name_key";
ALTER TABLE "apis" ALTER COLUMN "project_id" DROP NOT NULL;

-- 4. Backfill service column with sanitized slugified identifier from name
UPDATE "apis"
SET "service" = lower(regexp_replace("name", '[^a-zA-Z0-9]+', '-', 'g'))
WHERE "service" IS NULL;

-- 5. Add type column to environments
ALTER TABLE "environments" ADD COLUMN "type" "EnvironmentType" NOT NULL DEFAULT 'DEVELOPMENT';

-- 6. Backfill type based on environment naming heuristics
UPDATE "environments"
SET "type" = CASE
  WHEN lower("name") LIKE '%prod%' THEN 'PRODUCTION'::"EnvironmentType"
  WHEN lower("name") LIKE '%stag%' THEN 'STAGING'::"EnvironmentType"
  WHEN lower("name") LIKE '%uat%' THEN 'UAT'::"EnvironmentType"
  WHEN lower("name") LIKE '%dev%' THEN 'DEVELOPMENT'::"EnvironmentType"
  ELSE 'CUSTOM'::"EnvironmentType"
END;

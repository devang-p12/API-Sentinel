-- ==============================================================================
-- Migration: 20261101133000_multitenant_organization_architecture
-- Phase 1 SaaS Multi-tenant Refactor: Membership model & Organization Scoping
-- ==============================================================================

-- 1. Create memberships table
CREATE TABLE "memberships" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'MEMBER',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "memberships_pkey" PRIMARY KEY ("id")
);

-- Unique index to prevent duplicate user membership in the same organization
CREATE UNIQUE INDEX "memberships_user_id_organization_id_key" ON "memberships"("user_id", "organization_id");
CREATE INDEX "memberships_user_id_idx" ON "memberships"("user_id");
CREATE INDEX "memberships_organization_id_idx" ON "memberships"("organization_id");

-- Add foreign key constraints for memberships
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 2. Safely backfill existing users into memberships
INSERT INTO "memberships" ("id", "user_id", "organization_id", "role", "created_at", "updated_at")
SELECT gen_random_uuid()::text, "id", "organization_id", "role", "created_at", "updated_at"
FROM "users"
ON CONFLICT ("user_id", "organization_id") DO NOTHING;

-- 3. Add organization_id column to organization-scoped tables (initially nullable for backfilling)
ALTER TABLE "apis" ADD COLUMN "organization_id" TEXT;
ALTER TABLE "environments" ADD COLUMN "organization_id" TEXT;
ALTER TABLE "monitors" ADD COLUMN "organization_id" TEXT;
ALTER TABLE "alert_rules" ADD COLUMN "organization_id" TEXT;
ALTER TABLE "incidents" ADD COLUMN "organization_id" TEXT;
ALTER TABLE "dashboards" ADD COLUMN "organization_id" TEXT;
ALTER TABLE "load_tests" ADD COLUMN "organization_id" TEXT;
ALTER TABLE "api_collections" ADD COLUMN "organization_id" TEXT;
ALTER TABLE "saved_api_requests" ADD COLUMN "organization_id" TEXT;
ALTER TABLE "api_request_histories" ADD COLUMN "organization_id" TEXT;

-- 4. Backfill organization_id from related parent hierarchies
-- Backfill apis from projects
UPDATE "apis" SET "organization_id" = p."organization_id"
FROM "projects" p WHERE "apis"."project_id" = p."id";

-- Backfill environments from apis
UPDATE "environments" SET "organization_id" = a."organization_id"
FROM "apis" a WHERE "environments"."api_id" = a."id";

-- Backfill monitors from environments
UPDATE "monitors" SET "organization_id" = e."organization_id"
FROM "environments" e WHERE "monitors"."environment_id" = e."id";

-- Backfill alert_rules from projects
UPDATE "alert_rules" SET "organization_id" = p."organization_id"
FROM "projects" p WHERE "alert_rules"."project_id" = p."id";

-- Backfill incidents from projects
UPDATE "incidents" SET "organization_id" = p."organization_id"
FROM "projects" p WHERE "incidents"."project_id" = p."id";

-- Backfill dashboards from projects
UPDATE "dashboards" SET "organization_id" = p."organization_id"
FROM "projects" p WHERE "dashboards"."project_id" = p."id";

-- Backfill load_tests from projects
UPDATE "load_tests" SET "organization_id" = p."organization_id"
FROM "projects" p WHERE "load_tests"."project_id" = p."id";

-- Backfill api_collections from projects
UPDATE "api_collections" SET "organization_id" = p."organization_id"
FROM "projects" p WHERE "api_collections"."project_id" = p."id";

-- Backfill saved_api_requests from projects
UPDATE "saved_api_requests" SET "organization_id" = p."organization_id"
FROM "projects" p WHERE "saved_api_requests"."project_id" = p."id";

-- Backfill api_request_histories from projects
UPDATE "api_request_histories" SET "organization_id" = p."organization_id"
FROM "projects" p WHERE "api_request_histories"."project_id" = p."id";

-- Fallback for any orphaned rows using the first available organization
DO $$
DECLARE
    default_org_id TEXT;
BEGIN
    SELECT "id" INTO default_org_id FROM "organizations" LIMIT 1;
    IF default_org_id IS NOT NULL THEN
        UPDATE "apis" SET "organization_id" = default_org_id WHERE "organization_id" IS NULL;
        UPDATE "environments" SET "organization_id" = default_org_id WHERE "organization_id" IS NULL;
        UPDATE "monitors" SET "organization_id" = default_org_id WHERE "organization_id" IS NULL;
        UPDATE "alert_rules" SET "organization_id" = default_org_id WHERE "organization_id" IS NULL;
        UPDATE "incidents" SET "organization_id" = default_org_id WHERE "organization_id" IS NULL;
        UPDATE "dashboards" SET "organization_id" = default_org_id WHERE "organization_id" IS NULL;
        UPDATE "load_tests" SET "organization_id" = default_org_id WHERE "organization_id" IS NULL;
        UPDATE "api_collections" SET "organization_id" = default_org_id WHERE "organization_id" IS NULL;
        UPDATE "saved_api_requests" SET "organization_id" = default_org_id WHERE "organization_id" IS NULL;
    END IF;
END $$;

-- 5. Enforce NOT NULL constraints where appropriate and add foreign keys & indices
ALTER TABLE "apis" ALTER COLUMN "organization_id" SET NOT NULL;
ALTER TABLE "apis" ADD CONSTRAINT "apis_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "apis_organization_id_idx" ON "apis"("organization_id");

ALTER TABLE "environments" ALTER COLUMN "organization_id" SET NOT NULL;
ALTER TABLE "environments" ADD CONSTRAINT "environments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "environments_organization_id_idx" ON "environments"("organization_id");

ALTER TABLE "monitors" ALTER COLUMN "organization_id" SET NOT NULL;
ALTER TABLE "monitors" ADD CONSTRAINT "monitors_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "monitors_organization_id_idx" ON "monitors"("organization_id");

ALTER TABLE "alert_rules" ALTER COLUMN "organization_id" SET NOT NULL;
ALTER TABLE "alert_rules" ADD CONSTRAINT "alert_rules_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "alert_rules_organization_id_idx" ON "alert_rules"("organization_id");

ALTER TABLE "incidents" ALTER COLUMN "organization_id" SET NOT NULL;
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "incidents_organization_id_idx" ON "incidents"("organization_id");

ALTER TABLE "dashboards" ALTER COLUMN "organization_id" SET NOT NULL;
ALTER TABLE "dashboards" ADD CONSTRAINT "dashboards_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "dashboards_organization_id_idx" ON "dashboards"("organization_id");

ALTER TABLE "load_tests" ALTER COLUMN "organization_id" SET NOT NULL;
ALTER TABLE "load_tests" ADD CONSTRAINT "load_tests_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "load_tests_organization_id_idx" ON "load_tests"("organization_id");

ALTER TABLE "api_collections" ALTER COLUMN "organization_id" SET NOT NULL;
ALTER TABLE "api_collections" ADD CONSTRAINT "api_collections_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "api_collections_organization_id_idx" ON "api_collections"("organization_id");

ALTER TABLE "saved_api_requests" ALTER COLUMN "organization_id" SET NOT NULL;
ALTER TABLE "saved_api_requests" ADD CONSTRAINT "saved_api_requests_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "saved_api_requests_organization_id_idx" ON "saved_api_requests"("organization_id");

ALTER TABLE "api_request_histories" ADD CONSTRAINT "api_request_histories_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "api_request_histories_organization_id_idx" ON "api_request_histories"("organization_id");

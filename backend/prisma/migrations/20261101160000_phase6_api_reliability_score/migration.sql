-- ==============================================================================
-- Migration: 20261101160000_phase6_api_reliability_score
-- Phase 6: API Reliability Score & Historical Trend Persistence
-- ==============================================================================

CREATE TABLE IF NOT EXISTS "reliability_score_records" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "api_id" TEXT NOT NULL,
  "environment_id" TEXT,
  "score" DOUBLE PRECISION NOT NULL,
  "availability_score" DOUBLE PRECISION NOT NULL,
  "latency_score" DOUBLE PRECISION NOT NULL,
  "error_score" DOUBLE PRECISION NOT NULL,
  "latency_stability_score" DOUBLE PRECISION NOT NULL,
  "schema_score" DOUBLE PRECISION NOT NULL,
  "sample_count" INTEGER NOT NULL,
  "period_start" TIMESTAMP(3),
  "period_end" TIMESTAMP(3),
  "breakdown" JSONB NOT NULL,
  "calculated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "reliability_score_records_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "reliability_score_records_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "reliability_score_records_api_id_fkey" FOREIGN KEY ("api_id") REFERENCES "apis"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "reliability_score_records_environment_id_fkey" FOREIGN KEY ("environment_id") REFERENCES "environments"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "reliability_score_records_organization_id_idx" ON "reliability_score_records"("organization_id");
CREATE INDEX IF NOT EXISTS "reliability_score_records_api_id_idx" ON "reliability_score_records"("api_id");
CREATE INDEX IF NOT EXISTS "reliability_score_records_environment_id_idx" ON "reliability_score_records"("environment_id");
CREATE INDEX IF NOT EXISTS "reliability_score_records_calculated_at_idx" ON "reliability_score_records"("calculated_at" DESC);

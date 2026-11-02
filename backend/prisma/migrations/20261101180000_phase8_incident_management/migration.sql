-- Phase 8: Incident Management Migration

-- AlterEnum
ALTER TYPE "IncidentEventType" ADD VALUE IF NOT EXISTS 'FAILURE_RECORDED';

-- AlterTable
ALTER TABLE "incidents"
  ALTER COLUMN "project_id" DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS "reason" TEXT,
  ADD COLUMN IF NOT EXISTS "duration_ms" INTEGER,
  ADD COLUMN IF NOT EXISTS "duration_seconds" INTEGER,
  ADD COLUMN IF NOT EXISTS "monitor_config_id" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "incidents_monitor_config_id_status_idx" ON "incidents"("monitor_config_id", "status");

-- AddForeignKey
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_monitor_config_id_fkey" FOREIGN KEY ("monitor_config_id") REFERENCES "monitor_configs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable alert_rules
ALTER TABLE "alert_rules" ADD COLUMN IF NOT EXISTS "operator" TEXT;
ALTER TABLE "alert_rules" ADD COLUMN IF NOT EXISTS "notification_channels" JSONB DEFAULT '[]';
ALTER TABLE "alert_rules" ADD COLUMN IF NOT EXISTS "grafana_rule_uid" TEXT;
ALTER TABLE "alert_rules" ADD COLUMN IF NOT EXISTS "cooldown_seconds" INTEGER NOT NULL DEFAULT 300;
ALTER TABLE "alert_rules" ADD COLUMN IF NOT EXISTS "last_triggered_at" TIMESTAMP(3);

-- CreateTable alert_events
CREATE TABLE IF NOT EXISTS "alert_events" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "alert_rule_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "metric_value" DOUBLE PRECISION,
    "threshold" DOUBLE PRECISION,
    "message" TEXT NOT NULL,
    "severity" "AlertSeverity" NOT NULL DEFAULT 'WARNING',
    "fingerprint" TEXT,
    "metadata" JSONB DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alert_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "alert_rules_grafana_rule_uid_idx" ON "alert_rules"("grafana_rule_uid");
CREATE INDEX IF NOT EXISTS "alert_events_organization_id_created_at_idx" ON "alert_events"("organization_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "alert_events_alert_rule_id_created_at_idx" ON "alert_events"("alert_rule_id", "created_at" DESC);

-- AddForeignKey
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'alert_events_organization_id_fkey'
    ) THEN
        ALTER TABLE "alert_events" ADD CONSTRAINT "alert_events_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'alert_events_alert_rule_id_fkey'
    ) THEN
        ALTER TABLE "alert_events" ADD CONSTRAINT "alert_events_alert_rule_id_fkey" FOREIGN KEY ("alert_rule_id") REFERENCES "alert_rules"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

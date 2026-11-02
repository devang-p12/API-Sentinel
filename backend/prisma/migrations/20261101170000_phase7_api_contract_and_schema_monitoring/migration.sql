-- Phase 7: API Contract and Schema Monitoring Migration

-- CreateEnum
CREATE TYPE "SchemaChangeSeverity" AS ENUM ('INFO', 'WARNING', 'BREAKING');

-- CreateEnum
CREATE TYPE "SchemaChangeType" AS ENUM ('FIELD_ADDED', 'FIELD_REMOVED', 'TYPE_CHANGED', 'STRUCTURE_CHANGED', 'REQUIRED_FIELD_MISSING');

-- CreateTable
CREATE TABLE "api_schemas" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "api_id" TEXT NOT NULL,
    "environment_id" TEXT,
    "monitor_config_id" TEXT,
    "endpoint" TEXT NOT NULL,
    "method" TEXT NOT NULL DEFAULT 'GET',
    "active_baseline_version_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "api_schemas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "schema_versions" (
    "id" TEXT NOT NULL,
    "schema_id" TEXT NOT NULL,
    "version_number" INTEGER NOT NULL,
    "is_baseline" BOOLEAN NOT NULL DEFAULT false,
    "normalized_schema" JSONB NOT NULL,
    "sample_payload" JSONB,
    "checksum" TEXT,
    "created_by_user_id" TEXT,
    "approved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "schema_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "schema_changes" (
    "id" TEXT NOT NULL,
    "schema_id" TEXT NOT NULL,
    "version_id" TEXT,
    "field_path" TEXT NOT NULL,
    "change_type" "SchemaChangeType" NOT NULL,
    "severity" "SchemaChangeSeverity" NOT NULL,
    "previous_type" TEXT,
    "current_type" TEXT,
    "description" TEXT NOT NULL,
    "is_breaking" BOOLEAN NOT NULL DEFAULT false,
    "detected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "is_acknowledged" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "schema_changes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "api_schemas_organization_id_api_id_idx" ON "api_schemas"("organization_id", "api_id");

-- CreateIndex
CREATE INDEX "api_schemas_environment_id_idx" ON "api_schemas"("environment_id");

-- CreateIndex
CREATE UNIQUE INDEX "api_schemas_organization_id_api_id_environment_id_endpoint_method_key" ON "api_schemas"("organization_id", "api_id", "environment_id", "endpoint", "method");

-- CreateIndex
CREATE INDEX "schema_versions_schema_id_is_baseline_idx" ON "schema_versions"("schema_id", "is_baseline");

-- CreateIndex
CREATE UNIQUE INDEX "schema_versions_schema_id_version_number_key" ON "schema_versions"("schema_id", "version_number");

-- CreateIndex
CREATE INDEX "schema_changes_schema_id_detected_at_idx" ON "schema_changes"("schema_id", "detected_at" DESC);

-- CreateIndex
CREATE INDEX "schema_changes_schema_id_severity_idx" ON "schema_changes"("schema_id", "severity");

-- AddForeignKey
ALTER TABLE "api_schemas" ADD CONSTRAINT "api_schemas_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_schemas" ADD CONSTRAINT "api_schemas_api_id_fkey" FOREIGN KEY ("api_id") REFERENCES "apis"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_schemas" ADD CONSTRAINT "api_schemas_environment_id_fkey" FOREIGN KEY ("environment_id") REFERENCES "environments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_schemas" ADD CONSTRAINT "api_schemas_monitor_config_id_fkey" FOREIGN KEY ("monitor_config_id") REFERENCES "monitor_configs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schema_versions" ADD CONSTRAINT "schema_versions_schema_id_fkey" FOREIGN KEY ("schema_id") REFERENCES "api_schemas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schema_changes" ADD CONSTRAINT "schema_changes_schema_id_fkey" FOREIGN KEY ("schema_id") REFERENCES "api_schemas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schema_changes" ADD CONSTRAINT "schema_changes_version_id_fkey" FOREIGN KEY ("version_id") REFERENCES "schema_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

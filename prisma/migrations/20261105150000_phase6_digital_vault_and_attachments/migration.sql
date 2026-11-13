-- ==============================================================================
-- MIGRACIÓN ADITIVA FASE 6 — BÓVEDA DIGITAL Y GESTIÓN DOCUMENTAL (MOD-05)
-- Base de datos: Neon PostgreSQL Serverless
-- Módulo: Attachments & Document Vault
-- ==============================================================================

-- 1. Agregar columnas aditivas a la tabla 'attachments'
ALTER TABLE "attachments" ADD COLUMN IF NOT EXISTS "agreement_id" UUID;
ALTER TABLE "attachments" ADD COLUMN IF NOT EXISTS "minutes_id" UUID;
ALTER TABLE "attachments" ADD COLUMN IF NOT EXISTS "category" VARCHAR(50) NOT NULL DEFAULT 'GENERAL';
ALTER TABLE "attachments" ADD COLUMN IF NOT EXISTS "description" TEXT;
ALTER TABLE "attachments" ADD COLUMN IF NOT EXISTS "storage_provider" VARCHAR(50) NOT NULL DEFAULT 'S3';
ALTER TABLE "attachments" ADD COLUMN IF NOT EXISTS "bucket_name" VARCHAR(100);
ALTER TABLE "attachments" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP(3);
ALTER TABLE "attachments" ADD COLUMN IF NOT EXISTS "deleted_by_id" UUID;
ALTER TABLE "attachments" ADD COLUMN IF NOT EXISTS "is_archived" BOOLEAN NOT NULL DEFAULT false;

-- 2. Claves foráneas aditivas
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'attachments_agreement_id_fkey') THEN
        ALTER TABLE "attachments" ADD CONSTRAINT "attachments_agreement_id_fkey"
            FOREIGN KEY ("agreement_id") REFERENCES "agreements"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'attachments_minutes_id_fkey') THEN
        ALTER TABLE "attachments" ADD CONSTRAINT "attachments_minutes_id_fkey"
            FOREIGN KEY ("minutes_id") REFERENCES "meeting_minutes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'attachments_deleted_by_id_fkey') THEN
        ALTER TABLE "attachments" ADD CONSTRAINT "attachments_deleted_by_id_fkey"
            FOREIGN KEY ("deleted_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

-- 3. Índices de rendimiento
CREATE INDEX IF NOT EXISTS "attachments_agreement_id_is_deleted_idx" ON "attachments"("agreement_id", "is_deleted");
CREATE INDEX IF NOT EXISTS "attachments_minutes_id_is_deleted_idx" ON "attachments"("minutes_id", "is_deleted");
CREATE INDEX IF NOT EXISTS "attachments_uploaded_by_id_is_deleted_idx" ON "attachments"("uploaded_by_id", "is_deleted");
CREATE INDEX IF NOT EXISTS "attachments_category_is_deleted_idx" ON "attachments"("category", "is_deleted");


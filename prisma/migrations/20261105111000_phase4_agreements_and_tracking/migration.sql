-- AlterEnum: Ampliar estados del acuerdo institucional (no destructivo)
ALTER TYPE "AgreementStatus" ADD VALUE IF NOT EXISTS 'CUMPLIDO';
ALTER TYPE "AgreementStatus" ADD VALUE IF NOT EXISTS 'VENCIDO';
ALTER TYPE "AgreementStatus" ADD VALUE IF NOT EXISTS 'SUSPENDIDO';

-- CreateEnum: Prioridad de acuerdos institucionales
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AgreementPriority') THEN
        CREATE TYPE "AgreementPriority" AS ENUM ('BAJA', 'MEDIA', 'ALTA', 'URGENTE');
    END IF;
END$$;

-- AlterTable: Renombrar code a folio y agregar campos de gobernanza institucional
ALTER TABLE "agreements" RENAME COLUMN "code" TO "folio";
ALTER TABLE "agreements" ALTER COLUMN "folio" TYPE VARCHAR(60);
ALTER INDEX IF EXISTS "agreements_code_key" RENAME TO "agreements_folio_key";

ALTER TABLE "agreements"
    ADD COLUMN "agreement_type" VARCHAR(50) NOT NULL DEFAULT 'ORDINARIO',
    ADD COLUMN "category_id" UUID,
    ADD COLUMN "agenda_item_id" UUID,
    ADD COLUMN "minutes_id" UUID,
    ADD COLUMN "minutes_version_number" INTEGER,
    ADD COLUMN "approval_date" DATE NOT NULL DEFAULT CURRENT_DATE,
    ADD COLUMN "start_date" DATE,
    ADD COLUMN "priority" "AgreementPriority" NOT NULL DEFAULT 'MEDIA',
    ADD COLUMN "progress_percent" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN "observations" TEXT,
    ADD COLUMN "change_reason" TEXT,
    ADD COLUMN "created_by_id" UUID,
    ADD COLUMN "completed_by_id" UUID,
    ADD COLUMN "is_archived" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN "deleted_at" TIMESTAMP(3);

-- Default para created_by_id si existen filas previas
UPDATE "agreements" SET "created_by_id" = "assigned_user_id" WHERE "created_by_id" IS NULL;
ALTER TABLE "agreements" ALTER COLUMN "created_by_id" SET NOT NULL;

-- Índices de consulta y rendimiento en agreements
CREATE INDEX IF NOT EXISTS "agreements_category_id_idx" ON "agreements"("category_id");
CREATE INDEX IF NOT EXISTS "agreements_status_idx" ON "agreements"("status");
CREATE INDEX IF NOT EXISTS "agreements_folio_idx" ON "agreements"("folio");

-- Foreign Keys en agreements
ALTER TABLE "agreements" ADD CONSTRAINT "agreements_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "meeting_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "agreements" ADD CONSTRAINT "agreements_agenda_item_id_fkey" FOREIGN KEY ("agenda_item_id") REFERENCES "meeting_agenda_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "agreements" ADD CONSTRAINT "agreements_minutes_id_fkey" FOREIGN KEY ("minutes_id") REFERENCES "meeting_minutes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "agreements" ADD CONSTRAINT "agreements_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "agreements" ADD CONSTRAINT "agreements_completed_by_id_fkey" FOREIGN KEY ("completed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable: agreement_collaborators (colaboradores asignados al acuerdo)
CREATE TABLE IF NOT EXISTS "agreement_collaborators" (
    "id" UUID NOT NULL,
    "agreement_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assigned_by_id" UUID NOT NULL,
    "notes" VARCHAR(255),

    CONSTRAINT "agreement_collaborators_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "agreement_collaborators_agreement_id_user_id_key" ON "agreement_collaborators"("agreement_id", "user_id");
CREATE INDEX IF NOT EXISTS "agreement_collaborators_agreement_id_idx" ON "agreement_collaborators"("agreement_id");
CREATE INDEX IF NOT EXISTS "agreement_collaborators_user_id_idx" ON "agreement_collaborators"("user_id");

ALTER TABLE "agreement_collaborators" ADD CONSTRAINT "agreement_collaborators_agreement_id_fkey" FOREIGN KEY ("agreement_id") REFERENCES "agreements"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "agreement_collaborators" ADD CONSTRAINT "agreement_collaborators_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "agreement_collaborators" ADD CONSTRAINT "agreement_collaborators_assigned_by_id_fkey" FOREIGN KEY ("assigned_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable: agreement_progress (bitácora de avances acumulativos)
CREATE TABLE IF NOT EXISTS "agreement_progress" (
    "id" UUID NOT NULL,
    "agreement_id" UUID NOT NULL,
    "reported_by_id" UUID NOT NULL,
    "reported_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "previous_percent" INTEGER NOT NULL,
    "new_percent" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "observations" TEXT,
    "resulting_status" "AgreementStatus",
    "justification" TEXT,

    CONSTRAINT "agreement_progress_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "agreement_progress_agreement_id_reported_at_idx" ON "agreement_progress"("agreement_id", "reported_at");

ALTER TABLE "agreement_progress" ADD CONSTRAINT "agreement_progress_agreement_id_fkey" FOREIGN KEY ("agreement_id") REFERENCES "agreements"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "agreement_progress" ADD CONSTRAINT "agreement_progress_reported_by_id_fkey" FOREIGN KEY ("reported_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable: agreement_evidences (metadatos de evidencias documentales)
CREATE TABLE IF NOT EXISTS "agreement_evidences" (
    "id" UUID NOT NULL,
    "agreement_id" UUID NOT NULL,
    "progress_id" UUID,
    "title" VARCHAR(250) NOT NULL,
    "description" TEXT,
    "document_reference" VARCHAR(500),
    "registered_by_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agreement_evidences_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "agreement_evidences_agreement_id_idx" ON "agreement_evidences"("agreement_id");

ALTER TABLE "agreement_evidences" ADD CONSTRAINT "agreement_evidences_agreement_id_fkey" FOREIGN KEY ("agreement_id") REFERENCES "agreements"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "agreement_evidences" ADD CONSTRAINT "agreement_evidences_progress_id_fkey" FOREIGN KEY ("progress_id") REFERENCES "agreement_progress"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "agreement_evidences" ADD CONSTRAINT "agreement_evidences_registered_by_id_fkey" FOREIGN KEY ("registered_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable: agreement_history (ampliación de trazabilidad y motivos de cambio)
ALTER TABLE "agreement_history"
    ADD COLUMN "action_type" VARCHAR(50) NOT NULL DEFAULT 'STATUS_CHANGE',
    ALTER COLUMN "previous_status" DROP NOT NULL,
    ALTER COLUMN "new_status" DROP NOT NULL,
    ADD COLUMN "previous_assigned_to_id" UUID,
    ADD COLUMN "new_assigned_to_id" UUID,
    ADD COLUMN "previous_due_date" DATE,
    ADD COLUMN "new_due_date" DATE,
    ADD COLUMN "previous_percent" INTEGER,
    ADD COLUMN "new_percent" INTEGER,
    ADD COLUMN "change_reason" TEXT,
    ADD COLUMN "details" JSONB;

CREATE INDEX IF NOT EXISTS "agreement_history_changed_by_id_idx" ON "agreement_history"("changed_by_id");

ALTER TABLE "agreement_history" ADD CONSTRAINT "agreement_history_previous_assigned_to_id_fkey" FOREIGN KEY ("previous_assigned_to_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "agreement_history" ADD CONSTRAINT "agreement_history_new_assigned_to_id_fkey" FOREIGN KEY ("new_assigned_to_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;


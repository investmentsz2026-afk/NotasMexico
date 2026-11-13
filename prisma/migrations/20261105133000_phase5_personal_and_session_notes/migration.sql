-- AlterTable: personal_notes (Fase 5 - Anotaciones Personales y Notas de Sesión)
ALTER TABLE "personal_notes" ALTER COLUMN "meeting_id" DROP NOT NULL;
ALTER TABLE "personal_notes" ADD COLUMN IF NOT EXISTS "title" VARCHAR(250) NOT NULL DEFAULT 'Anotación Institucional';
ALTER TABLE "personal_notes" ADD COLUMN IF NOT EXISTS "category" VARCHAR(50) NOT NULL DEFAULT 'GENERAL';
ALTER TABLE "personal_notes" ADD COLUMN IF NOT EXISTS "note_type" VARCHAR(30) NOT NULL DEFAULT 'PERSONAL';
ALTER TABLE "personal_notes" ADD COLUMN IF NOT EXISTS "visibility" VARCHAR(30) NOT NULL DEFAULT 'PRIVADA';
ALTER TABLE "personal_notes" ADD COLUMN IF NOT EXISTS "is_favorite" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "personal_notes" ADD COLUMN IF NOT EXISTS "tags" VARCHAR(255);
ALTER TABLE "personal_notes" ADD COLUMN IF NOT EXISTS "agenda_item_id" UUID;
ALTER TABLE "personal_notes" ADD COLUMN IF NOT EXISTS "agreement_id" UUID;
ALTER TABLE "personal_notes" ADD COLUMN IF NOT EXISTS "admin_justification" TEXT;
ALTER TABLE "personal_notes" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP(3);

-- Reconfigurar llaves foráneas en personal_notes
ALTER TABLE "personal_notes" DROP CONSTRAINT IF EXISTS "personal_notes_meeting_id_fkey";
ALTER TABLE "personal_notes" ADD CONSTRAINT "personal_notes_meeting_id_fkey" FOREIGN KEY ("meeting_id") REFERENCES "meetings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "personal_notes" DROP CONSTRAINT IF EXISTS "personal_notes_agenda_item_id_fkey";
ALTER TABLE "personal_notes" ADD CONSTRAINT "personal_notes_agenda_item_id_fkey" FOREIGN KEY ("agenda_item_id") REFERENCES "meeting_agenda_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "personal_notes" DROP CONSTRAINT IF EXISTS "personal_notes_agreement_id_fkey";
ALTER TABLE "personal_notes" ADD CONSTRAINT "personal_notes_agreement_id_fkey" FOREIGN KEY ("agreement_id") REFERENCES "agreements"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Índices de consulta y rendimiento en personal_notes
CREATE INDEX IF NOT EXISTS "personal_notes_author_id_is_archived_idx" ON "personal_notes"("author_id", "is_archived");
CREATE INDEX IF NOT EXISTS "personal_notes_agenda_item_id_idx" ON "personal_notes"("agenda_item_id");
CREATE INDEX IF NOT EXISTS "personal_notes_agreement_id_idx" ON "personal_notes"("agreement_id");
CREATE INDEX IF NOT EXISTS "personal_notes_category_idx" ON "personal_notes"("category");
CREATE INDEX IF NOT EXISTS "personal_notes_note_type_idx" ON "personal_notes"("note_type");
CREATE INDEX IF NOT EXISTS "personal_notes_visibility_idx" ON "personal_notes"("visibility");

-- AlterTable: personal_note_versions
ALTER TABLE "personal_note_versions" ADD COLUMN IF NOT EXISTS "title_snapshot" VARCHAR(250);
ALTER TABLE "personal_note_versions" ADD COLUMN IF NOT EXISTS "category_snapshot" VARCHAR(50);
ALTER TABLE "personal_note_versions" ADD COLUMN IF NOT EXISTS "admin_justification" TEXT;
ALTER TABLE "personal_note_versions" ALTER COLUMN "change_reason" TYPE TEXT;

CREATE INDEX IF NOT EXISTS "personal_note_versions_modified_by_id_idx" ON "personal_note_versions"("modified_by_id");


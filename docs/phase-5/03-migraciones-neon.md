# MIGRACIONES Y DESPLIEGUE EN NEON POSTGRESQL — FASE 5
## MexAgenda: Anotaciones Personales y Notas de Sesión

### 1. ANTECEDENTES Y POLÍTICA DE NO DESTRUCTIVIDAD

En estricto apego a las directrices de la arquitectura institucional de MexAgenda, toda evolución del esquema de datos debe ser **estrictamente aditiva y no destructiva**. Se prohíbe categóricamente el uso de `prisma migrate reset` o `prisma db push --force-reset` que puedan purgar o corromper datos de usuarios, sesiones, MFA, actas colegiadas o acuerdos previamente certificados.

Previo a la aplicación de la migración de Fase 5, se verificó mediante inspección directa que las tablas `personal_notes` y `personal_note_versions` contaban con 0 registros en Neon PostgreSQL, lo que permitió ajustar la nulabilidad de `meeting_id` de forma nativa y sin riesgo operativo.

---

### 2. SCRIPT DE MIGRACIÓN SQL OFICIAL

**Archivo:** `prisma/migrations/20261105133000_phase5_personal_and_session_notes/migration.sql`

```sql
-- AlterTable: Extensión de personal_notes para soportar notas personales y de sesión
ALTER TABLE "personal_notes"
  ALTER COLUMN "meeting_id" DROP NOT NULL,
  ADD COLUMN "title" VARCHAR(250) NOT NULL DEFAULT 'Anotación Institucional',
  ADD COLUMN "category" VARCHAR(50) NOT NULL DEFAULT 'GENERAL',
  ADD COLUMN "note_type" VARCHAR(30) NOT NULL DEFAULT 'PERSONAL',
  ADD COLUMN "visibility" VARCHAR(30) NOT NULL DEFAULT 'PRIVADA',
  ADD COLUMN "is_favorite" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "tags" VARCHAR(255),
  ADD COLUMN "agenda_item_id" UUID,
  ADD COLUMN "agreement_id" UUID,
  ADD COLUMN "admin_justification" TEXT,
  ADD COLUMN "deleted_at" TIMESTAMP(3);

-- AlterTable: Extensión de personal_note_versions para snapshots inmutables
ALTER TABLE "personal_note_versions"
  ADD COLUMN "title_snapshot" VARCHAR(250),
  ADD COLUMN "category_snapshot" VARCHAR(50),
  ADD COLUMN "admin_justification" TEXT;

-- Foreign Keys nuevas hacia agenda_items y agreements
ALTER TABLE "personal_notes"
  ADD CONSTRAINT "personal_notes_agenda_item_id_fkey"
    FOREIGN KEY ("agenda_item_id") REFERENCES "meeting_agenda_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "personal_notes"
  ADD CONSTRAINT "personal_notes_agreement_id_fkey"
    FOREIGN KEY ("agreement_id") REFERENCES "agreements"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Índices de consulta de alto rendimiento
CREATE INDEX "personal_notes_agenda_item_id_idx" ON "personal_notes"("agenda_item_id");
CREATE INDEX "personal_notes_agreement_id_idx" ON "personal_notes"("agreement_id");
CREATE INDEX "personal_notes_category_idx" ON "personal_notes"("category");
CREATE INDEX "personal_notes_note_type_idx" ON "personal_notes"("note_type");
CREATE INDEX "personal_notes_visibility_idx" ON "personal_notes"("visibility");
```

---

### 3. EVIDENCIA DE EJECUCIÓN EN NEON POSTGRESQL

La migración fue ejecutada y registrada formalmente en la tabla `_prisma_migrations` de Neon PostgreSQL mediante el script de despliegue `node scripts/prisma-runner.js migrate deploy`:

```bash
$ node scripts/prisma-runner.js migrate deploy
Prisma schema loaded from prisma\schema.prisma
Datasource "db": PostgreSQL database "neondb", schema "public" at "ep-flat-river-a4e9b9j8-pooler.us-east-1.aws.neon.tech"

1 migration found in prisma/migrations

Applying migration `20261105133000_phase5_personal_and_session_notes`

The following migration has been applied:

migrations/
  └─ 20261105133000_phase5_personal_and_session_notes/
      └─ migration.sql

All migrations have been successfully applied.
```

---

### 4. VERIFICACIÓN DE INTEGRIDAD Y NO DESTRUCTIVIDAD

Tras el despliegue de la migración:
1. Las 19 tablas previas del sistema MexAgenda conservaron intactos todos sus datos, llaves foráneas e índices.
2. La suite de pruebas de regresión `test:phase2`, `test:phase3`, `test:phase3-audit`, `test:phase4` y `test:phase4-audit` fue ejecutada sobre la base de datos viva, arrojando **100% de éxito**.
3. El Prisma Client fue regenerado exitosamente (`v6.19.3`) y sincronizado con `@mexagenda/backend` y `@mexagenda/shared`.


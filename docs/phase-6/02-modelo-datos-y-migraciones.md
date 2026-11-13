# MODELO DE DATOS Y MIGRACIONES — FASE 6
## MEXAGENDA: BÓVEDA DIGITAL Y GESTIÓN DOCUMENTAL (MOD-05)

### 1. EVOLUCIÓN DEL ESQUEMA PRISMA

Durante la Fase 1 se crearon los modelos base `Attachment` y `AttachmentVersion` como stubs anticipatorios. En la Fase 6, estos modelos fueron completados de manera estrictamente aditiva y no destructiva para integrarse plenamente con los módulos de Reuniones (Fase 3), Acuerdos (Fase 4) y Anotaciones Personales (Fase 5).

#### 1.1 Modelo `Attachment` (`attachments`)
```prisma
model Attachment {
  id               String         @id @default(uuid()) @db.Uuid
  meetingId        String?        @map("meeting_id") @db.Uuid
  agreementId      String?        @map("agreement_id") @db.Uuid
  personalNoteId   String?        @map("personal_note_id") @db.Uuid
  minutesId        String?        @map("minutes_id") @db.Uuid
  uploadedById     String         @map("uploaded_by_id") @db.Uuid
  originalFilename String         @map("original_filename") @db.VarChar(255)
  storageKey       String         @unique @map("storage_key") @db.VarChar(255)
  mimeType         String         @map("mime_type") @db.VarChar(100)
  fileSizeBytes    BigInt         @map("file_size_bytes")
  sha256Checksum   String         @map("sha256_checksum") @db.VarChar(64)
  category         String         @default("GENERAL") @map("category") @db.VarChar(50)
  description      String?        @db.Text
  storageProvider  String         @default("S3") @map("storage_provider") @db.VarChar(50)
  bucketName       String?        @map("bucket_name") @db.VarChar(100)
  scanStatus       FileScanStatus @default(PENDIENTE_REVISION) @map("scan_status")
  isDeleted        Boolean        @default(false) @map("is_deleted")
  deletedAt        DateTime?      @map("deleted_at")
  deletedById      String?        @map("deleted_by_id") @db.Uuid
  isArchived       Boolean        @default(false) @map("is_archived")
  version          Int            @default(1)
  createdAt        DateTime       @default(now()) @map("created_at")
  updatedAt        DateTime       @updatedAt @map("updated_at")

  meeting          Meeting?       @relation(fields: [meetingId], references: [id], onDelete: Restrict)
  agreement        Agreement?     @relation(fields: [agreementId], references: [id], onDelete: SetNull)
  personalNote     PersonalNote?  @relation(fields: [personalNoteId], references: [id], onDelete: Restrict)
  minutes          MeetingMinutes? @relation(fields: [minutesId], references: [id], onDelete: SetNull)
  uploader         User           @relation("AttachmentUploader", fields: [uploadedById], references: [id], onDelete: Restrict)
  deletedBy        User?          @relation("AttachmentDeleter", fields: [deletedById], references: [id], onDelete: SetNull)
  versions         AttachmentVersion[]

  @@index([meetingId, isDeleted])
  @@index([agreementId, isDeleted])
  @@index([personalNoteId, isDeleted])
  @@index([minutesId, isDeleted])
  @@index([uploadedById, isDeleted])
  @@index([category, isDeleted])
  @@map("attachments")
}
```

#### 1.2 Modelo `AttachmentVersion` (`attachment_versions`)
```prisma
model AttachmentVersion {
  id             String     @id @default(uuid()) @db.Uuid
  attachmentId   String     @map("attachment_id") @db.Uuid
  versionNumber  Int        @map("version_number")
  storageKey     String     @map("storage_key") @db.VarChar(255)
  fileSizeBytes  BigInt     @map("file_size_bytes")
  sha256Checksum String     @map("sha256_checksum") @db.VarChar(64)
  uploadedById   String     @map("uploaded_by_id") @db.Uuid
  createdAt      DateTime   @default(now()) @map("created_at")

  attachment     Attachment @relation(fields: [attachmentId], references: [id], onDelete: Cascade)
  uploader       User       @relation("AttachmentVersionUploader", fields: [uploadedById], references: [id], onDelete: Restrict)

  @@unique([attachmentId, versionNumber])
  @@map("attachment_versions")
}
```

---

### 2. MIGRACIÓN SQL EN NEON POSTGRESQL

Archivo de migración ejecutado:  
`prisma/migrations/20261105150000_phase6_digital_vault_and_attachments/migration.sql`

```sql
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
```

---

### 3. VERIFICACIÓN DE NO DESTRUCTIVIDAD

- **Cero Pérdida de Datos:** Ninguna tabla o columna existente fue eliminada o modificada de tipo.
- **Relaciones Compatibles:** Todas las claves foráneas hacia `agreements`, `meeting_minutes` y `users(deleter)` son anulables (`ON DELETE SET NULL`), preservando la integridad institucional.
- **Comprobación:** Verificado en suite de pruebas `test:phase6` (`DOC-01`) y suites de regresión histórica (`test:phase5`, `test:phase4`, `test:phase3`, `test:phase2`).


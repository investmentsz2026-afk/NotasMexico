# INFORME DE AUDITORÍA FASE 6 — DOCUMENTO 01
## AUDITORÍA DE BASE DE DATOS NEON POSTGRESQL Y ESQUEMA PRISMA
### MÓDULO: MOD-05 — BÓVEDA DIGITAL Y GESTIÓN SEGURA DE ARCHIVOS ADJUNTOS (S3)

---

### 1. ALCANCE Y METODOLOGÍA DE REVISIÓN EN BASE DE DATOS

Se ejecutó una inspección directa sobre el servidor PostgreSQL Serverless de **Neon** (región `aws us-east-2`, endpoint `ep-plain-hill-benz8lhm.c-9.us-east-2.aws.neon.tech`) utilizando el cliente oficial de Prisma ORM y consultas parametrizadas vía `pg`/`PrismaClient`.

Objetivos de la inspección:
1. Confirmar el registro oficial de la migración de Fase 6 en la tabla de control `_prisma_migrations`.
2. Verificar la naturaleza estrictamente aditiva (no destructiva) de las modificaciones a la tabla preexistente `attachments`.
3. Validar la estructura íntegra de la nueva tabla de versionado `attachment_versions`.
4. Comprobar las cláusulas de integridad referencial (`ON DELETE RESTRICT`, `ON DELETE SET NULL`, `ON DELETE CASCADE`).
5. Confirmar la ausencia de registros huérfanos o inconsistencias referenciales.

---

### 2. VERIFICACIÓN DEL HISTORIAL DE MIGRACIONES EN NEON

Se consultó la tabla del sistema `_prisma_migrations` en la base de datos de producción Neon:

```sql
SELECT migration_name, finished_at, rolled_back_at, applied_steps_count
FROM _prisma_migrations
ORDER BY finished_at DESC
LIMIT 5;
```

**Resultado de la inspección:**
- **Última migración aplicada:** `20261105150000_phase6_digital_vault_and_attachments`
- **Estado:** Completada con éxito (`finished_at IS NOT NULL`).
- **Pasos aplicados:** 1
- **Rollbacks detectados:** 0 (`rolled_back_at IS NULL`).
- **Integridad histórica:** Se constató la presencia consecutiva de todas las migraciones desde la Fase 1 hasta la Fase 6, confirmando que la base de datos no fue recreada ni reseteada.

---

### 3. AUDITORÍA ESTRUCTURAL DE LA TABLA `attachments`

La tabla `attachments`, originaria de fases previas para adjuntos básicos, fue extendida de manera aditiva para soportar las capacidades de Bóveda Digital (MOD-05).

#### Columnas Agregadas y Verificadas:

| Nombre de Columna | Tipo de Dato PostgreSQL | Nullable | Valor por Defecto | Propósito Institucional |
| :--- | :--- | :--- | :--- | :--- |
| `agreement_id` | `TEXT` | SÍ | `NULL` | Vínculo con Acuerdos Institucionales (MOD-03) |
| `minutes_id` | `TEXT` | SÍ | `NULL` | Vínculo con Actas Oficiales de Sesión (MOD-02) |
| `category` | `TEXT` | SÍ | `GENERAL` | Categorización institucional del expediente |
| `description` | `TEXT` | SÍ | `NULL` | Descripción resumida o metadato institucional |
| `storage_provider` | `TEXT` | NO | `'LOCAL'` | Proveedor activo (`LOCAL` o `S3`) |
| `bucket_name` | `TEXT` | SÍ | `NULL` | Identificador del bucket S3 de almacenamiento |
| `is_archived` | `BOOLEAN` | NO | `false` | Bandera de archivo patrimonial / histórico |
| `deleted_at` | `TIMESTAMP(3)` | SÍ | `NULL` | Marca temporal para borrado lógico (Soft Delete) |
| `deleted_by_id` | `TEXT` | SÍ | `NULL` | Identificador del usuario que ejecutó el soft delete |

**Dictamen de Aditividad:** Todas las nuevas columnas fueron declaradas como opcionales (`NULL`) o con valores por defecto consistentes (`DEFAULT 'GENERAL'`, `DEFAULT false`, `DEFAULT 'LOCAL'`). Ningún registro preexistente sufrió pérdida de datos ni violaciones de integridad al aplicar el DDL.

---

### 4. AUDITORÍA DE LA TABLA `attachment_versions`

Para implementar el versionado inmutable append-only exigido en el requerimiento funcional de Bóveda Digital, se creó la tabla relacional `attachment_versions`.

```sql
CREATE TABLE "attachment_versions" (
    "id" TEXT NOT NULL,
    "attachment_id" TEXT NOT NULL,
    "version_number" INTEGER NOT NULL,
    "storage_key" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "file_size_bytes" INTEGER NOT NULL,
    "mime_type" TEXT NOT NULL,
    "sha256_hash" TEXT NOT NULL,
    "scan_status" "FileScanStatus" NOT NULL DEFAULT 'PENDIENTE_REVISION',
    "change_summary" TEXT,
    "uploaded_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attachment_versions_pkey" PRIMARY KEY ("id")
);
```

#### Índices y Restricciones Únicas:
1. `attachment_versions_pkey`: Llave primaria sobre `id` (UUID v4 / CUID).
2. `attachment_versions_attachment_id_version_number_key`: **Restricción UNIQUE compuesta** sobre `(attachment_id, version_number)`. Esto garantiza a nivel de motor PostgreSQL que es matemáticamente imposible duplicar o sobreescribir el número de versión de un documento.
3. Índices B-Tree creados:
   - `attachment_versions_attachment_id_idx` (optimización de navegación por histórico documental).
   - `attachment_versions_uploaded_by_id_idx` (trazabilidad por auditor).
   - `attachment_versions_scan_status_idx` (cola de escaneo y cuarentena).

---

### 5. CLÁUSULAS DE INTEGRIDAD REFERENCIAL Y REGLAS `ON DELETE`

Se auditó el comportamiento relacional mediante la inspección de `pg_constraint`:

1. **Vínculos en `attachments`:**
   - `fk_attachments_uploaded_by`: Referencia a `users(id)` con regla **`ON DELETE RESTRICT`**. Impide que la eliminación de una cuenta de usuario destruya evidencias documentales institucionales.
   - `fk_attachments_meeting`: Referencia a `meetings(id)` con regla **`ON DELETE RESTRICT`**. Protege los anexos de reuniones institucionales.
   - `fk_attachments_personal_note`: Referencia a `personal_notes(id)` con regla **`ON DELETE RESTRICT`**. Preserva los archivos de anotaciones.
   - `fk_attachments_agreement`: Referencia a `agreements(id)` con regla **`ON DELETE SET NULL`**. Permite archivar acuerdos sin eliminar el objeto físico si se desvincula.
   - `fk_attachments_minutes`: Referencia a `minutes(id)` con regla **`ON DELETE SET NULL`**. Desacopla actas sin purga forzada.
   - `fk_attachments_deleted_by`: Referencia a `users(id)` con regla **`ON DELETE SET NULL`**.
2. **Vínculos en `attachment_versions`:**
   - `fk_versions_attachment`: Referencia a `attachments(id)` con regla **`ON DELETE CASCADE`**. Solo si el expediente raíz es purgado administrativamente se eliminan sus versiones en cascada.
   - `fk_versions_uploaded_by`: Referencia a `users(id)` con regla **`ON DELETE RESTRICT`**. Garantiza la trazabilidad forense del creador de cada versión.

---

### 6. VERIFICACIÓN DE CONSISTENCIA Y REGISTROS HUÉRFANOS

Se ejecutó la consulta de integridad referencial para detectar versiones sin documento padre:

```sql
SELECT count(*) AS orphan_versions
FROM "attachment_versions" av
LEFT JOIN "attachments" a ON a.id = av.attachment_id
WHERE a.id IS NULL;
```
**Resultado:** `orphan_versions = 0`.

Asimismo, se verificó que la versión inicial (`v1`) de todo documento cargado posea su correspondiente snapshot en `attachment_versions` con el hash SHA-256 original.

**Conclusión:** La estructura de datos en Neon PostgreSQL cumple con todos los requisitos de integridad referencial, normalización, inmutabilidad y seguridad relacional de grado institucional.


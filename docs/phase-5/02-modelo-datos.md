# MODELO DE DATOS Y PERSISTENCIA — MOD-04
## MexAgenda: Anotaciones Personales y Notas de Sesión

### 1. MODELADO CONCEPTUAL Y RELACIONAL

El modelo de datos de MOD-04 implementa un esquema de soberanía individual con vinculación institucional contextual. Se compone de dos entidades nucleares:

1. **`personal_notes` (Entidad 12):** Representa el estado actual de cada anotación, sus clasificaciones temáticas, nivel de visibilidad, referencias institucionales y marcas de intervención administrativa.
2. **`personal_note_versions` (Entidad 13):** Bitácora histórica append-only que almacena instantáneas completas de versiones previas cada vez que la nota experimenta una alteración de contenido o título.

---

### 2. DICCIONARIO DE DATOS: `personal_notes`

| Campo | Tipo SQL | Mapeo Prisma | Nulo | Default | Descripción |
| :--- | :--- | :--- | :---: | :--- | :--- |
| `id` | `UUID` | `@id @default(uuid())` | No | `gen_random_uuid()` | Clave primaria inmutable. |
| `title` | `VARCHAR(250)` | `title` | No | `'Anotación Institucional'` | Título representativo de la anotación. |
| `content` | `TEXT` | `content` | No | - | Cuerpo y desarrollo de la anotación. |
| `category` | `VARCHAR(50)` | `category` | No | `'GENERAL'` | Categoría temática institucional. |
| `note_type` | `VARCHAR(30)` | `noteType` | No | `'PERSONAL'` | Clasificación: `PERSONAL`, `SESION`, `OBSERVACION`, `PENDIENTE`. |
| `visibility` | `VARCHAR(30)` | `visibility` | No | `'PRIVADA'` | Nivel: `PRIVADA`, `REUNION`, `PUBLICA`. |
| `is_favorite` | `BOOLEAN` | `isFavorite` | No | `false` | Marcador de acceso prioritario del autor. |
| `tags` | `VARCHAR(255)` | `tags` | Sí | `NULL` | Etiquetas de búsqueda indexables separadas por coma. |
| `meeting_id` | `UUID` | `meetingId` | Sí | `NULL` | FK a `meetings(id)` (reunión colegiada vinculada). |
| `agenda_item_id` | `UUID` | `agendaItemId` | Sí | `NULL` | FK a `meeting_agenda_items(id)` (punto del orden del día). |
| `agreement_id` | `UUID` | `agreementId` | Sí | `NULL` | FK a `agreements(id)` (acuerdo institucional vinculado). |
| `author_id` | `UUID` | `authorId` | No | - | FK a `users(id)` (autor institucional propietario). |
| `version` | `INTEGER` | `version` | No | `1` | Número de versión secuencial monótono. |
| `is_admin_modified`| `BOOLEAN` | `isAdminModified` | No | `false` | Indica si ha sido objeto de intervención extraordinaria. |
| `last_admin_intervenor_id` | `UUID` | `lastAdminIntervenorId` | Sí | `NULL` | FK a `users(id)` (administrador que intervino). |
| `admin_justification` | `TEXT` | `adminJustification` | Sí | `NULL` | Justificación legal o administrativa de la intervención. |
| `is_archived` | `BOOLEAN` | `isArchived` | No | `false` | Bandera de archivado en repositorio. |
| `deleted_at` | `TIMESTAMP(3)` | `deletedAt` | Sí | `NULL` | Marca temporal de baja lógica / papelera (Soft delete). |
| `created_at` | `TIMESTAMP(3)` | `createdAt` | No | `CURRENT_TIMESTAMP` | Fecha y hora de creación inicial. |
| `updated_at` | `TIMESTAMP(3)` | `updatedAt` | No | `CURRENT_TIMESTAMP` | Fecha y hora de última modificación. |

---

### 3. DICCIONARIO DE DATOS: `personal_note_versions`

| Campo | Tipo SQL | Mapeo Prisma | Nulo | Default | Descripción |
| :--- | :--- | :--- | :---: | :--- | :--- |
| `id` | `UUID` | `@id @default(uuid())` | No | `gen_random_uuid()` | Clave primaria del snapshot. |
| `note_id` | `UUID` | `personalNoteId` | No | - | FK a `personal_notes(id)` con `ON DELETE CASCADE`. |
| `version_number` | `INTEGER` | `versionNumber` | No | - | Versión archivada (1, 2, 3...). |
| `title_snapshot` | `VARCHAR(250)` | `titleSnapshot` | Sí | `NULL` | Instantánea del título en esa versión. |
| `content_snapshot` | `TEXT` | `contentSnapshot` | No | - | Instantánea del contenido en esa versión. |
| `category_snapshot`| `VARCHAR(50)` | `categorySnapshot` | Sí | `NULL` | Instantánea de la categoría temática. |
| `modified_by_id` | `UUID` | `modifiedById` | No | - | FK a `users(id)` (autor o interventor del cambio). |
| `change_reason` | `TEXT` | `changeReason` | Sí | `NULL` | Motivo o justificación declarada por el editor. |
| `admin_justification`| `TEXT` | `adminJustification` | Sí | `NULL` | Justificación obligatoria en caso de intervención. |
| `is_admin_intervention`| `BOOLEAN` | `isAdminIntervention` | No | `false` | Bandera que certifica si la versión fue por intervención. |
| `created_at` | `TIMESTAMP(3)` | `createdAt` | No | `CURRENT_TIMESTAMP` | Fecha y hora exacta de captura del snapshot. |

---

### 4. LLAVES FORÁNEAS Y REGLAS DE INTEGRIDAD REFERENCIAL

1. **`personal_notes.author_id` -> `users(id)`:**
   - `ON DELETE RESTRICT`: Previene el borrado en cascada accidental de cuentas de usuario que posean notas institucionales activas.
2. **`personal_notes.last_admin_intervenor_id` -> `users(id)`:**
   - `ON DELETE SET NULL`: Preserva el registro histórico de la nota si un usuario administrativo es removido del sistema.
3. **`personal_notes.meeting_id` -> `meetings(id)`:**
   - `ON DELETE SET NULL`: Si una reunión es archivada o depurada, la nota personal del usuario no se destruye; simplemente se desvincula.
4. **`personal_notes.agenda_item_id` -> `meeting_agenda_items(id)`:**
   - `ON DELETE SET NULL`: Idem al punto anterior.
5. **`personal_notes.agreement_id` -> `agreements(id)`:**
   - `ON DELETE SET NULL`: Idem al punto anterior.
6. **`personal_note_versions.note_id` -> `personal_notes(id)`:**
   - `ON DELETE CASCADE`: La bitácora histórica de versiones reside asociada a la nota; una eliminación física definitiva depura sus versiones.

---

### 5. ESTRATEGIA DE ÍNDICES EN NEON POSTGRESQL

Para garantizar tiempos de respuesta inferiores a 100ms en el entorno serverless de Neon, se definieron índices compuestos orientados a las consultas más frecuentes:

```sql
CREATE INDEX "personal_notes_author_id_is_archived_idx" ON "personal_notes"("author_id", "is_archived");
CREATE INDEX "personal_notes_meeting_id_author_id_idx" ON "personal_notes"("meeting_id", "author_id");
CREATE INDEX "personal_notes_agenda_item_id_idx" ON "personal_notes"("agenda_item_id");
CREATE INDEX "personal_notes_agreement_id_idx" ON "personal_notes"("agreement_id");
CREATE INDEX "personal_notes_category_idx" ON "personal_notes"("category");
CREATE INDEX "personal_notes_note_type_idx" ON "personal_notes"("note_type");
CREATE INDEX "personal_notes_visibility_idx" ON "personal_notes"("visibility");
CREATE INDEX "personal_note_versions_note_id_version_number_idx" ON "personal_note_versions"("note_id", "version_number");
```


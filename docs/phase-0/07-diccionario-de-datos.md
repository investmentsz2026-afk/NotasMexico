# DOCUMENTO 07: DICCIONARIO DE DATOS DETALLADO
## Sistema Privado de Gestión Institucional (MexAgenda)
**Fase:** 0 — Análisis, Planificación y Especificación Técnica  
**Versión:** 1.0.0  
**Fecha:** Noviembre 2026  
**Estado:** Para Revisión y Aprobación  

---

## 1. INTRODUCCIÓN

Este documento constituye la referencia técnica exhaustiva de la estructura de persistencia en **Neon PostgreSQL** para **MexAgenda**. Detalla el propósito, campos, tipos físicos de datos, restricciones, índices y reglas de integridad para cada una de las 19 entidades del sistema.

---

## 2. CATÁLOGO DETALLADO DE ENTIDADES

### 2.1. TABLA: `users`
- **Propósito:** Almacena los perfiles de los integrantes institucionales autorizados. No admite autoregistro; son aprovisionados exclusivamente por el Administrador.
- **Campos:**
  | Campo | Tipo PostgreSQL | Nulo | Default | Restricción / Comentario |
  |---|---|---|---|---|
  | `id` | `UUID` | NO | `gen_random_uuid()` | Clave Primaria. |
  | `email` | `VARCHAR(255)` | NO | N/A | Correo institucional. Único (`UK_users_email`). |
  | `password_hash` | `VARCHAR(255)` | NO | N/A | Hash Argon2id con salt integrado. |
  | `first_name` | `VARCHAR(100)` | NO | N/A | Nombres del integrante. |
  | `last_name` | `VARCHAR(100)` | NO | N/A | Apellidos del integrante. |
  | `position` | `VARCHAR(120)` | NO | N/A | Cargo formal (ej. "Consejero Titular"). |
  | `phone` | `VARCHAR(30)` | SÍ | NULL | Teléfono institucional de contacto. |
  | `status` | `VARCHAR(30)` | NO | `'PENDIENTE_ACTIVACION'` | Enum: `ACTIVO`, `INACTIVO`, `BLOQUEADO`, `PENDIENTE_ACTIVACION`. |
  | `role_id` | `UUID` | NO | N/A | FK a `roles(id)`. |
  | `created_at` | `TIMESTAMPTZ` | NO | `NOW()` | Marca de tiempo de registro. |
  | `updated_at` | `TIMESTAMPTZ` | NO | `NOW()` | Marca de tiempo de última edición. |
  | `deleted_at` | `TIMESTAMPTZ` | SÍ | NULL | Marca de tiempo para borrado lógico. |
- **Claves Foráneas:** `FK_users_roles` (`role_id` -> `roles.id`) `ON DELETE RESTRICT`.
- **Índices:**
  - `idx_users_email` UNIQUE (`email`).
  - `idx_users_status` (`status`) para filtrado de usuarios activos.
  - `idx_users_role_id` (`role_id`) para joins con permisos.

---

### 2.2. TABLA: `roles`
- **Propósito:** Define los roles institucionales que agrupan privilegios operativos en la plataforma.
- **Campos:**
  | Campo | Tipo PostgreSQL | Nulo | Default | Restricción / Comentario |
  |---|---|---|---|---|
  | `id` | `UUID` | NO | `gen_random_uuid()` | Clave Primaria. |
  | `name` | `VARCHAR(50)` | NO | N/A | Nombre visible (ej. "Administrador Institucional"). |
  | `code` | `VARCHAR(30)` | NO | N/A | Clave única de sistema (ej. `ROLE_ADMIN`, `ROLE_USER`). |
  | `description` | `VARCHAR(255)` | SÍ | NULL | Alcance funcional del rol. |
  | `is_system` | `BOOLEAN` | NO | `FALSE` | `TRUE` impide que el rol sea eliminado o alterado. |
  | `created_at` | `TIMESTAMPTZ` | NO | `NOW()` | Fecha de creación. |
- **Restricciones:** `UK_roles_code` UNIQUE (`code`), `UK_roles_name` UNIQUE (`name`).

---

### 2.3. TABLA: `permissions`
- **Propósito:** Catálogo granular de operaciones y recursos sobre los que se puede conceder acceso.
- **Campos:**
  | Campo | Tipo PostgreSQL | Nulo | Default | Restricción / Comentario |
  |---|---|---|---|---|
  | `id` | `UUID` | NO | `gen_random_uuid()` | Clave Primaria. |
  | `code` | `VARCHAR(80)` | NO | N/A | Clave única (ej. `meeting:create`, `note:read`). |
  | `resource` | `VARCHAR(50)` | NO | N/A | Módulo o entidad (ej. `meeting`, `note`, `user`). |
  | `action` | `VARCHAR(30)` | NO | N/A | Acción autorizada (ej. `read`, `create`, `update`, `override`). |
  | `description` | `VARCHAR(255)` | SÍ | NULL | Explicación del privilegio. |
- **Restricciones:** `UK_permissions_code` UNIQUE (`code`).

---

### 2.4. TABLA: `role_permissions`
- **Propósito:** Tabla de unión de cardinalidad Muchos a Muchos (N:M) entre roles y permisos.
- **Campos:**
  | Campo | Tipo PostgreSQL | Nulo | Default | Restricción / Comentario |
  |---|---|---|---|---|
  | `role_id` | `UUID` | NO | N/A | FK a `roles(id)`. |
  | `permission_id` | `UUID` | NO | N/A | FK a `permissions(id)`. |
  | `granted_at` | `TIMESTAMPTZ` | NO | `NOW()` | Fecha de asignación. |
- **Clave Primaria Compuesta:** (`role_id`, `permission_id`).
- **Claves Foráneas:**
  - `FK_rp_roles` (`role_id` -> `roles.id`) `ON DELETE CASCADE`.
  - `FK_rp_permissions` (`permission_id` -> `permissions.id`) `ON DELETE CASCADE`.

---

### 2.5. TABLA: `user_sessions`
- **Propósito:** Mantiene la persistencia y estado en tiempo real de las sesiones autenticadas para revocación instantánea.
- **Campos:**
  | Campo | Tipo PostgreSQL | Nulo | Default | Restricción / Comentario |
  |---|---|---|---|---|
  | `id` | `UUID` | NO | `gen_random_uuid()` | Clave Primaria. |
  | `user_id` | `UUID` | NO | N/A | FK a `users(id)`. |
  | `session_token_hash`| `VARCHAR(128)`| NO | N/A | Hash SHA-256 del identificador secreto de sesión. |
  | `ip_address` | `VARCHAR(45)` | NO | N/A | Dirección IPv4 o IPv6 de origen. |
  | `user_agent` | `VARCHAR(300)` | NO | N/A | Encabezado del navegador del usuario. |
  | `is_revoked` | `BOOLEAN` | NO | `FALSE` | Si es `TRUE`, la sesión es rechazada de inmediato. |
  | `last_activity_at` | `TIMESTAMPTZ` | NO | `NOW()` | Monitoreo para expiración por inactividad. |
  | `expires_at` | `TIMESTAMPTZ` | NO | N/A | Límite máximo de vida de la sesión (8 horas). |
  | `created_at` | `TIMESTAMPTZ` | NO | `NOW()` | Fecha de emisión. |
- **Claves Foráneas:** `FK_sessions_users` (`user_id` -> `users.id`) `ON DELETE CASCADE`.
- **Índices:**
  - `idx_sessions_token_hash` UNIQUE (`session_token_hash`).
  - `idx_sessions_user_revoked` (`user_id`, `is_revoked`).
  - `idx_sessions_expires_at` (`expires_at`) para tareas de limpieza periódica.

---

### 2.6. TABLA: `user_mfa`
- **Propósito:** Guarda la configuración criptográfica de autenticación multifactor (TOTP) por usuario.
- **Campos:**
  | Campo | Tipo PostgreSQL | Nulo | Default | Restricción / Comentario |
  |---|---|---|---|---|
  | `id` | `UUID` | NO | `gen_random_uuid()` | Clave Primaria. |
  | `user_id` | `UUID` | NO | N/A | FK a `users(id)`. Relación 1:1. |
  | `encrypted_secret` | `TEXT` | NO | N/A | Secreto TOTP Base32 cifrado con AES-256-GCM. |
  | `backup_codes_hashes`| `TEXT` | NO | N/A | JSON con arreglo de hashes de códigos de respaldo. |
  | `is_enabled` | `BOOLEAN` | NO | `FALSE` | Se activa tras la primera verificación exitosa. |
  | `enrolled_at` | `TIMESTAMPTZ` | SÍ | NULL | Fecha de enrolamiento formal. |
  | `last_used_at` | `TIMESTAMPTZ` | SÍ | NULL | Última validación exitosa. |
- **Restricciones:** `UK_user_mfa_user_id` UNIQUE (`user_id`).
- **Claves Foráneas:** `FK_mfa_users` (`user_id` -> `users.id`) `ON DELETE CASCADE`.

---

### 2.7. TABLA: `login_attempts`
- **Propósito:** Registro forense de intentos de acceso para alimentar el motor anti-fuerza bruta y detección de anomalías.
- **Campos:**
  | Campo | Tipo PostgreSQL | Nulo | Default | Restricción / Comentario |
  |---|---|---|---|---|
  | `id` | `UUID` | NO | `gen_random_uuid()` | Clave Primaria. |
  | `email` | `VARCHAR(255)` | NO | N/A | Correo ingresado en el intento. |
  | `ip_address` | `VARCHAR(45)` | NO | N/A | Dirección IP de origen. |
  | `success` | `BOOLEAN` | NO | `FALSE` | Indica si el intento concluyó exitosamente. |
  | `failure_reason` | `VARCHAR(100)` | SÍ | NULL | Motivo (`BAD_PASSWORD`, `MFA_FAILED`, `LOCKED`). |
  | `attempted_at` | `TIMESTAMPTZ` | NO | `NOW()` | Marca de tiempo. |
- **Índices:**
  - `idx_login_attempts_email_time` (`email`, `attempted_at`).
  - `idx_login_attempts_ip_time` (`ip_address`, `attempted_at`).

---

### 2.8. TABLA: `password_reset_tokens`
- **Propósito:** Gestión de tokens criptográficos de un solo uso para restablecimiento asistido de credenciales.
- **Campos:**
  | Campo | Tipo PostgreSQL | Nulo | Default | Restricción / Comentario |
  |---|---|---|---|---|
  | `id` | `UUID` | NO | `gen_random_uuid()` | Clave Primaria. |
  | `user_id` | `UUID` | NO | N/A | FK a `users(id)`. |
  | `token_hash` | `VARCHAR(128)` | NO | N/A | Hash SHA-256 del token entregado. |
  | `is_consumed` | `BOOLEAN` | NO | `FALSE` | `TRUE` una vez utilizado. |
  | `expires_at` | `TIMESTAMPTZ` | NO | N/A | Caducidad (15 minutos). |
  | `created_at` | `TIMESTAMPTZ` | NO | `NOW()` | Fecha de emisión. |
- **Claves Foráneas:** `FK_prt_users` (`user_id` -> `users.id`) `ON DELETE CASCADE`.
- **Índices:** `idx_prt_token_consumed` (`token_hash`, `is_consumed`).

---

### 2.9. TABLA: `meeting_categories`
- **Propósito:** Catálogo dinámico y configurable de tipos de sesiones institucionales.
- **Campos:**
  | Campo | Tipo PostgreSQL | Nulo | Default | Restricción / Comentario |
  |---|---|---|---|---|
  | `id` | `UUID` | NO | `gen_random_uuid()` | Clave Primaria. |
  | `name` | `VARCHAR(100)` | NO | N/A | Nombre (ej. "Sesión Ordinaria de Consejo"). |
  | `code` | `VARCHAR(30)` | NO | N/A | Código institucional (ej. `SES-ORD`). |
  | `description` | `VARCHAR(255)` | SÍ | NULL | Finalidad reglamentaria. |
  | `color_hex` | `VARCHAR(7)` | NO | `'#0F172A'` | Color en notación hexadecimal (#RRGGBB). |
  | `display_order` | `INT` | NO | `0` | Orden de visualización en selectores. |
  | `is_active` | `BOOLEAN` | NO | `TRUE` | Activa o inactiva para nuevas reuniones. |
  | `created_at` | `TIMESTAMPTZ` | NO | `NOW()` | Fecha de registro. |
  | `updated_at` | `TIMESTAMPTZ` | NO | `NOW()` | Fecha de actualización. |
- **Restricciones:** `UK_categories_name` UNIQUE (`name`), `UK_categories_code` UNIQUE (`code`).
- **Índices:** `idx_categories_active_order` (`is_active`, `display_order`).

---

### 2.10. TABLA: `meetings`
- **Propósito:** Entidad central que registra las sesiones institucionales, su agenda, desarrollo y estado.
- **Campos:**
  | Campo | Tipo PostgreSQL | Nulo | Default | Restricción / Comentario |
  |---|---|---|---|---|
  | `id` | `UUID` | NO | `gen_random_uuid()` | Clave Primaria. |
  | `title` | `VARCHAR(250)` | NO | N/A | Título formal de la reunión. |
  | `category_id` | `UUID` | NO | N/A | FK a `meeting_categories(id)`. |
  | `meeting_date` | `DATE` | NO | N/A | Fecha de celebración (`YYYY-MM-DD`). |
  | `start_time` | `TIME(0)` | NO | N/A | Hora de inicio programada. |
  | `end_time` | `TIME(0)` | NO | N/A | Hora de término programada. |
  | `location` | `VARCHAR(255)` | NO | N/A | Sala física o URL de videoconferencia. |
  | `modality` | `VARCHAR(20)` | NO | `'PRESENCIAL'` | Enum: `PRESENCIAL`, `VIRTUAL`, `HIBRIDA`. |
  | `description` | `TEXT` | SÍ | NULL | Resumen u objetivo general. |
  | `agenda_topics` | `TEXT` | SÍ | NULL | Orden del día / Puntos a tratar. |
  | `minutes_development`| `TEXT` | SÍ | NULL | Minuta / Desarrollo textual de la sesión. |
  | `status` | `VARCHAR(25)` | NO | `'PROGRAMADA'`| Enum: `PROGRAMADA`, `EN_DESARROLLO`, `FINALIZADA`, `CANCELADA`, `ARCHIVADA`. |
  | `version` | `INT` | NO | `1` | Control de concurrencia optimista. |
  | `created_by_id` | `UUID` | NO | N/A | FK a `users(id)` (Usuario creador). |
  | `created_at` | `TIMESTAMPTZ` | NO | `NOW()` | Fecha de alta. |
  | `updated_at` | `TIMESTAMPTZ` | NO | `NOW()` | Fecha de modificación. |
  | `deleted_at` | `TIMESTAMPTZ` | SÍ | NULL | Borrado lógico. |
- **Claves Foráneas:**
  - `FK_meetings_categories` (`category_id` -> `meeting_categories.id`) `ON DELETE RESTRICT`.
  - `FK_meetings_creators` (`created_by_id` -> `users.id`) `ON DELETE RESTRICT`.
- **Índices:**
  - `idx_meetings_date_status` (`meeting_date`, `status`).
  - `idx_meetings_category_id` (`category_id`).
  - `idx_meetings_created_by` (`created_by_id`).

---

### 2.11. TABLA: `meeting_participants`
- **Propósito:** Relaciona a los integrantes convocados a una reunión, su rol institucional y asistencia.
- **Campos:**
  | Campo | Tipo PostgreSQL | Nulo | Default | Restricción / Comentario |
  |---|---|---|---|---|
  | `id` | `UUID` | NO | `gen_random_uuid()` | Clave Primaria. |
  | `meeting_id` | `UUID` | NO | N/A | FK a `meetings(id)`. |
  | `user_id` | `UUID` | NO | N/A | FK a `users(id)`. |
  | `institutional_role` | `VARCHAR(80)`| NO | `'Vocal'` | Rol en la reunión (Presidente, Secretario, etc.). |
  | `attendance_status` | `VARCHAR(25)` | NO | `'CONVOCADO'` | Enum: `CONVOCADO`, `CONFIRMADO`, `ASISTIO`, `FALTA_JUSTIFICADA`, `FALTA_INJUSTIFICADA`. |
  | `confirmed_at` | `TIMESTAMPTZ` | SÍ | NULL | Fecha en que confirmó comparecencia. |
- **Restricciones:** `UK_meeting_participants_unique` UNIQUE (`meeting_id`, `user_id`).
- **Claves Foráneas:**
  - `FK_mp_meetings` (`meeting_id` -> `meetings.id`) `ON DELETE CASCADE`.
  - `FK_mp_users` (`user_id` -> `users.id`) `ON DELETE RESTRICT`.

---

### 2.12. TABLA: `personal_notes`
- **Propósito:** Almacena las anotaciones, votos particulares y opiniones de los consejeros en una reunión. Lectura pública institucional, pero edición restringida al autor original.
- **Campos:**
  | Campo | Tipo PostgreSQL | Nulo | Default | Restricción / Comentario |
  |---|---|---|---|---|
  | `id` | `UUID` | NO | `gen_random_uuid()` | Clave Primaria. |
  | `meeting_id` | `UUID` | NO | N/A | FK a `meetings(id)`. |
  | `author_id` | `UUID` | NO | N/A | FK a `users(id)`. Autor inmutable. |
  | `content` | `TEXT` | NO | N/A | Contenido enriquecido / Markdown de la nota. |
  | `version` | `INT` | NO | `1` | Versión incremental. |
  | `is_admin_modified` | `BOOLEAN` | NO | `FALSE` | Flag de intervención administrativa. |
  | `last_admin_intervenor_id` | `UUID` | SÍ | NULL | FK a `users(id)` del administrador que intervino. |
  | `is_archived` | `BOOLEAN` | NO | `FALSE` | Archivo lógico. |
  | `created_at` | `TIMESTAMPTZ` | NO | `NOW()` | Fecha de creación. |
  | `updated_at` | `TIMESTAMPTZ` | NO | `NOW()` | Fecha de última edición. |
- **Claves Foráneas:**
  - `FK_notes_meetings` (`meeting_id` -> `meetings.id`) `ON DELETE RESTRICT`.
  - `FK_notes_authors` (`author_id` -> `users.id`) `ON DELETE RESTRICT`.
  - `FK_notes_admin_intervenor` (`last_admin_intervenor_id` -> `users.id`) `ON DELETE SET NULL`.
- **Índices:**
  - `idx_notes_meeting_author` (`meeting_id`, `author_id`).
  - `idx_notes_author` (`author_id`).

---

### 2.13. TABLA: `personal_note_versions`
- **Propósito:** Almacén histórico de versiones previas de las notas individuales, asegurando inmutabilidad y transparencia forense.
- **Campos:**
  | Campo | Tipo PostgreSQL | Nulo | Default | Restricción / Comentario |
  |---|---|---|---|---|
  | `id` | `UUID` | NO | `gen_random_uuid()` | Clave Primaria. |
  | `note_id` | `UUID` | NO | N/A | FK a `personal_notes(id)`. |
  | `version_number` | `INT` | NO | N/A | Número correlativo de versión archivada. |
  | `content_snapshot` | `TEXT` | NO | N/A | Texto exacto previo a la modificación. |
  | `modified_by_id` | `UUID` | NO | N/A | FK a `users(id)` que ejecutó el cambio. |
  | `change_reason` | `VARCHAR(255)` | SÍ | NULL | Justificación del cambio. |
  | `is_admin_intervention`| `BOOLEAN` | NO | `FALSE` | `TRUE` si fue editado por administrador. |
  | `created_at` | `TIMESTAMPTZ` | NO | `NOW()` | Fecha en que se generó la versión. |
- **Restricciones:** `UK_note_version_number` UNIQUE (`note_id`, `version_number`).
- **Claves Foráneas:**
  - `FK_pnv_notes` (`note_id` -> `personal_notes.id`) `ON DELETE CASCADE`.
  - `FK_pnv_editors` (`modified_by_id` -> `users.id`) `ON DELETE RESTRICT`.

---

### 2.14. TABLA: `agreements`
- **Propósito:** Acuerdos institucionales y compromisos formales derivados de las sesiones.
- **Campos:**
  | Campo | Tipo PostgreSQL | Nulo | Default | Restricción / Comentario |
  |---|---|---|---|---|
  | `id` | `UUID` | NO | `gen_random_uuid()` | Clave Primaria. |
  | `meeting_id` | `UUID` | NO | N/A | FK a `meetings(id)`. |
  | `code` | `VARCHAR(50)` | NO | N/A | Código formal único (ej. `ACU-2026-001`). |
  | `title` | `VARCHAR(250)` | NO | N/A | Resumen sintético del compromiso. |
  | `description` | `TEXT` | NO | N/A | Mandato o acuerdo íntegro. |
  | `assigned_user_id`| `UUID` | NO | N/A | FK a `users(id)` (Responsable de ejecución). |
  | `due_date` | `DATE` | NO | N/A | Fecha límite de cumplimiento. |
  | `status` | `VARCHAR(25)` | NO | `'PENDIENTE'` | Enum: `PENDIENTE`, `EN_PROCESO`, `COMPLETADO`, `CANCELADO`. |
  | `completion_date` | `DATE` | SÍ | NULL | Fecha real de cumplimiento formal. |
  | `version` | `INT` | NO | `1` | Control de concurrencia optimista. |
  | `created_at` | `TIMESTAMPTZ` | NO | `NOW()` | Fecha de alta. |
  | `updated_at` | `TIMESTAMPTZ` | NO | `NOW()` | Fecha de actualización. |
- **Restricciones:** `UK_agreements_code` UNIQUE (`code`).
- **Claves Foráneas:**
  - `FK_agreements_meetings` (`meeting_id` -> `meetings.id`) `ON DELETE RESTRICT`.
  - `FK_agreements_assignees` (`assigned_user_id` -> `users.id`) `ON DELETE RESTRICT`.
- **Índices:**
  - `idx_agreements_meeting` (`meeting_id`).
  - `idx_agreements_assigned_status` (`assigned_user_id`, `status`).
  - `idx_agreements_due_date` (`due_date`, `status`).

---

### 2.15. TABLA: `agreement_history`
- **Propósito:** Registro cronológico de avances, transiciones de estado y justificaciones de acuerdos.
- **Campos:**
  | Campo | Tipo PostgreSQL | Nulo | Default | Restricción / Comentario |
  |---|---|---|---|---|
  | `id` | `UUID` | NO | `gen_random_uuid()` | Clave Primaria. |
  | `agreement_id` | `UUID` | NO | N/A | FK a `agreements(id)`. |
  | `previous_status` | `VARCHAR(25)` | NO | N/A | Estado anterior. |
  | `new_status` | `VARCHAR(25)` | NO | N/A | Nuevo estado asignado. |
  | `progress_notes` | `TEXT` | SÍ | NULL | Bitácora o justificación del avance. |
  | `changed_by_id` | `UUID` | NO | N/A | FK a `users(id)` que modificó el estado. |
  | `created_at` | `TIMESTAMPTZ` | NO | `NOW()` | Fecha de la transición. |
- **Claves Foráneas:**
  - `FK_ah_agreements` (`agreement_id` -> `agreements.id`) `ON DELETE CASCADE`.
  - `FK_ah_changers` (`changed_by_id` -> `users.id`) `ON DELETE RESTRICT`.
- **Índices:** `idx_agreement_history_agreement_id` (`agreement_id`).

---

### 2.16. TABLA: `attachments`
- **Propósito:** Metadatos de archivos adjuntos vinculados a reuniones o anotaciones. El binario físico reside en el bucket S3 privado.
- **Campos:**
  | Campo | Tipo PostgreSQL | Nulo | Default | Restricción / Comentario |
  |---|---|---|---|---|
  | `id` | `UUID` | NO | `gen_random_uuid()` | Clave Primaria. |
  | `meeting_id` | `UUID` | SÍ | NULL | FK a `meetings(id)` (si es anexo de sesión). |
  | `personal_note_id`| `UUID` | SÍ | NULL | FK a `personal_notes(id)` (si es anexo de nota). |
  | `uploaded_by_id` | `UUID` | NO | N/A | FK a `users(id)` que subió el documento. |
  | `original_filename`| `VARCHAR(255)`| NO | N/A | Nombre de archivo original aportado por usuario. |
  | `storage_key` | `VARCHAR(255)` | NO | N/A | Clave S3 interna generada (`vault/<uuid>`). Única. |
  | `mime_type` | `VARCHAR(100)` | NO | N/A | Tipo MIME validado por Magic Bytes. |
  | `file_size_bytes` | `BIGINT` | NO | N/A | Tamaño del archivo en bytes (hasta 25 MB). |
  | `sha256_checksum` | `VARCHAR(64)` | NO | N/A | Hash SHA-256 para verificación de integridad. |
  | `scan_status` | `VARCHAR(30)` | NO | `'PENDIENTE'` | Enum: `PENDIENTE_REVISION`, `LIMPIO`, `INFECTADO`, `ERROR_ESCANEO`. |
  | `is_deleted` | `BOOLEAN` | NO | `FALSE` | Eliminación lógica (*soft delete*). |
  | `version` | `INT` | NO | `1` | Versión documental. |
  | `created_at` | `TIMESTAMPTZ` | NO | `NOW()` | Fecha de carga. |
  | `updated_at` | `TIMESTAMPTZ` | NO | `NOW()` | Fecha de actualización. |
- **Restricciones:** `UK_attachments_storage_key` UNIQUE (`storage_key`).
- **Claves Foráneas:**
  - `FK_att_meetings` (`meeting_id` -> `meetings.id`) `ON DELETE RESTRICT`.
  - `FK_att_notes` (`personal_note_id` -> `personal_notes.id`) `ON DELETE RESTRICT`.
  - `FK_att_uploaders` (`uploaded_by_id` -> `users.id`) `ON DELETE RESTRICT`.
- **Índices:**
  - `idx_attachments_meeting` (`meeting_id`, `is_deleted`).
  - `idx_attachments_note` (`personal_note_id`, `is_deleted`).

---

### 2.17. TABLA: `attachment_versions`
- **Propósito:** Almacena versiones históricas de archivos modificados o reemplazados.
- **Campos:**
  | Campo | Tipo PostgreSQL | Nulo | Default | Restricción / Comentario |
  |---|---|---|---|---|
  | `id` | `UUID` | NO | `gen_random_uuid()` | Clave Primaria. |
  | `attachment_id` | `UUID` | NO | N/A | FK a `attachments(id)`. |
  | `version_number` | `INT` | NO | N/A | Correlativo de versión anterior. |
  | `storage_key` | `VARCHAR(255)` | NO | N/A | Clave S3 de la versión archivada. |
  | `file_size_bytes` | `BIGINT` | NO | N/A | Tamaño en bytes. |
  | `sha256_checksum` | `VARCHAR(64)` | NO | N/A | Hash de integridad. |
  | `uploaded_by_id` | `UUID` | NO | N/A | FK a `users(id)`. |
  | `created_at` | `TIMESTAMPTZ` | NO | `NOW()` | Fecha de archivado de la versión. |
- **Restricciones:** `UK_attachment_versions_unique` UNIQUE (`attachment_id`, `version_number`).
- **Claves Foráneas:**
  - `FK_av_attachments` (`attachment_id` -> `attachments.id`) `ON DELETE CASCADE`.
  - `FK_av_uploaders` (`uploaded_by_id` -> `users.id`) `ON DELETE RESTRICT`.

---

### 2.18. TABLA: `audit_logs`
- **Propósito:** Bitácora inmutable de eventos de seguridad y de negocio (*Append-Only*).
- **Campos:**
  | Campo | Tipo PostgreSQL | Nulo | Default | Restricción / Comentario |
  |---|---|---|---|---|
  | `id` | `BIGSERIAL` / `BIGINT` | NO | Secuencia | Clave Primaria monotónica creciente. |
  | `actor_id` | `UUID` | SÍ | NULL | FK a `users(id)`. NULL si el actor no autenticó. |
  | `action` | `VARCHAR(80)` | NO | N/A | Código de acción (ej. `NOTE_UPDATED`). |
  | `entity` | `VARCHAR(60)` | NO | N/A | Nombre de la entidad (ej. `PersonalNote`). |
  | `entity_id` | `VARCHAR(80)` | NO | N/A | ID de la entidad afectada. |
  | `ip_address` | `VARCHAR(45)` | NO | N/A | Dirección IP origen. |
  | `user_agent` | `VARCHAR(300)` | NO | N/A | Dispositivo / Navegador solicitante. |
  | `outcome` | `VARCHAR(20)` | NO | `'SUCCESS'` | Enum: `SUCCESS`, `FAILURE`, `DENIED`. |
  | `diff_payload` | `JSONB` | SÍ | NULL | Diff de campos (`before`, `after`) sin secretos. |
  | `created_at` | `TIMESTAMPTZ` | NO | `NOW()` | Marca de tiempo exacta UTC. |
- **Claves Foráneas:** `FK_audit_actors` (`actor_id` -> `users.id`) `ON DELETE SET NULL`.
- **Índices:**
  - `idx_audit_logs_created_at` (`created_at` DESC).
  - `idx_audit_logs_actor_created` (`actor_id`, `created_at`).
  - `idx_audit_logs_entity_lookup` (`entity`, `entity_id`).

---

### 2.19. TABLA: `system_settings`
- **Propósito:** Parámetros institucionales configurables globalmente (vigencias, logos, políticas).
- **Campos:**
  | Campo | Tipo PostgreSQL | Nulo | Default | Restricción / Comentario |
  |---|---|---|---|---|
  | `id` | `UUID` | NO | `gen_random_uuid()` | Clave Primaria. |
  | `setting_key` | `VARCHAR(80)` | NO | N/A | Clave única (ej. `SESSION_TIMEOUT_MINUTES`). |
  | `setting_value` | `TEXT` | NO | N/A | Valor serializado en texto o JSON. |
  | `description` | `VARCHAR(255)` | SÍ | NULL | Propósito de la directiva institucional. |
  | `is_public` | `BOOLEAN` | NO | `FALSE` | Determina si puede exponerse sin auth al login. |
  | `updated_at` | `TIMESTAMPTZ` | NO | `NOW()` | Fecha de última configuración. |
- **Restricciones:** `UK_settings_key` UNIQUE (`setting_key`).


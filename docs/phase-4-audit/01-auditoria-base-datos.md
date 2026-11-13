# 01. AUDITORÍA DE BASE DE DATOS Y MODELO RELACIONAL (MOD-03)
## MexAgenda — Sistema Privado de Gestión Institucional

### 1. Metodología de Inspección y Conexión Oficial

La auditoría de base de datos se ejecutó directamente sobre la base de datos oficial **Neon PostgreSQL** utilizando conexiones seguras SSL (tanto en modo *transaction pooling* para operaciones transaccionales concurrentes, como *direct URL* para migraciones e introspección DDL).

Archivos inspeccionados:
- `prisma/schema.prisma` (Entidades 14 y 15).
- `prisma/migrations/20261105111000_phase4_agreements_and_tracking/migration.sql`.
- Catálogo de llaves, índices y restricciones en PostgreSQL.

---

### 2. Estructura Relacional de Tablas de MOD-03

#### 2.1. Tabla Principal: `agreements`
Almacena el registro formal de cada acuerdo institucional emanado de una sesión colegiada.

| Columna | Tipo de Dato | Nulable | Restricción / Índice | Comportamiento |
| :--- | :--- | :---: | :--- | :--- |
| `id` | `UUID` | No | `PRIMARY KEY` | Identificador universal autogenerado (`uuid()`). |
| `folio` | `VARCHAR(60)` | No | `UNIQUE`, `INDEX` | Folio institucional único (`ACU-[PRE]-[AÑO]-[SEQ]`). |
| `title` | `VARCHAR(250)` | No | — | Título ejecutivo del acuerdo (mín. 3 caracteres). |
| `description` | `TEXT` | No | — | Mandato y alcance detallado acordado por el pleno. |
| `agreement_type` | `VARCHAR(50)` | No | Default: `'ORDINARIO'` | Taxonomía (`ORDINARIO`, `EXTRAORDINARIO`, `NORMATIVO`, `ADMINISTRATIVO`). |
| `meeting_id` | `UUID` | No | `FK -> meetings.id`, `INDEX` | **ON DELETE RESTRICT**. Impide borrar reuniones con acuerdos activos. |
| `category_id` | `UUID` | Sí | `FK -> meeting_categories.id` | **ON DELETE SET NULL**. Preserva acuerdo si la categoría se depura. |
| `agenda_item_id` | `UUID` | Sí | `FK -> meeting_agenda_items.id` | **ON DELETE SET NULL**. Enlace contextual con el debate del orden del día. |
| `minutes_id` | `UUID` | Sí | `FK -> meeting_minutes.id` | **ON DELETE SET NULL**. Vinculación con el acta formal aprobada. |
| `minutes_version_number`| `INTEGER`| Sí | — | Instantánea de la versión del acta al emitirse el acuerdo. |
| `approval_date`| `DATE` | No | Default: `CURRENT_DATE` | Fecha formal de aprobación plenaria. |
| `start_date` | `DATE` | Sí | — | Fecha de inicio programado de los trabajos. |
| `due_date` | `DATE` | No | `INDEX (due_date, status)` | Fecha límite de cumplimiento del acuerdo. |
| `completionDate`| `DATE` | Sí | — | Fecha en que se certificó el cumplimiento formal. |
| `priority` | `ENUM` | No | Default: `'MEDIA'` | `AgreementPriority` (`BAJA`, `MEDIA`, `ALTA`, `URGENTE`). |
| `status` | `ENUM` | No | `INDEX (status)` | `AgreementStatus` (`PENDIENTE`, `EN_PROCESO`, `CUMPLIDO`, `VENCIDO`, `SUSPENDIDO`, `CANCELADO`). |
| `progress_percent`| `INTEGER` | No | Default: `0` | Porcentaje de avance acumulado reportado (0 a 100). |
| `observations` | `TEXT` | Sí | — | Notas técnicas u operativas complementarias. |
| `change_reason`| `TEXT` | Sí | — | Justificación formal del último cambio crítico. |
| `created_by_id`| `UUID` | No | `FK -> users.id` | **ON DELETE RESTRICT**. Servidor público que registró el acuerdo. |
| `assigned_user_id`| `UUID` | No | `FK -> users.id`, `INDEX` | **ON DELETE RESTRICT**. Servidor público titular responsable directo. |
| `completed_by_id`| `UUID` | Sí | `FK -> users.id` | **ON DELETE SET NULL**. Autoridad que formalizó el cumplimiento. |
| `version` | `INTEGER` | No | Default: `1` | Control de concurrencia optimista (*optimistic locking*). |
| `is_archived` | `BOOLEAN` | No | Default: `false` | Bandera de baja lógica institucional. |
| `deleted_at` | `TIMESTAMP` | Sí | — | Marca temporal de borrado lógico. |
| `created_at` | `TIMESTAMP` | No | Default: `CURRENT_TIMESTAMP` | Creación inmutable del registro. |
| `updated_at` | `TIMESTAMP` | No | Auto-actualizado | Última mutación en la entidad. |

---

#### 2.2. Tabla de Coadyuvancia: `agreement_collaborators`
Regula los servidores públicos facultados para coadyuvar con el titular responsable.

| Columna | Tipo de Dato | Nulable | Restricción |
| :--- | :--- | :---: | :--- |
| `id` | `UUID` | No | `PRIMARY KEY` |
| `agreement_id` | `UUID` | No | `FK -> agreements.id` (**ON DELETE CASCADE**) |
| `user_id` | `UUID` | No | `FK -> users.id` (**ON DELETE RESTRICT**) |
| `assigned_at` | `TIMESTAMP` | No | Default: `CURRENT_TIMESTAMP` |
| `assigned_by_id` | `UUID` | No | `FK -> users.id` (**ON DELETE RESTRICT**) |
| `notes` | `VARCHAR(255)` | Sí | Rol o función desempeñada en la colaboración. |
| **Restricción Única** | — | — | `UNIQUE (agreement_id, user_id)` (Impide duplicar colaboradores). |

---

#### 2.3. Tabla de Seguimiento: `agreement_progress`
Bitácora de avances acumulativos (0% a 100%).

| Columna | Tipo de Dato | Nulable | Restricción |
| :--- | :--- | :---: | :--- |
| `id` | `UUID` | No | `PRIMARY KEY` |
| `agreement_id` | `UUID` | No | `FK -> agreements.id` (**ON DELETE CASCADE**) |
| `reported_by_id` | `UUID` | No | `FK -> users.id` (**ON DELETE RESTRICT**) |
| `reported_at` | `TIMESTAMP` | No | Default: `CURRENT_TIMESTAMP`, `INDEX (agreement_id, reported_at)` |
| `previous_percent` | `INTEGER` | No | Porcentaje antes de este reporte. |
| `new_percent` | `INTEGER` | No | Porcentaje asentado en este reporte. |
| `description` | `TEXT` | No | Descripción cualitativa de los avances realizados. |
| `observations` | `TEXT` | Sí | Observaciones adicionales del informante. |
| `resulting_status` | `ENUM` | Sí | Estado operativo adoptado (`AgreementStatus`). |
| `justification` | `TEXT` | Sí | **Obligatorio en decrementos:** motivo de la reducción porcentual. |

---

#### 2.4. Tabla de Evidencias: `agreement_evidences`
Metadatos y referencias oficiales de documentos sustentatorios (oficios, acuses, decretos).

| Columna | Tipo de Dato | Nulable | Restricción |
| :--- | :--- | :---: | :--- |
| `id` | `UUID` | No | `PRIMARY KEY` |
| `agreement_id` | `UUID` | No | `FK -> agreements.id` (**ON DELETE CASCADE**), `INDEX` |
| `progress_id` | `UUID` | Sí | `FK -> agreement_progress.id` (**ON DELETE SET NULL**) |
| `title` | `VARCHAR(250)` | No | Título de la evidencia aportada. |
| `description` | `TEXT` | Sí | Contexto y contenido del documento de respaldo. |
| `document_reference` | `VARCHAR(500)`| Sí | Número de oficio institucional o referencia documental. |
| `registered_by_id` | `UUID` | No | `FK -> users.id` (**ON DELETE RESTRICT**) |
| `created_at` | `TIMESTAMP` | No | Default: `CURRENT_TIMESTAMP` |

---

#### 2.5. Tabla de Auditoría Específica: `agreement_history`
Registro inmutable *append-only* de cada mutación de estado, reasignación o cambio de fecha compromiso.

| Columna | Tipo de Dato | Nulable | Restricción |
| :--- | :--- | :---: | :--- |
| `id` | `UUID` | No | `PRIMARY KEY` |
| `agreement_id` | `UUID` | No | `FK -> agreements.id` (**ON DELETE CASCADE**), `INDEX` |
| `action_type` | `VARCHAR(50)` | No | Default: `'STATUS_CHANGE'` |
| `previous_status` | `ENUM` | Sí | Estado anterior a la transición. |
| `new_status` | `ENUM` | Sí | Nuevo estado adoptado. |
| `previous_assigned_to_id`| `UUID` | Sí | `FK -> users.id` (**ON DELETE SET NULL**) |
| `new_assigned_to_id` | `UUID` | Sí | `FK -> users.id` (**ON DELETE SET NULL**) |
| `previous_due_date` | `DATE` | Sí | Plazo previo a la modificación. |
| `new_due_date` | `DATE` | Sí | Nuevo plazo acordado. |
| `previous_percent` | `INTEGER` | Sí | Porcentaje anterior. |
| `new_percent` | `INTEGER` | Sí | Porcentaje nuevo. |
| `progress_notes` | `TEXT` | Sí | Notas contextuales del cambio. |
| `change_reason` | `TEXT` | Sí | Fundamentación formal obligatoria del cambio. |
| `details` | `JSONB` | Sí | Contexto complementario estructurado. |
| `changed_by_id` | `UUID` | No | `FK -> users.id` (**ON DELETE RESTRICT**), `INDEX` |
| `created_at` | `TIMESTAMP` | No | Default: `CURRENT_TIMESTAMP` |

---

### 3. Verificación de No Destructividad e Integridad en Neon

Se verificó mediante consultas directas que la migración `20261105111000_phase4_agreements_and_tracking`:
1. **Preservó al 100% las tablas de Fases 1, 2 y 3:**  
   - Usuarios (`users`), roles (`roles`), permisos (`permissions`), sesiones (`sessions`) y bitácoras forenses (`audit_logs`) permanecieron intactos.
   - Categorías (`meeting_categories`), reuniones (`meetings`), puntos del orden del día (`meeting_agenda_items`), participantes (`meeting_participants`), historial de asistencia (`meeting_attendance_history`), bitácora de sesión (`meeting_session_logs`) y actas institucionales (`meeting_minutes`, `meeting_minutes_versions`) mantienen todas sus llaves e historiales.
2. **Fue estrictamente aditiva:**  
   Se añadieron columnas de gobernanza mediante sentencias `ALTER TABLE` seguras (`ADD COLUMN`, `ADD VALUE IF NOT EXISTS`).
3. **Consistencia de Llaves Foráneas y Restricciones:**  
   La prueba `DB-01` en `test:phase4-audit` comprobó que intentar eliminar físicamente una reunión que cuenta con acuerdos institucionales vinculados es impedido terminantemente por el motor PostgreSQL mediante la regla `ON DELETE RESTRICT`.

**Dictamen de Base de Datos:** **CONFORME Y CERTIFICADO SIN ERRORES.**


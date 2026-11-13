# INSPECCIÓN TÉCNICA DE LA API REST BACKEND — FASE 5
## Módulo MOD-04: Anotaciones Personales y Notas de Sesión

### 1. EVALUACIÓN EXHAUSTIVA DE LOS 11 ENDPOINTS

Se auditó minuciosamente el archivo [`apps/backend/src/modules/notes/notes.controller.ts`](file:///d:/MexAgenda/apps/backend/src/modules/notes/notes.controller.ts) y su servicio asociado [`notes.service.ts`](file:///d:/MexAgenda/apps/backend/src/modules/notes/notes.service.ts):

---

#### 1. `GET /notes/meeting/:meetingId`
- **Método y Ruta:** `GET /notes/meeting/:meetingId`
- **Autenticación:** Obligatoria (`SessionAuthGuard` vía cookie `__Host-session`).
- **Permisos RBAC:** `@RequirePermissions('note:read')`.
- **Validaciones:** Validación de existencia de reunión (`meetingId` UUID).
- **Autorización por Objeto:** Aplica `findAll` con filtro `meetingId` y reglas de visibilidad.
- **Transacciones:** N/A (Solo lectura).
- **Auditoría:** N/A (Consultas ordinarias no generan asientos en audit_logs para prevenir saturación).
- **Respuestas HTTP:** `200 OK`, `401 Unauthorized`, `403 Forbidden`, `404 Not Found`.
- **Riesgos Detectados:** Permite ver notas marcadas como `REUNION` a usuarios no participantes de dicha sesión (`FIND-05-02`).

---

#### 2. `GET /notes`
- **Método y Ruta:** `GET /notes`
- **Autenticación:** Obligatoria (`SessionAuthGuard`).
- **Permisos RBAC:** `@RequirePermissions('note:read')`.
- **Validaciones:** `QueryNotesDto` (paginación con mínimos/máximos, enum en categoría y visibilidad).
- **Autorización por Objeto:** Cláusula `where.OR` automática: solo notas propias, públicas o de reunión. Notas archivadas forzadas a `authorId = user.id` para usuarios estándar.
- **Transacciones:** N/A (Solo lectura con `Promise.all` para `count` y `findMany`).
- **Auditoría:** N/A.
- **Respuestas HTTP:** `200 OK`, `401 Unauthorized`, `403 Forbidden`.
- **Riesgos Detectados:** Ninguno.

---

#### 3. `POST /notes`
- **Método y Ruta:** `POST /notes`
- **Autenticación:** Obligatoria (`SessionAuthGuard`).
- **Permisos RBAC:** `@RequirePermissions('note:create')`.
- **Validaciones:** `CreateNoteDto` (`title` obligatorio máx. 250, `content` obligatorio, enums válidos). Validación relacional de `meetingId`, `agendaItemId` y `agreementId`.
- **Autorización por Objeto:** Inyección estricta de `authorId = user.id`. Inmune a Mass Assignment.
- **Transacciones:** No requerida (inserción atómica en `personal_notes`).
- **Auditoría:** Registra `NOTE_CREATED` en `audit_logs` con `outcome = SUCCESS`.
- **Respuestas HTTP:** `201 Created`, `400 Bad Request`, `401 Unauthorized`, `403 Forbidden`, `404 Not Found`.
- **Riesgos Detectados:** Ninguno.

---

#### 4. `GET /notes/:id`
- **Método y Ruta:** `GET /notes/:id`
- **Autenticación:** Obligatoria (`SessionAuthGuard`).
- **Permisos RBAC:** `@RequirePermissions('note:read')`.
- **Validaciones:** Parámetro `id` UUID v4.
- **Autorización por Objeto:** Si la nota es `PRIVADA` y el solicitante no es autor ni administrador, arroja `403 Forbidden`. Si está archivada y no es autor/admin, arroja `404 Not Found`.
- **Transacciones:** N/A (Lectura profunda con `include`).
- **Auditoría:** N/A.
- **Respuestas HTTP:** `200 OK`, `401 Unauthorized`, `403 Forbidden`, `404 Not Found`.
- **Riesgos Detectados:** Misma observación sobre visibilidad `REUNION` (`FIND-05-02`).

---

#### 5. `PUT /notes/:id`
- **Método y Ruta:** `PUT /notes/:id`
- **Autenticación:** Obligatoria (`SessionAuthGuard`).
- **Permisos RBAC:** `@RequirePermissions('note:update_own')`.
- **Validaciones:** `UpdateNoteDto` (`title` máx. 250, enums opcionales, `changeReason` máx. 500).
- **Autorización por Objeto:** Verificación estricta `note.authorId === user.id`. Si difiere, bloquea con `403 Forbidden` y registra `UNAUTHORIZED_NOTE_MUTATION_ATTEMPT` con `outcome: DENIED`.
- **Transacciones:** Creación de snapshot y actualización de nota secuenciales (`FIND-05-01`).
- **Auditoría:** Registra `NOTE_UPDATED` en `audit_logs` con versiones previa y nueva.
- **Respuestas HTTP:** `200 OK`, `400 Bad Request`, `401 Unauthorized`, `403 Forbidden`, `404 Not Found`.
- **Riesgos Detectados:** Falta de envoltura `$transaction` en caso de fallo intermedio (`FIND-05-01`).

---

#### 6. `PATCH /notes/:id`
- **Método y Ruta:** `PATCH /notes/:id`
- **Autenticación:** Obligatoria (`SessionAuthGuard`).
- **Permisos RBAC:** `@RequirePermissions('note:update_own')`.
- **Validaciones:** `UpdateNoteDto` (actualización parcial de favoritos, tags o metadatos).
- **Autorización por Objeto:** Idéntica a `PUT /notes/:id` (reutiliza `notesService.update`).
- **Transacciones:** Idéntica a `PUT /notes/:id`.
- **Auditoría:** Registra `NOTE_UPDATED` en `audit_logs`.
- **Respuestas HTTP:** `200 OK`, `400 Bad Request`, `401 Unauthorized`, `403 Forbidden`, `404 Not Found`.
- **Riesgos Detectados:** Idéntico a `PUT`.

---

#### 7. `POST /notes/:id/intervene`
- **Método y Ruta:** `POST /notes/:id/intervene`
- **Autenticación:** Obligatoria (`SessionAuthGuard`).
- **Permisos RBAC:** `@RequirePermissions('note:override_any')`.
- **Validaciones:** `AdminInterveneNoteDto` con `@MinLength(15)` en `adminJustification` validado tanto en DTO como en servicio.
- **Autorización por Objeto:** Exclusivo para administradores institucionales con el permiso correspondiente.
- **Transacciones:** Snapshot previo y actualización ejecutados secuencialmente (`FIND-05-01`).
- **Auditoría:** Registra `NOTE_ADMIN_OVERRIDE` en `audit_logs` con severidad `CRITICAL` y campos modificados.
- **Respuestas HTTP:** `200 OK`, `400 Bad Request`, `401 Unauthorized`, `403 Forbidden`, `404 Not Found`.
- **Riesgos Detectados:** Ausencia de `$transaction` (`FIND-05-01`).

---

#### 8. `GET /notes/:id/versions`
- **Método y Ruta:** `GET /notes/:id/versions`
- **Autenticación:** Obligatoria (`SessionAuthGuard`).
- **Permisos RBAC:** `@RequirePermissions('note:history:read')`.
- **Validaciones:** `id` UUID v4.
- **Autorización por Objeto:** Invoca `findById` previo, asegurando que un tercero no pueda auditar versiones de una nota que no tiene permitido consultar.
- **Transacciones:** N/A (Solo lectura).
- **Auditoría:** N/A.
- **Respuestas HTTP:** `200 OK`, `401 Unauthorized`, `403 Forbidden`, `404 Not Found`.
- **Riesgos Detectados:** Ninguno.

---

#### 9. `DELETE /notes/:id`
- **Método y Ruta:** `DELETE /notes/:id`
- **Autenticación:** Obligatoria (`SessionAuthGuard`).
- **Permisos RBAC:** `@RequirePermissions('note:delete_own')`.
- **Validaciones:** `id` UUID v4.
- **Autorización por Objeto:** Autoriza solo si `note.authorId === user.id` o si el usuario es `ROLE_ADMIN`. Si no, arroja `403 Forbidden` y asienta `UNAUTHORIZED_NOTE_DELETION_ATTEMPT`.
- **Transacciones:** Actualización de `deletedAt = new Date()`.
- **Auditoría:** Registra `NOTE_ARCHIVED` en `audit_logs`.
- **Respuestas HTTP:** `200 OK`, `401 Unauthorized`, `403 Forbidden`, `404 Not Found`.
- **Riesgos Detectados:** No sincroniza la columna `is_archived` en PostgreSQL (`FIND-05-03`).

---

#### 10. `POST /notes/:id/restore`
- **Método y Ruta:** `POST /notes/:id/restore`
- **Autenticación:** Obligatoria (`SessionAuthGuard`).
- **Permisos RBAC:** `@RequirePermissions('note:delete_own')`.
- **Validaciones:** `id` UUID v4. Valida que `note.deletedAt !== null` (si no, arroja `400 Bad Request`).
- **Autorización por Objeto:** Solo el autor o un administrador pueden restaurar.
- **Transacciones:** Actualización de `deletedAt = null`.
- **Auditoría:** Registra `NOTE_RESTORED` en `audit_logs`.
- **Respuestas HTTP:** `200 OK`, `400 Bad Request`, `401 Unauthorized`, `403 Forbidden`, `404 Not Found`.
- **Riesgos Detectados:** Ninguno.

---

#### 11. `DELETE /notes/:id/permanent`
- **Método y Ruta:** `DELETE /notes/:id/permanent`
- **Autenticación:** Obligatoria (`SessionAuthGuard`).
- **Permisos RBAC:** `@RequirePermissions('note:override_any')`.
- **Validaciones:** `id` UUID v4.
- **Autorización por Objeto:** Estrictamente reservado para administradores con `note:override_any`.
- **Transacciones:** **SÍ:** Implementa `this.prisma.$transaction([ deleteMany versions, delete note ])`.
- **Auditoría:** Registra `NOTE_PERMANENTLY_DELETED` en `audit_logs`.
- **Respuestas HTTP:** `200 OK`, `401 Unauthorized`, `403 Forbidden`, `404 Not Found`.
- **Riesgos Detectados:** Ninguno.

---

### 2. RESUMEN DE DEFENSAS CONTRA AMENAZAS COMUNES

- **Inyección SQL:** Mitigada al 100% mediante el uso de Prisma ORM con consultas parametrizadas nativas. No existen llamadas con concatenación cruda `$queryRawUnsafe`.
- **Cross-Site Scripting (XSS):** El frontend React 19 escapa de forma predeterminada cualquier cadena dentro de `{note.title}` o `{note.content}`. No se identificó el uso de `dangerouslySetInnerHTML`.
- **Mass Assignment:** Inmune; `authorId` se asigna exclusivamente en el backend desde la sesión.
- **Manejo de Excepciones:** Estandarizado mediante `GlobalExceptionFilter` bajo RFC 7807 Problem Details.


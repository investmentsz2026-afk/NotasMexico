# 00. AUDITORÍA PREVIA Y DIAGNÓSTICO INICIAL — FASE 5 (MOD-04)
## ANOTACIONES PERSONALES Y NOTAS DE SESIÓN
### MEXAGENDA — SISTEMA PRIVADO DE GESTIÓN INSTITUCIONAL

---

### 1. Resumen Ejecutivo del Diagnóstico

El presente diagnóstico técnico constituye la primera etapa obligatoria para la implementación de la **Fase 5 (MOD-04: Anotaciones Personales y Notas de Sesión)** de MexAgenda. Se realizó una auditoría preliminar del monorepo, inspeccionando la documentación histórica de la Fase 0, el modelo de datos en Neon PostgreSQL, los servicios y controladores en NestJS, el paquete `@mexagenda/shared`, la interfaz en Next.js 15 y el marco de ciberseguridad vigente.

El diagnóstico confirma que la arquitectura actual de MexAgenda es limpia, modular y desacoplada, ofreciendo cimientos sólidos para incorporar las capacidades de anotaciones personales y notas de sesión sin afectar ni alterar las funcionalidades operativas de Fases 1, 2, 3 y 4.

---

### 2. Arquitectura Actual del Sistema

```
+---------------------------------------------------------------------------------------+
|                                    CLIENTE NEXT.JS 15                                 |
|  - Layout institucional (Tailwind CSS, diseño responsive 320px a 1440px)              |
|  - AuthContext + Sesión persistente mediante cookies firmadas (__Host- / httpOnly)    |
|  - Módulos desplegados: Auth, MFA, Sesiones, Reuniones (MOD-02), Acuerdos (MOD-03)    |
+---------------------------------------------------------------------------------------+
                                            │ HTTP / JSON (Cookies seguras)
                                            ▼
+---------------------------------------------------------------------------------------+
|                                    BACKEND NESTJS                                     |
|  - [SessionAuthGuard]  ──▶ Valida vigencia de sesión contra Neon PostgreSQL           |
|  - [PermissionsGuard] ──▶ Evalúa permisos granulares RBAC declarados en decorador     |
|  - Módulos existentes: AuthModule, SessionsModule, MfaModule, AuditModule,            |
|                        MeetingCategoriesModule, MeetingsModule, AgreementsModule       |
|  - GlobalExceptionFilter: Mapeo limpio de errores HTTP y excepciones Prisma           |
+---------------------------------------------------------------------------------------+
                                            │ Prisma ORM (Pooler & Direct URL)
                                            ▼
+---------------------------------------------------------------------------------------+
|                                BASE DE DATOS NEON POSTGRESQL                          |
|  - 19 entidades activas: users, roles, permissions, sessions, audit_logs, meetings,   |
|    meeting_participants, meeting_agenda_items, meeting_minutes, agreements, etc.       |
|  - Entidades base preparadas en Fase 1: personal_notes, personal_note_versions        |
+---------------------------------------------------------------------------------------+
```

---

### 3. Componentes Reutilizables Identificados

#### 3.1. En el Backend (NestJS):
- **Guards de Seguridad:** `SessionAuthGuard` (validación de sesiones en DB con timeout de inactividad de 30 minutos) y `PermissionsGuard` (inspección de permisos en memoria de sesión).
- **Decoradores:** `@RequirePermissions(...)` para control funcional RBAC y `@CurrentUser()` para inyección limpia de `AuthUser`.
- **Servicio de Auditoría Forense:** `AuditService.logEvent(...)` para registro atómico en `audit_logs` con IP, UserAgent, diffPayload y estado de severidad.
- **Mapeador Global de Excepciones:** `GlobalExceptionFilter` para captura de códigos Prisma `P2002` (409 Conflict), `P2003` / `P2025` (404/400).

#### 3.2. En el Frontend (Next.js 15):
- **Sistema de Autenticación y Contexto:** `useAuth()` proporciona datos del usuario autenticado, roles y permisos efectivos.
- **Navegación Institucional:** `header-nav.tsx` cuenta con soporte para añadir enlaces de navegación accesibles.
- **Patrones de UI Existentes:** Modales accesibles con backdrop, tablas con scroll aislado (`overflow-x-auto`), formularios con validaciones reactivas y tarjetas métricas de estado.

---

### 4. Entidades Existentes y Relaciones Disponibles

En el esquema de Prisma (`schema.prisma` líneas 480-520), se encuentran definidas las entidades 12 y 13:

1. **`PersonalNote` (`personal_notes`):**
   - Campos actuales: `id` (UUID), `meetingId` (UUID, actualmente no nulo), `authorId` (UUID), `content` (TEXT), `version` (INT, default 1), `isAdminModified` (BOOLEAN), `lastAdminIntervenorId` (UUID), `isArchived` (BOOLEAN), `createdAt`, `updatedAt`.
   - Relaciones actuales: `meeting -> Meeting` (`ON DELETE RESTRICT`), `author -> User` (`ON DELETE RESTRICT`), `lastAdminIntervenor -> User` (`ON DELETE SET NULL`), `versions -> PersonalNoteVersion[]`.
2. **`PersonalNoteVersion` (`personal_note_versions`):**
   - Campos actuales: `id`, `personalNoteId`, `versionNumber`, `contentSnapshot`, `modifiedById`, `changeReason`, `isAdminIntervention`, `createdAt`.
   - Relación: `personalNote -> PersonalNote` (`ON DELETE CASCADE`), `modifiedBy -> User` (`ON DELETE RESTRICT`).

#### Diagnóstico del Estado de las Tablas en Neon:
- `PersonalNotes count: 0`.
- `PersonalNoteVersions count: 0`.
- Las tablas existen físicamente en Neon PostgreSQL desde la migración de Fase 1, pero se encuentran vacías, lo que permite realizar ajustes aditivos limpios sin necesidad de alterar datos existentes ni realizar migraciones destructivas.

---

### 5. Permisos Existentes vs Requeridos

Actualmente existen 28 permisos catalogados en Neon PostgreSQL:
- Usuarios (`user:read`, `user:create`, `user:update`, `user:delete`).
- Reuniones (`meeting:read`, `meeting:create`, `meeting:update`, `meeting:delete`, `meeting:attendance`, `meeting:minutes:approve`, `meeting:category:manage`).
- Acuerdos (`agreement:read`, `agreement:create`, `agreement:update`, `agreement:assign`, `agreement:progress:create`, `agreement:progress:read`, `agreement:complete`, `agreement:suspend`, `agreement:cancel`, `agreement:reactivate`, `agreement:history:read`, `agreement:report:read`, `agreement:manage`).
- Documentos y Sistema (`attachment:read`, `attachment:upload`, `audit:read`, `system:settings`).

**No existen permisos de anotaciones registrados actualmente en la base de datos.**

#### Permisos a Incorporar para MOD-04:
- `note:read`: Consultar catálogo de anotaciones personales autorizadas y notas de sesión.
- `note:create`: Redactar y publicar anotaciones personales y notas de sesión.
- `note:update_own`: Modificar exclusivamente las anotaciones y notas redactadas por el propio usuario.
- `note:delete_own`: Archivar o dar de baja lógica anotaciones propias.
- `note:history:read`: Consultar el historial de versiones de anotaciones autorizadas.
- `note:visibility:manage`: Configurar la visibilidad de notas personales (Privada, Reunión, Institucional).
- `note:override_any`: Facultad de intervención administrativa extraordinaria sobre notas ajenas (requiere permiso específico, justificación formal obligatoria >= 15 caracteres y genera auditoría CRITICAL).
- `note:admin:read`: Auditoría administrativa de notas institucionales.

---

### 6. Requisitos Originales de Fase 0

La documentación de Fase 0 (`docs/phase-0/02-requisitos-funcionales.md` y `docs/phase-0/08-matriz-roles-permisos.md`) establece los siguientes mandatos:

1. **Soberanía de Autoría:** "Transparencia deliberativa con inmutabilidad de autoría". Los consejeros plasman sus razonamientos; nadie puede modificar, suplantar ni borrar las palabras de otro consejero (`RF-NOTE-003`).
2. **Propiedad Estricta desde Sesión:** El `author_id` debe extraerse inmutablemente del token de sesión (`session.user_id`), nunca de un parámetro enviado libremente en el cuerpo de la petición HTTP.
3. **Control Anti-IDOR/BOLA:** El backend debe comprobar que `note.authorId === currentUser.id`. Si un usuario B intenta modificar o eliminar una nota de A, el backend debe arrojar `403 Forbidden` e inscribir un evento de alerta en `audit_logs` (`UNAUTHORIZED_NOTE_MUTATION_ATTEMPT`).
4. **Versionado Inmutable:** Toda modificación genera una versión histórica en `personal_note_versions` con el snapshot previo intacto.
5. **Intervención Administrativa Extraordinaria:** El administrador solo puede intervenir notas ajenas si:
   - Posee el permiso `note:override_any`.
   - Provee una justificación formal obligatoria (`adminJustification.length >= 15`).
   - Se crea una versión previa intacta.
   - La nota queda sellada con `is_admin_modified = true` y `last_admin_intervenor_id`.
   - Se registra evento con severidad `CRITICAL` en `audit_logs`.

---

### 7. Dependencias con MOD-02 y MOD-03

1. **Interoperabilidad con Reuniones (MOD-02):**  
   - Las notas de sesión se asocian a una reunión (`meetingId`).
   - Deben poder relacionarse contextualmente con un punto del orden del día (`agendaItemId`), permitiendo registrar deliberaciones o asuntos pendientes por tema.
   - **Regla Innegociable:** Las notas de sesión son apuntes de trabajo deliberativo y **NO constituyen actas oficiales** (`meeting_minutes`) ni alteran actas previamente aprobadas.
2. **Interoperabilidad con Acuerdos (MOD-03):**  
   - Una nota de sesión puede referenciar a un acuerdo institucional (`agreementId`) para dar seguimiento preliminar a compromisos acordados en asamblea.
   - Las llaves foráneas deben configurarse con `ON DELETE SET NULL` o `ON DELETE RESTRICT` para evitar eliminaciones en cascada que afecten acuerdos o reuniones.

---

### 8. Registro de Riesgos Técnicos Identificados

| ID | Riesgo Técnico | Severidad | Mitigación Arquitectónica |
| :--- | :--- | :---: | :--- |
| **R-01** | `meetingId` requerido en el esquema actual impide notas personales independientes | ALTO | Modificar `meetingId` a opcional (`String?`) en `PersonalNote`, permitiendo anotaciones institucionales libres o vinculadas a sesión. |
| **R-02** | Vulnerabilidad BOLA si la autorización solo evalúa permisos funcionales genéricos | ALTO | Validar titularidad estricta en el servicio: `note.authorId === currentUser.id` o permiso administrativo de intervención justificada. |
| **R-03** | Modificación administrativa silenciosa de notas ajenas | ALTO | Exigencia mandatoria de justificación formal (mínimo 15 caracteres), registro del intervenor y marcado de `isAdminModified`. |
| **R-04** | Confusión entre notas de sesión y actas institucionales | MEDIO | Delimitación estricta en backend y frontend: las notas no alteran `meeting_minutes` ni las versiones aprobadas de actas. |
| **R-05** | Desbordamiento de contenido largo o código en dispositivos móviles | MEDIO | Sanitización XSS, contención de layout con `break-words` y scroll vertical acotado. |

---

### 9. Cambios Necesarios en el Modelo de Datos

Para cubrir los requerimientos de la Fase 5 sin duplicar entidades innecesariamente, se propone enriquecer el modelo existente `PersonalNote` y `PersonalNoteVersion`:

1. **`PersonalNote`:**
   - `title`: `VARCHAR(250)` (Obligatorio, título descriptivo de la nota).
   - `meetingId`: Convertir de obligatorio a opcional (`UUID?`), permitiendo notas personales generales no vinculadas a una reunión.
   - `agendaItemId`: `UUID?` (Opcional, vínculo contextual con punto de orden del día).
   - `agreementId`: `UUID?` (Opcional, vínculo contextual con acuerdo de MOD-03).
   - `category`: `VARCHAR(50)` (Categoría: `GENERAL`, `JURIDICO`, `TECNICO`, `PRESUPUESTAL`, `ACUERDO`, `SESION`, etc.).
   - `noteType`: `VARCHAR(30)` (`PERSONAL`, `SESION`, `OBSERVACION`, `PENDIENTE`).
   - `visibility`: `VARCHAR(30)` (`PRIVADA`, `REUNION`, `PUBLICA`).
   - `isFavorite`: `BOOLEAN DEFAULT false` (Marcado de favoritas).
   - `tags`: `VARCHAR(255)?` (Etiquetas separadas por coma para búsqueda rápida).
   - `deletedAt`: `TIMESTAMP?` (Soporte de borrado lógico / restauración).
2. **`PersonalNoteVersion`:**
   - `titleSnapshot`: `VARCHAR(250)?` (Respaldo del título previo).
   - `adminJustification`: `TEXT?` (Fundamentación de intervención administrativa).
   - `changeReason`: `TEXT?` (Motivo de cambio reportado por el autor).

---

### 10. Estrategia de Migración en Neon PostgreSQL

1. Crear la migración aditiva incremental mediante Prisma: `20261105133000_phase5_personal_and_session_notes`.
2. Aplicar la migración utilizando el corredor oficial: `node scripts/prisma-runner.js migrate deploy`.
3. Ejecutar `node scripts/prisma-runner.js generate` para actualizar el cliente Prisma.
4. Sembrar los 8 nuevos permisos institucionales en Neon y asociarlos a los roles correspondientes mediante `scripts/bootstrap-admin.js`.

---

### 11. Plan de Pruebas Automatizadas (`test:phase5`)

Se estructurará una suite automatizada integral en `scripts/test-phase5.js` que verificará:
- **Gestión Funcional:** Creación, consulta, actualización, archivado y búsqueda de notas.
- **Seguridad y Privacidad (Anti-IDOR / Anti-BOLA):**
  - Rechazo de peticiones no autenticadas (401).
  - Rechazo si Usuario B intenta modificar la nota de Usuario A (403 Forbidden).
  - Rechazo si Usuario B intenta eliminar la nota de Usuario A (403 Forbidden).
  - Rechazo si el administrador intenta modificar sin justificación obligatoria (400 Bad Request).
- **Intervención Administrativa:** Aprobación cuando el administrador provee justificación formal, verificando el marcado `isAdminModified` y la creación de la versión previa.
- **Historial y Versionado:** Creación automática de snapshots en `personal_note_versions`.
- **Integridad y No Destructividad:** Confirmación de no afectación de reuniones, actas y acuerdos de fases previas.
- **Regresión:** Ejecución de suites existentes (`test:phase4-audit`, `test:phase4`, `test:phase3-audit`, `test:phase3`, `test:phase2`, `pnpm build`).

---

### 12. Conclusión del Diagnóstico

El diagnóstico inicial confirma la viabilidad plena de implementar la Fase 5 (MOD-04) sobre los cimientos arquitectónicos existentes. La propuesta respeta al 100% las reglas innegociables, aprovecha los modelos predefinidos enriqueciéndolos de forma aditiva y garantiza la soberanía de autoría y privacidad institucional requeridas.


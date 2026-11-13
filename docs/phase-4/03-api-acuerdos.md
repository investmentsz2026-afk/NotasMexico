# 03. ESPECIFICACIÓN DE LA API REST DE ACUERDOS INSTITUCIONALES (MOD-03)
## MexAgenda — Sistema Privado de Gestión Institucional

### 1. Resumen y Principios de Diseño de la API

La API de Acuerdos Institucionales (`/api/agreements` o `/agreements`) expone 23 endpoints RESTful construidos bajo los estándares de NestJS, TypeScript y OpenAPI/Swagger.

#### Principios rectores:
1. **Autenticación Obligatoria:** Todas las rutas requieren sesión institucional activa validada por `SessionAuthGuard` (cookie `mexagenda_session` firmada con HMAC).
2. **Autorización Granular (RBAC):** Cada endpoint evalúa permisos mediante el decorador `@RequirePermissions(...)` y el `PermissionsGuard`.
3. **Formato Estándar de Respuesta (`ApiResponse<T>`):**
   ```json
   {
     "success": true,
     "statusCode": 200,
     "data": { ... },
     "timestamp": "2026-11-05T12:00:00.000Z"
   }
   ```
4. **Control de Concurrencia Optimista:** Peticiones de actualización admiten el campo `version` (o `expectedVersion`); si la versión no coincide, retorna `409 Conflict`.
5. **Auditoría Forense en Operaciones de Mutación:** Se capturan automáticamente `ipAddress`, `userAgent` y `userId` para alimentar `agreement_history` y `audit_logs`.

---

### 2. Catálogo General de Endpoints

| Método | Endpoint | Permiso Requerido | Descripción |
| :--- | :--- | :--- | :--- |
| `GET` | `/agreements/dashboard` | `agreement:report:read` | Métricas ejecutivas, KPIs y actividad reciente |
| `GET` | `/agreements/reports` | `agreement:report:read` | Reportes de cumplimiento, semáforo preventivo y vencidos |
| `GET` | `/agreements/users` | `agreement:read` | Catálogo de usuarios activos asignables |
| `GET` | `/agreements/assigned` | `agreement:read` | Acuerdos asignados al usuario autenticado (titular o colaborador) |
| `GET` | `/agreements` | `agreement:read` | Listado general con paginación, búsqueda y filtros combinados |
| `POST` | `/agreements` | `agreement:create` | Creación de acuerdo con generación de folio institucional único |
| `GET` | `/agreements/:id` | `agreement:read` | Consulta de expediente institucional completo con relaciones |
| `PUT` | `/agreements/:id` | `agreement:update` | Actualización integral de metadatos del acuerdo |
| `PATCH` | `/agreements/:id` | `agreement:update` | Actualización parcial de metadatos del acuerdo |
| `DELETE` | `/agreements/:id` | `agreement:manage` | Archivo / baja institucional lógica del acuerdo |
| `POST` | `/agreements/:id/assign` | `agreement:assign` | Asignación o reasignación del responsable principal (titular) |
| `GET` | `/agreements/:id/collaborators` | `agreement:read` | Listado de colaboradores institucionales coadyuvantes |
| `POST` | `/agreements/:id/collaborators` | `agreement:assign` | Adición de colaborador institucional |
| `DELETE` | `/agreements/:id/collaborators/:userId` | `agreement:assign` | Remoción de colaborador institucional |
| `GET` | `/agreements/:id/progress` | `agreement:progress:read` | Historial cronológico de avances registrados |
| `POST` | `/agreements/:id/progress` | `agreement:progress:create` | Registro acumulativo de avance (0% a 100%) |
| `POST` | `/agreements/:id/complete` | `agreement:complete` | Formalización deliberada de cumplimiento de acuerdo |
| `POST` | `/agreements/:id/suspend` | `agreement:suspend` | Suspensión temporal con justificación obligatoria |
| `POST` | `/agreements/:id/reactivate` | `agreement:reactivate` | Reactivación formal de un acuerdo suspendido |
| `POST` | `/agreements/:id/cancel` | `agreement:cancel` | Cancelación definitiva con causa justificada indeleble |
| `GET` | `/agreements/:id/evidences` | `agreement:read` | Consulta de referencias documentales vinculadas |
| `POST` | `/agreements/:id/evidences` | `agreement:progress:create` | Registro de referencia de evidencia documental |
| `GET` | `/agreements/:id/history` | `agreement:history:read` | Bitácora de trazabilidad e historial inmutable de cambios |

---

### 3. Especificación Detallada por Endpoint

#### 3.1. Tablero y Reportes

##### `GET /agreements/dashboard`
- **Permiso:** `agreement:report:read`
- **Respuesta (200 OK):**
  ```json
  {
    "success": true,
    "statusCode": 200,
    "data": {
      "totalAgreements": 45,
      "pendingCount": 12,
      "inProgressCount": 18,
      "completedCount": 10,
      "overdueCount": 3,
      "suspendedCount": 1,
      "cancelledCount": 1,
      "complianceRate": 82.5,
      "urgentAgreements": [ ... ],
      "recentProgress": [ ... ],
      "byAssignee": [
        { "userId": "usr_1", "fullName": "Lic. Roberto Garza", "count": 14 }
      ]
    },
    "timestamp": "2026-11-05T12:00:00.000Z"
  }
  ```

##### `GET /agreements/reports`
- **Permiso:** `agreement:report:read`
- **Respuesta (200 OK):**
  ```json
  {
    "success": true,
    "statusCode": 200,
    "data": {
      "summary": {
        "total": 45,
        "completed": 10,
        "overdue": 3,
        "compliancePercentage": 82.5
      },
      "byPriority": { "BAJA": 5, "MEDIA": 20, "ALTA": 15, "URGENTE": 5 },
      "byType": { "ORDINARIO": 30, "EXTRAORDINARIO": 10, "NORMATIVO": 3, "ADMINISTRATIVO": 2 },
      "overdueList": [ ... ],
      "dueSoonList": [ ... ]
    },
    "timestamp": "2026-11-05T12:00:00.000Z"
  }
  ```

---

#### 3.2. Catálogos y Búsquedas

##### `GET /agreements/users`
- **Permiso:** `agreement:read`
- **Propósito:** Retorna lista de servidores públicos habilitados para asignación (`status = 'ACTIVO'` y `deletedAt IS NULL`).

##### `GET /agreements`
- **Permiso:** `agreement:read`
- **Parámetros Query:**
  - `page`: Número de página (default: 1)
  - `limit`: Elementos por página (default: 10, máx: 100)
  - `search`: Búsqueda textual por folio, título o descripción
  - `status`: Filtrado por estado (`PENDIENTE`, `EN_PROCESO`, `CUMPLIDO`, `VENCIDO`, `SUSPENDIDO`, `CANCELADO`)
  - `priority`: Filtrado por prioridad (`BAJA`, `MEDIA`, `ALTA`, `URGENTE`)
  - `meetingId`: Filtrado por identificador de reunión de origen
  - `assignedToId`: Filtrado por usuario responsable
  - `startDate` / `endDate`: Rango de fechas compromiso (`dueDate`)
  - `sortBy`: Campo de ordenamiento (`dueDate`, `createdAt`, `progressPercent`, `priority`)
  - `sortOrder`: Dirección (`asc` o `desc`)

---

#### 3.3. Creación y Actualización

##### `POST /agreements`
- **Permiso:** `agreement:create`
- **Body de Entrada (`CreateAgreementDto`):**
  ```json
  {
    "meetingId": "c33b49e1-fa36-40db-9491-38148b4566ec",
    "agendaItemId": "item_1234",
    "title": "Aprobación de la política institucional de seguridad de la información",
    "description": "Se aprueba por unanimidad la implementación obligatoria de MFA...",
    "priority": "ALTA",
    "type": "NORMATIVO",
    "dueDate": "2026-12-15",
    "assignedToId": "usr_c4819d4b"
  }
  ```
- **Lógica Interna:**
  1. Verifica que la reunión exista y no esté cancelada.
  2. Valida que el responsable exista y se encuentre en estado `ACTIVO`.
  3. Genera folio único transaccional mediante prefijo institucional (`ACU-SEC-2026-0001`).
  4. Inserta el acuerdo con `currentProgress = 0`, `status = 'PENDIENTE'` y `version = 1`.
  5. Registra el evento `CREACION` en `agreement_history` y `audit_logs`.

##### `PUT /agreements/:id` y `PATCH /agreements/:id`
- **Permiso:** `agreement:update`
- **Body (`UpdateAgreementDto`):**
  ```json
  {
    "title": "Título actualizado de acuerdo",
    "description": "Descripción complementaria...",
    "priority": "URGENTE",
    "dueDate": "2026-12-31",
    "version": 1
  }
  ```
- **Invariante:** Si el acuerdo se encuentra en estado `CUMPLIDO` o `CANCELADO`, la operación es rechazada con `BadRequestException (400)`. Si la versión enviada no concuerda con la base de datos, retorna `ConflictException (409)`.

---

#### 3.4. Asignación y Colaboradores

##### `POST /agreements/:id/assign`
- **Permiso:** `agreement:assign`
- **Body (`AssignAgreementDto`):**
  ```json
  {
    "assignedToId": "usr_nuevo_responsable",
    "justification": "Reasignación formal por cambio de titularidad de la Dirección General de Tecnologías."
  }
  ```
- **Regla:** Requiere obligatoriamente `justification`. Si el nuevo responsable ya era colaborador, se remueve automáticamente de la lista de colaboradores para evitar redundancia.

##### `POST /agreements/:id/collaborators`
- **Permiso:** `agreement:assign`
- **Body (`AddCollaboratorDto`):**
  ```json
  {
    "userId": "usr_colaborador",
    "role": "Coordinador de Enlace Técnico"
  }
  ```
- **Regla:** Impide asignar al mismo usuario responsable principal como colaborador (`BadRequestException`).

##### `DELETE /agreements/:id/collaborators/:userId`
- **Permiso:** `agreement:assign`
- **Regla:** Remueve el registro en `agreement_collaborators` y documenta la remoción en la bitácora de trazabilidad.

---

#### 3.5. Gestión de Avances

##### `POST /agreements/:id/progress`
- **Permiso:** `agreement:progress:create`
- **Body (`CreateAgreementProgressDto`):**
  ```json
  {
    "newPercent": 65,
    "description": "Se completó la fase de auditoría técnica y revisión de lineamientos.",
    "justification": "Se aclara que el porcentaje anterior disminuyó debido al ajuste del cronograma aprobado."
  }
  ```
- **Reglas del Negocio:**
  - El avance `newPercent` debe ser un entero entre 0 y 100.
  - Si el avance representa una **reducción** respecto al porcentaje actual (`newPercent < currentProgress`), el campo `justification` es **estrictamente obligatorio**. De omitirse, se rechaza con `BadRequestException (400)`.
  - Si el estado actual es `PENDIENTE` y el nuevo avance es `> 0`, el sistema actualiza automáticamente el estado a `EN_PROCESO`.
  - **REGLA DE ORO:** Si `newPercent == 100`, el acuerdo actualiza su `currentProgress = 100`, pero su estado **permanece en `EN_PROCESO`**. Para pasar a `CUMPLIDO`, es imperativo invocar `/complete`.

---

#### 3.6. Transiciones Formales de Estado

##### `POST /agreements/:id/complete`
- **Permiso:** `agreement:complete`
- **Body:** `{ "resolutionNotes": "Dictamen final emitido y aprobado en sesión ordinaria." }`
- **Efecto:** Establece `status = 'CUMPLIDO'`, fija `currentProgress = 100` y sella `closedAt = NOW()`. No permite modificaciones posteriores.

##### `POST /agreements/:id/suspend`
- **Permiso:** `agreement:suspend`
- **Body:** `{ "justification": "Suspensión temporal por veda presupuestal institucional." }`
- **Regla:** Justificación obligatoria (mínimo 5 caracteres). Estado pasa a `SUSPENDIDO`.

##### `POST /agreements/:id/reactivate`
- **Permiso:** `agreement:reactivate`
- **Body:** `{ "justification": "Se reanudan actividades al liberarse la partida presupuestal." }`
- **Regla:** Solo aplicable si el estado actual es `SUSPENDIDO`. Si `currentProgress > 0` retorna a `EN_PROCESO`; si es `0`, retorna a `PENDIENTE`.

##### `POST /agreements/:id/cancel`
- **Permiso:** `agreement:cancel`
- **Body:** `{ "justification": "Cancelación por derogación del proyecto por el H. Consejo Directivo." }`
- **Regla:** Justificación obligatoria. Transición a estado terminal `CANCELADO`.

---

#### 3.7. Evidencias Documentales e Historial

##### `POST /agreements/:id/evidences`
- **Permiso:** `agreement:progress:create`
- **Body (`CreateEvidenceDto`):**
  ```json
  {
    "documentReference": "OFICIO-DGT-2026-089",
    "description": "Acuse de recibo de la cédula de implementación de ciberseguridad."
  }
  ```

##### `GET /agreements/:id/history`
- **Permiso:** `agreement:history:read`
- **Respuesta:** Array ordenado descendentemente por `createdAt` con todos los cambios históricos inmutables registrados.


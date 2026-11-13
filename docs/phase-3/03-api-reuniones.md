# 03 — Catálogo de Endpoints de la API REST (Fase 3)

## 1. Visión General de la API

La API del módulo MOD-02 se encuentra expuesta bajo el prefijo `/api/v1` en el backend NestJS. Requiere autenticación mediante sesión de usuario activa (`SessionAuthGuard`) y control de acceso basado en roles y permisos institucionales (`PermissionsGuard`).

Todas las respuestas exitosas devuelven el esquema estándar:
```json
{
  "success": true,
  "data": { ... },
  "timestamp": "2026-11-20T10:00:00.000Z"
}
```

Las respuestas paginadas incluyen metadatos de navegación:
```json
{
  "success": true,
  "data": {
    "items": [ ... ],
    "meta": {
      "total": 45,
      "page": 1,
      "limit": 10,
      "totalPages": 5,
      "hasNextPage": true,
      "hasPreviousPage": false
    }
  }
}
```

---

## 2. Endpoints de Taxonomía y Categorías

Controlador: `MeetingCategoriesController` (`/api/v1/meeting-categories`).

| Método | Endpoint | Permiso Requerido | Descripción |
| :--- | :--- | :--- | :--- |
| `GET` | `/meeting-categories` | `meeting:read` | Lista categorías activas (o inactivas con `?includeInactive=true`). |
| `GET` | `/meeting-categories/:id` | `meeting:read` | Obtiene el detalle de una categoría institucional por su ID. |
| `POST` | `/meeting-categories` | `meeting:category:manage` | Crea una nueva categoría institucional con código y colorHex. |
| `PATCH` | `/meeting-categories/:id` | `meeting:category:manage` | Modifica nombre, descripción, color u orden de visualización. |
| `DELETE` | `/meeting-categories/:id` | `meeting:category:manage` | Desactiva suavemente la categoría (`isActive = false`). |

---

## 3. Endpoints Principales de Reuniones

Controlador: `MeetingsController` (`/api/v1/meetings`).

| Método | Endpoint | Permiso Requerido | Descripción |
| :--- | :--- | :--- | :--- |
| `GET` | `/meetings` | `meeting:read` | Listado paginado con filtros (`search`, `categoryId`, `status`, `modality`, `startDate`, `endDate`). |
| `GET` | `/meetings/:id` | `meeting:read` | Obtiene expediente integral de la reunión con subrecursos. |
| `POST` | `/meetings` | `meeting:create` | Programa una nueva reunión colegiada, genera folio e inscribe al convocador. |
| `PATCH` | `/meetings/:id` | `meeting:update` | Actualiza metadatos de la sesión e incrementa `version` de concurrencia. |
| `PATCH` | `/meetings/:id/status` | `meeting:update` | Cambia el estado del ciclo de vida colegiado validando transiciones legales. |
| `POST` | `/meetings/:id/archive` | `meeting:delete` | Archiva formalmente la reunión en el acervo institucional (`status: ARCHIVADA`). |

---

## 4. Endpoints de Convocatoria Oficial

| Método | Endpoint | Permiso Requerido | Descripción |
| :--- | :--- | :--- | :--- |
| `PUT` | `/meetings/:id/convocatoria` | `meeting:update` | Crea o actualiza el borrador de cédula notificatoria. |
| `POST` | `/meetings/:id/convocatoria/publish` | `meeting:update` | Publica la convocatoria, congela el padrón y cambia estatus a `CONVOCADA`. |

---

## 5. Endpoints del Orden del Día (Agenda)

| Método | Endpoint | Permiso Requerido | Descripción |
| :--- | :--- | :--- | :--- |
| `POST` | `/meetings/:id/agenda` | `meeting:update` | Agrega un nuevo punto secuencial al orden del día. |
| `PATCH` | `/meetings/:id/agenda/reorder` | `meeting:update` | Reordena atómicamente la lista de puntos en una sola transacción. |
| `PATCH` | `/meetings/:id/agenda/:itemId` | `meeting:update` | Modifica título, descripción, expositor o tiempo estimado. |
| `PATCH` | `/meetings/:id/agenda/:itemId/treated`| `meeting:update` | Marca el punto como desahogado (`isTreated = true`). |
| `DELETE`| `/meetings/:id/agenda/:itemId` | `meeting:update` | Aplica baja lógica al punto del orden del día (`isDeleted = true`). |

---

## 6. Endpoints de Participantes y Asistencia

| Método | Endpoint | Permiso Requerido | Descripción |
| :--- | :--- | :--- | :--- |
| `POST` | `/meetings/:id/participants` | `meeting:update` | Convoca a un integrante institucional o invitado externo. |
| `DELETE`| `/meetings/:id/participants/:pId` | `meeting:update` | Revoca la convocatoria de un participante de la sesión. |
| `PATCH` | `/meetings/:id/attendance/:pId` | `meeting:attendance` | Registra el pase de lista y genera entrada en `MeetingAttendanceHistory`. |

---

## 7. Endpoints de Desarrollo de Sesión y Bitácora

| Método | Endpoint | Permiso Requerido | Descripción |
| :--- | :--- | :--- | :--- |
| `POST` | `/meetings/:id/session/start` | `meeting:update` | Abre formalmente la sesión colegiada (`EN_DESARROLLO`), fija `realStartTime`. |
| `POST` | `/meetings/:id/session/end` | `meeting:update` | Clausura formalmente la sesión colegiada (`FINALIZADA`), fija `realEndTime`. |
| `POST` | `/meetings/:id/session/logs` | `meeting:update` | Asienta una deliberación, receso, moción o incidente en la bitácora. |
| `GET` | `/meetings/:id/session/logs` | `meeting:read` | Obtiene el historial de la bitácora en orden cronológico ascendente. |

---

## 8. Endpoints de Actas Institucionales

| Método | Endpoint | Permiso Requerido | Descripción |
| :--- | :--- | :--- | :--- |
| `PUT` | `/meetings/:id/minutes` | `meeting:update` | Redacta o actualiza el acta oficial (genera versión histórica si ya estaba aprobada). |
| `POST` | `/meetings/:id/minutes/send-to-revision`| `meeting:update` | Somete el acta a revisión formal de los integrantes colegiados. |
| `POST` | `/meetings/:id/minutes/approve` | `meeting:minutes:approve` | Aprueba formalmente el acta institucional, asienta fecha y aprobador. |
| `GET` | `/meetings/:id/minutes/versions` | `meeting:read` | Consulta el histórico inmutable de versiones del acta (MIN-006). |


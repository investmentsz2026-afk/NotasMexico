# ESPECIFICACIÓN DE LA API REST — FASE 7
## MEXAGENDA — SISTEMA PRIVADO DE GESTIÓN INSTITUCIONAL
### MÓDULO: MOD-06 — SISTEMA DE NOTIFICACIONES INSTITUCIONALES Y SERVICIO DE CORREO SMTP

---

### 1. CONVENCIONES Y PREFIJO GLOBAL

- **Prefijo Global:** `/api/v1`
- **Ruta Base del Módulo:** `/api/v1/notifications`
- **Autenticación:** Requerida en todos los endpoints mediante Cookie de Sesión HttpOnly (`__Host-mexagenda_session`) o Bearer Token.
- **Formato de Respuesta Exitoso:**
  ```json
  {
    "success": true,
    "statusCode": 200,
    "data": { ... },
    "timestamp": "2026-11-06T17:34:00.000Z"
  }
  ```
- **Formato de Respuesta de Error (RFC 7807):**
  ```json
  {
    "type": "https://mexagenda.org/errors/403",
    "title": "Forbidden",
    "status": 403,
    "detail": "No tiene permisos para modificar esta notificación",
    "instance": "/api/v1/notifications/uuid-123/read",
    "timestamp": "2026-11-06T17:34:00.000Z"
  }
  ```

---

### 2. DETALLE DE ENDPOINTS REST

#### 1. `GET /api/v1/notifications`
- **Descripción:** Obtiene la lista paginada de notificaciones del usuario autenticado.
- **Permiso:** `notification:read`
- **Query Params:**
  * `page` (opcional, entero ≥ 1, default 1)
  * `limit` (opcional, entero 1-100, default 20)
  * `isRead` (opcional, boolean `true` o `false`)
  * `type` (opcional, `NotificationType`)
- **Respuesta:** `200 OK` con `PaginatedResponse<NotificationItem>`.

#### 2. `GET /api/v1/notifications/unread-count`
- **Descripción:** Retorna el número de avisos no leídos para actualizar el badge de la campana.
- **Permiso:** `notification:read`
- **Respuesta:**
  ```json
  {
    "success": true,
    "statusCode": 200,
    "data": { "unreadCount": 3 },
    "timestamp": "2026-11-06T17:34:00.000Z"
  }
  ```

#### 3. `GET /api/v1/notifications/preferences`
- **Descripción:** Consulta las preferencias individuales de notificación del usuario.
- **Permiso:** `notification:read`
- **Respuesta:** `200 OK` con objeto `NotificationPreference`.

#### 4. `PATCH /api/v1/notifications/preferences`
- **Descripción:** Actualiza las preferencias de alerta y canales del usuario.
- **Permiso:** `notification:update`
- **Body JSON:**
  ```json
  {
    "emailEnabled": true,
    "inAppEnabled": true,
    "meetingAlerts": true,
    "agreementAlerts": false,
    "minutesAlerts": true,
    "generalAlerts": true
  }
  ```
- **Respuesta:** `200 OK` con las preferencias actualizadas.

#### 5. `PATCH /api/v1/notifications/read-all`
- **Descripción:** Marca todas las notificaciones pendientes del usuario como leídas.
- **Permiso:** `notification:update`
- **Respuesta:**
  ```json
  {
    "success": true,
    "statusCode": 200,
    "data": { "updatedCount": 5 },
    "timestamp": "2026-11-06T17:34:00.000Z"
  }
  ```

#### 6. `PATCH /api/v1/notifications/:id/read`
- **Descripción:** Marca una notificación específica como leída.
- **Permiso:** `notification:update`
- **Parámetros de Ruta:** `id` (UUID v4 de la notificación).
- **Respuesta:** `200 OK` con el registro actualizado.

#### 7. `DELETE /api/v1/notifications/:id`
- **Descripción:** Elimina una notificación propia de la bandeja del usuario.
- **Permiso:** `notification:delete`
- **Parámetros de Ruta:** `id` (UUID v4 de la notificación).
- **Respuesta:** `200 OK`.

#### 8. `GET /api/v1/notifications/admin/deliveries`
- **Descripción:** Bitácora administrativa de entregas outbox (solo administradores).
- **Permiso:** `notification:admin:manage`
- **Query Params:** `page`, `limit`.
- **Respuesta:** `200 OK` con listado paginado de `NotificationDelivery`.

#### 9. `POST /api/v1/notifications/admin/deliveries/:id/retry`
- **Descripción:** Reintenta manualmente una entrega fallida en la cola outbox.
- **Permiso:** `notification:admin:manage`
- **Parámetros de Ruta:** `id` (UUID v4 de la entrega).
- **Respuesta:** `200 OK` con confirmación de reprogramación.


# CONTROL DE ACCESO (RBAC), PRIVACIDAD Y SEGURIDAD — FASE 7
## MEXAGENDA — SISTEMA PRIVADO DE GESTIÓN INSTITUCIONAL
### MÓDULO: MOD-06 — SISTEMA DE NOTIFICACIONES INSTITUCIONALES Y SERVICIO DE CORREO SMTP

---

### 1. MODELO DE CONTROL DE ACCESO BASADO EN ROLES (RBAC)

El módulo MOD-06 se integra al esquema de autorización granular institucional mediante 4 permisos registrados en la tabla `permissions` de Neon PostgreSQL:

| Código de Permiso | Nombre del Recurso | Acción Autorizada | `ROLE_ADMIN` | `ROLE_USER` |
| :--- | :--- | :--- | :---: | :---: |
| `notification:read` | `notifications` | Consultar notificaciones y preferencias propias | **SÍ** | **SÍ** |
| `notification:update`| `notifications` | Marcar avisos como leídos y modificar preferencias | **SÍ** | **SÍ** |
| `notification:delete`| `notifications` | Descartar o eliminar avisos propios de la bandeja | **SÍ** | **SÍ** |
| `notification:admin:manage` | `notifications` | Auditoría de entregas outbox y reintentos manuales | **SÍ** | **NO** |

---

### 2. MATRIZ DE PROTECCIÓN DE ENDPOINTS

Todos los métodos del controlador [`NotificationsController`](file:///d:/MexAgenda/apps/backend/src/modules/notifications/notifications.controller.ts) están blindados con la combinación obligatoria de guards:
```typescript
@UseGuards(SessionAuthGuard, PermissionsGuard)
```

| Método HTTP | Endpoint | Permiso Requerido | Privilegio Mínimo |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/notifications` | `notification:read` | `ROLE_USER` |
| `GET` | `/api/v1/notifications/unread-count` | `notification:read` | `ROLE_USER` |
| `GET` | `/api/v1/notifications/preferences` | `notification:read` | `ROLE_USER` |
| `PATCH` | `/api/v1/notifications/preferences` | `notification:update` | `ROLE_USER` |
| `PATCH` | `/api/v1/notifications/read-all` | `notification:update` | `ROLE_USER` |
| `PATCH` | `/api/v1/notifications/:id/read` | `notification:update` | `ROLE_USER` |
| `DELETE` | `/api/v1/notifications/:id` | `notification:delete` | `ROLE_USER` |
| `GET` | `/api/v1/notifications/admin/deliveries` | `notification:admin:manage` | `ROLE_ADMIN` |
| `POST` | `/api/v1/notifications/admin/deliveries/:id/retry` | `notification:admin:manage` | `ROLE_ADMIN` |

---

### 3. MITIGACIÓN DE VULNERABILIDADES IDOR / BOLA (OWASP API1:2023)

Para evitar la consulta o manipulación indebida de recursos entre usuarios autenticados:
1. **Filtro de Consulta Forzado:** En `findAll`, el backend inyecta de forma imperativa `where: { userId: user.id }`. Resulta imposible que un usuario consulte los avisos de otro usuario aún manipulando los parámetros de query.
2. **Validación de Propiedad:** En `markAsRead` y `delete`, el servicio compara la titularidad:
   ```typescript
   if (notif.userId !== userId) {
     throw new ForbiddenException('No tiene permisos para modificar esta notificación');
   }
   ```
   Cualquier intento de alteración sobre un ID ajeno retorna **HTTP 403 Forbidden**.

---

### 4. REGLAS ESTRICTAS DE PRIVACIDAD EN ENTIDADES VINCULADAS

#### A. Anotaciones Personales (Máxima Confidencialidad):
- **Regla Inquebrantable:** Toda nota con visibilidad `PRIVADA` tiene **estrictamente prohibido generar notificaciones a terceros**, tanto dentro de la plataforma como por correo electrónico.
- **Mecanismo de Bloqueo:** En `notifyNoteShared`:
  ```typescript
  if (note.visibility === 'PRIVADA') {
    throw new BadRequestException('Las notas privadas no pueden emitir notificaciones institucionales.');
  }
  ```
- Para notas con visibilidad `REUNION`, el sistema consulta la tabla `meeting_participants` y despacha únicamente a los integrantes convocados a la sesión correspondiente.

#### B. Sesiones y Acuerdos:
- Las convocatorias y modificaciones solo se transmiten a los integrantes registrados en la sesión.
- Las notificaciones de acuerdos se circunscriben exclusivamente al responsable titular y al equipo de colaboradores designados.


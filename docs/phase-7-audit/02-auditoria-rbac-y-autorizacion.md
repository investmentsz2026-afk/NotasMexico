# Auditoría Fase 7 — 02. Auditoría de RBAC, Autorización y Aislamiento Multi-usuario

## 1. Matriz de Permisos RBAC de Fase 7

Se auditó la configuración de permisos institucionales en Neon PostgreSQL y la protección de endpoints mediante `SessionAuthGuard`, `PermissionsGuard` y `@RequirePermissions`.

| Permiso | Propósito Institucional | Asignación en ROLE_USER | Asignación en ROLE_ADMIN | Verificación Técnica |
| :--- | :--- | :---: | :---: | :---: |
| `notification:read` | Consultar notificaciones propias, preferencias y contador no leídas | SÍ | SÍ | VERIFICADO |
| `notification:update` | Marcar lecturas (individual o masivo) y actualizar preferencias | SÍ | SÍ | VERIFICADO |
| `notification:delete` | Eliminar o descartar notificaciones propias | SÍ | SÍ | VERIFICADO |
| `notification:admin:manage` | Administrar cola outbox y reintentar envíos fallidos | NO | SÍ | VERIFICADO |

---

## 2. Pruebas Negativas y Control de Acceso Ordinario vs Administrativo

Se ejecutaron pruebas automatizadas independientes simulando usuarios con credenciales ordinarias (`ROLE_USER`):
1. **Acceso a `/api/v1/notifications/admin/deliveries`:**
   - Un usuario sin `notification:admin:manage` es rechazado con código HTTP 403 Forbidden.
2. **Reintento de entregas fallidas `/api/v1/notifications/admin/deliveries/:id/retry`:**
   - Un usuario sin `notification:admin:manage` es bloqueado con HTTP 403 Forbidden.

---

## 3. Pruebas de Penetración IDOR / BOLA (OWASP API1:2023)

Se crearon dos usuarios independientes de prueba (Usuario A y Usuario B) para validar el aislamiento horizontal de recursos:

1. **Lectura y Exposición de Bandeja:**
   - Usuario B ejecutó `findAll()`.
   - Evidencia: Ninguna notificación perteneciente a Usuario A fue incluida en el resultado paginado. La cláusula `where: { userId }` confina estrictamente los registros al actor autenticado.
2. **Marcado de Lectura Cruzado:**
   - Usuario B intentó invocar `markAsRead(notifA.id, userB.id)`.
   - Evidencia: El sistema evaluó `notif.userId !== userId` y lanzó inmediatamente una `ForbiddenException (403: No tiene permisos para modificar esta notificación)`.
3. **Eliminación Cruzada:**
   - Usuario B intentó invocar `delete(notifA.id, userB.id)`.
   - Evidencia: El sistema evaluó la titularidad y bloqueó la operación con `ForbiddenException (403)`.
4. **Marcado Masivo Aislado:**
   - Usuario B ejecutó `markAllAsRead(userB.id)`.
   - Evidencia: El contador y estado de las notificaciones de Usuario A permanecieron completamente inalterados (`isRead: false`).

**Resultado de Auditoría de RBAC y Aislamiento:** **VERIFICADO (100% Conforme y Seguro).**


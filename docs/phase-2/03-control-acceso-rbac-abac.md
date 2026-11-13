# DOCUMENTO 03: CONTROL DE ACCESO BASADO EN ROLES Y PROPIEDAD (RBAC / ABAC)
## Sistema Privado de Gestión Institucional (MexAgenda)
**Fase:** 2 — Autenticación, Sesiones Seguras y Control de Acceso (`MOD-01`)  
**Versión:** 1.0.0  
**Fecha:** Noviembre 2026  

---

## 1. MODELO DE CONTROL DE ACCESO EN BASE DE DATOS

El sistema implementa una matriz desacoplada de control de acceso basada en roles (**RBAC Granular**) mediante las entidades `roles`, `permissions` y `role_permissions` en Neon PostgreSQL.

```
┌─────────────┐       ┌──────────────────┐       ┌─────────────────┐
│    Role     │ 1───N │  RolePermission  │ N───1 │   Permission    │
│ (ROLE_ADMIN)│       │ (role_id, perm_id│       │  (code, action) │
└─────────────┘       └──────────────────┘       └─────────────────┘
       ▲
       │ 1
       │
       │ N
┌─────────────┐
│    User     │
│ (role_id)   │
└─────────────┘
```

---

## 2. CATÁLOGO OFICIAL DE PERMISOS INSTITUCIONALES (15 PERMISOS)

```
+---------------------+-------------------+------------+-------------------------------------------------------+
| CÓDIGO PERMISO      | RECURSO (ENTITY)  | ACCIÓN     | DESCRIPCIÓN INSTITUCIONAL                             |
+---------------------+-------------------+------------+-------------------------------------------------------+
| `user:read`         | `users`           | `read`     | Consultar directorio de usuarios y consejeros         |
| `user:create`       | `users`           | `create`   | Registrar nuevos integrantes institucionales          |
| `user:update`       | `users`           | `update`   | Modificar datos institucionales o suspender accesos   |
| `user:delete`       | `users`           | `delete`   | Desactivar o eliminar usuarios                        |
| `meeting:read`      | `meetings`        | `read`     | Consultar convocatorias y órdenes del día             |
| `meeting:create`    | `meetings`        | `create`   | Convocar a sesiones ordinarias o extraordinarias      |
| `meeting:update`    | `meetings`        | `update`   | Modificar agenda o actas de sesiones                  |
| `meeting:delete`    | `meetings`        | `delete`   | Cancelar o archivar reuniones                         |
| `agreement:read`    | `agreements`      | `read`     | Consultar acuerdos vinculantes aprobados              |
| `agreement:create`  | `agreements`      | `create`   | Registrar nuevos acuerdos aprobados en actas          |
| `agreement:update`  | `agreements`      | `update`   | Actualizar estado de avance de los acuerdos           |
| `attachment:read`   | `attachments`     | `read`     | Consultar y descargar actas y anexos de la bóveda     |
| `attachment:upload` | `attachments`     | `upload`   | Subir documentos y dictámenes a la bóveda             |
| `audit:read`        | `audit_logs`      | `read`     | Consultar bitácora forense de operaciones y accesos   |
| `system:settings`   | `system_settings` | `admin`    | Modificar parámetros globales y políticas del sistema |
+---------------------+-------------------+------------+-------------------------------------------------------+
```

---

## 3. MATRIZ DE ASIGNACIÓN A ROLES DEL SISTEMA

### 3.1. Rol: Administrador Institucional (`ROLE_ADMIN`)
- **Propósito:** Gobierno integral del sistema, auditoría de seguridad y gestión de identidades.
- **MFA:** Obligatorio para iniciar sesión.
- **Permisos Asignados:** Los **15 permisos** del catálogo oficial.

### 3.2. Rol: Usuario Institucional (`ROLE_USER`)
- **Propósito:** Consejeros, directores y secretarios técnicos que participan en reuniones y dan seguimiento a acuerdos.
- **MFA:** Configurable.
- **Permisos Base Asignados:**
  - `meeting:read`: Acceso de lectura a las reuniones institucionales.
  - `agreement:read`: Acceso de lectura a los acuerdos asignados o públicos del comité.
  - `attachment:read`: Descarga y lectura de anexos vinculados a sus sesiones.
- **Aislamiento Estricto:** Un usuario con rol `ROLE_USER` no puede invocar endpoints de gestión de usuarios, auditoría ni configuraciones globales (retorna HTTP 403 Forbidden).

---

## 4. JERARQUÍA DE GUARDIAS EN NESTJS

Las restricciones de acceso se aplican en la capa de controladores mediante tres niveles de verificación independiente:

1. **`SessionAuthGuard`:**
   - Extrae el token de la cookie `__Host-mexagenda_session` (o encabezado `Authorization: Bearer`).
   - Verifica que el hash exista en `user_sessions`, que no esté revocado y que no haya expirado por inactividad (>30 min) o vida máxima (>8 h).
   - Comprueba que el usuario tenga estatus `ACTIVO`.
   - Inyecta el usuario con sus permisos en `request.user`.
2. **`RolesGuard` (`@Roles('ROLE_ADMIN')`):**
   - Comprueba si el rol del usuario autenticado coincide con la lista de roles autorizados.
   - Si no coincide, detiene la solicitud de inmediato con HTTP 403 Forbidden.
3. **`PermissionsGuard` (`@RequirePermissions('user:create')`):**
   - Comprueba que el usuario posea explícitamente el permiso granular exigido por el endpoint.
4. **Control de Propiedad ABAC (Sentando bases para Fase 5):**
   - Valida que `resource.authorId === session.userId` para evitar vulnerabilidades de Referencia Directa Insegura a Objetos (IDOR/BOLA).


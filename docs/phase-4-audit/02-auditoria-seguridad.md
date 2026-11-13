# 02. AUDITORÍA DE SEGURIDAD Y CONTROL DE ACCESO (RBAC) (MOD-03)
## MexAgenda — Sistema Privado de Gestión Institucional

### 1. Marco de Seguridad y Filosofía de Defensa en Profundidad

La auditoría de seguridad del módulo **MOD-03 (Acuerdos Institucionales)** analizó la efectividad de las barreras de autenticación, control de acceso basado en roles (RBAC), verificación de sesiones y sanitización de datos conforme a los estándares de OWASP Top 10 y directrices de seguridad de la administración pública.

Toda petición dirigida a `/agreements` atraviesa indefectiblemente dos capas de protección en NestJS:
1. **`SessionAuthGuard` (Capa de Autenticación e Identidad):**  
   Extrae la cookie criptográfica firmada `mexagenda_session`, consulta la sesión en Neon PostgreSQL y verifica que no esté revocada ni expirada por inactividad (> 30 minutos). Inyecta el objeto autenticado `AuthUser` en el contexto de ejecución.
2. **`PermissionsGuard` (Capa de Autorización Granular):**  
   Extrae los metadatos de permisos declarados con `@RequirePermissions(...)` en el controlador y valida contra el catálogo de permisos efectivos del usuario. Si el usuario carece de cualquiera de los permisos exigidos, la petición es interceptada antes de invocar el servicio, retornando `403 Forbidden`.

---

### 2. Resultados de las Pruebas Negativas de Autorización (`SEC-AUDIT`)

Se ejecutó la suite automatizada `scripts/test-phase4-audit.js` directamente contra los guards y servicios de producción en Neon PostgreSQL. Los 9 casos de prueba negativos fueron aprobados con éxito al 100%:

| Código | Control de Seguridad Auditado | Permiso Exigido | Comportamiento Esperado | Código HTTP | Resultado |
| :--- | :--- | :--- | :--- | :---: | :---: |
| **`SEC-AUDIT-01`** | Petición sin autenticación | — | Rechazo inmediato por falta de credenciales de sesión | `401 Unauthorized` | **APROBADO** |
| **`SEC-AUDIT-02`** | Token de sesión revocado / inexistente | — | Rechazo por sesión no hallada o invalidada en base de datos | `401 Unauthorized` | **APROBADO** |
| **`SEC-AUDIT-03`** | Creación de acuerdo sin permiso | `agreement:create` | Servidor público sin permiso bloqueado al intentar crear acuerdos | `403 Forbidden` | **APROBADO** |
| **`SEC-AUDIT-04`** | Modificación general sin permiso | `agreement:update` | Servidor público sin permiso bloqueado al modificar título/fechas | `403 Forbidden` | **APROBADO** |
| **`SEC-AUDIT-05`** | Reasignación de titular sin permiso | `agreement:assign` | Servidor público sin permiso bloqueado al reasignar responsable | `403 Forbidden` | **APROBADO** |
| **`SEC-AUDIT-06`** | Cumplimiento formal sin permiso | `agreement:complete` | Servidor público sin permiso bloqueado al intentar cerrar acuerdo | `403 Forbidden` | **APROBADO** |
| **`SEC-AUDIT-07`** | Suspensión temporal sin permiso | `agreement:suspend` | Servidor público sin permiso bloqueado al suspender acuerdo | `403 Forbidden` | **APROBADO** |
| **`SEC-AUDIT-08`** | Baja / Archivado sin permiso | `agreement:manage` | Servidor público sin permiso bloqueado al archivar acuerdos | `403 Forbidden` | **APROBADO** |
| **`SEC-AUDIT-09`** | Consulta de historial sin permiso | `agreement:history:read` | Servidor público sin permiso bloqueado al consultar trazabilidad | `403 Forbidden` | **APROBADO** |

---

### 3. Matriz Exhaustiva de Permisos en el Controlador

El controlador [`AgreementsController`](file:///d:/MexAgenda/apps/backend/src/modules/agreements/agreements.controller.ts) implementa la siguiente asociación estricta:

```
[Cliente HTTP] ──▶ SessionAuthGuard (401 si falla) ──▶ PermissionsGuard (403 si falla) ──▶ AgreementsController
```

- `GET /agreements/dashboard` ──▶ `@RequirePermissions('agreement:report:read')`
- `GET /agreements/reports` ──▶ `@RequirePermissions('agreement:report:read')`
- `GET /agreements/users` ──▶ `@RequirePermissions('agreement:read')`
- `GET /agreements/assigned` ──▶ `@RequirePermissions('agreement:read')`
- `GET /agreements` ──▶ `@RequirePermissions('agreement:read')`
- `POST /agreements` ──▶ `@RequirePermissions('agreement:create')`
- `GET /agreements/:id` ──▶ `@RequirePermissions('agreement:read')`
- `PUT /agreements/:id` ──▶ `@RequirePermissions('agreement:update')`
- `PATCH /agreements/:id` ──▶ `@RequirePermissions('agreement:update')`
- `DELETE /agreements/:id` ──▶ `@RequirePermissions('agreement:manage')`
- `POST /agreements/:id/assign` ──▶ `@RequirePermissions('agreement:assign')`
- `GET /agreements/:id/collaborators` ──▶ `@RequirePermissions('agreement:read')`
- `POST /agreements/:id/collaborators` ──▶ `@RequirePermissions('agreement:assign')`
- `DELETE /agreements/:id/collaborators/:userId` ──▶ `@RequirePermissions('agreement:assign')`
- `GET /agreements/:id/progress` ──▶ `@RequirePermissions('agreement:progress:read')`
- `POST /agreements/:id/progress` ──▶ `@RequirePermissions('agreement:progress:create')`
- `POST /agreements/:id/complete` ──▶ `@RequirePermissions('agreement:complete')`
- `POST /agreements/:id/suspend` ──▶ `@RequirePermissions('agreement:suspend')`
- `POST /agreements/:id/reactivate` ──▶ `@RequirePermissions('agreement:reactivate')`
- `POST /agreements/:id/cancel` ──▶ `@RequirePermissions('agreement:cancel')`
- `GET /agreements/:id/evidences` ──▶ `@RequirePermissions('agreement:read')`
- `POST /agreements/:id/evidences` ──▶ `@RequirePermissions('agreement:progress:create')`
- `GET /agreements/:id/history` ──▶ `@RequirePermissions('agreement:history:read')`

---

### 4. Sanitización y Protección contra Inyecciones

1. **Parámetros SQL Cero Inyecciones:**  
   Todas las consultas y filtros se construyen exclusivamente mediante sentencias parametrizadas de Prisma ORM. No existe uso de `$queryRawUnsafe` ni concatenación manual de cadenas en consultas a la base de datos.
2. **DTOs con Whitelist Estricta:**  
   El backend opera con `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })`, desechando cualquier propiedad no declarada formalmente en los contratos TypeScript para evitar ataques de asignación masiva (*mass assignment*).
3. **Ofuscación Forense en Bitácoras:**  
   El servicio de auditoría [`AuditService`](file:///d:/MexAgenda/apps/backend/src/modules/audit/audit.service.ts) sanitiza los payloads, eliminando campos sensibles (`password`, `token`, `secret`) previo a la inserción en `audit_logs`.

**Dictamen de Seguridad:** **CONFORME. EL SISTEMA PROTEGE RIGUROSAMENTE TODAS LAS RUTAS OPERATIVAS.**


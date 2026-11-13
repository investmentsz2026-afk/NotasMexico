# INFORME DE AUDITORÍA FASE 6 — DOCUMENTO 06
## AUDITORÍA DE CONTROL DE ACCESO BASADO EN ROLES (RBAC) Y PERMISOS
### MÓDULO: MOD-05 — BÓVEDA DIGITAL Y GESTIÓN SEGURA DE ARCHIVOS ADJUNTOS (S3)

---

### 1. ALCANCE DEL CONTROL DE ACCESO EN BÓVEDA DIGITAL

La seguridad institucional de MexAgenda se fundamenta en un esquema RBAC granular verificado a nivel de base de datos y validado en tiempo de ejecución por guards en NestJS.

Para el módulo MOD-05, se auditaron:
1. La existencia de los 8 permisos oficiales en la tabla `permissions` de Neon PostgreSQL.
2. La asignación matricial de permisos a los roles del sistema (`ROLE_ADMIN` y `ROLE_USER`).
3. La aplicación de decoradores `@RequirePermissions` y guards `@UseGuards(SessionAuthGuard, PermissionsGuard)` en cada endpoint de [`DocumentsController`](file:///d:/MexAgenda/apps/backend/src/modules/documents/documents.controller.ts).

---

### 2. AUDITORÍA DE PERMISOS EN BASE DE DATOS NEON

Se ejecutó la consulta de verificación sobre las tablas `permissions` y `role_permissions`:

```sql
SELECT p.code, p.name, r.code AS role_code
FROM permissions p
JOIN role_permissions rp ON rp.permission_id = p.id
JOIN roles r ON r.id = rp.role_id
WHERE p.code LIKE 'document:%'
ORDER BY p.code, r.code;
```

#### Catálogo Oficial de Permisos Verificado:

| Permiso | Descripción Institucional | `ROLE_ADMIN` | `ROLE_USER` |
| :--- | :--- | :---: | :---: |
| `document:create` | Cargar nuevos documentos a la bóveda o adjuntar a entidades | **SÍ** | **SÍ** |
| `document:read` | Consultar metadatos y listado de documentos accesibles | **SÍ** | **SÍ** |
| `document:read:all` | Consultar todos los documentos de la institución sin restricción | **SÍ** | **NO** |
| `document:update` | Actualizar metadatos (descripción, categoría, tags) | **SÍ** | **SÍ** |
| `document:delete` | Realizar borrado lógico (soft delete) de documentos propios | **SÍ** | **SÍ** |
| `document:version:create` | Subir una nueva versión documental (v2, v3, etc.) | **SÍ** | **SÍ** |
| `document:download` | Solicitar URL presignada temporal de descarga | **SÍ** | **SÍ** |
| `document:admin:manage` | Restaurar documentos eliminados, archivar y gestionar cuarentenas | **SÍ** | **NO** |

**Totales Comprobados:**
- `ROLE_ADMIN`: **8 de 8 permisos (100%)**
- `ROLE_USER`: **6 de 8 permisos (75%)**

---

### 3. AUDITORÍA DE CONTROLADORES Y GUARDS DE ENDPOINTS

Se inspeccionó la implementación de [`DocumentsController`](file:///d:/MexAgenda/apps/backend/src/modules/documents/documents.controller.ts):

```typescript
@Controller('documents')
@UseGuards(SessionAuthGuard, PermissionsGuard)
export class DocumentsController { ... }
```

Todos los métodos del controlador heredan la obligatoriedad de sesión autenticada activa (`SessionAuthGuard`) y la evaluación estricta de permisos (`PermissionsGuard`).

#### Matriz de Protección por Endpoint:

| Endpoint HTTP | Decorador de Permiso | Comportamiento con Token Inválido | Comportamiento sin Permiso |
| :--- | :--- | :---: | :---: |
| `POST /api/documents` | `@RequirePermissions('document:create')` | 401 Unauthorized | 403 Forbidden |
| `GET /api/documents` | `@RequirePermissions('document:read')` | 401 Unauthorized | 403 Forbidden |
| `GET /api/documents/:id` | `@RequirePermissions('document:read')` | 401 Unauthorized | 403 Forbidden |
| `PATCH /api/documents/:id` | `@RequirePermissions('document:update')` | 401 Unauthorized | 403 Forbidden |
| `DELETE /api/documents/:id` | `@RequirePermissions('document:delete')` | 401 Unauthorized | 403 Forbidden |
| `POST /api/documents/:id/versions` | `@RequirePermissions('document:version:create')` | 401 Unauthorized | 403 Forbidden |
| `GET /api/documents/:id/download-url`| `@RequirePermissions('document:download')` | 401 Unauthorized | 403 Forbidden |
| `POST /api/documents/:id/restore` | `@RequirePermissions('document:admin:manage')`| 401 Unauthorized | 403 Forbidden |

---

### 4. PRUEBAS DE ACCESO NEGATIVO (CONTROL DE PRIVILEGIOS)

Se ejecutaron pruebas automatizadas dirigidas a validar el rechazo de peticiones anómalas:

1. **Petición Anónima (Sin Cabecera de Autorización):**
   - Solicitud: `GET /api/documents`
   - **Resultado:** **HTTP 401 No autorizado**.
2. **Escalamiento de Privilegios Horizontal hacia Administración:**
   - Solicitud: `POST /api/documents/:id/restore` firmado por usuario con `ROLE_USER`.
   - **Resultado:** **HTTP 403 Prohibido**. El guard intercepta la petición antes de ejecutar la lógica de negocio por carecer del permiso `document:admin:manage`.
3. **Consulta de Catálogo Global:**
   - Un usuario regular sin `document:read:all` consulta `GET /api/documents`.
   - **Resultado:** El servicio filtra la consulta en Neon PostgreSQL, devolviendo únicamente documentos institucionales generales o aquellos donde el usuario es titular o participante autorizado.

**Conclusión:** La capa RBAC del módulo MOD-05 cumple satisfactoriamente los estándares de seguridad, impidiendo el escalamiento vertical de privilegios.


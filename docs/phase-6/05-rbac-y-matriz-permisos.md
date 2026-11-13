# MATRIZ DE CONTROL DE ACCESO (RBAC) — FASE 6
## MEXAGENDA: BÓVEDA DIGITAL Y GESTIÓN DOCUMENTAL (MOD-05)

### 1. CATÁLOGO DE PERMISOS INSTITUCIONALES DE BÓVEDA

En cumplimiento de las especificaciones de seguridad institucional, se incorporaron 8 permisos granulares en la tabla `permissions` bajo el recurso `documents`:

| Código del Permiso | Recurso | Acción | Descripción Institucional |
| :--- | :--- | :--- | :--- |
| `document:read` | `documents` | `read` | Consultar y listar documentos institucionales autorizados. |
| `document:upload` | `documents` | `upload` | Cargar nuevos archivos adjuntos a entidades autorizadas. |
| `document:download` | `documents` | `download` | Descargar archivos mediante URL presignada autorizada. |
| `document:update_own` | `documents` | `update_own` | Modificar metadatos de documentos propios. |
| `document:delete_own` | `documents` | `delete_own` | Eliminar suavemente o archivar documentos propios. |
| `document:history:read` | `documents` | `history_read` | Consultar versiones e historial técnico de documentos. |
| `document:admin:read` | `documents` | `admin_read` | Auditoría y visualización de todos los documentos y estados. |
| `document:admin:manage` | `documents` | `admin_manage` | Gestión administrativa total de la bóveda (restaurar, estado de escaneo). |

---

### 2. MATRIZ DE ASIGNACIÓN POR ROLES (RBAC)

| Permiso | `ROLE_ADMIN` (Administrador) | `ROLE_USER` (Usuario Institucional) | Justificación de Seguridad |
| :--- | :---: | :---: | :--- |
| `document:read` | **SÍ** | **SÍ** | Listado de catálogo accesible bajo reglas de visibilidad. |
| `document:upload` | **SÍ** | **SÍ** | Permite aportar insumos, anexos y evidencias. |
| `document:download` | **SÍ** | **SÍ** | Acceso a descarga condicionado a permisos sobre la entidad padre. |
| `document:update_own` | **SÍ** | **SÍ** (Solo propios) | Actualización de nombre y descripción de sus propios archivos. |
| `document:delete_own` | **SÍ** | **SÍ** (Solo propios) | Retiro suave de documentos cargados por el usuario. |
| `document:history:read`| **SÍ** | **SÍ** | Verificación técnica de versiones previas. |
| `document:admin:read` | **SÍ** | **NO** | Exclusivo para auditoría de cumplimiento y supervisión global. |
| `document:admin:manage`| **SÍ** | **NO** | Exclusivo para restauración de archivos y modificación de estado de malware. |

---

### 3. MECANISMO DE ENFORCEMENT EN EL BACKEND

Todos los endpoints del módulo están asegurados mediante los decoradores de seguridad institucional en NestJS:

```typescript
@UseGuards(SessionAuthGuard, PermissionsGuard)
@RequirePermissions('document:download')
@Get(':id/download')
async getDownloadUrl(...) { ... }
```

- **`SessionAuthGuard`:** Valida que el token de sesión exista en cookie segura o cabecera `Authorization: Bearer`, esté activo en la base de datos Neon PostgreSQL (`user_sessions`), no haya sido revocado y no supere los 30 minutos de inactividad.
- **`PermissionsGuard`:** Extrae los permisos del usuario desde el rol institucional asociado y verifica la presencia obligatoria del código exigido por `@RequirePermissions()`.
- **Lógica de Dominio Adicional (ABAC / Anti-IDOR):** Además del permiso RBAC, el servicio valida si el usuario tiene relación con el documento o si este pertenece a una entidad privada (e.g. notas personales de otro usuario).


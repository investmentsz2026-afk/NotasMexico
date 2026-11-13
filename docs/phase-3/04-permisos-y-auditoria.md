# 04 — Seguridad, Matriz RBAC y Auditoría Institucional

## 1. Modelo de Autorización RBAC / ABAC

MexAgenda implementa un control de acceso estricto basado en roles y permisos granulares. Para la Fase 3, se añadieron 3 permisos operativos especializados al catálogo de permisos institucionales en Neon PostgreSQL, totalizando 18 permisos en la plataforma:

1. `meeting:attendance`: Permite asentar pases de lista y modificar el estatus de asistencia de los convocados.
2. `meeting:minutes:approve`: Permite dictaminar y formalizar la aprobación de las actas colegiadas.
3. `meeting:category:manage`: Permite dar de alta, modificar y desactivar taxonomías y categorías de reuniones.

---

## 2. Matriz de Roles y Privilegios en Fase 3

| Permiso Institucional | Código del Permiso | `ROLE_ADMIN` | `ROLE_USER` |
| :--- | :--- | :---: | :---: |
| Consulta de Usuarios | `user:read` | ✓ | — |
| Creación de Usuarios | `user:create` | ✓ | — |
| Modificación de Usuarios | `user:update` | ✓ | — |
| Eliminación de Usuarios | `user:delete` | ✓ | — |
| Lectura de Sesiones | `meeting:read` | ✓ | ✓ |
| Creación de Sesiones | `meeting:create` | ✓ | ✓ |
| Actualización de Sesiones | `meeting:update` | ✓ | ✓* |
| Archivo / Baja de Sesiones | `meeting:delete` | ✓ | — |
| **Control de Asistencia** | `meeting:attendance` | ✓ | ✓ |
| **Aprobación de Actas** | `meeting:minutes:approve` | ✓ | — |
| **Gestión de Categorías** | `meeting:category:manage` | ✓ | — |
| Consulta de Acuerdos | `agreement:read` | ✓ | ✓ |
| Creación de Acuerdos | `agreement:create` | ✓ | — |
| Modificación de Acuerdos | `agreement:update` | ✓ | — |
| Consulta de Anexos | `attachment:read` | ✓ | ✓ |
| Carga de Anexos | `attachment:upload` | ✓ | ✓ |
| Auditoría Forense | `audit:read` | ✓ | — |
| Parámetros del Sistema | `system:settings` | ✓ | — |

*\* `meeting:update` para usuarios ordinarios está sujeto a políticas ABAC: únicamente pueden actualizar reuniones convocadas por ellos mismos o en las que funjan como Presidente o Secretario de Actas.*

---

## 3. Trazabilidad Forense e Inmutabilidad de Auditoría

Cada operación sensible dentro de la gestión de reuniones genera un evento estructurado en la tabla `audit_logs` con las siguientes propiedades:
- `actorId`: Identificador UUID del usuario autenticado.
- `action`: Acción normalizada en mayúsculas (e.g. `MEETING_CREATED`, `MEETING_UPDATED`, `CONVOCATORIA_PUBLISHED`, `PARTICIPANT_ADDED`, `ATTENDANCE_CHANGED`, `MEETING_SESSION_STARTED`, `MINUTES_APPROVED`, `MINUTES_MODIFIED_AFTER_APPROVAL`).
- `entity`: Nombre de la tabla afectada (`meetings`, `meeting_agenda_items`, `meeting_participants`, `meeting_minutes`).
- `entityId`: UUID del registro modificado.
- `diffPayload`: Objeto JSON con el estado previo y posterior, o con los parámetros rectores de la operación.
- `ipAddress` y `userAgent`: Metadatos de red del solicitante.
- `outcome`: `SUCCESS`, `FAILURE` o `DENIED`.

### Sanitización Criptográfica
El servicio `AuditService` aplica un filtro de sanitización recursivo antes de persistir cualquier `diffPayload`, garantizando que ninguna propiedad con nombres sensibles (`password`, `totpSecret`, `sessionToken`, `secretKey`, etc.) sea almacenada en texto claro o filtrada a la bitácora institucional.


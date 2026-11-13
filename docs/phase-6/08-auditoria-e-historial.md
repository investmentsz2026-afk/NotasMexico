# AUDITORÍA FORENSE E HISTORIAL INMUTABLE — FASE 6
## MEXAGENDA: BÓVEDA DIGITAL Y GESTIÓN DOCUMENTAL (MOD-05)

### 1. EVENTOS DE AUDITORÍA REGISTRADOS EN `audit_logs`

Cada acción sobre la bóveda documental produce un registro forense inmutable en la tabla `audit_logs` de Neon PostgreSQL, gestionado por `AuditService`:

| Evento | Acción | Entidad | Actor | Outcome | Diff / Carga Útil Registrada |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Carga de Documento** | `DOCUMENT_UPLOADED` | `Attachment` | Usuario / Admin | `SUCCESS` | Nombre original, tamaño bytes, MIME type, hash SHA-256, storageKey, categoría. |
| **Descarga Autorizada** | `DOCUMENT_DOWNLOADED` | `Attachment` | Usuario / Admin | `SUCCESS` | Nombre del archivo, TTL de expiración (300s), storageKey. |
| **Intento no Autorizado** | `UNAUTHORIZED_DOCUMENT_ACCESS_ATTEMPT`| `Attachment` | Usuario | `DENIED` | Motivo del rechazo (acceso a nota privada ajena, archivo infectado, etc.). |
| **Actualización Metadatos** | `DOCUMENT_METADATA_UPDATED` | `Attachment` | Autor / Admin | `SUCCESS` | Valores previos y valores nuevos (categoría, descripción, archivado). |
| **Eliminación Suave** | `DOCUMENT_DELETED` | `Attachment` | Autor / Admin | `SUCCESS` | Nombre del archivo y storageKey retirado del catálogo activo. |
| **Restauración** | `DOCUMENT_RESTORED` | `Attachment` | Admin | `SUCCESS` | Identificador del archivo restaurado a la bóveda activa. |
| **Nueva Versión** | `DOCUMENT_VERSION_UPLOADED` | `Attachment` | Autor / Admin | `SUCCESS` | Número de versión (`v2`), nueva storageKey, nuevo hash SHA-256. |
| **Actualización de Escaneo**| `DOCUMENT_SCAN_STATUS_UPDATED` | `Attachment` | Admin | `SUCCESS` | Estado previo y estado nuevo de escaneo de seguridad. |

---

### 2. ESTRUCTURA DE LOS REGISTROS FORENSES

Cada registro en `audit_logs` contiene de forma obligatoria:
- `id`: Secuencia autonumérica inmutable (`BigInt`).
- `actorId`: UUID del usuario que ejecutó la acción (o null si es anónimo).
- `ipAddress`: Dirección IP de origen (extraída de la petición o cabecera `X-Forwarded-For`).
- `userAgent`: Identificador del cliente o navegador (limitado a 300 caracteres).
- `outcome`: Resultado del intento (`SUCCESS`, `DENIED`, `FAILURE`).
- `diffPayload`: Objeto JSON sanitizado con los detalles forenses del evento.
- `createdAt`: Timestamp UTC con precisión de milisegundos provisto por Neon PostgreSQL.

---

### 3. HISTORIAL DE VERSIONES EN `attachment_versions`

A diferencia de un sistema de archivos tradicional donde un nuevo archivo sobreescribe al anterior, MexAgenda implementa un patrón **Append-Only** para revisiones documentales:

1. Cada carga de versión genera un registro inmutable en `attachment_versions`.
2. La clave de almacenamiento física en S3/Sandbox es completamente nueva (`UUIDv4`). La versión anterior no se borra ni se modifica, preservando la cadena de custodia institucional.
3. El campo `version` en `attachments` se incrementa monótonamente (`1 -> 2 -> 3`).
4. La tabla `attachment_versions` no cuenta con endpoints de actualización ni eliminación (`PATCH` o `DELETE`), garantizando que los registros históricos sean inmutables.


# ESPECIFICACIÓN DE LA API REST BACKEND — FASE 6
## MEXAGENDA: BÓVEDA DIGITAL Y GESTIÓN DOCUMENTAL (MOD-05)

### 1. RESUMEN DE ENDPOINTS

Todos los endpoints están alojados bajo el prefijo global `/api/v1/documents`.

| Método | Endpoint | Permiso Exigido | Descripción |
| :--- | :--- | :--- | :--- |
| `POST` | `/documents/upload` | `document:upload` | Carga un archivo con metadatos y relaciones. |
| `GET` | `/documents` | `document:read` | Consulta catálogo de documentos con filtros y paginación. |
| `GET` | `/documents/:id` | `document:read` | Obtiene la ficha técnica y versiones de un documento. |
| `GET` | `/documents/:id/download` | `document:download` | Genera una URL presignada autorizada (TTL: 300s). |
| `PATCH` | `/documents/:id` | `document:update_own` | Actualiza metadatos (solo autor o admin). |
| `DELETE` | `/documents/:id` | `document:delete_own` | Eliminación suave del documento (solo autor o admin). |
| `POST` | `/documents/:id/version` | `document:upload` | Carga una nueva versión incremental (`v(N+1)`). |
| `POST` | `/documents/:id/restore` | `document:admin:manage` | Restaura un documento eliminado (solo admin). |
| `PATCH` | `/documents/:id/scan-status` | `document:admin:manage` | Modifica el estado de escaneo de seguridad (solo admin). |
| `GET` | `/documents/local-download` | *Público firmado* | Descarga directa sandbox validando firma HMAC y TTL. |

---

### 2. DETALLE DE ENDPOINTS PRINCIPALES

#### 2.1 Carga de Archivo (`POST /documents/upload`)
- **Tipo de Contenido:** `multipart/form-data`
- **Campos del Formulario:**
  * `file`: Archivo binario (máx. 25 MB).
  * `category`: String opcional (`GENERAL`, `ACTA`, `ACUERDO`, `NOTA`, `CONVOCATORIA`, `EVIDENCIA`, `ANEXO`, `DICTAMEN`).
  * `description`: String opcional.
  * `meetingId`: UUID opcional de la reunión.
  * `agreementId`: UUID opcional del acuerdo.
  * `personalNoteId`: UUID opcional de la anotación personal.
  * `minutesId`: UUID opcional del acta.
- **Respuesta Exitosa (`201 Created`):**
```json
{
  "success": true,
  "statusCode": 201,
  "data": {
    "id": "e3b0c442-98fc-1c14-9afb-4c8996fb9242",
    "originalFilename": "dictamen_pleno_2026.pdf",
    "storageKey": "vault/2026/11/e3b0c442-98fc-1c14-9afb-4c8996fb9242-dictamen_pleno_2026.pdf",
    "mimeType": "application/pdf",
    "fileSizeBytes": 142850,
    "sha256Checksum": "a1b2c3d4e5f6...",
    "category": "DICTAMEN",
    "description": "Dictamen oficial del pleno",
    "storageProvider": "LOCAL",
    "scanStatus": "LIMPIO",
    "isArchived": false,
    "version": 1,
    "uploader": {
      "id": "39596f92-dbdc-4760-bd2a-ec9b56160692",
      "fullName": "Lic. Juan Pérez",
      "email": "juan.perez@institucion.gob.mx"
    },
    "createdAt": "2026-11-05T20:00:00.000Z",
    "updatedAt": "2026-11-05T20:00:00.000Z"
  },
  "timestamp": "2026-11-05T20:00:00.000Z"
}
```

#### 2.2 Generación de URL Presignada de Descarga (`GET /documents/:id/download`)
- **Respuesta Exitosa (`200 OK`):**
```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "documentId": "e3b0c442-98fc-1c14-9afb-4c8996fb9242",
    "downloadUrl": "http://localhost:4000/api/v1/documents/local-download?key=...&expires=1793928000&filename=dictamen.pdf&sig=...",
    "expiresInSeconds": 300,
    "filename": "dictamen_pleno_2026.pdf",
    "mimeType": "application/pdf",
    "fileSizeBytes": 142850
  },
  "timestamp": "2026-11-05T20:00:00.000Z"
}
```

#### 2.3 Respuestas de Error Estandarizadas (RFC 7807)
```json
{
  "type": "https://mexagenda.org/errors/403",
  "title": "Forbidden",
  "status": 403,
  "detail": "Acceso denegado: este archivo pertenece a una anotación privada institucional.",
  "instance": "/api/v1/documents/e3b0c442/download",
  "timestamp": "2026-11-05T20:00:00.000Z"
}
```


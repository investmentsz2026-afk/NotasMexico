# DOCUMENTO 09: ESPECIFICACIÓN DE API REST Y CONTRATOS DE INTEGRACIÓN
## Sistema Privado de Gestión Institucional (MexAgenda)
**Fase:** 0 — Análisis, Planificación y Especificación Técnica  
**Versión:** 1.0.0  
**Fecha:** Noviembre 2026  
**Estado:** Para Revisión y Aprobación  

---

## 1. ESTÁNDARES Y CONVENCIONES DE LA API

- **Base URL:** `/api/v1`
- **Formato de Intercambio:** `application/json` (UTF-8).
- **Manejo de Errores:** Conforme al estándar **RFC 7807 (Problem Details for HTTP APIs)**.
- **Paginación Uniforme:**
  - Parámetros: `page` (default: 1), `limit` (default: 20, max: 100).
  - Metadatos en respuesta: `{ data: [...], meta: { total, page, limit, totalPages } }`.
- **Formato de Fechas:** ISO 8601 UTC (`YYYY-MM-DDTHH:mm:ss.sssZ`).
- **Autenticación:** Cookie segura `HttpOnly` (`__Host-mexagenda_session`) o Header Bearer Token.

---

## 2. FORMATO ESTÁNDAR DE RESPUESTA Y ERRORES

### 2.1. Respuesta Exitosa Estándar:
```json
{
  "success": true,
  "statusCode": 200,
  "data": { ... },
  "timestamp": "2026-11-04T12:00:00.000Z"
}
```

### 2.2. Respuesta de Error RFC 7807:
```json
{
  "type": "https://api.mexagenda.org/errors/forbidden",
  "title": "Forbidden",
  "status": 403,
  "detail": "Violación de Soberanía: No tiene autorización para modificar anotaciones de otro integrante.",
  "instance": "/api/v1/notes/b5a1f644-8c7e-40e1-931b-7a54a7c1e342",
  "errorCode": "NOTE_SOVEREIGNTY_VIOLATION",
  "timestamp": "2026-11-04T12:00:00.000Z"
}
```

---

## 3. CATÁLOGO COMPLETO DE ENDPOINTS POR MÓDULO

```
+-----------------------------------------------------------------------------------+
|                        RESUMEN DE RUTAS DE LA API REST                            |
+-----------------------------------------------------------------------------------+
| /auth/login, /mfa/verify, /logout, /me, /reset-password                           |
| /users, /users/:id, /users/:id/status, /users/:id/revoke-sessions                 |
| /categories, /categories/:id, /categories/reorder, /categories/stats              |
| /meetings, /meetings/:id, /meetings/:id/status, /meetings/:id/participants        |
| /notes, /notes/:id, /notes/:id/admin-override, /notes/:id/versions                |
| /agreements, /agreements/:id, /agreements/:id/status, /agreements/:id/history     |
| /attachments/upload-intent, /attachments/:id/confirm, /attachments/:id/url        |
| /audit/logs, /audit/logs/:id, /audit/export                                       |
| /dashboard/summary, /dashboard/admin-metrics                                      |
+-----------------------------------------------------------------------------------+
```

---

### 3.1. MÓDULO: AUTENTICACIÓN (`/auth`)

#### `POST /auth/login`
- **Descripción:** Inicio de sesión primario con credenciales institucionales.
- **Autenticación:** Pública (Sujeta a Rate Limiting: 5 req/min por IP).
- **Body:**
```json
{
  "email": "consejero.garcia@institucion.mx",
  "password": "PasswordCompleja!2026"
}
```
- **Respuesta (200 OK - Si MFA está activo):**
```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "mfaRequired": true,
    "mfaToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.temp_mfa_token..."
  }
}
```
- **Errores:** `401 Unauthorized` (Credenciales no válidas), `429 Too Many Requests` (Límite excedido).

#### `POST /auth/mfa/verify`
- **Descripción:** Validación del segundo factor TOTP o código de respaldo.
- **Body:**
```json
{
  "mfaToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.temp_mfa_token...",
  "totpCode": "583921"
}
```
- **Respuesta (200 OK):**
  - Establece Cookie: `__Host-mexagenda_session=...; HttpOnly; Secure; SameSite=Strict; Path=/`
```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "user": {
      "id": "e3b0c442-98fc-1c14-9af0-2a3b95797741",
      "email": "consejero.garcia@institucion.mx",
      "firstName": "Alejandro",
      "lastName": "García",
      "role": "ROLE_USER"
    }
  }
}
```

#### `POST /auth/logout`
- **Descripción:** Invalida la sesión actual en la base de datos y destruye la cookie.
- **Autenticación:** Sesión requerida.

---

### 3.2. MÓDULO: GESTIÓN DE USUARIOS (`/users`)

#### `GET /users`
- **Descripción:** Directorio institucional con paginación y búsqueda por nombre/cargo.
- **Permisos:** `user:read`.
- **Query Params:** `page`, `limit`, `search`, `status`, `role`.

#### `POST /users`
- **Descripción:** Aprovisionamiento administrativo de un nuevo integrante.
- **Permisos:** `user:create` (`ROLE_ADMIN` exclusivamente).
- **Body:**
```json
{
  "email": "vocal.sanchez@institucion.mx",
  "firstName": "Claudia",
  "lastName": "Sánchez",
  "position": "Vocal del Comité de Presupuesto",
  "phone": "+525512345678",
  "roleId": "7d2b454e-4f51-40ef-871c-3b4f6e1f0e21"
}
```
- **Respuesta (201 Created):** Retorna el usuario en estado `PENDIENTE_ACTIVACION` y emite enlace de bienvenida encriptado.

#### `PATCH /users/:id/status`
- **Descripción:** Activar, desactivar o bloquear una cuenta. Si se desactiva, revoca instantáneamente sus sesiones.
- **Permisos:** `user:status_change` (`ROLE_ADMIN`).
- **Body:**
```json
{
  "status": "INACTIVO",
  "reason": "Término de encargo reglamentario en el Consejo."
}
```

---

### 3.3. MÓDULO: CLASIFICACIONES DE REUNIONES (`/categories`)

#### `GET /categories`
- **Descripción:** Retorna las clasificaciones activas ordenadas por `displayOrder` para selectores de interfaz.
- **Permisos:** Autenticado.

#### `POST /categories`
- **Descripción:** Crea una nueva clasificación institucional de sesión.
- **Permisos:** `category:manage` (`ROLE_ADMIN`).
- **Body:**
```json
{
  "name": "Comité Extraordinario de Transparencia",
  "code": "COM-EXT-TR",
  "description": "Sesiones especiales de atención a solicitudes de información.",
  "colorHex": "#1E3A8A",
  "displayOrder": 3
}
```

---

### 3.4. MÓDULO: REUNIONES (`/meetings`)

#### `GET /meetings`
- **Descripción:** Listado facetado de reuniones institucionales.
- **Query Params:** `from`, `to`, `categoryId`, `status`, `modality`, `search`.
- **Respuesta (200 OK):**
```json
{
  "data": [
    {
      "id": "a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d",
      "title": "Tercera Sesión Ordinaria de Consejo Directivo 2026",
      "category": { "name": "Sesión Ordinaria", "colorHex": "#0F172A" },
      "meetingDate": "2026-11-15",
      "startTime": "10:00:00",
      "endTime": "13:30:00",
      "modality": "HIBRIDA",
      "location": "Sala Mayor de Juntas / Enlace Privado",
      "status": "PROGRAMADA",
      "totalNotes": 4,
      "totalAttachments": 2,
      "totalAgreements": 1
    }
  ],
  "meta": { "total": 1, "page": 1, "limit": 20 }
}
```

#### `POST /meetings`
- **Descripción:** Convoca una nueva reunión en la plataforma.
- **Permisos:** `meeting:create`.
- **Body:**
```json
{
  "title": "Sesión Extraordinaria de Evaluación Presupuestal",
  "categoryId": "c9e8d7c6-b5a4-4321-8765-abcdef123456",
  "meetingDate": "2026-11-20",
  "startTime": "09:00:00",
  "endTime": "11:30:00",
  "location": "Auditorio Poniente",
  "modality": "PRESENCIAL",
  "description": "Revisión del ejercicio fiscal del cuarto trimestre.",
  "agendaTopics": "1. Lista de asistencia y declaración de quórum.\n2. Informe del tesorero.\n3. Votación de reasignaciones.",
  "participantUserIds": [
    "e3b0c442-98fc-1c14-9af0-2a3b95797741",
    "f4c1d553-09ad-2d25-0bf1-3b4c06808852"
  ]
}
```

#### `GET /meetings/:id`
- **Descripción:** Recupera el expediente integral unificado de la sesión (Ficha, minuta, notas compartidas, documentos y acuerdos).

---

### 3.5. MÓDULO: ANOTACIONES INDIVIDUALES (`/notes`)

#### `POST /meetings/:meetingId/notes`
- **Descripción:** Redacta y publica una nueva anotación individual en la reunión.
- **Permisos:** `note:create`.
- **Body:**
```json
{
  "content": "Manifiesto mi conformidad con el balance general, reservando mi voto respecto al rubro de consultorías externas hasta recibir la auditoría de soporte."
}
```
- **Comportamiento Backend:** Asigna automáticamente `author_id = session.user_id`.

#### `PUT /notes/:id`
- **Descripción:** Modificación de anotación por parte de su **autor original**.
- **Permisos:** `note:update_own`.
- **Body:**
```json
{
  "content": "Manifiesto mi conformidad con el balance general, reservando mi voto respecto al rubro de consultorías externas (Se adjunta solicitud formal de informe).",
  "version": 1
}
```
- **Control de Seguridad Anti-IDOR:** Si el usuario autenticado no es el autor de la nota, el backend rechaza con `403 Forbidden` y registra alerta de seguridad.

#### `PUT /notes/:id/admin-override`
- **Descripción:** Intervención administrativa extraordinaria sobre anotaciones ajenas.
- **Permisos:** `note:override_any` (`ROLE_ADMIN` exclusivamente).
- **Body:**
```json
{
  "content": "Contenido corregido por mandato institucional...",
  "adminJustification": "Corrección formal solicitada mediante Oficio Técnico OIC-2026-44."
}
```

#### `GET /notes/:id/versions`
- **Descripción:** Consulta el historial inmutable de versiones de una anotación.

---

### 3.6. MÓDULO: GESTIÓN DOCUMENTAL (`/attachments`)

#### `POST /attachments/upload-intent`
- **Descripción:** Solicita permiso para subir un archivo adjunto.
- **Permisos:** `document:upload`.
- **Body:**
```json
{
  "meetingId": "a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d",
  "originalFilename": "dictamen_financiero_q4.pdf",
  "mimeType": "application/pdf",
  "fileSizeBytes": 4582910
}
```
- **Respuesta (200 OK):**
```json
{
  "attachmentId": "8f3e2d1c-7b6a-5432-10fe-dcba98765432",
  "uploadUrl": "https://vault.institucion.mx/s3/mexagenda-vault/attachments/8f3e2d1c...?AWSAccessKeyId=...",
  "expiresInSeconds": 300
}
```

#### `POST /attachments/:id/confirm-upload`
- **Descripción:** Notifica que el cliente completó la subida a S3 para que el backend valide Magic Bytes y selle el anexo.

#### `GET /attachments/:id/download-url`
- **Descripción:** Genera una URL pre-firmada efímera (10 min) para visualizar o descargar un documento seguro.
- **Permisos:** `document:download`.

---

### 3.7. MÓDULO: ACUERDOS Y COMPROMISOS (`/agreements`)

#### `POST /meetings/:meetingId/agreements`
- **Descripción:** Registra un nuevo acuerdo institucional derivado de una sesión.
- **Permisos:** `agreement:create`.
- **Body:**
```json
{
  "code": "ACU-2026-042-01",
  "title": "Elaboración de Términos de Referencia para Auditoría Externa",
  "description": "La Dirección de Finanzas elaborará los TDR y los someterá al Consejo antes del 15 de diciembre.",
  "assignedUserId": "e3b0c442-98fc-1c14-9af0-2a3b95797741",
  "dueDate": "2026-12-15"
}
```

#### `PATCH /agreements/:id/status`
- **Descripción:** Actualiza el estado y registra el avance en la bitácora histórica.
- **Body:**
```json
{
  "status": "COMPLETADO",
  "progressNotes": "TDR entregados formalmente a la Presidencia del Consejo mediante oficio DF/120/2026."
}
```

---

### 3.8. MÓDULO: AUDITORÍA FORENSE (`/audit`)

#### `GET /audit/logs`
- **Descripción:** Consulta paginada y filtrada de la bitácora de eventos.
- **Permisos:** `audit:read` (`ROLE_ADMIN` exclusivamente).
- **Query Params:** `actorId`, `action`, `entity`, `from`, `to`, `outcome`, `page`, `limit`.
- **Respuesta (200 OK):**
```json
{
  "data": [
    {
      "id": 10482,
      "actor": { "id": "admin_uuid", "name": "Lic. Roberto Mendoza" },
      "action": "ADMIN_NOTE_OVERRIDE",
      "entity": "PersonalNote",
      "entityId": "b5a1f644-8c7e-40e1-931b-7a54a7c1e342",
      "ipAddress": "187.189.44.12",
      "outcome": "SUCCESS",
      "diffPayload": {
        "reason": "Corrección formal solicitada mediante Oficio...",
        "previousVersion": 2,
        "newVersion": 3
      },
      "createdAt": "2026-11-04T18:45:10.120Z"
    }
  ],
  "meta": { "total": 1, "page": 1, "limit": 20 }
}
```


# ESPECIFICACIÓN DE LA API REST — MOD-04
## Backend NestJS: Anotaciones Personales y Notas de Sesión

### 1. ESTRUCTURA DEL MÓDULO BACKEND

El módulo reside en `apps/backend/src/modules/notes/` y está compuesto por:

```
apps/backend/src/modules/notes/
├── dto/
│   ├── admin-intervene-note.dto.ts
│   ├── create-note.dto.ts
│   ├── query-notes.dto.ts
│   └── update-note.dto.ts
├── notes.controller.ts
├── notes.module.ts
└── notes.service.ts
```

Se encuentra registrado en `AppModule` con inyección de dependencias hacia `DatabaseModule`, `CryptoModule`, `AuditModule` y `SessionsModule`.

---

### 2. CATÁLOGO COMPLETO DE ENDPOINTS REST

Todos los endpoints requieren autenticación mediante sesión institucional (`SessionAuthGuard`), control granular de permisos (`PermissionsGuard`) y contexto de usuario (`@CurrentUser()`).

| Método | Ruta | Permiso RBAC | Descripción | Retorno HTTP |
| :--- | :--- | :--- | :--- | :---: |
| `GET` | `/notes` | `note:read` | Listar catálogo paginado con filtros avanzados. | 200 OK |
| `GET` | `/notes/meeting/:meetingId` | `note:read` | Consultar notas asociadas a una reunión específica. | 200 OK |
| `POST` | `/notes` | `note:create` | Crear nueva anotación personal o de sesión. | 201 Created |
| `GET` | `/notes/:id` | `note:read` | Consultar expediente detallado de la anotación. | 200 OK |
| `PUT` | `/notes/:id` | `note:update_own` | Actualización ordinaria completa (exclusiva del autor). | 200 OK |
| `PATCH` | `/notes/:id` | `note:update_own` | Actualización parcial (favorita, tags, categoría). | 200 OK |
| `POST` | `/notes/:id/intervene` | `note:override_any` | Intervención administrativa extraordinaria auditada. | 200 OK |
| `GET` | `/notes/:id/versions` | `note:history:read` | Consultar bitácora histórica inmutable de versiones. | 200 OK |
| `DELETE`| `/notes/:id` | `note:delete_own` | Archivar anotación institucional (Soft delete). | 200 OK |
| `POST` | `/notes/:id/restore` | `note:delete_own` | Restaurar anotación archivada de la papelera. | 200 OK |
| `DELETE`| `/notes/:id/permanent` | `note:override_any` | Eliminación definitiva (Hard delete) administrativo. | 200 OK |

---

### 3. CONTRATOS DE ENTRADA Y SALIDA (PAYLOADS)

#### A. Crear Anotación (`POST /notes`)
```json
{
  "title": "Observaciones preliminares sobre el dictamen financiero",
  "content": "Se identifican discrepancias entre las partidas 2000 y 3000 del anteproyecto...",
  "category": "PRESUPUESTAL",
  "noteType": "SESION",
  "visibility": "REUNION",
  "isFavorite": true,
  "tags": "presupuesto, dictamen, finanzas",
  "meetingId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "agendaItemId": "1a2b3c4d-5717-4562-b3fc-2c963f66afa7",
  "agreementId": "9f8e7d6c-5717-4562-b3fc-2c963f66afa8"
}
```

#### B. Actualización Ordinaria del Autor (`PUT /notes/:id`)
```json
{
  "title": "Observaciones preliminares sobre el dictamen financiero [REVISADO]",
  "content": "Se actualizan los montos conforme a la sesión extraordinaria del día de hoy...",
  "category": "PRESUPUESTAL",
  "visibility": "REUNION",
  "changeReason": "Actualización de cifras tras deliberación de la comisión"
}
```

#### C. Intervención Administrativa Extraordinaria (`POST /notes/:id/intervene`)
```json
{
  "adminJustification": "Revisión técnica instruida por la Secretaría de la Contraloría en el marco de la auditoría 2026.",
  "title": "Observaciones preliminares sobre el dictamen financiero [AUDITADA POR OIC]",
  "content": "Texto auditado y certificado legalmente...",
  "visibility": "PUBLICA"
}
```

---

### 4. GESTIÓN DE ERRORES Y CÓDIGOS DE ESTADO (RFC 7807)

El sistema implementa el filtro global `GlobalExceptionFilter` que normaliza todas las respuestas de error bajo el estándar RFC 7807:
- `400 Bad Request`: Parámetros inválidos (ej. justificación administrativa menor a 15 caracteres).
- `401 Unauthorized`: Token de sesión ausente, revocado o inválido.
- `403 Forbidden`: Intento de mutación de nota ajena sin intervención administrativa, o falta de permisos RBAC.
- `404 Not Found`: Identificador UUID de nota no existente o fuera de alcance.
- `409 Conflict`: Conflicto de concurrencia o violación de clave única en la base de datos.
- `500 Internal Server Error`: Fallo interno no controlado con reporte sanitizado.


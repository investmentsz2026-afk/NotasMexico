# DIAGNÓSTICO INICIAL Y ARQUITECTURA TÉCNICA — FASE 6
## MEXAGENDA: BÓVEDA DIGITAL Y GESTIÓN SEGURA DE ARCHIVOS ADJUNTOS (MOD-05)

**Fecha:** Noviembre 2026  
**Fase:** 6  
**Módulo:** MOD-05 — Bóveda Digital y Gestión Documental  
**Estado:** DIAGNÓSTICO Y ARQUITECTURA BASE  

---

### 1. ESTADO ACTUAL Y COMPONENTES EXISTENTES

Durante la inspección de la base de datos Neon PostgreSQL y el esquema de Prisma (`prisma/schema.prisma`), se verificaron los modelos base creados durante la Fase 1:

1. **Modelo `Attachment` (`attachments`):**
   - Campos existentes: `id` (UUID), `meetingId` (UUID opcional), `personalNoteId` (UUID opcional), `uploadedById` (UUID), `originalFilename` (VARCHAR 255), `storageKey` (VARCHAR 255 UNIQUE), `mimeType` (VARCHAR 100), `fileSizeBytes` (BIGINT), `sha256Checksum` (VARCHAR 64), `scanStatus` (ENUM `FileScanStatus`), `isDeleted` (BOOLEAN default false), `version` (INT default 1), `createdAt`, `updatedAt`.
   - Relaciones existentes: `meeting` (`Meeting`), `personalNote` (`PersonalNote`), `uploader` (`User`), `versions` (`AttachmentVersion[]`).

2. **Modelo `AttachmentVersion` (`attachment_versions`):**
   - Campos existentes: `id`, `attachmentId`, `versionNumber`, `storageKey`, `fileSizeBytes`, `sha256Checksum`, `uploadedById`, `createdAt`.
   - Relación con `Attachment` (onDelete: Cascade) y con `User` (onDelete: Restrict).

3. **Enum `FileScanStatus`:**
   - Valores: `PENDIENTE_REVISION`, `LIMPIO`, `INFECTADO`, `ERROR_ESCANEO`.

4. **Relaciones pendientes de integración institucional:**
   - El modelo actual no cuenta con enlace directo a acuerdos vinculantes (`agreementId`) ni a actas oficiales (`minutesId`).
   - Requiere campos adicionales no destructivos para clasificación documental (`category`), descripción institucional (`description`), control de almacenamiento (`storageProvider`, `bucketName`), y eliminación suave con trazabilidad (`deletedAt`, `deletedById`, `isArchived`).

---

### 2. COMPONENTES Y SERVICIOS REUTILIZABLES

MexAgenda cuenta con una base arquitectónica madura y probada que será reutilizada al 100%:

- **Módulo de Auditoría (`AuditModule` / `AuditService`):** Registro inmutable en `audit_logs` con IP, User Agent, actor y resultado para eventos como `DOCUMENT_UPLOADED`, `DOCUMENT_DOWNLOADED`, `DOCUMENT_DELETED`, `DOCUMENT_VIEWED` y `UNAUTHORIZED_DOCUMENT_ACCESS_ATTEMPT`.
- **Control de Acceso e Identidad (`AuthModule`, `SessionAuthGuard`, `PermissionsGuard`, `@RequirePermissions`):** Autenticación mediante tokens de sesión opacos con hash SHA-256 en base de datos Neon y control de permisos granulares (`Permission`).
- **Esquema de Roles y Permisos (RBAC):**
  - Roles base: `ROLE_ADMIN` y `ROLE_USER`.
  - Permisos a incorporar:
    * `document:read`: Lectura y listado de documentos institucionales autorizados.
    * `document:upload`: Carga de nuevos archivos adjuntos a entidades autorizadas.
    * `document:download`: Descarga autorizada y generación de URLs firmadas temporales.
    * `document:update_own`: Modificación de metadatos de documentos propios.
    * `document:delete_own`: Eliminación suave de documentos propios.
    * `document:history:read`: Consulta del historial y versiones documentales.
    * `document:admin:read`: Auditoría y visualización de todos los documentos y estados de escaneo.
    * `document:admin:manage`: Gestión administrativa global (restauración, archivado, cambio de estado de escaneo).

---

### 3. DEPENDENCIAS NECESARIAS Y CONFIGURACIÓN CLOUD

Para garantizar el cumplimiento con almacenamiento compatible con AWS S3 (Cloudflare R2, MinIO, AWS S3) y la manipulación segura de archivos:

1. **SDK Oficial de AWS v3:**
   - `@aws-sdk/client-s3`: Cliente S3 moderno, modular y compatible con TypeScript.
   - `@aws-sdk/s3-request-presigner`: Generación criptográfica de URLs presignadas para descargas y cargas seguras con tiempo de vida restringido (TTL de 300 segundos / 5 minutos por defecto).
2. **Inspección de Cabeceras Mágicas (Magic Numbers):**
   - Validación binaria del buffer para evitar ataques de *MIME Type Spoofing* (verificando firmas binarias para PDF `%PDF-`, PNG `\x89PNG\r\n\x1a\n`, JPEG `\xFF\xD8\xFF`, ZIP/Office OpenXML `PK\x03\x04`).
3. **Cálculo de Hash Criptográfico:**
   - Módulo nativo `crypto` de Node.js para cálculo de `SHA-256` en streaming y memoria, garantizando integridad referencial e inmutabilidad.
4. **Driver de Almacenamiento Dual (S3 + Fallback Local Seguro):**
   - Para entornos de desarrollo local y suites automatizadas de pruebas donde no exista conexión activa a un bucket S3 de AWS/R2, el servicio de almacenamiento implementará una abstracción (`StorageService`) con driver S3 nativo y fallback local sandbox en disco (`storage/vault/`), implementando la misma semántica de URLs firmadas temporales con firma HMAC-SHA256.

---

### 4. ANÁLISIS DE RIESGOS Y CONTROLES DE SEGURIDAD

| Riesgo | Impacto | Control Arquitectónico Implementado |
| :--- | :--- | :--- |
| **MIME Type Spoofing** | Alto (RCE / XSS) | Doble verificación: `Content-Type` de cabecera HTTP + verificación estricta de Magic Bytes en los primeros 16 bytes del archivo. |
| **Path Traversal / Sobreescritura** | Crítico | Las claves de almacenamiento (`storageKey`) no utilizan el nombre original del archivo. Se generan llaves UUIDv4 únicas con estructura particionada `vault/{yyyy}/{mm}/{uuid}-{cleanName}`. |
| **Acceso Público no Autorizado al Bucket** | Crítico | El bucket de almacenamiento es **100% privado**. No existen permisos de lectura pública (`public-read`). Todo acceso pasa por el backend con validación previa de sesión y permisos. |
| **Descargas Falsificadas (IDOR / BOLA)** | Crítico | El endpoint de descarga (`/documents/:id/download`) valida explícitamente: 1) Permiso RBAC `document:download`; 2) Permiso de lectura sobre la entidad asociada (reunión, acuerdo o nota personal); 3) En notas personales privadas, hereda la regla estricta: solo el autor o `ROLE_ADMIN` puede generar la URL presignada. |
| **URLs Presignadas Perpetuas** | Alto | El TTL de las URLs presignadas se configura a 300 segundos (5 minutos) máximo. Una vez expirada, la URL es rechazada automáticamente por el proveedor de almacenamiento. |
| **Agotamiento de Disco / Denegación de Servicio** | Medio | Límite estricto de tamaño de archivo (máximo 25 MB por archivo institucional). Lista blanca de extensiones permitidas (`.pdf`, `.docx`, `.xlsx`, `.pptx`, `.png`, `.jpg`, `.jpeg`, `.txt`, `.csv`). |
| **Falsificación de Identidad de Carga** | Alto | El campo `uploadedById` se obtiene directamente de la sesión criptográfica del usuario autenticado en el token de sesión, nunca del cuerpo de la petición. |

---

### 5. CAMBIOS REQUERIDOS EN LA BASE DE DATOS (MIGRACIÓN ADITIVA)

Para integrar la bóveda documental con todos los módulos institucionales sin alterar los datos existentes:

1. Modificar el modelo `Attachment`:
   - Agregar `agreementId` (UUID opcional, referencia a `agreements(id)`).
   - Agregar `minutesId` (UUID opcional, referencia a `meeting_minutes(id)`).
   - Agregar `category` (VARCHAR 50, default `'GENERAL'`).
   - Agregar `description` (TEXT opcional).
   - Agregar `storageProvider` (VARCHAR 50, default `'S3'`).
   - Agregar `bucketName` (VARCHAR 100 opcional).
   - Agregar `isArchived` (BOOLEAN, default `false`).
   - Agregar `deletedAt` (TIMESTAMP opcional).
   - Agregar `deletedById` (UUID opcional, referencia a `users(id)`).
   - Crear índices de alto rendimiento para búsquedas por entidad (`meetingId`, `agreementId`, `personalNoteId`, `minutesId`, `uploadedById`, `category`).
2. Mantener `AttachmentVersion` intacto para registrar histórico de revisiones de documentos.
3. Generar migración SQL aditiva y desplegarla con `prisma migrate deploy` en Neon PostgreSQL.

---

### 6. PROPUESTA DE ARQUITECTURA TÉCNICA Y CAPAS

```
MexAgenda Phase 6 - Bóveda Digital (MOD-05)
│
├── packages/shared
│   ├── enums: StorageProvider, DocumentCategory, FileScanStatus
│   └── contracts: DocumentListItemDto, DocumentDetailDto, UploadDocumentDto, DownloadUrlDto
│
├── apps/backend/src/modules/documents
│   ├── storage/
│   │   ├── storage.interface.ts (Contrato agnóstico de almacenamiento)
│   │   ├── s3-storage.service.ts (Implementación AWS S3 SDK v3)
│   │   └── local-storage.service.ts (Implementación de respaldo sandbox)
│   ├── dto/
│   │   ├── upload-document.dto.ts
│   │   ├── update-document.dto.ts
│   │   └── query-documents.dto.ts
│   ├── documents.service.ts (Lógica de negocio, Anti-IDOR, hash, herencia de privacidad)
│   ├── documents.controller.ts (Endpoints protegidos RBAC)
│   └── documents.module.ts
│
├── apps/frontend/src/app/(dashboard)/vault
│   ├── page.tsx (Catálogo documental institucional, filtros, modal de carga)
│   └── [id]/page.tsx (Ficha técnica del documento, trazabilidad, descarga segura)
│
└── scripts/test-phase6.js (Suite integral automatizada de 20+ pruebas de integridad y seguridad)
```

---

### 7. PLAN DE IMPLEMENTACIÓN ESTRUCTURADO

1. **Paso 1:** Instalación de dependencias del SDK de AWS v3 y validadores en `@mexagenda/backend`.
2. **Paso 2:** Actualización del esquema Prisma, migración SQL aditiva y despliegue en Neon PostgreSQL.
3. **Paso 3:** Seeding de los 8 permisos `document:*` en Neon para `ROLE_ADMIN` y `ROLE_USER`.
4. **Paso 4:** Actualización del paquete compartido `@mexagenda/shared` con contratos y enums.
5. **Paso 5:** Implementación del módulo backend `DocumentsModule` con seguridad Anti-IDOR, validación de magic bytes, cálculo de SHA-256, generador de URLs presignadas y bitácora de auditoría.
6. **Paso 6:** Implementación del frontend Next.js 15 en `/vault` y enlace en la barra de navegación institucional.
7. **Paso 7:** Creación y ejecución de la suite de pruebas `test:phase6` y ejecución de toda la regresión histórica (`test:phase5-audit`, `test:phase5`, `test:phase4-audit`, `test:phase4`, `test:phase3-audit`, `test:phase3`, `test:phase2`, `pnpm build`).
8. **Paso 8:** Generación de la documentación formal exhaustiva (15 documentos en `docs/phase-6/`) con dictamen final `IMPLEMENTADA Y LISTA PARA AUDITORÍA INDEPENDIENTE`.


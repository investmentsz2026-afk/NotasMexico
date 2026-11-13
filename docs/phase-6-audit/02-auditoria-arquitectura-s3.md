# INFORME DE AUDITORÍA FASE 6 — DOCUMENTO 02
## AUDITORÍA DE ARQUITECTURA S3 Y CAPA DE ALMACENAMIENTO DE OBJETOS
### MÓDULO: MOD-05 — BÓVEDA DIGITAL Y GESTIÓN SEGURA DE ARCHIVOS ADJUNTOS (S3)

---

### 1. ARQUITECTURA DE LA CAPA DE ALMACENAMIENTO

La gestión documental de MexAgenda exige un desacoplamiento estricto entre el motor relacional de metadatos (Neon PostgreSQL) y el repositorio de persistencia binaria de archivos (Object Storage).

Se auditó el paquete [`apps/backend/src/modules/documents/storage/`](file:///d:/MexAgenda/apps/backend/src/modules/documents/storage/) identificando la implementación del patrón **Driver / Strategy**:

```
                       ┌─────────────────────────┐
                       │  DocumentsService (App) │
                       └────────────┬────────────┘
                                    │ inyecta
                       ┌────────────▼────────────┐
                       │     StorageService      │  (Fachada / Selector)
                       └────────────┬────────────┘
                                    │ implementa StorageDriver
                   ┌────────────────┴────────────────┐
                   ▼                                 ▼
      ┌─────────────────────────┐       ┌─────────────────────────┐
      │    S3StorageService     │       │   LocalStorageService   │
      │ (AWS SDK v3 / Cloud S3) │       │ (HMAC-SHA256 / Sandbox) │
      └─────────────────────────┘       └─────────────────────────┘
```

#### Interfaz Formal `StorageDriver`:
La interfaz [`storage-driver.interface.ts`](file:///d:/MexAgenda/apps/backend/src/modules/documents/storage/storage-driver.interface.ts) define un contrato asíncrono tipado:
- `upload(key, buffer, mimeType): Promise<{ key, size, sha256 }>`
- `getPresignedDownloadUrl(key, filename, expiresInSeconds): Promise<string>`
- `delete(key): Promise<void>`
- `exists(key): Promise<boolean>`
- `getStream(key): Promise<NodeJS.ReadableStream>`

---

### 2. AUDITORÍA DEL SERVICIO AWS S3 (`S3StorageService`)

Se inspeccionó la implementación de [`s3-storage.service.ts`](file:///d:/MexAgenda/apps/backend/src/modules/documents/storage/s3-storage.service.ts):

1. **Uso de Librerías Oficiales Modernas:**
   - Emplea `@aws-sdk/client-s3` (AWS SDK v3 modular) y `@aws-sdk/s3-request-presigner`.
   - Se descartó el uso de versiones obsoletas v2 o wrappers inseguros de terceros.
2. **Privacidad Absoluta del Bucket (No Public Read):**
   - El método `PutObjectCommand` **no asigna ningún ACL público** (`ACL: 'public-read'` está ausente por diseño).
   - El almacenamiento es 100% privado. La única vía de acceso es a través de firmas criptográficas presignadas temporales o streaming autenticado a través del backend.
3. **Estructura Jerárquica y Anti-Colisión de Storage Keys:**
   - La clave física en el bucket se genera mediante:
     ```typescript
     const year = now.getFullYear();
     const month = String(now.getMonth() + 1).padStart(2, '0');
     const uuid = randomUUID();
     const sanitized = sanitizeFileName(originalName);
     const key = `vault/${year}/${month}/${uuid}_${sanitized}`;
     ```
   - **Evaluación de Rendimiento y Seguridad:** Previene puntos calientes (*hotspotting*) en particiones S3, garantiza unicidad criptográfica de claves y neutraliza vulnerabilidades de sobrescritura de archivos por colisión de nombres.

---

### 3. POLÍTICA IAM DE MÍNIMO PRIVILEGIO (LEAST PRIVILEGE)

Para el despliegue del rol IAM o usuario de servicio en AWS, este comité auditor verificó que la aplicación requiere únicamente las siguientes directivas mínimas:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "MexAgendaVaultBucketAccess",
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject",
        "s3:HeadObject"
      ],
      "Resource": "arn:aws:s3:::mexagenda-vault-prod/*"
    },
    {
      "Sid": "MexAgendaVaultBucketMeta",
      "Effect": "Allow",
      "Action": [
        "s3:ListBucket"
      ],
      "Resource": "arn:aws:s3:::mexagenda-vault-prod"
    }
  ]
}
```
**Observación de Seguridad:** No se requieren permisos de administración global de S3 (`s3:*`), ni creación/eliminación de buckets (`s3:CreateBucket`, `s3:DeleteBucket`), mitigando el riesgo de compromiso de infraestructura en caso de filtración accidental de credenciales.

---

### 4. AUDITORÍA DEL SERVICIO SANDBOX LOCAL (`LocalStorageService`)

Dado que el entorno de desarrollo y auditoría no dispone de credenciales activas de nube en `.env.local` (**Escenario D/E**), el backend activa automáticamente el driver [`LocalStorageService`](file:///d:/MexAgenda/apps/backend/src/modules/documents/storage/local-storage.service.ts).

#### Evaluación del Mecanismo Criptográfico:
1. **Directorio Base Seguro:** Los archivos se alojan en el directorio `storage/vault/` aislado fuera del árbol estático accesible por el servidor web o el frontend.
2. **Generación de Enlaces de Descarga Firmados:**
   - Emplea un secreto institucional (`VAULT_LOCAL_SECRET` o fallback derivado de `JWT_ACCESS_SECRET`).
   - El payload firmado contiene:
     ```
     payload = `${storageKey}:${expiresAt}`
     signature = HMAC-SHA256(payload, secret)
     ```
   - La URL generada adopta el formato:
     `/api/vault-download?key=vault/...&expires=1799999999&sig=a8f...`
3. **Validación de Integridad Temporal:**
   - Al recibir una solicitud, el controlador [`LocalDownloadController`](file:///d:/MexAgenda/apps/backend/src/modules/documents/storage/local-download.controller.ts) verifica la expiración (`now > expiresAt` rechaza con `403 Prohibido`).
   - Comprueba la firma mediante comparación segura contra ataques de tiempo (`crypto.timingSafeEqual`).
4. **Prevención de Path Traversal:**
   - El método `resolveSafePath` verifica estrictamente que la ruta resuelta permanezca contenida dentro de `storage/vault/`, rechazando intentos de escape con `../` o secuencias Unicode equivalentes.

---

### 5. CONCLUSIÓN DE ARQUITECTURA S3

La arquitectura implementada por la célula desarrolladora cumple con los estándares empresariales de separación de responsabilidades y portabilidad cloud. El sistema está preparado para alternar inmediatamente a producción AWS S3 con solo suministrar las variables de entorno correspondientes, sin alterar una sola línea de código fuente.


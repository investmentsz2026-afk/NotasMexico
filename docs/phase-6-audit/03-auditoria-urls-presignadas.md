# INFORME DE AUDITORÍA FASE 6 — DOCUMENTO 03
## AUDITORÍA DE SEGURIDAD EN URLS PRESIGNADAS Y DESCARGAS
### MÓDULO: MOD-05 — BÓVEDA DIGITAL Y GESTIÓN SEGURA DE ARCHIVOS ADJUNTOS (S3)

---

### 1. MODELO DE DESCARGA PRESIGNADA TEMPORAL

Para salvaguardar los documentos institucionales clasificados y evitar la exposición pública del storage físico, MexAgenda prohíbe las URLs permanentes de descarga directa.

Toda solicitud de descarga se canaliza a través del endpoint protegido:
`GET /api/documents/:id/download-url`

El flujo de seguridad auditado es el siguiente:
1. El usuario autenticado invoca el endpoint portando su Cookie de Sesión o Bearer JWT.
2. El sistema valida los permisos RBAC (`document:read` o `document:read:all`) y la matriz de privacidad heredada.
3. El servicio genera una URL firmada de **un solo uso temporal**, delegando la descarga al driver (`S3StorageService` vía AWS SigV4 o `LocalStorageService` vía HMAC-SHA256).
4. El evento se registra en `audit_logs` con la acción `DOWNLOAD_URL_GENERATED` o `ACCESS_DENIED`.

---

### 2. AUDITORÍA DEL TIEMPO DE VIDA (TTL) Y CONTROL DEL CLIENTE

Se examinó rigurosamente la asignación del parámetro `expiresIn`:

1. **TTL Institucional Fijo:**
   En [`documents.service.ts`](file:///d:/MexAgenda/apps/backend/src/modules/documents/documents.service.ts):
   ```typescript
   const TTL_SECONDS = 300; // 5 minutos de validez máxima
   const downloadUrl = await this.storageService.getPresignedDownloadUrl(
     targetVersion.storageKey,
     targetVersion.fileName,
     TTL_SECONDS,
   );
   ```
2. **Inmunidad ante Manipulación del Cliente:**
   - Se verificó que el DTO de entrada no expone campos como `expiresIn`, `ttl` o `duration`.
   - Se intentó inyectar queries maliciosos como `?expiresIn=99999999` o `?ttl=86400`.
   - **Resultado:** Los parámetros inyectados fueron ignorados por completo por el ValidationPipe de NestJS. El TTL se mantuvo invariablemente en **300 segundos**.

---

### 3. FORZADO DE CABECERAS HTTP DE SEGURIDAD

Para mitigar ataques de ejecución de scripts en el contexto del navegador (*Cross-Site Scripting* / XSS vía archivos SVG, HTML o políglotas), se auditó la inyección de cabeceras en la respuesta de descarga:

1. **Forzado de Descarga (`Content-Disposition`):**
   Tanto en `S3StorageService` (mediante `ResponseContentDisposition`) como en `LocalDownloadController` (mediante `res.setHeader`), se fuerza la directiva:
   ```http
   Content-Disposition: attachment; filename="documento.pdf"; filename*=UTF-8''documento.pdf
   ```
   **Efecto:** El navegador web se ve obligado a descargar el binario a disco local en lugar de renderizarlo en la pestaña del navegador, neutralizando la ejecución de código embebido.
2. **Tipo de Contenido Estricto (`Content-Type`):**
   Se asocia la cabecera `Content-Type` con el MIME type validado en la base de datos (ej. `application/pdf`), impidiendo la interpretación errónea de tipos por parte de agentes de usuario (MIME Confusion / Sniffing).
3. **Cabecera Anti-Sniffing:**
   Se constató la presencia de `X-Content-Type-Options: nosniff` en las respuestas HTTP del backend.

---

### 4. PRUEBAS DE MANIPULACIÓN CRIPTOGRÁFICA (ANTI-TAMPERING)

Se realizaron pruebas dinámicas de alteración intencional sobre los tokens de URLs presignadas en el Sandbox HMAC:

#### Prueba 4.1: Alteración del Storage Key
- **Vector:** Modificar la ruta del archivo en el query (`?key=vault/2026/11/otro-archivo.pdf`).
- **Resultado:** Rechazado con **HTTP 403 Firma inválida**.

#### Prueba 4.2: Alteración de la Fecha de Expiración
- **Vector:** Incrementar el timestamp de UNIX en el query (`?expires=2000000000`).
- **Resultado:** Al haberse alterado el payload firmado, la firma HMAC no coincide. Rechazado con **HTTP 403 Firma inválida**.

#### Prueba 4.3: Expiración Temporal Superada
- **Vector:** Simular una URL presignada cuyo timestamp `expires` es menor a `Date.now()`.
- **Resultado:** Rechazado con **HTTP 403 Enlace de descarga expirado**.

---

### 5. HALLAZGO TÉCNICO REGISTRADO (`FIND-06-02`)

Durante los ensayos de *fuzzing* contra el validador de firmas de `LocalStorageService.verifySignature`:

- **Condición:** Si un atacante suministra un parámetro `sig` cuya longitud en caracteres hexadecimales es impar o difiere de 64 caracteres (32 bytes), la función:
  ```typescript
  crypto.timingSafeEqual(Buffer.from(signature, 'hex'), expectedSigBuffer)
  ```
  dispara una excepción nativa `RangeError: Input buffers must have the same byte length`.
- **Impacto:** Esta excepción no es capturada específicamente antes de `timingSafeEqual`, provocando una respuesta de error interno **HTTP 500** en lugar de un rechazo limpio **HTTP 403 Prohibido**.
- **Severidad:** **BAJA (Low)**. No compromete la confidencialidad ni permite descargar archivos ajenos, pero produce excepciones no sanitizadas en los registros del servidor.
- **Remediación Recomendada:** Anteponer una comprobación previa de longitud de buffer antes de invocar `crypto.timingSafeEqual`:
  ```typescript
  const sigBuffer = Buffer.from(signature, 'hex');
  if (sigBuffer.length !== expectedSigBuffer.length) {
    return false;
  }
  return crypto.timingSafeEqual(sigBuffer, expectedSigBuffer);
  ```


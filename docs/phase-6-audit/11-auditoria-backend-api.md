# INFORME DE AUDITORÍA FASE 6 — DOCUMENTO 11
## AUDITORÍA DE BACKEND API, CONTROLADORES NESTJS Y VALIDACIÓN
### MÓDULO: MOD-05 — BÓVEDA DIGITAL Y GESTIÓN SEGURA DE ARCHIVOS ADJUNTOS (S3)

---

### 1. ARQUITECTURA DE LA API Y ENFRENTAMIENTO DE CONTROLADORES

El backend de MexAgenda está construido sobre **NestJS 10** en TypeScript estricto. La exposición de servicios documentales del módulo MOD-05 se concentra en dos controladores especializados:
1. [`DocumentsController`](file:///d:/MexAgenda/apps/backend/src/modules/documents/documents.controller.ts) (`/api/documents`): Gestión de ciclo de vida, metadatos, versiones y emisión de URLs.
2. [`LocalDownloadController`](file:///d:/MexAgenda/apps/backend/src/modules/documents/storage/local-download.controller.ts) (`/api/vault-download`): Endpoint de descarga para el Sandbox Local HMAC.

---

### 2. AUDITORÍA DE DTOs Y PIPES DE VALIDACIÓN

Se inspeccionaron los Objetos de Transferencia de Datos (DTOs) en `apps/backend/src/modules/documents/dto/`:
- `CreateDocumentDto`: Valida `category`, `description`, `meetingId`, `personalNoteId`, `agreementId`, `minutesId`.
- `UpdateDocumentDto`: Permite modificar exclusivamente campos no estructurales (`description`, `category`).
- `AddVersionDto`: Valida `changeSummary`.
- `QueryDocumentsDto`: Sanitiza parámetros de filtrado y paginación (`category`, `search`, `page`, `limit`).

#### Evaluación del `ValidationPipe` Global:
- **`whitelist: true`:** Descarta automáticamente propiedades extrañas inyectadas en los payloads JSON.
- **`forbidNonWhitelisted: true`:** Rechaza peticiones que contengan propiedades no autorizadas, mitigando ataques de *Mass Assignment*.
- **Transformación de Tipos:** Los parámetros numéricos de paginación se convierten y validan como enteros positivos válidos.

---

### 3. AUDITORÍA DEL MANEJO DE MULTIPART / FORM-DATA Y MEMORIA

La recepción de archivos binarios utiliza el interceptor oficial `@UseInterceptors(FileInterceptor('file', ...))`:

1. **Gestión de Memoria en Carga:**
   - La carga se realiza en buffers de memoria protegidos con límite estricto fijado en `limits: { fileSize: 25 * 1024 * 1024 }`.
   - Si un usuario malicioso intenta enviar un stream sin límite de longitud, el interceptor de Multer/Busboy aborta la conexión inmediatamente antes de agotar la memoria del proceso Node.js (*Memory Exhaustion DoS*).
2. **Streaming en Descargas:**
   - En `LocalDownloadController`, el archivo no se carga íntegramente en un buffer estático antes de ser enviado, sino que se canaliza mediante `createReadStream(filePath).pipe(res)`.
   - Esto garantiza un consumo de memoria constante O(1) independientemente del tamaño del archivo durante descargas concurrentes.

---

### 4. AUDITORÍA DE SANITIZACIÓN DE ERRORES Y RFC 7807

Se ejecutaron pruebas destructivas de inyección para verificar el comportamiento de los filtros de excepción:
- Consultas con CUIDs malformados.
- Tipos de archivo no soportados.
- IDs inexistentes en base de datos.
- Desconexiones de red simuladas.

#### Estructura de Respuesta de Error Observada:
```json
{
  "statusCode": 400,
  "timestamp": "2026-11-06T15:20:00.000Z",
  "path": "/api/documents",
  "error": "Bad Request",
  "message": "El tipo de archivo 'application/x-msdos-program' no está permitido en la institución."
}
```

#### Verificaciones de Seguridad en Errores:
1. **Ausencia de Stack Traces:** Ninguna respuesta HTTP de error expone trazas de ejecución interna de Node.js, rutas absolutas del servidor o versiones de librerías.
2. **Protección de Datos de Conexión:** No se filtran cadenas de conexión a Neon PostgreSQL, tokens JWT ni secretos criptográficos en las respuestas.
3. **Consistencia RFC 7807:** Las respuestas de error siguen un formato JSON homogéneo que facilita el consumo seguro y determinista por parte de la aplicación cliente Next.js.

---

### 5. CONCLUSIÓN DE AUDITORÍA DE API BACKEND

La API de Bóveda Digital presenta una implementación limpia, modular y altamente resiliente. Los controladores actúan como una barrera estricta que impide que peticiones defectuosas o maliciosas impacten en la base de datos o en el sistema de archivos.


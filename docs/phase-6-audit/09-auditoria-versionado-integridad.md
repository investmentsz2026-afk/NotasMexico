# INFORME DE AUDITORÍA FASE 6 — DOCUMENTO 09
## AUDITORÍA DE VERSIONADO DOCUMENTAL, INMUTABILIDAD Y CHECKSUMS SHA-256
### MÓDULO: MOD-05 — BÓVEDA DIGITAL Y GESTIÓN SEGURA DE ARCHIVOS ADJUNTOS (S3)

---

### 1. OBJETIVO DEL SISTEMA DE VERSIONADO INSTITUCIONAL

En la administración pública y corporativa, los documentos oficiales (anteproyectos, convenios, minutas, dictámenes) evolucionan a través de sucesivas iteraciones. Es un requisito innegociable que las versiones anteriores no sean destruidas ni sobrescritas, preservando el valor probatorio de cada estado histórico del expediente.

Se auditó el mecanismo de versionado implementado en:
- Esquema de base de datos (`attachment_versions`).
- Servicio backend ([`documents.service.ts`](file:///d:/MexAgenda/apps/backend/src/modules/documents/documents.service.ts)).
- Persistencia física de objetos en la capa de storage.

---

### 2. MONOTONICIDAD ESTRICTA DEL NÚMERO DE VERSIÓN

Se analizó la lógica de cálculo de la siguiente versión en `addVersion`:

```typescript
const latestVersion = await this.prisma.attachmentVersion.findFirst({
  where: { attachmentId: id },
  orderBy: { versionNumber: 'desc' },
});

const nextVersionNumber = (latestVersion?.versionNumber || 0) + 1;
```

#### Pruebas Dinámicas de Incremento Secuencial:
1. **Creación Inicial (v1):** Al subir por primera vez un documento, se crea el registro en `attachments` y simultáneamente se inserta la versión inicial en `attachment_versions` con `versionNumber = 1`.
2. **Subida Consecutiva de Versiones (v2, v3):**
   - Se ejecutó la subida de dos revisiones sucesivas mediante `POST /api/documents/:id/versions`.
   - Se verificó en Neon PostgreSQL que las versiones generadas fueron rigurosamente `2` y `3`.
3. **Protección a Nivel de Motor Relacional:**
   - Como se auditó en el Documento 01, la restricción única compuesta `(attachment_id, version_number)` en PostgreSQL previene a nivel de base de datos cualquier salto, retroceso o colisión de versiones en caso de concurrencia.

---

### 3. INMUTABILIDAD APPEND-ONLY Y LLAVES DE ALMACENAMIENTO INDEPENDIENTES

Se comprobó que al cargar una nueva versión:
1. **No se sobrescribe el objeto físico previo:**
   - La versión 1 conserva su storage key original: `vault/2026/11/uuid1_documento.pdf`.
   - La versión 2 recibe un nuevo storage key único: `vault/2026/11/uuid2_documento_v2.pdf`.
   - Ambos binarios coexisten intactos en el repositorio de objetos.
2. **Inmutabilidad de Metadatos Históricos:**
   - Ningún campo (`fileName`, `fileSizeBytes`, `sha256Hash`, `createdAt`) de la fila correspondiente a la versión 1 fue modificado en Neon PostgreSQL.

---

### 4. AUDITORÍA DE INTEGRIDAD CRIPTOGRÁFICA (SHA-256)

Para garantizar la no alteración de los binarios y prevenir ataques de corrupción de datos (*silent bitrot* o manipulación en tránsito):

1. **Cálculo Criptográfico en Carga:**
   ```typescript
   const sha256 = crypto.createHash('sha256').update(file.buffer).digest('hex');
   ```
   El hash es generado a partir del buffer bruto validado en memoria antes de la transferencia al storage driver.
2. **Verificación de Correspondencia:**
   - Se descargó el archivo físico desde el storage y se recalculó su suma de verificación SHA-256 mediante utilidades del sistema.
   - El hash obtenido coincidió al 100% con el campo `sha256_hash` almacenado en la tabla `attachment_versions`.
3. **Historial de Modificaciones (`changeSummary`):**
   - El modelo exige o permite registrar un resumen de cambios (ej. *"Se incorporan observaciones del comité jurídico"*), enriqueciendo la trazabilidad del ciclo de vida documental.

---

### 5. DESCARGA PUNTUAL DE VERSIONES ESPECÍFICAS

Se verificó el parámetro opcional `version` en el endpoint de descarga:
`GET /api/documents/:id/download-url?version=1`

- Si no se especifica versión, el backend entrega la versión más reciente (`latest`).
- Si se especifica una versión histórica previa (ej. `version=1`), el sistema localiza el registro histórico exacto y emite la URL presignada hacia el snapshot inmutable correspondiente.
- Si se solicita una versión inexistente (ej. `version=99`), el backend responde con **HTTP 404 No encontrada**.

**Conclusión:** El sistema de versionado de MexAgenda opera bajo un estándar de archivo institucional append-only inmutable, satisfaciendo plenamente los requerimientos de auditoría y no repudio.


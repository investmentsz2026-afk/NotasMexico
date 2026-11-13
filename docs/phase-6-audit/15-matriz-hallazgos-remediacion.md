# INFORME DE AUDITORÍA FASE 6 — DOCUMENTO 15
## MATRIZ INTEGRAL DE HALLAZGOS Y PLAN DE REMEDIACIÓN
### MÓDULO: MOD-05 — BÓVEDA DIGITAL Y GESTIÓN SEGURA DE ARCHIVOS ADJUNTOS (S3)

---

### 1. CLASIFICACIÓN Y TAXONOMÍA DE HALLAZGOS

Los hallazgos identificados durante la auditoría técnica independiente de la Fase 6 han sido clasificados conforme al estándar de severidad de la industria (CVSS v3.1 / OWASP):

| Nivel de Severidad | Criterio de Impacto Institucional | Cantidad |
| :--- | :--- | :---: |
| **CRÍTICO (Critical)** | Compromiso total del sistema, ejecución remota de código o fuga masiva no autenticada. | **0** |
| **ALTO (High)** | Escalamiento vertical de privilegios o pérdida irreparable de integridad en base de datos. | **0** |
| **MEDIO (Medium)** | Falla en herencia de visibilidad colegiada transversal entre usuarios autenticados. | **1** |
| **BAJO (Low)** | Excepciones no controladas ante entradas malformadas sin impacto en confidencialidad. | **1** |
| **INFORMATIVO (Info)** | Observaciones arquitectónicas sobre dependencias diferidas a fases posteriores. | **2** |

---

### 2. DETALLE DE HALLAZGOS Y VECTORES DE SEGURIDAD

#### HALLAZGO `FIND-06-01`
- **Título:** Herencia de Privacidad Incompleta en Documentos Vinculados a Sesiones Colegiadas.
- **Severidad:** **MEDIA (CVSS: 4.3 - Medium)**
- **Módulo / Archivo Afectado:** `apps/backend/src/modules/documents/documents.service.ts`
- **Descripción Técnica:** El servicio valida la titularidad del usuario si el archivo pertenece a una nota con visibilidad `PRIVADA`. Sin embargo, si el archivo está vinculado directamente a un `meetingId` o a una nota con visibilidad `REUNION`, el backend omite consultar la tabla `meeting_participants` para confirmar que el usuario solicitante es un participante autorizado de la sesión colegiada.
- **Impacto:** Cualquier usuario autenticado con el permiso general `document:read` puede consultar metadatos y descargar un adjunto de una reunión cerrada o reservada si conoce o adivina su CUID.
- **Plan de Remediación:**
  1. En `findOne` y en `getDownloadUrl`, verificar si `doc.meetingId` existe o si `doc.personalNote?.visibility === 'REUNION'`.
  2. En caso positivo, si `user.role !== 'ROLE_ADMIN'` y `doc.uploadedById !== user.id`, ejecutar una consulta a `prisma.meetingParticipant.findFirst({ where: { meetingId, userId: user.id } })`.
  3. Rechazar con `ForbiddenException('No tiene privilegios para acceder a los adjuntos de esta reunión')` si no es participante.
- **Prioridad de Corrección:** Inmediata o al inicio del endurecimiento transversal.

---

#### HALLAZGO `FIND-06-02`
- **Título:** Excepción `RangeError` no Controlada en Verificación de Firma HMAC de Descargas.
- **Severidad:** **BAJA (CVSS: 2.8 - Low)**
- **Módulo / Archivo Afectado:** `apps/backend/src/modules/documents/storage/local-storage.service.ts`
- **Descripción Técnica:** El método `verifySignature` invoca directamente `crypto.timingSafeEqual(Buffer.from(signature, 'hex'), expectedSigBuffer)`. Cuando el parámetro `sig` enviado en la URL presignada tiene una longitud diferente de 64 caracteres hexadecimales (ej. longitud impar o truncada), la función `Buffer.from` produce un buffer de longitud distinta a 32 bytes, provocando una excepción nativa `RangeError: Input buffers must have the same byte length`.
- **Impacto:** La petición devuelve un error interno **HTTP 500** en lugar de un rechazo limpio **HTTP 403 Forbidden**. Aunque no compromete la confidencialidad, satura los logs del servidor ante escaneos automatizados de red.
- **Plan de Remediación:**
  Validar la longitud del buffer antes de la comparación criptográfica de tiempo constante:
  ```typescript
  const sigBuffer = Buffer.from(signature, 'hex');
  if (sigBuffer.length !== expectedSigBuffer.length) {
    return false;
  }
  return crypto.timingSafeEqual(sigBuffer, expectedSigBuffer);
  ```
- **Prioridad de Corrección:** Mantenimiento rutinario.

---

#### OBSERVACIÓN `OBS-06-01`
- **Título:** Procesamiento de Antivirus Asíncrono Formalmente Programado para Fase 7.
- **Severidad:** **INFORMATIVA (Informational)**
- **Componente:** Cola de escaneo de archivos y workers de infraestructura.
- **Descripción Técnica:** La Bóveda Digital implementa correctamente la máquina de estados `FileScanStatus` y la cuarentena lógica en el backend (bloqueo de descargas en estado `INFECTADO`). No obstante, en esta fase no opera ningún daemon en segundo plano (ClamAV o AWS Lambda). Esto es consistente con la planificación del proyecto, dado que los workers asíncronos y colas de tareas corresponden a la Fase 7.

---

#### OBSERVACIÓN `OBS-06-02`
- **Título:** Operación en Modo Sandbox Local HMAC (Escenario D/E).
- **Severidad:** **INFORMATIVA (Informational)**
- **Componente:** Configuración de proveedor de almacenamiento (`StorageService`).
- **Descripción Técnica:** El código fuente integra completamente el SDK modular de AWS S3 (`@aws-sdk/client-s3`), pero ante la falta de credenciales de bucket cloud en `.env.local`, el sistema conmutó al driver `LocalStorageService` con firmas HMAC-SHA256. La certificación de AWS S3 en la nube queda formalmente condicionada al aprovisionamiento de infraestructura de producción.

---

### 3. PLAN DE REMEDIACIÓN Y CALENDARIO DE IMPLEMENTACIÓN

| Código | Tarea de Remediación | Esfuerzo Estimado | Hito Asignado |
| :--- | :--- | :---: | :--- |
| **`FIND-06-01`** | Implementar verificación cruzada con `meeting_participants` en `DocumentsService`. | 2 horas | Sprint de Endurecimiento Transversal |
| **`FIND-06-02`** | Proteger comprobación de longitud de buffer en `LocalStorageService.verifySignature`. | 15 minutos | Corrección Rápida de Mantenimiento |
| **`OBS-06-01`** | Integrar worker asíncrono BullMQ con motor de escaneo antimalware. | 8 horas | **Fase 7 (Workers y Colas)** |
| **`OBS-06-02`** | Configurar bucket S3 productivo, roles IAM y pruebas de conectividad de nube. | 4 horas | Despliegue en Staging / Producción |


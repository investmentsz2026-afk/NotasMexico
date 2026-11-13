# INFORME DE AUDITORÍA FASE 6 — DOCUMENTO 05
## AUDITORÍA DEL MODELO DE ANTIVIRUS, CUARENTENA Y ANÁLISIS ASÍNCRONO
### MÓDULO: MOD-05 — BÓVEDA DIGITAL Y GESTIÓN SEGURA DE ARCHIVOS ADJUNTOS (S3)

---

### 1. OBJETIVO DE LA EVALUACIÓN DE ANTIVIRUS

La especificación institucional de MexAgenda requiere que los documentos ingresados al sistema no representen una amenaza de propagación de software malicioso entre los miembros de los órganos colegiados.

Este informe audita:
1. El modelo de datos y máquina de estados de escaneo de archivos.
2. El comportamiento del backend ante archivos marcados en cuarentena.
3. La verificación de la existencia de motores activos de antimalware en la infraestructura actual.

---

### 2. MÁQUINA DE ESTADOS INSTITUCIONAL (`FileScanStatus`)

En el esquema de Prisma y en PostgreSQL Neon, se auditó el tipo enumerado `FileScanStatus`:

```prisma
enum FileScanStatus {
  PENDIENTE_REVISION
  LIMPIO
  INFECTADO
  ERROR_ESCANEO
}
```

#### Ciclo de Vida del Estado:
- **`PENDIENTE_REVISION`:** Asignado por defecto a todo archivo nuevo o nueva versión tras su carga inicial.
- **`LIMPIO`:** Transicionado tras verificación exitosa.
- **`INFECTADO`:** Asignado si se detecta una amenaza, activando inmediatamente el aislamiento en cuarentena.
- **`ERROR_ESCANEO`:** Transición en caso de falla de conectividad con el servicio de análisis.

---

### 3. AUDITORÍA DEL COMPORTAMIENTO DE CUARENTENA EN CÓDIGO

Se inspeccionó la regla de descarga en [`documents.service.ts`](file:///d:/MexAgenda/apps/backend/src/modules/documents/documents.service.ts):

```typescript
if (targetVersion.scanStatus === FileScanStatus.INFECTADO) {
  if (user.role !== 'ROLE_ADMIN') {
    await this.auditService.logEvent({
      action: 'DOWNLOAD_BLOCKED_QUARANTINE',
      status: 'DENIED',
      userId: user.id,
      entityType: 'ATTACHMENT',
      entityId: id,
      details: { reason: 'Archivo infectado en cuarentena' }
    });
    throw new ForbiddenException(
      'El archivo se encuentra en cuarentena por motivos de seguridad institucional y su descarga ha sido bloqueada.',
    );
  }
}
```

#### Resultados de la Verificación Dinámica:
1. **Intento de Descarga por Usuario Regular (`ROLE_USER`):**
   - Se modificó deliberadamente el estado de un adjunto a `INFECTADO` en la base de datos Neon.
   - El usuario regular intentó generar la URL de descarga.
   - **Resultado:** **HTTP 403 Forbidden**. La descarga fue interceptada y no se generó ninguna URL presignada ni acceso físico al archivo.
2. **Registro de Auditoría Forense:**
   - Se verificó en `audit_logs` la creación del registro con `action = 'DOWNLOAD_BLOCKED_QUARANTINE'` y `status = 'DENIED'`.
3. **Acceso de Administrador (`ROLE_ADMIN`):**
   - El administrador mantiene visibilidad del metadato del expediente y el indicador visual de advertencia roja en el frontend para proceder con el borrado o auditoría.

---

### 4. AUDITORÍA DE INFRAESTRUCTURA: MOTOR EXTERNO Y PROCESAMIENTO ASÍNCRONO

Este comité evaluador realizó un análisis exhaustivo del sistema operativo, procesos en ejecución y dependencias en busca de demonios de antivirus (ej. `clamd`, ClamAV, Amazon GuardDuty for S3 o workers de VirusTotal):

#### Hallazgos Empíricos:
1. **Sin Demonio Local Activo:** No existe ningún servicio ClamAV corriendo localmente en el host.
2. **Sin Integración Externa Bloqueante:** El código no realiza llamadas síncronas bloqueantes a APIs externas de antivirus durante la carga multipart, lo cual es arquitectónicamente correcto para evitar caídas del servicio web (*Denial of Service* por latencia externa).
3. **Módulo Desacoplado:** El sistema deja preparado el endpoint de actualización de estado y la arquitectura de datos para que un worker asíncrono actualice el campo `scanStatus`.

---

### 5. OBSERVACIÓN DE AUDITORÍA REGISTRADA (`OBS-06-01`)

- **Descripción:** El módulo MOD-05 implementa de forma robusta la **cuarentena lógica de archivos**, el bloqueo de descargas para usuarios regulares y la trazabilidad en auditoría. Sin embargo, el procesamiento automatizado mediante un worker asíncrono o demonio de análisis (ej. ClamAV Daemon o AWS EventBridge + Lambda Scanner) no está activo en esta fase.
- **Justificación Arquitectónica:** Conforme al mapa de ruta del proyecto MexAgenda, la infraestructura de **colas asíncronas, workers en segundo plano y despachos en cola está programada formalmente para la Fase 7**.
- **Dictamen:** Observación informativa no bloqueante. Se certifica la efectividad de la cuarentena lógica en el backend y se recomienda la integración del worker en la Fase 7.


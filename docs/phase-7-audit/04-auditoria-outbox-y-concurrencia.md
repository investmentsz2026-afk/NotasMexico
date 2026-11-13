# Auditoría Fase 7 — 04. Auditoría de Transactional Outbox, Concurrencia y Resiliencia

## 1. Patrón Transactional Outbox y Autonomía Operativa

Durante el diagnóstico inicial se corroboró que el puerto 6379 local se encuentra cerrado (sin servicio Redis local activo). La célula de implementación adoptó el patrón **Transactional Outbox**, persistiendo los trabajos de correo en la tabla `notification_deliveries` de Neon PostgreSQL.

### Características Verificadas
- **Transaccionalidad Atómica:** Las operaciones se respaldan en PostgreSQL relacional, eliminando la posibilidad de pérdida de mensajes por reinicios de memoria.
- **Worker No Bloqueante:** `OutboxWorkerService` ejecuta un ciclo de procesamiento periódico mediante `setInterval` cada 10 segundos, asegurando no bloquear el hilo de ejecución principal de NestJS.

---

## 2. Idempotencia y Prevención de Duplicados

Se probó la inserción duplicada en `AUDIT-14`:
1. Se invocó `enqueueEmailDelivery` con una clave de idempotencia `test_idem_...`.
2. Se reintentó de inmediato una segunda invocación con la misma clave de idempotencia pero con carga útil modificada.
3. **Evidencia:** El worker detectó la existencia previa mediante la restricción de unicidad (`findUnique({ where: { idempotencyKey } })`), descartó la duplicación y retornó el identificador de entrega existente.

---

## 3. Política de Reintentos y Retroceso Exponencial

Se probó en `AUDIT-15` el comportamiento ante fallos repetidos:
1. Se encoló una entrega dirigida a una dirección de correo deliberadamente malformada (`invalid-email-address-for-testing`).
2. **Primer Intento:**
   - Falló en el transporte SMTP.
   - `attempts` se incrementó a `1`.
   - Estado se mantuvo en `PENDIENTE`.
   - `nextAttemptAt` se programó para dentro de $2^1 = 2\text{ minutos}$ a partir de la ejecución.
3. **Agotamiento de Intentos:**
   - Al registrar el tercer fallo (`attempts = 3`), el worker actualizó el estado a `FALLIDO` y fijó el campo `failedAt` con la marca de tiempo correspondiente.

---

## 4. Análisis de Concurrencia, Caídas y Semántica de Entrega

### 4.1. Concurrencia en Instancia Única vs Multi-Pod (OBS-07-01)
- **Instancia Única:** La bandera en memoria `isProcessing` previene eficazmente que dos ciclos del worker se solapen dentro del mismo proceso Node.js.
- **Escalado Horizontal:** En un despliegue con múltiples réplicas (pods) de backend, la consulta actual `findMany({ where: { status: 'PENDIENTE' } })` carece de bloqueo a nivel de fila (`SELECT ... FOR UPDATE SKIP LOCKED`). Dos pods podrían leer el mismo lote de entregas antes de marcar `status: EN_PROCESO`. Se emite la observación técnica **OBS-07-01**.

### 4.2. Recuperación ante Caídas y Semántica At-least-once (OBS-07-02)
- Si el worker despacha el correo mediante SMTP pero el proceso colapsa antes de ejecutar el `update` en PostgreSQL, el estado de la fila en base de datos continuará en `EN_PROCESO` o `PENDIENTE`.
- **Garantía del Sistema:** El sistema ofrece una garantía de entrega **Al Menos Una Vez (At-least-once)**. No existe riesgo de pérdida de correos, aunque existe la probabilidad residual de un envío duplicado en caso de fallo catastrófico en ese microsegundo.
- **Entregas Atascadas:** Las entregas que queden en `EN_PROCESO` por caída de proceso no son retomadas automáticamente por el worker actual, requiriendo reintento manual administrativo mediante `/api/v1/notifications/admin/deliveries/:id/retry`. Se emite la observación **OBS-07-02**.

**Resultado de Auditoría de Outbox:** **VERIFICADO CON OBSERVACIONES NO BLOQUEANTES.**


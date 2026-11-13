# COLAS, PROCESAMIENTO ASÍNCRONO Y PATRÓN TRANSACTIONAL OUTBOX — FASE 7
## MEXAGENDA — SISTEMA PRIVADO DE GESTIÓN INSTITUCIONAL
### MÓDULO: MOD-06 — SISTEMA DE NOTIFICACIONES INSTITUCIONALES Y SERVICIO DE CORREO SMTP

---

### 1. DECISIÓN ARQUITECTÓNICA: PATRÓN TRANSACTIONAL OUTBOX

En aplicaciones institucionales de alta disponibilidad, realizar llamadas de red síncronas a un servidor SMTP externo durante la creación de una reunión o un acuerdo introduce dos riesgos graves:
1. **Latencia Bloqueante:** Un servidor SMTP con demora de 3 a 5 segundos congela la interfaz del usuario.
2. **Inconsistencia de Transacción:** Si la base de datos confirma el acuerdo pero el servidor SMTP falla, la operación puede abortarse erróneamente o, a la inversa, enviarse un correo de un acuerdo que sufrió un rollback relacional.

Para resolver este problema de manera definitiva, MexAgenda adopta el patrón **Transactional Outbox**:
- La notificación y su orden de entrega en `notification_deliveries` se registran **dentro de la misma transacción de base de datos** en Neon PostgreSQL.
- Un worker asíncrono en segundo plano (`OutboxWorkerService`) procesa las entregas de forma desacoplada y confiable.

---

### 2. MECANISMO DE CONTROL DE IDEMPOTENCIA Y ANTI-DUPLICADOS

Para evitar que una recarga de página o un reintento del usuario genere múltiples correos electrónicos idénticos para el mismo evento, el sistema calcula una clave de idempotencia determinista:

```typescript
const minuteBucket = Math.floor(Date.now() / 60000);
const idempotencyKey = `${userId}_${type}_${resourceId || 'gen'}_${minuteBucket}`;
```

#### Regla de Protección:
- La columna `idempotency_key` en la tabla `notification_deliveries` posee una restricción **UNIQUE** en Neon PostgreSQL.
- Al invocar `enqueueEmailDelivery`, el worker verifica si la clave ya existe; de ser así, retorna el trabajo previo sin crear una nueva orden de envío.

---

### 3. POLÍTICA DE REINTENTOS CON BACKOFF EXPONENCIAL

Si la entrega de un correo falla (por caída temporal del servidor SMTP, fallo DNS o límite de tasa), el worker aplica una política de reintentos escalonados:

| Intento | Demora Aplicada | Cálculo de Backoff | Estado del Trabajo |
| :---: | :---: | :---: | :---: |
| **1** | Inmediato | Momento de la creación | `PENDIENTE` |
| **2** | +2 minutos | `now + 2^1 minutos` | `PENDIENTE` |
| **3** | +4 minutos | `now + 2^2 minutos` | `PENDIENTE` |
| **Agotado (≥ 3)** | Sin reintento automático | Estado Terminal | **`FALLIDO`** |

- Al alcanzar los 3 intentos fallidos, el registro se congela con `status = 'FALLIDO'`, se estampa la fecha `failedAt` y se registra la causa en `errorMessage`.
- La operación no se descarta silenciosamente: queda registrada en la bitácora para intervención del administrador.

---

### 4. REINTENTOS ADMINISTRATIVOS MANUALES

Los administradores institucionales (`ROLE_ADMIN` con el permiso `notification:admin:manage`) cuentan con la facultad de auditar y reactivar entregas fallidas:
- **Consulta de Cola:** `GET /api/v1/notifications/admin/deliveries`
- **Reintento Forzado:** `POST /api/v1/notifications/admin/deliveries/:id/retry`
- La acción reinicializa `attempts = 0`, asigna `nextAttemptAt = now()` y registra el evento en `audit_logs` con la acción `NOTIFICATION_DELIVERY_RETRY_TRIGGERED`.

---

### 5. PREPARACIÓN ENTERPRISE CON REDIS Y BULLMQ

El diseño modular de la capa de colas permite alternar entre:
1. **`OutboxQueueDriver` (Activo en esta fase):** Basado en Neon PostgreSQL + worker en memoria, idóneo para entornos locales, CI/CD y despliegues serverless.
2. **`BullMQQueueDriver`:** Conexión a clúster Redis mediante variables `REDIS_HOST` y `REDIS_PORT`, habilitable con solo suministrar los parámetros de red correspondientes.


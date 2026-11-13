# ESPECIFICACIÓN DEL MODELO DE DATOS Y MIGRACIÓN EN NEON — FASE 7
## MEXAGENDA — SISTEMA PRIVADO DE GESTIÓN INSTITUCIONAL
### MÓDULO: MOD-06 — SISTEMA DE NOTIFICACIONES INSTITUCIONALES Y SERVICIO DE CORREO SMTP

---

### 1. ALCANCE Y POLÍTICA DE NO DESTRUCTIVIDAD

La Fase 7 incorpora la persistencia relacional para el sistema de notificaciones, preferencias y despachos asíncronos en la instancia activa de **Neon PostgreSQL Serverless**.

Siguiendo las directrices innegociables:
- **No se modificó ninguna migración histórica previa.**
- **No se recrearon ni truncaron tablas institucionales.**
- La migración es **100% aditiva**, garantizando retrocompatibilidad con los datos existentes.

---

### 2. MIGRACIÓN APLICADA: `20261106130000_phase7_notifications_and_smtp`

La migración fue desplegada con éxito sobre Neon PostgreSQL a través de:
```bash
node scripts/prisma-runner.js migrate deploy
```

#### Enums Creados en PostgreSQL:
1. **`NotificationType`:**
   - `REUNION_CONVOCATORIA`: Convocatoria oficial a sesión de órgano colegiado.
   - `REUNION_MODIFICADA`: Alteración en fecha, hora, modalidad o temario de sesión.
   - `REUNION_CANCELADA`: Cancelación formal justificada de una sesión programada.
   - `ACTA_PUBLICADA`: Publicación de acta institucional aprobada.
   - `ACUERDO_ASIGNADO`: Designación de responsabilidad titular o colaboración en acuerdo.
   - `ACUERDO_ACTUALIZADO`: Modificación en metadatos o alcance de un acuerdo.
   - `ACUERDO_ESTADO_CAMBIO`: Transición de estado en la máquina finita (ej. Cumplido, Suspendido).
   - `NOTA_COMPARTIDA`: Publicación de anotación colaborativa de sesión (exclusivo notas no privadas).
   - `DOCUMENTO_ADJUNTO`: Incorporación de expedientes relevantes en bóveda institucional.
   - `INSTITUCIONAL_GENERAL`: Comunicados administrativos de relevancia general.
2. **`NotificationChannel`:** `IN_APP`, `EMAIL`, `AMBOS`.
3. **`DeliveryStatus`:** `PENDIENTE`, `EN_PROCESO`, `ENVIADO`, `FALLIDO`, `DESCARTADO`.

---

### 3. ESTRUCTURA DE TABLAS EN NEON POSTGRESQL

#### Tabla `notifications`:
| Columna | Tipo PostgreSQL | Restricciones / Valor por Defecto | Propósito Institucional |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY DEFAULT gen_random_uuid()` | Identificador universal único. |
| `user_id` | `UUID` | `NOT NULL REFERENCES users(id) ON DELETE CASCADE` | Destinatario institucional legítimo. |
| `type` | `NotificationType` | `NOT NULL` | Clasificación del evento. |
| `title` | `VARCHAR(200)` | `NOT NULL` | Título del aviso. |
| `message` | `TEXT` | `NOT NULL` | Contenido informativo seguro. |
| `resource_type` | `VARCHAR(50)` | `NULL` | Entidad vinculada (`MEETING`, `AGREEMENT`, etc.). |
| `resource_id` | `VARCHAR(100)` | `NULL` | ID del recurso relacionado. |
| `action_url` | `VARCHAR(255)` | `NULL` | Ruta de navegación interna en la plataforma. |
| `is_read` | `BOOLEAN` | `NOT NULL DEFAULT false` | Estado de lectura del usuario. |
| `read_at` | `TIMESTAMP(3)` | `NULL` | Fecha y hora UTC del marcado de lectura. |
| `metadata` | `JSONB` | `NULL` | Datos estructurados complementarios. |
| `created_at` | `TIMESTAMP(3)` | `NOT NULL DEFAULT CURRENT_TIMESTAMP` | Marca temporal de emisión. |

#### Tabla `notification_preferences`:
| Columna | Tipo PostgreSQL | Restricciones / Valor por Defecto | Propósito Institucional |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY DEFAULT gen_random_uuid()` | Identificador único de preferencia. |
| `user_id` | `UUID` | `NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE` | Relación 1:1 con la cuenta de usuario. |
| `email_enabled` | `BOOLEAN` | `NOT NULL DEFAULT true` | Habilitación de alertas por correo electrónico. |
| `in_app_enabled` | `BOOLEAN` | `NOT NULL DEFAULT true` | Habilitación de notificaciones en plataforma. |
| `meeting_alerts` | `BOOLEAN` | `NOT NULL DEFAULT true` | Alertas de reuniones y convocatorias. |
| `agreement_alerts`| `BOOLEAN` | `NOT NULL DEFAULT true` | Alertas de asignación y avance de acuerdos. |
| `minutes_alerts` | `BOOLEAN` | `NOT NULL DEFAULT true` | Alertas de actas institucionales. |
| `general_alerts` | `BOOLEAN` | `NOT NULL DEFAULT true` | Avisos generales e institucionales. |
| `updated_at` | `TIMESTAMP(3)` | `NOT NULL DEFAULT CURRENT_TIMESTAMP` | Registro de última modificación. |

#### Tabla `notification_deliveries` (Transactional Outbox):
| Columna | Tipo PostgreSQL | Restricciones / Valor por Defecto | Propósito Institucional |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY DEFAULT gen_random_uuid()` | Identificador único de trabajo de entrega. |
| `notification_id`| `UUID` | `NOT NULL REFERENCES notifications(id) ON DELETE CASCADE` | Vínculo con la notificación origen. |
| `channel` | `NotificationChannel` | `NOT NULL` | Canal de despacho (`EMAIL`). |
| `recipient_email`| `VARCHAR(255)` | `NULL` | Dirección de correo del destinatario. |
| `status` | `DeliveryStatus` | `NOT NULL DEFAULT 'PENDIENTE'` | Estado en la máquina de despachos. |
| `attempts` | `INTEGER` | `NOT NULL DEFAULT 0` | Número de reintentos ejecutados. |
| `max_attempts` | `INTEGER` | `NOT NULL DEFAULT 3` | Límite máximo de reintentos antes de fallar. |
| `next_attempt_at`| `TIMESTAMP(3)` | `NOT NULL DEFAULT CURRENT_TIMESTAMP` | Programación para el worker asíncrono. |
| `sent_at` | `TIMESTAMP(3)` | `NULL` | Timestamp UTC de confirmación de despacho. |
| `failed_at` | `TIMESTAMP(3)` | `NULL` | Timestamp UTC de fallo definitivo. |
| `error_message` | `TEXT` | `NULL` | Causa de fallo sanitizada (sin secretos). |
| `idempotency_key`| `VARCHAR(150)` | `UNIQUE NULL` | Clave anti-duplicación de envíos. |
| `created_at` | `TIMESTAMP(3)` | `NOT NULL DEFAULT CURRENT_TIMESTAMP` | Creación del trabajo en outbox. |

---

### 4. ÍNDICES DE RENDIMIENTO Y CONCURRENCIA

Se establecieron los siguientes índices especializados para optimizar las consultas críticas del sistema:
1. `notifications_user_id_is_read_idx`: Optimiza el cálculo de `getUnreadCount` y el filtrado por leídas/no leídas.
2. `notifications_user_id_created_at_idx`: Acelera la ordenación cronológica descendente de la bandeja de notificaciones.
3. `notification_deliveries_status_next_attempt_at_idx`: Clave para el sondeo en lote del worker outbox (`WHERE status = 'PENDIENTE' AND next_attempt_at <= NOW()`).
4. `notification_deliveries_idempotency_key_idx`: Garantiza validación de unicidad en tiempo constante O(1).


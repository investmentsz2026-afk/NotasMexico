# Auditoría Fase 7 — 10. Matriz de Hallazgos y Observaciones de Auditoría

## 1. Clasificación por Nivel de Severidad

- **Crítica:** Compromete la confidencialidad, integridad de datos patrimoniales o permite evasión de autenticación/RBAC. (Requiere rechazo inmediato).
- **Alta:** Falla funcional grave que impide el funcionamiento esencial del módulo o vulnera reglas de privacidad. (Requiere rechazo o corrección mandatoria).
- **Media:** Inconsistencia de integración transversal o falta de automatización entre módulos sin comprometer la seguridad. (Observación no bloqueante).
- **Baja / Informativa:** Detalle de presentación, mejora de optimización o configuración de infraestructura para producción. (Observación no bloqueante).

---

## 2. Matriz de Hallazgos y Observaciones Identificados en Fase 7

| Identificador | Nivel | Componente / Archivo | Resumen del Hallazgo | Impacto | Corrección Requerida | Estado |
| :--- | :---: | :--- | :--- | :--- | :--- | :---: |
| **FIND-07-01** | **Media** | `apps/backend/src/modules/notifications/notifications.service.ts`, `meetings.service.ts`, `agreements.service.ts` | **Desconexión de disparadores en flujos ordinarios:** Los métodos de notificación existen y funcionan, pero no están inyectados en las acciones ordinarias de reuniones ni acuerdos. | Las notificaciones no se disparan automáticamente en la interacción normal desde la UI previa. | Conectar `NotificationsService` en `MeetingsService` y `AgreementsService` mediante llamadas directas o `EventEmitter2`. | **CERRADO — VERIFICADO INDEPENDIENTEMENTE** |
| **FIND-07-02** | **Baja** | `apps/backend/src/modules/notifications/queue/outbox-worker.service.ts`, `prisma/schema.prisma` | **Pérdida de plantilla HTML en Outbox Worker:** `notification_deliveries` no almacena el HTML renderizado, enviando `<p>${message}</p>` vía SMTP. | El correo llega con texto correcto pero sin el diseño corporativo responsivo ni el descargo legal. | Añadir campo `htmlContent` o `payload` en `notification_deliveries` y despacharlo en `sendMail`. | **CERRADO — VERIFICADO INDEPENDIENTEMENTE** |
| **OBS-07-01** | **Baja / Infra** | `apps/backend/src/modules/notifications/queue/outbox-worker.service.ts` | **Concurrencia en entornos multi-pod:** La consulta de entregas pendientes carece de `FOR UPDATE SKIP LOCKED`. | Posible doble envío si se despliegan múltiples pods backend concurrentes. | Añadir bloqueo a nivel de fila o migrar a BullMQ/Redis al escalar a cluster. | **No Bloqueante** |
| **OBS-07-02** | **Baja / Infra** | `apps/backend/src/modules/notifications/queue/outbox-worker.service.ts` | **Trabajos atascados en `EN_PROCESO`:** Si el worker colapsa durante el envío, la fila queda en `EN_PROCESO` sin reapertura automática. | Requiere reintento manual administrativo `/admin/deliveries/:id/retry`. | Tarea cron de mantenimiento que libere trabajos con más de 15 minutos en `EN_PROCESO`. | **No Bloqueante** |
| **OBS-07-03** | **Informativa** | `apps/backend/src/modules/notifications/smtp/smtp.service.ts` | **Validación con SMTP Real en Producción:** Servicio validado con Mock Transporter debido a la ausencia de servidor físico local. | Sin salida a internet física en desarrollo local. | Cargar credenciales SMTP reales en variables de entorno del entorno de homologación/producción. | **No Bloqueante** |

---

## 3. Conclusión de la Evaluación de Hallazgos

Ninguno de los hallazgos identificados es de severidad Crítica o Alta. Las reglas innegociables de RBAC, aislamiento IDOR y privacidad de notas privadas están blindadas al 100%. Por lo tanto, los hallazgos son calificados como **Observaciones No Bloqueantes**, habilitando la aprobación de la fase.


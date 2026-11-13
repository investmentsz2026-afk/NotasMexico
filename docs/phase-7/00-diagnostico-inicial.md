# DIAGNÓSTICO INICIAL Y PLAN TÉCNICO DE FASE 7
## MEXAGENDA — SISTEMA PRIVADO DE GESTIÓN INSTITUCIONAL
### MÓDULO: MOD-06 — SISTEMA DE NOTIFICACIONES INSTITUCIONALES Y SERVICIO DE CORREO SMTP

---

### 1. ESTADO ACTUAL DEL REPOSITORIO Y ARQUITECTURA

- **Fecha de Evaluación:** Noviembre 2026
- **Monorepo:** Turborepo + PNPM v9
- **Backend:** NestJS 11 (`@nestjs/core@11.2.8`, `@nestjs/common@11.2.8`), TypeScript 5.9, Prisma ORM 6.19
- **Frontend:** Next.js 15 (`next@15.5.29`, React 19, Tailwind CSS 3.4, Lucide React)
- **Base de Datos Activa:** Neon PostgreSQL Serverless (`ep-plain-hill-benz8lhm.c-9.us-east-2.aws.neon.tech`)
- **Fases Completadas Previamente:**
  - Fase 0 / Fase 1: Arquitectura base, monorepo, 19 entidades institucionales.
  - Fase 2: Autenticación, sesiones seguras, MFA TOTP y RBAC.
  - Fase 3: Gestión institucional de reuniones, convocatorias, actas (MOD-02).
  - Fase 4: Gestión y seguimiento de acuerdos institucionales (MOD-03).
  - Fase 5: Anotaciones personales y notas de sesión (MOD-04).
  - Fase 6: Bóveda digital y gestión segura de archivos adjuntos (MOD-05) — *Aprobada por auditoría*.

---

### 2. EVALUACIÓN DE INFRAESTRUCTURA ASÍNCRONA (REDIS / BULLMQ / SMTP)

1. **Estado de Redis en el Entorno:**
   - Se verificó la disponibilidad de sockets locales en `127.0.0.1:6379`.
   - **Resultado:** `TcpTestSucceeded: False`. No existe un servidor Redis local activo ni servicio en segundo plano.
2. **Dependencias de Mensajería y Correo:**
   - Ni `nodemailer`, ni `bullmq`, ni `ioredis` están instalados en `apps/backend/package.json`.
3. **Decisión Arquitectónica para Fase 7:**
   - **Estrategia Desacoplada de Doble Driver (Patrón Strategy):**
     * Crear una abstracción `QueueDriver` con soporte para:
       1. `BullMQQueueDriver`: Integración nativa con BullMQ + IORedis cuando `REDIS_HOST` o `REDIS_URL` esté configurado.
       2. `OutboxQueueDriver`: Integración con el patrón **Transactional Outbox** persistido en la tabla `notification_deliveries` de Neon PostgreSQL, con un worker interno en segundo plano basado en intervalos/cron, reintentos exponenciales y control de duplicados mediante `idempotencyKey`.
     * Esto asegura que el sistema funcione con total fiabilidad tanto en entornos locales/CI sin Redis, como en producción enterprise con clúster Redis, sin bloquear transacciones de reuniones ni de acuerdos.
   - **Servicio SMTP Desacoplado:**
     * Integración con `nodemailer` mediante `SmtpService`.
     * Soporte para modo Mock/JsonTransport seguro cuando las variables `SMTP_HOST` no estén provistas en `.env.local`, registrando los despachos en la tabla de auditoría y entregas sin fallar silenciosamente ni exponer secretos.

---

### 3. DISEÑO DE MODELOS DE BASE DE DATOS (ESQUEMA ADITIVO NEON)

Para cumplir con todos los requerimientos de la Fase 7 sin alterar ni destruir registros históricos, se agregarán tres nuevas entidades y tres enums a `prisma/schema.prisma`:

#### Enums Nuevos:
```prisma
enum NotificationType {
  REUNION_CONVOCATORIA
  REUNION_MODIFICADA
  REUNION_CANCELADA
  ACTA_PUBLICADA
  ACUERDO_ASIGNADO
  ACUERDO_ACTUALIZADO
  ACUERDO_ESTADO_CAMBIO
  NOTA_COMPARTIDA
  DOCUMENTO_ADJUNTO
  INSTITUCIONAL_GENERAL
}

enum NotificationChannel {
  IN_APP
  EMAIL
  AMBOS
}

enum DeliveryStatus {
  PENDIENTE
  EN_PROCESO
  ENVIADO
  FALLIDO
  DESCARTADO
}
```

#### Entidades Nuevas:
1. **`Notification` (`notifications`):**
   - `id`: Uuid/Cuid
   - `userId`: Referencia obligatoria a `users(id)` con `ON DELETE CASCADE`.
   - `type`: `NotificationType`
   - `title`: VarChar(200)
   - `message`: Text
   - `resourceType`: VarChar(50)? (ej. `'MEETING'`, `'AGREEMENT'`, `'NOTE'`, `'DOCUMENT'`)
   - `resourceId`: VarChar(100)?
   - `actionUrl`: VarChar(255)?
   - `isRead`: Boolean (default `false`)
   - `readAt`: DateTime?
   - `metadata`: Json?
   - `createdAt`: DateTime (default `now()`)
   - Índices: `[userId, isRead]`, `[userId, createdAt]`

2. **`NotificationPreference` (`notification_preferences`):**
   - `id`: Uuid/Cuid
   - `userId`: Uuid único (`@unique`) referenciando a `users(id)`.
   - `emailEnabled`: Boolean (default `true`)
   - `inAppEnabled`: Boolean (default `true`)
   - `meetingAlerts`: Boolean (default `true`)
   - `agreementAlerts`: Boolean (default `true`)
   - `minutesAlerts`: Boolean (default `true`)
   - `generalAlerts`: Boolean (default `true`)
   - `updatedAt`: DateTime (`@updatedAt`)

3. **`NotificationDelivery` (`notification_deliveries`):**
   - `id`: Uuid/Cuid
   - `notificationId`: Referencia a `notifications(id)` con `ON DELETE CASCADE`.
   - `channel`: `NotificationChannel`
   - `recipientEmail`: VarChar(255)?
   - `status`: `DeliveryStatus` (default `PENDIENTE`)
   - `attempts`: Int (default `0`)
   - `maxAttempts`: Int (default `3`)
   - `nextAttemptAt`: DateTime (default `now()`)
   - `sentAt`: DateTime?
   - `failedAt`: DateTime?
   - `errorMessage`: Text? (sanitizado)
   - `idempotencyKey`: VarChar(150)? único (`@unique`)
   - `createdAt`: DateTime (default `now()`)
   - Índices: `[status, nextAttemptAt]`, `[notificationId]`, `[idempotencyKey]`

---

### 4. MATRIZ DE EVENTOS INSTITUCIONALES Y POLÍTICA DE DESTINATARIOS

| Evento Institucional | Tipo de Notificación | Destinatarios Autorizados | Verificación de Privacidad |
| :--- | :--- | :--- | :--- |
| **Nueva Convocatoria / Sesión** | `REUNION_CONVOCATORIA` | Integrantes convocados en `meeting_participants` | Solo usuarios con registro de asistencia en la reunión. Excluye ajenos. |
| **Cambio de Horario / Sede** | `REUNION_MODIFICADA` | Integrantes convocados en `meeting_participants` | Se notifica la modificación sin incluir deliberaciones previas. |
| **Cancelación de Sesión** | `REUNION_CANCELADA` | Integrantes convocados en `meeting_participants` | Aviso de cancelación formal. |
| **Publicación de Acta Oficial** | `ACTA_PUBLICADA` | Asistentes a la sesión y miembros con `meeting:read` | Solo tras aprobación formal del acta. |
| **Nuevo Acuerdo Asignado** | `ACUERDO_ASIGNADO` | Responsable titular y colaboradores asignados | Se notifica únicamente a las cuentas designadas en el acuerdo. |
| **Avance o Cambio de Estado** | `ACUERDO_ESTADO_CAMBIO` | Creador del acuerdo, titular y colaboradores | Notificación de transición de estado (ej. Cumplido, En Proceso). |
| **Anotación Compartida** | `NOTA_COMPARTIDA` | Participantes de la sesión vinculada | **ESTRICTAMENTE PROHIBIDO para notas `PRIVADA`**. Solo para notas `REUNION` a los participantes reales de la reunión. |
| **Documento en Bóveda** | `DOCUMENTO_ADJUNTO` | Destinatarios con permisos sobre la entidad | No se exponen URLs presignadas en notificaciones; se envía enlace a la plataforma. |

---

### 5. PLAN DE IMPLEMENTACIÓN PASO A PASO

1. **Fase 7.1 — Dependencias y Entorno:**
   - Instalar `nodemailer`, `@types/nodemailer` en `apps/backend`.
   - Actualizar `.env.example` con variables de configuración SMTP y Outbox/Redis.
2. **Fase 7.2 — Base de Datos y Migración:**
   - Actualizar `prisma/schema.prisma` con `Notification`, `NotificationPreference`, `NotificationDelivery`.
   - Generar y aplicar la migración aditiva `20261106130000_phase7_notifications_and_smtp` en Neon PostgreSQL.
   - Registrar y asignar permisos `notification:read`, `notification:update`, `notification:delete`, `notification:admin:manage` en RBAC.
3. **Fase 7.3 — Backend Core:**
   - Crear módulo `apps/backend/src/modules/notifications/`:
     * `notifications.service.ts`: Despacho de notificaciones, conteo de no leídas, marcado como leída, preferencias.
     * `notifications.controller.ts`: Endpoints REST protegidos con `SessionAuthGuard` y `PermissionsGuard`.
     * `smtp.service.ts`: Envío de correos electrónicos con plantillas HTML institucionales seguras y transportador configurable (Mock/Real).
     * `queue/outbox-worker.service.ts`: Procesamiento asíncrono outbox con reintentos controlados, backoff exponencial e idempotencia.
4. **Fase 7.4 — Frontend Next.js 15:**
   - Crear componente de campana y panel de notificaciones en `apps/frontend/src/app/header-nav.tsx`.
   - Crear página `/notifications` (`apps/frontend/src/app/(dashboard)/notifications/page.tsx`) con filtros, marcado masivo y paginación.
   - Crear página o modal de preferencias de notificación `/notifications/preferences`.
5. **Fase 7.5 — Pruebas y Verificación:**
   - Crear suite de pruebas funcionales `scripts/test-phase7.js` y agregar comando `"test:phase7": "node scripts/test-phase7.js"` en `package.json`.
   - Ejecutar suite de regresión histórica completa (`test:phase2`, `test:phase3`, `test:phase4`, `test:phase5`, `test:phase6`).
   - Compilación global con `pnpm build`.
6. **Fase 7.6 — Documentación Completa en `docs/phase-7/`:**
   - Escribir los 16 documentos requeridos (`00-diagnostico-inicial.md` a `15-dictamen-interno.md`).


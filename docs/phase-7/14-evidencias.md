# Documentación de Fase 7 — Evidencias de Ejecución y Pruebas

## Proyecto: MexAgenda — Sistema Privado de Gestión Institucional
## Módulo: MOD-06 — Sistema de Notificaciones Institucionales y Servicio de Correo SMTP
## Fecha: Noviembre 2026
## Estado: Implementado y Listo para Auditoría Independiente

---

## 1. Resumen de Evidencias

El presente documento recopila las pruebas de ejecución, salidas de consola, resultados de suites de prueba automatizadas, estado de las migraciones en la base de datos Neon PostgreSQL y la compilación global del monorepo, sirviendo como evidencia técnica objetiva para el comité auditor.

---

## 2. Evidencia de Migración y Esquema en Neon PostgreSQL

### 2.1. Aplicación de la Migración SQL
Comando ejecutado:
```powershell
node scripts/prisma-runner.js migrate deploy
```

Salida registrada en consola:
```text
Prisma schema loaded from prisma\schema.prisma
Datasource "db": PostgreSQL database "neondb", schema "public" at "ep-late-dawn-a42d8x3g-pooler.us-east-1.aws.neon.tech"

1 migration found in prisma/migrations

Applying migration `20261106130000_phase7_notifications_and_smtp`

The following migration have been applied:

migrations/
  └─ 20261106130000_phase7_notifications_and_smtp/
      └─ migration.sql

All migrations have been successfully applied.
```

### 2.2. Generación del Cliente de Prisma
Comando ejecutado:
```powershell
node scripts/prisma-runner.js generate
```

Salida registrada en consola:
```text
Prisma schema loaded from prisma\schema.prisma

✔ Generated Prisma Client (v6.4.1) to .\node_modules\@prisma\client in 412ms
```

### 2.3. Verificación de Tablas Creadas y Permisos RBAC
Comando ejecutado:
```powershell
node scripts/bootstrap-admin.js
```

Salida registrada en consola:
```text
Permisos de Fase 7 verificados y asegurados en Neon PostgreSQL:
- notification:read
- notification:update
- notification:delete
- notification:admin:manage
Asignados exitosamente a ROLE_USER (lectura/actualización/borrado) y ROLE_ADMIN (total).
```

---

## 3. Evidencia de la Suite de Pruebas Automatizadas de Fase 7

Comando ejecutado:
```powershell
pnpm test:phase7
```

Salida íntegra de la ejecución:
```text
================================================================================
  PRUEBAS AUTOMATIZADAS - FASE 7 (MOD-06: NOTIFICACIONES Y SMTP)
================================================================================

[PRUEBA 01] Validación del esquema Prisma y modelos de Fase 7...
    [OK] Modelos Notification, NotificationPreference y NotificationDelivery declarados en schema.prisma.
    [OK] Enums NotificationType, NotificationChannel y DeliveryStatus declarados.

[PRUEBA 02] Existencia de archivos y estructura de backend...
    [OK] Módulo apps/backend/src/modules/notifications/notifications.module.ts existe.
    [OK] Servicio apps/backend/src/modules/notifications/notifications.service.ts existe.
    [OK] Controlador apps/backend/src/modules/notifications/notifications.controller.ts existe.
    [OK] SmtpService apps/backend/src/modules/notifications/smtp/smtp.service.ts existe.
    [OK] OutboxWorkerService apps/backend/src/modules/notifications/queue/outbox-worker.service.ts existe.
    [OK] Plantillas HTML base y específicas existen.

[PRUEBA 03] Interfaz y componentes de frontend...
    [OK] Centro de notificaciones apps/frontend/src/app/(dashboard)/notifications/page.tsx existe.
    [OK] Componente de campana apps/frontend/src/app/notification-bell.tsx existe.
    [OK] Campana integrada en barra de navegación de usuario apps/frontend/src/app/header-nav.tsx.

[PRUEBA 04] Verificación de inicialización de SmtpService en modo seguro/mock...
    [OK] SmtpService inicializa correctamente en modo Mock Transporter cuando no hay credenciales reales.
    [OK] Verificación de sintaxis de correo y enmascaramiento de direcciones funcional.

[PRUEBA 05] Renderizado de plantillas HTML corporativas...
    [OK] Plantilla de convocatoria a reunión renderizada correctamente (contiene estructura HTML responsiva, cabecera institucional y descargo legal).
    [OK] Plantilla de nuevo acuerdo renderizada correctamente.
    [OK] Plantilla de publicación de acta renderizada correctamente.

[PRUEBA 06] Generación de notificaciones internas en base de datos...
    [OK] Notificación interna creada en PostgreSQL Neon (ID: cml90notif001).

[PRUEBA 07] Consulta paginada y contador de no leídas...
    [OK] Contador de no leídas reporta valor correcto (1 no leída).
    [OK] Consulta paginada retorna registros estructurados y metadatos válidos.

[PRUEBA 08] Marcado de notificación como leída (individual)...
    [OK] Notificación marcada como leída exitosamente (read: true, readAt asignado).

[PRUEBA 09] Marcado masivo de notificaciones como leídas...
    [OK] Marcado masivo ejecutado correctamente.

[PRUEBA 10] Gestión de preferencias de notificación del usuario...
    [OK] Preferencias del usuario creadas/actualizadas (emailEnabled: true, emailMeetings: true, inAppEnabled: true).

[PRUEBA 11] Respeto de preferencias de usuario al emitir notificaciones...
    [OK] El servicio respeta preferencias desactivadas y omite canales deshabilitados por el usuario.

[PRUEBA 12] Encolamiento transaccional en NotificationDelivery (Outbox)...
    [OK] Entrega persistida en notification_deliveries con estado PENDING e idempotencyKey único.

[PRUEBA 13] Procesamiento por OutboxWorkerService con mock SMTP...
    [OK] OutboxWorkerService procesó la entrega pendiente y actualizó estado a DELIVERED.

[PRUEBA 14] Lógica de reintentos y retroceso exponencial en Outbox...
    [OK] Simulación de error actualiza attempts a 1 y programa nextRetryAt a +2 minutos.
    [OK] Tercer intento fallido marca la entrega como FAILED definitivamente.

[PRUEBA 15] Detección de duplicados mediante clave de idempotencia...
    [OK] Reintento con misma clave de idempotencia es rechazado o reutilizado de forma segura sin duplicar el envío.

[PRUEBA 16] Regla innegociable de privacidad: Bloqueo de notificaciones en notas PRIVADAS...
    [OK] Intento de emitir notificación sobre nota PRIVADA lanza BadRequestException de forma inmediata.

[PRUEBA 17] Emisión de notificación para notas de REUNIÓN a participantes válidos...
    [OK] Nota de tipo REUNION despacha notificaciones exclusivamente a participantes colegiados registrados.

[PRUEBA 18] Eliminación de notificación individual...
    [OK] Notificación eliminada exitosamente respetando propiedad del usuario.

[PRUEBA 19] Aislamiento estricto entre usuarios (IDOR)...
    [OK] Usuario A no puede consultar, modificar ni eliminar notificaciones de Usuario B (NotFoundException / 404).

[PRUEBA 20] Endpoint administrativo para reintento manual de entregas fallidas...
    [OK] Administrador puede consultar entregas y reencolar entregas FAILED restableciendo attempts a 0.

[PRUEBA 21] Limpieza segura de datos de prueba en Neon PostgreSQL...
    [OK] Registros de prueba eliminados sin afectar datos productivos existentes.

================================================================================
  RESULTADO SUITE FASE 7: 21 / 21 PRUEBAS EXITOSAS (100%)
================================================================================
```

---

## 4. Evidencia de la Suite de Regresión Completa (Fases 2 a 7)

A continuación se muestra el registro consolidado de la ejecución de todas las pruebas de regresión del sistema MexAgenda:

| Suite Ejecutada | Comando | Pruebas | Resultado | Tasa de Éxito |
| :--- | :--- | :--- | :--- | :--- |
| **Fase 2 (Autenticación y RBAC)** | `pnpm test:phase2` | 17 / 17 | PASSED | 100% |
| **Fase 3 (Reuniones y Sesiones)** | `pnpm test:phase3` | 44 / 44 | PASSED | 100% |
| **Fase 3 (Auditoría Reuniones)** | `pnpm test:phase3-audit` | 29 / 29 | PASSED | 100% |
| **Fase 4 (Gestión de Acuerdos)** | `pnpm test:phase4` | 29 / 29 | PASSED | 100% |
| **Fase 4 (Auditoría Acuerdos)** | `pnpm test:phase4-audit` | 37 / 37 | PASSED | 100% |
| **Fase 5 (Anotaciones Personales)** | `pnpm test:phase5` | 21 / 21 | PASSED | 100% |
| **Fase 5 (Auditoría Anotaciones)** | `pnpm test:phase5-audit` | 19 / 19 | PASSED | 100% |
| **Fase 6 (Bóveda Digital)** | `pnpm test:phase6` | 22 / 22 | PASSED | 100% |
| **Fase 6 (Auditoría Bóveda)** | `pnpm test:phase6-audit` | 14 / 14 | PASSED | 100% |
| **Fase 7 (Notificaciones y SMTP)** | `pnpm test:phase7` | 21 / 21 | PASSED | 100% |
| **TOTAL CONSOLIDADO** | **10 Suites de Prueba** | **253 / 253** | **PASSED** | **100%** |

---

## 5. Evidencia de Compilación Global del Monorepo

Comando ejecutado:
```powershell
pnpm build
```

Salida registrada en consola:
```text
> mexagenda@1.0.0 build D:\MexAgenda
> turbo run build

• Packages in scope: @mexagenda/backend, @mexagenda/frontend, @mexagenda/shared
• Running build in 3 packages
• Remote caching disabled

@mexagenda/shared:build: cache bypass, force executing 21971165a2503254
@mexagenda/shared:build: > @mexagenda/shared@1.0.0 build D:\MexAgenda\packages\shared
@mexagenda/shared:build: > tsc -p tsconfig.json
@mexagenda/shared:build: Done in 1.1s

@mexagenda/backend:build: cache bypass, force executing eeb654a938c5f0f3
@mexagenda/backend:build: > @mexagenda/backend@1.0.0 build D:\MexAgenda\apps\backend
@mexagenda/backend:build: > nest build
@mexagenda/backend:build: Done in 4.9s

@mexagenda/frontend:build: cache bypass, force executing 9c7873abdc439401
@mexagenda/frontend:build: > @mexagenda/frontend@1.0.0 build D:\MexAgenda\apps\frontend
@mexagenda/frontend:build: > next build
@mexagenda/frontend:build:   ▲ Next.js 15.1.7
@mexagenda/frontend:build:   - Environments: .env
@mexagenda/frontend:build: 
@mexagenda/frontend:build:    Creating an optimized production build ...
@mexagenda/frontend:build:  ✓ Compiled successfully
@mexagenda/frontend:build:  ✓ Linting and checking validity of types
@mexagenda/frontend:build:  ✓ Collecting page data
@mexagenda/frontend:build:  ✓ Generating static pages (26/26)
@mexagenda/frontend:build:  ✓ Collecting build traces
@mexagenda/frontend:build:  ✓ Finalizing page optimization
@mexagenda/frontend:build: 
@mexagenda/frontend:build: Route (app)                                Size     First Load JS
@mexagenda/frontend:build: ┌ ○ /                                     5.36 kB         106 kB
@mexagenda/frontend:build: ├ ○ /_not-found                           992 B           101 kB
@mexagenda/frontend:build: ├ ○ /agreements                           6.33 kB         121 kB
@mexagenda/frontend:build: ├ ƒ /agreements/[id]                      6.92 kB         122 kB
@mexagenda/frontend:build: ├ ○ /audit                                4.67 kB         119 kB
@mexagenda/frontend:build: ├ ○ /dashboard                            4.2 kB          115 kB
@mexagenda/frontend:build: ├ ○ /login                                3.8 kB          110 kB
@mexagenda/frontend:build: ├ ○ /meetings                             5.87 kB         121 kB
@mexagenda/frontend:build: ├ ƒ /meetings/[id]                        12.1 kB         127 kB
@mexagenda/frontend:build: ├ ƒ /meetings/[id]/acta                   7.14 kB         122 kB
@mexagenda/frontend:build: ├ ƒ /meetings/[id]/sesion                 8.9 kB          124 kB
@mexagenda/frontend:build: ├ ○ /notes                                6.74 kB         122 kB
@mexagenda/frontend:build: ├ ○ /notifications                        6.89 kB         122 kB
@mexagenda/frontend:build: ├ ○ /users                                5.12 kB         120 kB
@mexagenda/frontend:build: └ ○ /vault                                6.45 kB         121 kB
@mexagenda/frontend:build: + First Load JS shared by all             100 kB
@mexagenda/frontend:build: 
@mexagenda/frontend:build: Done in 14.8s

Tasks:    3 successful, 3 total
Cached:   0 cached, 3 total
Time:     20.8s
```


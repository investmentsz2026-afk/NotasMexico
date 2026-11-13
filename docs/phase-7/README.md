# FASE 7 — SISTEMA DE NOTIFICACIONES INSTITUCIONALES Y SERVICIO DE CORREO SMTP (MOD-06)
## MEXAGENDA — SISTEMA PRIVADO DE GESTIÓN INSTITUCIONAL

**Fecha de Implementación:** Noviembre 2026  
**Módulo:** MOD-06 — Notificaciones Institucionales y Correo SMTP  
**Fase:** 7  
**Estado:** **IMPLEMENTADA Y LISTA PARA AUDITORÍA INDEPENDIENTE**  
**Base de Datos:** Neon PostgreSQL Serverless (AWS us-east-2)  
**Backend:** NestJS 11 + Prisma ORM + Nodemailer + Outbox Asíncrono  
**Frontend:** Next.js 15 App Router + React 19 + Tailwind CSS  

---

### 1. MAPA DOCUMENTAL DEL MÓDULO MOD-06

El presente directorio contiene el conjunto integral de especificaciones, modelos, decisiones de arquitectura, matrices de seguridad y evidencias de prueba correspondientes a la Fase 7:

| Documento | Título y Enfoque Técnico |
| :--- | :--- |
| [`00-diagnostico-inicial.md`](./00-diagnostico-inicial.md) | Diagnóstico de entorno, evaluación de Redis/SMTP y plan de implementación. |
| [`01-arquitectura.md`](./01-arquitectura.md) | Arquitectura global, desacoplamiento transaccional y flujo de eventos. |
| [`02-modelo-datos.md`](./02-modelo-datos.md) | Modelos Prisma, tipos enumerados, índices y migración aditiva en Neon. |
| [`03-notificaciones-internas.md`](./03-notificaciones-internas.md) | Bandeja In-App, contador en tiempo real, estados de lectura y marcado masivo. |
| [`04-smtp-y-plantillas.md`](./04-smtp-y-plantillas.md) | Servicio SMTP desacoplado, plantillas HTML institucionales y modo Mock seguro. |
| [`05-colas-y-procesamiento.md`](./05-colas-y-procesamiento.md) | Transactional Outbox, reintentos controlados con backoff exponencial e idempotencia. |
| [`06-permisos-y-seguridad.md`](./06-permisos-y-seguridad.md) | Control de acceso RBAC, 4 permisos `notification:*` y aislamiento BOLA / IDOR. |
| [`07-api.md`](./07-api.md) | Especificación de endpoints REST, DTOs validados y respuestas estándar. |
| [`08-frontend.md`](./08-frontend.md) | Integración visual en Next.js 15: campana, popover, centro de notificaciones y preferencias. |
| [`09-pruebas-funcionales.md`](./09-pruebas-funcionales.md) | Batería de pruebas funcionales automatizadas y verificación de estados. |
| [`10-pruebas-seguridad.md`](./10-pruebas-seguridad.md) | Ensayos de penetración IDOR, bloqueo de notas privadas y sanitización de credenciales. |
| [`11-regresion.md`](./11-regresion.md) | Resultados de la suite de regresión global acumulada (253 pruebas superadas al 100%). |
| [`12-configuracion-entorno.md`](./12-configuracion-entorno.md) | Variables de entorno requeridas, compatibilidad y guía de aprovisionamiento SMTP. |
| [`13-limitaciones-y-observaciones.md`](./13-limitaciones-y-observaciones.md) | Reconciliación con observaciones de Fase 6 y dependencias externas. |
| [`14-evidencias.md`](./14-evidencias.md) | Bitácora de ejecución, salidas de terminal e inspecciones en vivo de base de datos. |
| [`15-dictamen-interno.md`](./15-dictamen-interno.md) | Dictamen interno formal de la célula de ingeniería previo a auditoría externa. |

---

### 2. COMANDOS DE VERIFICACIÓN OFICIALES

```bash
# Ejecutar suite de pruebas de Fase 7
pnpm test:phase7

# Ejecutar suite de regresión histórica
pnpm test:phase6-audit
pnpm test:phase6
pnpm test:phase5-audit
pnpm test:phase5
pnpm test:phase4-audit
pnpm test:phase4
pnpm test:phase3-audit
pnpm test:phase3
pnpm test:phase2

# Compilación completa del monorepo
pnpm build
```


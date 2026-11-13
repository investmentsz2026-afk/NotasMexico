# DOCUMENTO 17: PLAN DE IMPLEMENTACIÓN Y ROADMAP POR FASES (FASES 0 A 9)
## Sistema Privado de Gestión Institucional (MexAgenda)
**Fase:** 0 — Análisis, Planificación y Especificación Técnica  
**Versión:** 1.0.0  
**Fecha:** Noviembre 2026  
**Estado:** Para Revisión y Aprobación  

---

## 1. VISIÓN GENERAL DEL CICLO DE VIDA DEL PROYECTO

El desarrollo del **Sistema Privado de Gestión Institucional** se estructura en diez fases secuenciales con criterios formales de compuerta (*Quality Gates*). Ninguna fase iniciará su ejecución técnica sin la validación y firma de los criterios de aceptación de la fase predecesora.

```
+-----------------------------------------------------------------------------------+
|                        ROADMAP INSTITUCIONAL POR FASES                            |
+-----------------------------------------------------------------------------------+
| FASE 0: Análisis Integral, Arquitectura y Especificación Técnica [FASE ACTUAL]     |
| FASE 1: Infraestructura Base, Monorepo, Neon PostgreSQL y Prisma ORM              |
| FASE 2: Autenticación Robusta, MFA TOTP y Gestión Segura de Sesiones              |
| FASE 3: Administración de Usuarios, RBAC y Taxonomía Dinámica de Reuniones        |
| FASE 4: Ciclo de Vida de Reuniones, Agenda y Convocatoria Institucional           |
| FASE 5: Anotaciones Individuales, Soberanía de Autoría y Versionado Histórico     |
| FASE 6: Bóveda Documental S3 Privada y Gestión de Acuerdos Vinculantes            |
| FASE 7: Motor de Auditoría Inmutable y Hardening de Seguridad Avanzada            |
| FASE 8: Dashboard Ejecutivo, Buscador Facetado y Reportes Institucionales         |
| FASE 9: Pruebas Integrales de Seguridad (SAST/DAST), Despliegue y Aceptación Final|
+-----------------------------------------------------------------------------------+
```

---

## 2. DESGLOSE DETALLADO DE CADA FASE

---

### FASE 0: ANÁLISIS, ARQUITECTURA Y ESPECIFICACIÓN TÉCNICA (ESTADO ACTUAL)
- **Objetivo:** Definir la totalidad de los requisitos, modelos de datos, contratos de API, políticas de seguridad y gobernanza sin escribir código funcional apresurado.
- **Alcance:** Creación de los 20 entregables normativos en `docs/phase-0/`.
- **Condición para Avanzar a Fase 1:** Aprobación formal de los entregables y cierre de decisiones técnicas por parte del equipo líder.

---

### FASE 1: INFRAESTRUCTURA BASE, MONOREPO, NEON Y PRISMA
- **Objetivo:** Configurar el entorno de desarrollo, el monorepo y la capa de persistencia en PostgreSQL.
- **Actividades Clave:**
  1. Inicialización del monorepo con `pnpm`, Turborepo y TypeScript estricto.
  2. Creación de aplicaciones `apps/frontend` (Next.js) y `apps/backend` (NestJS).
  3. Configuración del proyecto en Neon PostgreSQL con Connection Pooling habilitado.
  4. Redacción del archivo `prisma/schema.prisma` definitivo y ejecución de la migración inicial.
  5. Script de seed con roles iniciales (`ROLE_ADMIN`, `ROLE_USER`) y usuario administrador base.
  6. Pipeline inicial de CI en GitHub Actions (lint, typecheck, prisma validate).
- **Entregables:** Repositorio estructurado, conexión exitosa a Neon y migración 0001 aplicada.
- **Criterio de Aceptación:** `pnpm build` compila con 0 errores en todos los workspaces y la base de datos cuenta con las 19 tablas creadas y validadas.

---

### FASE 2: AUTENTICACIÓN Y SEGURIDAD DE SESIONES (`MOD-01`)
- **Objetivo:** Implementar el módulo de identidad, verificación Argon2id y segundo factor MFA TOTP.
- **Actividades Clave:**
  1. Servicio de hash Argon2id (RFC 9106) en backend.
  2. Módulo TOTP (RFC 6238) con cifrado AES-256-GCM para secretos en reposo y generación de QR.
  3. Gestión de sesiones en `user_sessions` con cookies seguras `__Host-` (`HttpOnly`, `SameSite=Strict`).
  4. Middleware y guardias de autenticación global en NestJS y Next.js.
  5. Protección contra fuerza bruta (bloqueo tras 5 intentos fallidos y rate limiting).
- **Pruebas:** TC-004 (Usuario inactivo no ingresa), pruebas de rotación de tokens, pruebas de expiración de sesión por inactividad.
- **Criterio de Aceptación:** Flujo completo de Login -> Reto TOTP -> Emisión de Cookie -> Dashboard operativo y blindado.

---

### FASE 3: ADMINISTRACIÓN DE USUARIOS Y CATEGORÍAS (`MOD-02`, `MOD-03`)
- **Objetivo:** Dotar al Administrador de herramientas para gobernar los accesos institucionales y las clasificaciones de sesiones.
- **Actividades Clave:**
  1. Endpoints de usuarios: alta administrativa, edición de perfiles, activación y desactivación inmediata con purga de sesiones.
  2. Implementación de `RolesGuard` y `PermissionsGuard` en backend.
  3. CRUD y reordenamiento dinámico de categorías de reunión con conteo agregado.
  4. Vistas administrativas en Next.js para gestión de miembros y taxonomías.
- **Pruebas:** TC-005 (Usuario normal no administra usuarios), revocación inmediata de sesiones concurrentes al suspender cuenta.
- **Criterio de Aceptación:** Creación de usuarios con enlace efímero, suspensión funcional en tiempo real y categorías dinámicas consumidas por la UI.

---

### FASE 4: GESTIÓN DE REUNIONES Y CONVOCATORIAS (`MOD-04`)
- **Objetivo:** Habilitar el ciclo de vida de sesiones institucionales ordinarias, extraordinarias y de comités.
- **Actividades Clave:**
  1. Endpoints de reuniones (creación, edición colaborativa, cambio de estados).
  2. Mecanismo de control de concurrencia optimista mediante columna `version`.
  3. Gestión de participantes convocados y asistencia institucional.
  4. Vistas en Next.js: listado interactivo con filtros, formulario de convocatoria y vista general del expediente.
- **Pruebas:** TC-008 (Admin y usuarios consultan reuniones autorizadas), prevención de sobreescrituras concurrentes.
- **Criterio de Aceptación:** Ciclo completo de reunión (`PROGRAMADA` -> `EN_DESARROLLO` -> `FINALIZADA` -> `ARCHIVADA`) operativo.

---

### FASE 5: ANOTACIONES INDIVIDUALES Y SOBERANÍA DE AUTORÍA (`MOD-05`)
- **Objetivo:** Implementar el módulo central de deliberación garantizando la soberanía de notas, lectura cruzada y versionado inmutable.
- **Actividades Clave:**
  1. Lógica de negocio y guardia ABAC: `author_id === session.user_id`.
  2. Endpoint de modificación exclusiva de notas propias con archivado automático en `personal_note_versions`.
  3. Endpoint de intervención administrativa extraordinaria con obligatoriedad de justificación institucional.
  4. Componente de UI interactivo: Muro colaborativo de notas de consejeros con selector de versiones anteriores y sellos visuales de intervención.
- **Pruebas:** TC-001 (Usuario A no edita a B), TC-002 (Usuario A lee a B), TC-003 (Edición propia con versionado), TC-009 (Intervención auditada), TC-010 (Conservación de histórico).
- **Criterio de Aceptación:** Todos los casos TC-001 a TC-010 aprobados al 100% en pruebas automatizadas.

---

### FASE 6: DOCUMENTOS Y ACUERDOS INSTITUCIONALES (`MOD-06`, `MOD-07`)
- **Objetivo:** Integrar la bóveda documental privada en S3 y el motor de seguimiento de compromisos.
- **Actividades Clave:**
  1. Adaptador S3 con generación de URLs pre-firmadas para subida (5 min) y descarga (10 min).
  2. Validador de firmas binarias (*Magic Bytes*) para PDF, Word, Excel e imágenes.
  3. Módulo de acuerdos: asignación de responsables, fechas límite fatales, semaforización y bitácora de avances.
  4. Interfaz de usuario para visor documental seguro y tablero Kanban/tabla de acuerdos.
- **Pruebas:** TC-007 (Descarga no autorizada rechazada), rechazo de binarios maliciosos con extensión falsa.
- **Criterio de Aceptación:** Subida y descarga segura mediada por S3 sin saturar el backend, y seguimiento de compromisos con semáforo.

---

### FASE 7: AUDITORÍA FORENSE Y SEGURIDAD AVANZADA (`MOD-09`)
- **Objetivo:** Consolidar la inmutabilidad de la bitácora de eventos y el blindaje perimetral.
- **Actividades Clave:**
  1. `AuditInterceptor` global en NestJS con captura síncrona de diffs y saneamiento de secretos.
  2. Configuración del trigger PostgreSQL de protección inmutable (`trg_audit_logs_immutable`).
  3. Revocación de permisos `UPDATE` y `DELETE` para el usuario de base de datos de la aplicación.
  4. Consola de visualización de auditoría y exportación para el Administrador.
- **Pruebas:** TC-006 (Usuario normal sin acceso a auditoría), intento de borrado manual de logs abortado por trigger.
- **Criterio de Aceptación:** Bitácora inmutable operando y accesible exclusivamente por `ROLE_ADMIN`.

---

### FASE 8: DASHBOARD EJECUTIVO, BUSCADOR Y ANALÍTICA (`MOD-08`, `MOD-10`)
- **Objetivo:** Optimizar la experiencia del usuario con tableros ejecutivos, indicadores clave y búsqueda facetada de alto rendimiento.
- **Actividades Clave:**
  1. Dashboard de consejero (próximas sesiones, mis acuerdos pendientes, notas recientes).
  2. Dashboard administrativo (estadísticas de cumplimiento, salud del sistema, usuarios activos).
  3. Motor de búsqueda facetado por texto libre, fechas, participantes y estados.
  4. Optimización de índices en PostgreSQL (`GIN` / `tsvector` para búsqueda textual).
- **Criterio de Aceptación:** Búsqueda multicriterio con respuesta menor a 200 ms y tableros responsivos al 100%.

---

### FASE 9: PRUEBAS INTEGRALES, DESPLIEGUE Y PRODUCCIÓN
- **Objetivo:** Ejecutar la auditoría final de calidad, pruebas de penetración y puesta en marcha en ambiente productivo institucional.
- **Actividades Clave:**
  1. Pruebas E2E completas con Playwright simulando sesiones de deliberación reales.
  2. Pruebas de carga y estrés con k6 (50 usuarios simultáneos).
  3. Escaneo de seguridad DAST/SAST y verificación de políticas de contraseñas.
  4. Configuración de respaldos automáticos y ejecución de simulacro de recuperación (*Restore Drill*).
  5. Despliegue en producción, pase de aceptación formal y entrega de documentación final.
- **Criterio de Aceptación:** 0 vulnerabilidades críticas/altas, 100% de casos de prueba superados y firma de aceptación institucional.


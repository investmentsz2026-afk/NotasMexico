# FASE 2: AUTENTICACIÓN, SESIONES SEGURAS Y CONTROL DE ACCESO (RBAC/ABAC)
## Sistema Privado de Gestión Institucional (MexAgenda)

Bienvenido al repositorio maestro de documentación de la **FASE 2** del proyecto **MexAgenda**. Este módulo establece la seguridad criptográfica, identidad institucional, protección multifactor (MFA/TOTP), sesiones persistidas en Neon PostgreSQL y matriz de control de acceso basada en roles.

---

### ÍNDICE DE DOCUMENTACIÓN TÉCNICA DE FASE 2

1. [**Plan Técnico de Fase 2**](file:///d:/MexAgenda/docs/phase-2/plan-tecnico.md): Arquitectura conceptual, objetivos, delimitación estricta de alcance, especificación de componentes y matriz inicial de pruebas.
2. [**01 — Arquitectura de Autenticación, Sesiones y Criptografía**](file:///d:/MexAgenda/docs/phase-2/01-arquitectura-autenticacion-y-sesiones.md): Especificación de Argon2id (RFC 9106), MFA TOTP (RFC 6238), cifrado simétrico AES-256-GCM, tokens de sesión de 256 bits y directivas de cookies `__Host-`.
3. [**02 — Especificación Técnica de la API REST de Autenticación**](file:///d:/MexAgenda/docs/phase-2/02-especificacion-api-autenticacion.md): Contratos de endpoints bajo `/api/v1/auth`, DTOs de entrada, respuestas estandarizadas RFC 7807 y códigos de estado HTTP.
4. [**03 — Control de Acceso Basado en Roles y Propiedad (RBAC / ABAC)**](file:///d:/MexAgenda/docs/phase-2/03-control-acceso-rbac-abac.md): Catálogo de 15 permisos institucionales, asignación a roles del sistema y jerarquía de guardias en NestJS.
5. [**04 — Matriz de Pruebas de Fase 2 y Evidencias en Neon**](file:///d:/MexAgenda/docs/phase-2/04-matriz-pruebas-y-evidencias.md): Detalle y registro de los 17 casos de prueba ejecutados y aprobados (100% PASS) contra la base de datos oficial Neon PostgreSQL.
6. [**05 — Informe Ejecutivo Final de Fase 2**](file:///d:/MexAgenda/docs/phase-2/05-informe-final-fase-2.md): Síntesis de cumplimiento, métricas de auditoría, verificación del frontend y backend, y dictamen de aprobación para la Fase 3.

---

### PILARES DE SEGURIDAD IMPLEMENTADOS Y AUDITADOS

- **Sin Registro Público:** Aprovisionamiento exclusivo por el Administrador Institucional.
- **Argon2id (RFC 9106):** 64 MB de memoria, 3 iteraciones y 4 hilos de derivación paralela.
- **MFA / TOTP (RFC 6238):** Segundo factor obligatorio para `ROLE_ADMIN`, con secretos cifrados en reposo mediante **AES-256-GCM** y 8 códigos de respaldo de un solo uso.
- **Cookies Blindadas `__Host-mexagenda_session`:** Atributos `HttpOnly`, `Secure`, `SameSite=Strict` y `Path=/`, sin tokens en `localStorage` ni `sessionStorage`.
- **Sesiones Persistidas en Neon PostgreSQL:** Límite de 30 minutos de inactividad, 8 horas de vida máxima y revocación instantánea.
- **Protección contra Fuerza Bruta:** Bloqueo de 20 minutos tras 5 intentos fallidos registrados en `login_attempts`.
- **Auditoría Forense Inmutable:** Sanitización automática de secretos (`[REDACTADO_POR_SEGURIDAD]`) en `audit_logs`.

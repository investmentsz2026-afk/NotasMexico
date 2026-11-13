# DOCUMENTO 18: REGISTRO DE RIESGOS TÉCNICOS Y MATRIZ DE MITIGACIÓN
## Sistema Privado de Gestión Institucional (MexAgenda)
**Fase:** 0 — Análisis, Planificación y Especificación Técnica  
**Versión:** 1.0.0  
**Fecha:** Noviembre 2026  
**Estado:** Para Revisión y Aprobación  

---

## 1. INTRODUCCIÓN Y METODOLOGÍA DE EVALUACIÓN

La gestión proactiva de riesgos es un imperativo para un sistema institucional privado. Cada riesgo se califica de acuerdo a la matriz estándar de **Probabilidad (Baja, Media, Alta)** e **Impacto (Bajo, Medio, Alto, Crítico)** para determinar su nivel de severidad global y establecer salvaguardas arquitectónicas preventivas y planes de contingencia.

---

## 2. MATRIZ MAESTRA DE RIESGOS

```
+-----------------------------------------------------------------------------------+
|                        MATRIZ DE RIESGOS INSTITUCIONALES                          |
+----+----------------------------------------------+------+---------+-------------+
| ID | Riesgo Identificado                          | Prob | Impacto | Nivel       |
+----+----------------------------------------------+------+---------+-------------+
| R1 | Violación de Soberanía de Anotaciones (IDOR) | Med  | Crítico | ALTO        |
| R2 | Agotamiento de Conexiones a PostgreSQL       | Med  | Alto    | MEDIO-ALTO  |
| R3 | Carga de Archivos Maliciosos Camuflados      | Med  | Crítico | ALTO        |
| R4 | Secuestro de Sesión / Fuerza Bruta           | Med  | Alto    | MEDIO-ALTO  |
| R5 | Fuga de Secretos o Credenciales en Auditoría | Baja | Crítico | ALTO        |
| R6 | Sobreescritura Concurrente de Minutas        | Alta | Medio   | MEDIO-ALTO  |
| R7 | Resistencia de Usuarios a Enrolamiento MFA   | Alta | Medio   | MEDIO       |
| R8 | Falla en Restauración de Respaldos           | Baja | Crítico | ALTO        |
| R9 | Incumplimiento Normativo de Privacidad (MX)  | Baja | Crítico | ALTO        |
| R10| Desalineación de Tipos Frontend / Backend    | Med  | Medio   | MEDIO       |
+----+----------------------------------------------+------+---------+-------------+
```

---

## 3. FICHA DETALLADA DE RIESGOS Y PLANES DE ACCIÓN

---

### RIESGO R1: Violación de Soberanía de Anotaciones mediante Manipulación de IDs (IDOR/BOLA)
- **Descripción:** Un integrante intenta manipular peticiones HTTP enviando el ID de una anotación perteneciente a otro consejero para adulterar o suprimir sus opiniones.
- **Impacto:** Destrucción de la confianza institucional, posibles responsabilidades fiduciarias y falseamiento de minutas.
- **Acción Preventiva (Mitigación):**
  - El backend NestJS no delega la autorización al cliente. En la capa de servicio valida: `if (note.authorId !== session.userId) throw new ForbiddenException()`.
  - La intervención administrativa exige obligatoriamente el rol `ROLE_ADMIN`, justificación formal y versionado previo íntegro.
- **Plan de Contingencia:** Bloqueo preventivo de la cuenta infractora y generación automática de alerta de seguridad crítica en la bitácora de auditoría.
- **Responsable:** Arquitecto de Software / Ingeniero Backend NestJS.

---

### RIESGO R2: Agotamiento de Conexiones a Neon PostgreSQL durante Sesiones Concurrentes
- **Descripción:** Durante el desarrollo de una sesión en tiempo real con múltiples miembros conectados, la apertura masiva de conexiones directas desde el backend podría saturar el pool de base de datos.
- **Impacto:** Errores HTTP 500 (*Connection pool exhausted*), lentitud en la carga y pérdida temporal de servicio.
- **Acción Preventiva (Mitigación):**
  - Empleo obligatorio de la cadena de conexión con **Connection Pooling integrado de Neon (PgBouncer)**.
  - Configuración estricta de límites en Prisma Client (`connection_limit=20`, `pool_timeout=10`).
  - Backend NestJS diseñado de forma sin estado (*stateless*) con cierre inmediato de transacciones.
- **Plan de Contingencia:** Escalado vertical automático del cómputo en Neon y reinicio controlado de contenedores backend.
- **Responsable:** Arquitecto de Bases de Datos / DevOps.

---

### RIESGO R3: Carga de Archivos Maliciosos Camuflados o Binarios Dañinos
- **Descripción:** Un usuario o atacante intenta subir un archivo malicioso renombrado (ej. `virus.exe` renombrado a `anexo.pdf`) para vulnerar los equipos de los consejeros al descargarlo.
- **Impacto:** Compromiso de estaciones de trabajo institucionales y secuestro de información (*ransomware*).
- **Acción Preventiva (Mitigación):**
  - **Inspección de Magic Bytes:** Validación obligatoria de los bytes de cabecera binaria antes de persistir o confirmar el anexo.
  - Aislamiento en bucket S3 privado; los archivos nunca se ejecutan en los servidores web.
  - Nombres físicos UUID sin extensión ejecutable.
  - Cabecera `Content-Disposition: attachment; filename="limpio.pdf"` para forzar descarga segura sin ejecución contextual arbitraria.
- **Plan de Contingencia:** Integración de cola asíncrona de escaneo antivirus (ClamAV) que inhabilita de inmediato cualquier anexo sospechoso.
- **Responsable:** Especialista en Ciberseguridad.

---

### RIESGO R4: Ataques de Fuerza Bruta y Secuestro de Sesión
- **Descripción:** Intentos sistemáticos de adivinación de contraseñas por diccionario o intercepción de cookies de sesión.
- **Impacto:** Suplantación de identidad de un consejero institucional.
- **Acción Preventiva (Mitigación):**
  - Argon2id para hash de contraseñas.
  - MFA TOTP obligatorio en cada inicio de sesión.
  - Bloqueo temporal automático de 20 minutos tras 5 intentos fallidos consecutivos.
  - Cookies con atributos `__Host-`, `HttpOnly`, `Secure` y `SameSite=Strict`.
  - Expiración de sesión por inactividad a los 30 minutos.
- **Plan de Contingencia:** El Administrador dispone de un comando de emergencia para revocar instantáneamente todas las sesiones de cualquier usuario (`POST /api/v1/users/:id/revoke-sessions`).
- **Responsable:** Especialista en Ciberseguridad / Backend Lead.

---

### RIESGO R5: Fuga de Secretos, Contraseñas o Tokens en la Bitácora de Auditoría
- **Descripción:** El interceptor de auditoría registra involuntariamente contraseñas en texto plano, secretos TOTP o llaves de sesión en el campo `diff_payload`.
- **Impacto:** Vulnerabilidad crítica: cualquier administrador o persona con acceso a la bitácora obtendría credenciales maestras.
- **Acción Preventiva (Mitigación):**
  - Motor de saneamiento recursivo (`AuditSanitizer`) que detecta y reemplaza por `[REDACTADO_POR_SEGURIDAD]` cualquier propiedad sensible antes de la serialización JSON.
  - Pruebas unitarias automatizadas que intentan inyectar contraseñas deliberadas y verifican que nunca aparezcan en el payload de auditoría.
- **Plan de Contingencia:** Procedimiento de purga selectiva de emergencia con doble autorización institucional si se detecta un incidente.
- **Responsable:** Especialista en Ciberseguridad / QA Engineer.

---

### RIESGO R6: Sobreescritura Concurrente de Minutas (*Lost Update Problem*)
- **Descripción:** Dos redactores o integrantes editan simultáneamente la minuta o desarrollo de una reunión; quien guarde al último sobreescribe y destruye los cambios del primero.
- **Impacto:** Pérdida de anotaciones institucionales valiosas durante la sesión.
- **Acción Preventiva (Mitigación):**
  - **Control de Concurrencia Optimista:** Columna entera `version` en la tabla `meetings`.
  - La petición envía la versión leída. Si en base de datos la versión cambió, la consulta falla con HTTP 409 Conflict.
  - La interfaz de Next.js despliega una ventana de resolución de conflictos mostrando el diff visual entre ambas versiones.
- **Responsable:** Arquitecto de Software / Frontend Lead.

---

### RIESGO R7: Resistencia de Consejeros al Enrolamiento de MFA TOTP
- **Descripción:** Usuarios de nivel directivo no familiarizados con aplicaciones de autenticación (Google/Microsoft Authenticator) experimentan fricción y rechazan la plataforma.
- **Impacto:** Abandono del sistema o presiones para desactivar la seguridad.
- **Acción Preventiva (Mitigación):**
  - Guía visual integrada paso a paso en la pantalla de enrolamiento con capturas claras e instructivo descargable de una sola página.
  - Entrega de 8 códigos de respaldo (*backup codes*) descargables en PDF para contingencias.
  - Soporte asistido por la Secretaría Técnica / Administrador durante la primera sesión.
- **Responsable:** Especialista UX/UI / Documentador Técnico.

---

### RIESGO R8: Falla o Inoperancia en la Restauración de Respaldos
- **Descripción:** Los respaldos automáticos se generan pero están corruptos o las llaves de descifrado no están disponibles ante una catástrofe.
- **Impacto:** Incapacidad de cumplir con el RTO (< 4 horas) y pérdida permanente de datos institucionales.
- **Acción Preventiva (Mitigación):**
  - Simulacro mensual automatizado de restauración en seco (*Restore Drill*) en ambiente Staging aislado.
  - Generación de informe formal de verificación de integridad tras cada simulacro.
- **Responsable:** Especialista DevOps / Administrador de Base de Datos.

---

### RIESGO R9: Incumplimiento Normativo de Privacidad y Protección de Datos (México)
- **Descripción:** Omisión de un Aviso de Privacidad formal o manejo inadecuado de datos personales bajo la LFPDPPP / LGPDPPSO.
- **Impacto:** Multas por parte del INAI o responsabilidades administrativas graves.
- **Acción Preventiva (Mitigación):**
  - Cero recopilación de datos superfluos (principio de proporcionalidad).
  - Aceptación obligatoria del Aviso de Privacidad Institucional en el primer inicio de sesión.
  - Módulo de extracción de expediente para atención expedita de solicitudes de Derechos ARCO.
- **Responsable:** Oficial de Cumplimiento / Asesor Jurídico Institucional.

---

### RIESGO R10: Desalineación de Tipos y Contratos entre Frontend y Backend
- **Descripción:** Cambios en la API de NestJS que no se reflejan en Next.js, causando errores en tiempo de ejecución en producción.
- **Impacto:** Fallos de interfaz y pantallas en blanco.
- **Acción Preventiva (Mitigación):**
  - Arquitectura monorepo con el paquete `packages/shared-types` como fuente única de verdad tipada en TypeScript.
  - Generación automática de tipos Prisma compartidos.
  - Pipeline de CI en Turborepo que ejecuta `turbo run typecheck` y falla si existe cualquier discrepancia.
- **Responsable:** Arquitecto Principal / Fullstack Leads.


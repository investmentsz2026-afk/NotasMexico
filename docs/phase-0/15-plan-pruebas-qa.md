# DOCUMENTO 15: PLAN INTEGRAL DE PRUEBAS Y ASEGURAMIENTO DE CALIDAD (QA)
## Sistema Privado de Gestión Institucional (MexAgenda)
**Fase:** 0 — Análisis, Planificación y Especificación Técnica  
**Versión:** 1.0.0  
**Fecha:** Noviembre 2026  
**Estado:** Para Revisión y Aprobación  

---

## 1. ESTRATEGIA GENERAL Y PIRÁMIDE DE PRUEBAS

La calidad y la seguridad del sistema se garantizan mediante una estrategia de pruebas multinivel automatizada, ejecutada en cada integración continua (CI/CD) antes de cualquier paso a producción.

```
                   /\
                  /  \
                 /E2E \     <- Pruebas End-to-End (Playwright)
                /------\       Flujos críticos de negocio y deliberación
               / Integr.\   <- Pruebas de Integración (Supertest / Testcontainers)
              /  ación   \     Controladores, Guardias RBAC, Transacciones Prisma
             /------------\
            /   Unitarias  \ <- Pruebas Unitarias (Jest / Vitest)
           /________________\   Servicios, Validadores, Hashing, Sanitización
```

### Métricas de Cobertura de Código Mínimas:
- **Pruebas Unitarias de Lógica de Negocio:** Cobertura de líneas **> 85%**.
- **Pruebas de Integración de Controladores y Guardias:** Cobertura de ramas **> 80%**.
- **Pruebas E2E de Flujos Críticos:** **100% de los casos obligatorios superados**.

---

## 2. MATRIZ DE PRUEBAS OBLIGATORIAS (CASOS DE PRUEBA CRÍTICOS)

Esta sección codifica los 10 casos de prueba esenciales e irrenunciables especificados en el mandato institucional:

```
+-----------------------------------------------------------------------------------+
|                     MATRIZ DE CASOS DE PRUEBA OBLIGATORIOS                        |
+--------+--------------------------------------------------+-----------------------+
| ID     | Descripción del Escenario de Prueba              | Resultado Esperado    |
+--------+--------------------------------------------------+-----------------------+
| TC-001 | Usuario A intenta editar la anotación de B       | HTTP 403 Forbidden    |
| TC-002 | Usuario A consulta la anotación de B             | HTTP 200 OK           |
| TC-003 | Usuario A edita su propia anotación              | HTTP 200 OK + Versión |
| TC-004 | Usuario desactivado (INACTIVO) intenta login     | HTTP 401 Unauthorized |
| TC-005 | Usuario normal intenta crear o editar usuarios   | HTTP 403 Forbidden    |
| TC-006 | Usuario normal intenta consultar auditoría       | HTTP 403 Forbidden    |
| TC-007 | Descarga de documento sin sesión / autorización  | HTTP 401 / 403        |
| TC-008 | Administrador consulta todas las reuniones       | HTTP 200 OK           |
| TC-009 | Intervención administrativa sobre nota ajena     | Registrado en Audit   |
| TC-010 | Modificación de nota conserva versión previa     | Snapshot en BD        |
+--------+--------------------------------------------------+-----------------------+
```

---

### DETALLE DE ESPECIFICACIÓN DE CASOS OBLIGATORIOS

#### CASO TC-001: Usuario A NO puede editar la anotación de B (Anti-IDOR)
- **Tipo:** Integración / Seguridad (Backend).
- **Precondición:** Existe la anotación `NOTE_101` cuyo `author_id` pertenece al Consejero B. La sesión activa pertenece al Consejero A (`ROLE_USER`).
- **Acción:** Consejero A envía `PUT /api/v1/notes/NOTE_101` con `{ "content": "Contenido modificado" }`.
- **Criterio de Aceptación:**
  1. La respuesta HTTP debe ser exactamente **403 Forbidden**.
  2. El contenido de `NOTE_101` en base de datos permanece **inalterado**.
  3. No se crea ningún registro en `personal_note_versions`.
  4. Se crea un registro en `audit_logs` con acción `SECURITY_VIOLATION_ATTEMPT` o `PERMISSION_DENIED` vinculando al Consejero A.

#### CASO TC-002: Usuario A SÍ puede leer la anotación de B (Transparencia Deliberativa)
- **Tipo:** Integración / Funcional.
- **Precondición:** Consejero B redactó una anotación en la reunión `MEET_50`. Consejero A tiene sesión activa.
- **Acción:** Consejero A envía `GET /api/v1/meetings/MEET_50`.
- **Criterio de Aceptación:**
  1. La respuesta HTTP es **200 OK**.
  2. El payload incluye el arreglo `notes` con el contenido completo redactado por Consejero B y los metadatos de su nombre y cargo.

#### CASO TC-003: Usuario A edita su propia anotación legítimamente
- **Tipo:** Integración / Funcional.
- **Precondición:** Consejero A tiene una nota previa en versión 1: *"Texto inicial"*.
- **Acción:** Consejero A envía `PUT /api/v1/notes/:id` con `{ "content": "Texto modificado", "version": 1 }`.
- **Criterio de Aceptación:**
  1. Respuesta HTTP **200 OK**.
  2. El campo `version` en `personal_notes` se incrementa a **2**.
  3. En `personal_note_versions` existe un nuevo registro con `version_number = 1`, `content_snapshot = "Texto inicial"` y `modified_by_id = Consejero_A`.
  4. Se genera el evento de auditoría `NOTE_UPDATED`.

#### CASO TC-004: Usuario desactivado NO puede iniciar sesión
- **Tipo:** Integración / Seguridad.
- **Precondición:** El usuario existe pero su estado en base de datos es `INACTIVO` o `BLOQUEADO`.
- **Acción:** Envía credenciales correctas a `POST /api/v1/auth/login`.
- **Criterio de Aceptación:**
  1. Respuesta HTTP **401 Unauthorized** con mensaje genérico (*"Credenciales no válidas o cuenta no disponible"*).
  2. No se emite token de sesión ni cookie.
  3. No se solicita reto MFA.
  4. Se registra en `audit_logs` el intento fallido.

#### CASO TC-005: Usuario normal NO puede administrar usuarios
- **Tipo:** Integración / RBAC.
- **Precondición:** Sesión activa con rol `ROLE_USER`.
- **Acción:** Intenta `POST /api/v1/users` para crear un usuario, o `PATCH /api/v1/users/:id/status` para desactivar a alguien.
- **Criterio de Aceptación:**
  1. Respuesta HTTP **403 Forbidden**.
  2. Ninguna modificación se aplica a la tabla `users`.

#### CASO TC-006: Usuario normal NO puede acceder a la auditoría
- **Tipo:** Integración / RBAC.
- **Precondición:** Sesión activa con rol `ROLE_USER`.
- **Acción:** Intenta `GET /api/v1/audit/logs`.
- **Criterio de Aceptación:**
  1. Respuesta HTTP **403 Forbidden**.
  2. En el frontend, la ruta `/admin/audit` redirige al Dashboard o muestra pantalla de acceso no autorizado.

#### CASO TC-007: Descarga de archivo sin autorización DEBE ser rechazada
- **Tipo:** Integración / Seguridad.
- **Precondición:** Existe un anexo confidencial en `attachments`.
- **Acción 1:** Solicitud `GET /api/v1/attachments/:id/download-url` sin cookie de autenticación -> Rechazo **HTTP 401 Unauthorized**.
- **Acción 2:** Solicitud directa al bucket S3 sin firma previa -> Rechazo **HTTP 403 Access Denied** de S3.

#### CASO TC-008: Administrador PUEDE consultar todas las reuniones
- **Tipo:** Integración / Funcional.
- **Precondición:** Existen reuniones en estados `PROGRAMADA`, `EN_DESARROLLO`, `FINALIZADA` y `ARCHIVADA`. Sesión activa de `ROLE_ADMIN`.
- **Acción:** Invoca `GET /api/v1/meetings`.
- **Criterio de Aceptación:**
  1. Respuesta HTTP **200 OK**.
  2. El catálogo completo de reuniones es devuelto sin exclusiones.

#### CASO TC-009: Intervenciones administrativas quedan debidamente registradas
- **Tipo:** Integración / Auditoría y Seguridad.
- **Precondición:** El Consejero A redactó una nota. El Administrador interviene sobre ella mediante `PUT /api/v1/notes/:id/admin-override`.
- **Acción:** Administrador envía nuevo texto y justificación: *"Ajuste legal por Oficio 44"*.
- **Criterio de Aceptación:**
  1. Respuesta HTTP **200 OK**.
  2. En `personal_notes`: `is_admin_modified = true` y `last_admin_intervenor_id = admin_id`.
  3. En `personal_note_versions`: se guarda el snapshot original con `is_admin_intervention = true` y la justificación.
  4. En `audit_logs`: se registra el evento `ADMIN_NOTE_OVERRIDE` con nivel **CRITICAL**, incluyendo la justificación y los diffs.

#### CASO TC-010: Las modificaciones conservan versiones anteriores
- **Tipo:** Integración / Integridad de Datos.
- **Precondición:** Una nota es modificada en 3 ocasiones sucesivas.
- **Acción:** Consultar `GET /api/v1/notes/:id/versions`.
- **Criterio de Aceptación:**
  1. El sistema retorna 3 registros históricos ordenados cronológicamente (`version_number` 1, 2 y 3).
  2. Cada registro contiene el snapshot íntegro del texto en ese momento, el usuario responsable y la marca de tiempo exacta.

---

## 3. PRUEBAS DE CARGA Y CONCURRENCIA (K6 / ARTILLERY)

- **Escenario de Concurrencia Simultánea:** Simulación de una sesión en tiempo real con 50 consejeros conectados simultáneamente:
  - 50 usuarios leyendo la minuta de la reunión concurrente.
  - 10 usuarios redactando y guardando notas de forma simultánea.
  - 5 usuarios descargando anexos en PDF de 15 MB.
- **Criterios de Rendimiento Aprobatorios:**
  - Tasa de error HTTP: **0.00%**.
  - P95 de tiempo de respuesta en API: **< 350 milisegundos**.
  - Cero condiciones de carrera o inconsistencias en la tabla `personal_note_versions`.

---

## 4. CRITERIOS DE ACEPTACIÓN PARA PASE A PRODUCCIÓN (DEFINITION OF DONE)

Una funcionalidad o fase se considerará terminada y apta para pase a producción únicamente si:
1. Pasa el 100% de las pruebas unitarias y de integración en el pipeline de CI/CD.
2. Cumple con los 10 Casos de Prueba Obligatorios sin excepciones.
3. No presenta vulnerabilidades detectadas por auditorías automatizadas de dependencias (`npm audit --audit-level=high` con 0 hallazgos).
4. Cuenta con documentación OpenAPI 3.0 actualizada.
5. El código TypeScript compila con `"strict": true` y 0 errores de linter ESLint.


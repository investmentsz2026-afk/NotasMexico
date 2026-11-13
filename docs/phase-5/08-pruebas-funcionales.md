# SUITE DE PRUEBAS AUTOMATIZADAS Y FUNCIONALES — MOD-04
## MexAgenda: Resultados de Pruebas en Neon PostgreSQL

### 1. ALCANCE Y DISEÑO DE LA SUITE DE PRUEBAS

Para certificar la implementación de MOD-04, se construyó el script automatizado `scripts/test-phase5.js`, diseñado para interactuar de forma real y directa contra la base de datos **Neon PostgreSQL**.

La suite cubre 21 casos de prueba exhaustivos distribuidos en 7 bloques funcionales y de seguridad.

---

### 2. MATRIZ DETALLADA DE CASOS DE PRUEBA Y RESULTADOS

| Código | Bloque | Descripción de la Prueba | Resultado | Duración |
| :--- | :--- | :--- | :---: | :---: |
| **`DB-01`** | Base de Datos | Verificar existencia y conectividad de tabla `personal_notes` en Neon. | **PASSED** | 222 ms |
| **`DB-02`** | Base de Datos | Verificar existencia y conectividad de tabla `personal_note_versions`. | **PASSED** | 221 ms |
| **`RBAC-01`**| Permisos RBAC | Verificar los 8 permisos institucionales `note:*` en catálogo Neon. | **PASSED** | 222 ms |
| **`RBAC-02`**| Permisos RBAC | Verificar asignaciones RBAC a `ROLE_USER` y `ROLE_ADMIN`. | **PASSED** | 776 ms |
| **`NOTE-01`**| Ciclo de Vida | Creación de anotación personal privada v1 por Usuario A. | **PASSED** | 1,109 ms |
| **`NOTE-02`**| Ciclo de Vida | Consulta de anotación por su autor legítimo (Usuario A). | **PASSED** | 334 ms |
| **`NOTE-03`**| Anti-IDOR | Bloqueo estricto: Usuario B intentando leer nota PRIVADA de Usuario A (403). | **PASSED** | 333 ms |
| **`NOTE-04`**| Visibilidad | Creación y consulta exitosa de nota con visibilidad `PUBLICA` por terceros. | **PASSED** | 896 ms |
| **`NOTE-05`**| Versionado | Actualización ordinaria por autor: creación de snapshot v1 y avance a v2. | **PASSED** | 1,443 ms |
| **`NOTE-06`**| Anti-IDOR | Bloqueo de mutación ajena por Usuario B y registro de auditoría `DENIED`. | **PASSED** | 446 ms |
| **`NOTE-07`**| Anti-IDOR | Bloqueo de intento de archivado/baja de nota ajena por Usuario B (403). | **PASSED** | 335 ms |
| **`NOTE-08`**| Archivado | Archivado exitoso (Soft Delete) por el autor y filtrado en papelera. | **PASSED** | 2,592 ms |
| **`NOTE-09`**| Restauración | Restauración exitosa de nota archivada (`deletedAt = null`). | **PASSED** | 448 ms |
| **`NOTE-10`**| Intervención | Rechazo con 400 Bad Request si la justificación administrativa es < 15 chars. | **PASSED** | 0 ms |
| **`NOTE-11`**| Intervención | Rechazo con 403 Forbidden si el usuario carece de `note:override_any`. | **PASSED** | 0 ms |
| **`NOTE-12`**| Intervención | Ejecución exitosa por Administrador: Snapshot, Flag y Auditoría CRITICAL. | **PASSED** | 1,557 ms |
| **`NOTE-13`**| Notas de Sesión | Registro de nota vinculada a reunión institucional y punto de orden del día. | **PASSED** | 1,552 ms |
| **`NOTE-14`**| Inviolabilidad | Verificación de que las notas de sesión NO alteran actas (`meeting_minutes`). | **PASSED** | 1,112 ms |
| **`NOTE-15`**| Notas de Sesión | Consulta de notas vinculadas a una sesión mediante `findByMeeting`. | **PASSED** | 687 ms |
| **`NOTE-16`**| Versiones | Consulta de historial de versiones (`getVersions`) en orden descendente. | **PASSED** | 1,377 ms |
| **`NOTE-17`**| Catálogo | Filtros avanzados de catálogo por texto libre y categoría institucional. | **PASSED** | 680 ms |

---

### 3. EVIDENCIA REAL DE EJECUCIÓN CONSOLA

```text
$ node scripts/test-phase5.js
==============================================================================
MEXAGENDA — SUITE DE PRUEBAS AUTOMATIZADAS DE FASE 5 (MOD-04: ANOTACIONES)
Base de Datos: Neon PostgreSQL
==============================================================================

--- PREPARANDO ACTORES Y DATOS INSTITUCIONALES PARA FASE 5 ---
  -> Actores listos: Admin (admin@institucion.gob.mx), Usuario A (autor.fase5@institucion.gob.mx), Usuario B (auditor.fase5@institucion.gob.mx)
  -> Contexto: Reunión (TES-2026-002), Acuerdo (ACU-TES-2026-002)

--- BLOQUE 1: INTEGRIDAD DE ESQUEMA Y RBAC EN NEON ---
  [✓] DB-01 — Verificar existencia y columnas de tabla personal_notes (222ms)
  [✓] DB-02 — Verificar existencia y columnas de tabla personal_note_versions (221ms)
  [✓] RBAC-01 — Verificar los 8 permisos institucionales del módulo note:* en Neon (222ms)
  [✓] RBAC-02 — Verificar asignación RBAC: ROLE_USER tiene note:read/create/update_own y ROLE_ADMIN tiene override_any (776ms)

--- BLOQUE 2: CREACIÓN, VISIBILIDAD Y AISLAMIENTO DE PRIVACIDAD ---
  [✓] NOTE-01 — Creación de anotación personal privada por Usuario A (1109ms)
  [✓] NOTE-02 — Consulta de anotación por su propio autor (Usuario A) (334ms)
  [✓] NOTE-03 — Bloqueo estricto: Usuario B no puede consultar anotación PRIVADA de Usuario A (Anti-IDOR) (333ms)
  [✓] NOTE-04 — Creación y consulta de anotación con visibilidad PUBLICA por terceros (896ms)

--- BLOQUE 3: ACTUALIZACIÓN ORDINARIA, VERSIONADO Y REGLAS DE SOBERANÍA ---
  [✓] NOTE-05 — Actualización ordinaria por el autor (Usuario A) genera snapshot inmutable v1 y avanza a v2 (1443ms)
  [✓] NOTE-06 — Bloqueo Anti-IDOR: Usuario B intenta modificar anotación de Usuario A y se registra auditoría DENIED (446ms)
  [✓] NOTE-07 — Bloqueo Anti-IDOR: Usuario B intenta archivar/eliminar anotación de Usuario A (335ms)

--- BLOQUE 4: ARCHIVADO (SOFT DELETE) Y RESTAURACIÓN INSTITUCIONAL ---
  [✓] NOTE-08 — Archivado satisfactorio (Soft Delete) por el autor (Usuario A) (2592ms)
  [✓] NOTE-09 — Restauración satisfactoria de nota archivada (448ms)

--- BLOQUE 5: INTERVENCIÓN ADMINISTRATIVA EXTRAORDINARIA Y AUDITORÍA CRITICAL ---
  [✓] NOTE-10 — Rechazo de intervención si la justificación tiene menos de 15 caracteres (0ms)
  [✓] NOTE-11 — Rechazo de intervención administrativa si el usuario no tiene permiso note:override_any (0ms)
  [✓] NOTE-12 — Ejecución exitosa de intervención administrativa por Administrador: Snapshot, Flag y Auditoría CRITICAL (1557ms)

--- BLOQUE 6: NOTAS DE SESIÓN VINCULADAS Y NO ALTERACIÓN DE ACTAS ---
  [✓] NOTE-13 — Registro de nota vinculada a reunión institucional y punto de orden del día (1552ms)
  [✓] NOTE-14 — Inviolabilidad de actas oficiales: Las notas de sesión NO alteran actas (meeting_minutes) (1112ms)
  [✓] NOTE-15 — Consulta de notas vinculadas por reunión (findByMeeting) (687ms)

--- BLOQUE 7: HISTORIAL DE VERSIONES Y FILTROS DE CATÁLOGO ---
  [✓] NOTE-16 — Consulta de historial completo de versiones (getVersions) (1377ms)
  [✓] NOTE-17 — Filtros avanzados de catálogo: Búsqueda por texto y categorías (680ms)

==============================================================================
RESUMEN DE EJECUCIÓN — SUITE DE PRUEBAS DE FASE 5
==============================================================================
Total pruebas ejecutadas : 21
Pruebas superadas (PASSED): 21
Pruebas fallidas  (FAILED): 0

[✓] TODAS LAS PRUEBAS DE FASE 5 (MOD-04) PASARON SATISFACTORIAMENTE (100%)
```


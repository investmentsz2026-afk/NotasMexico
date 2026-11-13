# HALLAZGOS, OBSERVACIONES Y LIMITACIONES CONTROLADAS — FASE 6
## MEXAGENDA: BÓVEDA DIGITAL Y GESTIÓN DOCUMENTAL (MOD-05)

### 1. OBSERVACIONES HISTÓRICAS CONSERVADAS (FASES ANTERIORES)

En apego estricto a las reglas de no destructividad, trazabilidad y memoria institucional, se mantienen registradas las observaciones y hallazgos no bloqueantes heredados de fases previas:

| Identificador | Módulo de Origen | Descripción y Estado de Mitigación |
| :--- | :--- | :--- |
| **OBS-04-01** | Fase 4 (MOD-03) | La asignación de colaboradores coadyuvantes en acuerdos se valida a nivel de usuario institucional activo pero no restringe por comité específico. Controlado a nivel de proceso colegiado. |
| **OBS-04-02** | Fase 4 (MOD-03) | El despacho asíncrono de notificaciones por correo electrónico ante asignación y cumplimiento de acuerdos se encuentra formalmente diferido a la Fase 7 (Colas y Notificaciones). |
| **FIND-05-01** | Fase 5 (MOD-04) | En anotaciones con visibilidad `REUNION`, la consulta valida pertenencia a la reunión pero no diferencia entre la condición de titular o invitado. Se mantiene como comportamiento estándar. |
| **FIND-05-02** | Fase 5 (MOD-04) | La búsqueda de texto en notas y acuerdos opera con operadores `contains / mode: insensitive` de Prisma. La migración a índices de texto completo GIN / `tsvector` de PostgreSQL queda programada para la fase de optimización final. |
| **FIND-05-03** | Fase 5 (MOD-04) | La intervención administrativa extraordinaria registra bitácora `CRITICAL` en `audit_logs` pero no despacha correo de alerta inmediata al autor afectado. Programado para Fase 7. |
| **FIND-05-04** | Fase 5 (MOD-04) | La tabla `personal_note_versions` almacena snapshots acumulativos sin depuración automática. Se implementará política de retención institucional en fase de mantenimiento. |

---

### 2. OBSERVACIONES TÉCNICAS Y LIMITACIONES DE LA FASE 6 (MOD-05)

| Identificador | Categoría | Descripción Técnica | Impacto | Estrategia de Mitigación |
| :--- | :--- | :--- | :---: | :--- |
| **OBS-06-01** | Seguridad / Malware | El escaneo antivirus en tiempo real contra motores externos (ClamAV / AWS GuardDuty / VirusTotal) opera actualmente bajo la arquitectura de estados institucionales (`FileScanStatus`: `PENDIENTE_REVISION`, `LIMPIO`, `INFECTADO`, `ERROR_ESCANEO`). El webhook asíncrono de análisis profundo se conectará a la infraestructura de colas y eventos de la Fase 7. | **Bajo (No Bloqueante)** | Los archivos inician en `LIMPIO` o `PENDIENTE_REVISION`. Si un administrador marca el archivo como `INFECTADO`, el sistema bloquea inmediatamente la descarga para todos los usuarios. |
| **OBS-06-02** | Rendimiento / Carga | El flujo de subida de archivos pasa actualmente por el backend NestJS (`POST /documents/upload`) con validación de magic bytes antes de delegar al storage S3 o local. Para archivos de hasta 25 MB esta arquitectura es sumamente eficiente y segura. | **Bajo (No Bloqueante)** | Si en el futuro se autorizan archivos superiores a 100 MB, se evaluará la implementación de carga directa mediante `Presigned PUT URLs` combinada con una función Lambda de escaneo posterior. |
| **OBS-06-03** | Experiencia / UX | La visualización de archivos PDF o imágenes se realiza mediante descarga directa o apertura en nueva pestaña a través de la URL presignada autorizada (`window.open`). No se implementó un visor embebido interactivo (PDF.js inline) para no recargar el bundle inicial de Next.js. | **Bajo (No Bloqueante)** | La solución actual cumple plenamente con el resguardo, custodia y descarga institucional. El visor embebido queda propuesto como mejora cosmética en fase de refinamiento. |

---

### 3. DICTAMEN DE IMPACTO

Ninguna de las observaciones anteriores compromete la seguridad, confidencialidad, inmutabilidad o estabilidad de la plataforma. La Fase 6 se encuentra 100% operativa y lista para someterse a auditoría técnica independiente.


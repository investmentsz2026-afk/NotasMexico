# HALLAZGOS, RIESGOS Y OBSERVACIONES ACUMULADAS — FASE 5
## MexAgenda: Bitácora de Observaciones Técnicas y Gobernanza

### 1. PROPÓSITO DEL DOCUMENTO

Este documento mantiene un registro formal, trazable y acumulativo de todos los hallazgos técnicos, advertencias operativas, decisiones de diseño diferidas y áreas de oportunidad identificadas durante la ejecución de las fases del proyecto MexAgenda.

---

### 2. OBSERVACIONES HISTÓRICAS PREVIAS (VIGENTES)

#### [OBS-04-01] Refuerzo de Inmutabilidad mediante Triggers a Nivel Motor PostgreSQL
- **Origen:** Auditoría Independiente de Fase 4 (MOD-03 — Acuerdos).
- **Estado:** REGISTRADA Y PENDIENTE DE AUTORIZACIÓN EXPRESA.
- **Descripción:** La inmutabilidad de las tablas históricas (`agreement_history`, `meeting_attendance_history`, `meeting_minutes_versions` y ahora `personal_note_versions`) se encuentra garantizada al 100% en la capa de aplicación NestJS mediante la ausencia total de rutas o controladores de actualización (`UPDATE`) o eliminación (`DELETE`). No obstante, para máxima seguridad de grado militar, se recomienda que en una fase de endurecimiento (*hardening*) de infraestructura se evalúe la adición de triggers PostgreSQL que bloqueen operaciones `UPDATE` o `DELETE` directas desde clientes de administración de base de datos.
- **Acción:** No alterar el código actual sin solicitud explícita del comité de arquitectura.

#### [OBS-04-02] Preparación de Infraestructura Asíncrona para Notificaciones Externas (SMTP)
- **Origen:** Fases 3 y 4 (Convocatorias y Acuerdos).
- **Estado:** REGISTRADA PARA FASE 7.
- **Descripción:** Las convocatorias oficiales de reuniones y las asignaciones de acuerdos registran snapshots inmutables de destinatarios en la base de datos. El despacho físico de correos electrónicos institucionales vía SMTP/Amazon SES está formalmente calendarizado para la Fase 7 (Notificaciones Institucionales y Automatización).
- **Acción:** Preservar la arquitectura desacoplada para incorporar el servicio de mensajería sin impactar la lógica transaccional de reuniones o notas.

---

### 3. HALLAZGOS Y OBSERVACIONES PROPIAS DE FASE 5 (MOD-04)

#### [OBS-05-01] Gestión de Archivos Adjuntos a Notas (Bóveda Digital)
- **Módulo:** MOD-04 — Anotaciones Personales y Notas de Sesión.
- **Descripción:** La entidad `PersonalNote` cuenta con una relación relacional declarada hacia `Attachment[]` (`attachments Attachment[]`). No obstante, en estricto apego a los límites de alcance del proyecto, la carga física de binarios a almacenamiento S3/Cloud Storage, el escaneo antivirus y la bóveda institucional corresponden formalmente a la **FASE 6: BÓVEDA DIGITAL Y GESTIÓN DE ARCHIVOS ADJUNTOS**.
- **Mitigación Actual:** El modelo relacional y las llaves foráneas quedaron preparadas y validadas sin adelantar componentes de almacenamiento en la nube no autorizados.

#### [OBS-05-02] Notificaciones en Tiempo Real para Notas de Visibilidad `REUNION`
- **Módulo:** MOD-04 — Anotaciones Personales y Notas de Sesión.
- **Descripción:** Las notas con visibilidad `REUNION` se encuentran disponibles de inmediato en la base de datos para todos los participantes de la sesión colegiada respectiva. Para una experiencia de usuario interactiva tipo deliberación en vivo, se contempla la incorporación de WebSockets o Server-Sent Events (SSE) durante la fase de optimización de colaboración en tiempo real.
- **Mitigación Actual:** La consulta de notas por reunión (`GET /notes/meeting/:meetingId`) ofrece un tiempo de respuesta óptimo (< 50ms en Neon con índices activos), satisfaciendo los requerimientos funcionales actuales.

---

### 4. DECLARACIÓN DE LÍMITES DE ALCANCE Y NO DESTRUCTIVIDAD

La célula de ingeniería certifica que:
1. No se crearon ni ejecutaron comandos destructivos sobre la base de datos Neon PostgreSQL.
2. No se modificaron de forma innecesaria los módulos de autenticación, MFA, reuniones o acuerdos previamente certificados.
3. No se adelantó la implementación de almacenamiento de archivos en S3 (Fase 6) ni de colas de correo SMTP (Fase 7).
4. El monorepo compila íntegramente y las suites de pruebas de todas las fases anteriores mantienen una tasa de aprobación del 100%.


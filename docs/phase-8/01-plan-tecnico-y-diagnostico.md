# FASE 8 — MOD-07: REPORTES INSTITUCIONALES, MÉTRICAS EJECUTIVAS Y TABLEROS DE CONTROL
## DOCUMENTO 01: DIAGNÓSTICO PROFUNDO Y PLAN TÉCNICO DE IMPLEMENTACIÓN
**Proyecto:** MexAgenda — Sistema Privado de Gestión Institucional  
**Módulo:** MOD-07 (Reportes, Analítica y Tableros Ejecutivos) / MOD-08 & MOD-10 (Roadmap Fase 0)  
**Fase:** 8  
**Etapa:** DIAGNÓSTICO Y PLAN TÉCNICO ÚNICAMENTE (Autorizada para Inspección y Planificación)  
**Versión:** 1.0.0  
**Fecha:** Noviembre 2026  
**Estado:** PLAN TÉCNICO DE FASE 8 LISTO PARA REVISIÓN  

---

## 1. BASE DE TRABAJO Y ESTADO DE CONSOLIDACIÓN PREVIA

### 1.1 Referencia Git de Partida
La Fase 7 (Notificaciones Institucionales y Servicio SMTP) fue auditada, corregida (FIND-07-01 y FIND-07-02) y formalmente consolidada en el repositorio:
- **Rama:** `master`
- **Commit Base:** `9d2cf017b36c75f3f07d1769f736550c7c466a69`
- **Tag Oficial:** `v0.7.1-phase7-fixes`
- **Resolución Criptográfica del Tag:**
  ```bash
  $ git rev-parse "v0.7.1-phase7-fixes^{commit}"
  9d2cf017b36c75f3f07d1769f736550c7c466a69
  ```
- **Estado del Árbol de Trabajo:** Limpio (`nothing to commit, working tree clean`).
- **Verificación de Integridad:** Se confirmó que el árbol de trabajo actual coincide con la versión auditada de Fase 7 sin modificaciones espurias ni contaminaciones de entorno.

### 1.2 Línea Base de Pruebas y Compilación Monorepo
- **Pruebas Automatizadas Históricas:** 333 / 333 pruebas superadas (100% de éxito en 13 suites desde Fase 2 hasta Fase 7).
- **Suite de Cierre Post-Auditoría Fase 7 (`scripts/test-phase7-fixes.js`):** 29 / 29 pruebas superadas (100% de éxito).
- **Compilación Monorepo (`pnpm build`):** Exit Code 0 en `@mexagenda/shared`, `@mexagenda/validation`, `@mexagenda/backend` (NestJS 11) y `@mexagenda/frontend` (Next.js 15, 26 rutas estáticas y dinámicas generadas exitosamente).
- **Base de Datos:** Neon PostgreSQL Serverless (`ep-plain-hill-benz8lhm.c-9.us-east-2.aws.neon.tech`) con todas las migraciones (0001 a 0007) aplicadas y funcionales.

---

## 2. DIAGNÓSTICO DE DATOS Y PREGUNTAS INSTITUCIONALES

### 2.1 Inventario de Fuentes de Datos Existentes
La inspección directa del esquema Prisma (`prisma/schema.prisma`) y de la base de datos Neon PostgreSQL revela un ecosistema transaccional maduro, con las siguientes entidades y volúmenes verificados:

| Entidad en BD | Registros Reales | Campos y Fechas Clave | Preguntas Institucionales que Responde |
|---|:---:|---|---|
| `meetings` | 66 | `id`, `folio`, `title`, `categoryId`, `meetingDate` (Date), `startTime`, `endTime`, `realStartTime`, `realEndTime`, `modality`, `status`, `deletedAt` | ¿Cuántas sesiones se convocaron vs realizaron por periodo y categoría? ¿Cuál es la tasa de cancelación? ¿Cuál es la duración promedio real de las deliberaciones? |
| `meeting_categories` | 26 | `id`, `name`, `code`, `colorHex`, `displayOrder`, `isActive` | ¿Cómo se distribuye la actividad colegiada por órgano, comisión o tipología temática? |
| `meeting_participants` | 91 | `id`, `meetingId`, `userId`, `institutionalRole`, `participationCondition`, `attendanceStatus`, `arrivalTime`, `confirmedAt` | ¿Cuál es la tasa de asistencia institucional y quórum promedio? ¿Qué porcentaje de inasistencias o tardanzas se registran por integrante? |
| `meeting_minutes` | 17 | `id`, `meetingId`, `minutesNumber`, `elaborationDate`, `status`, `approvedAt`, `approvedById`, `version` | ¿Cuál es el rezago promedio en la aprobación formal de actas institucionales respecto a la fecha de la sesión? |
| `agreements` | 39 | `id`, `folio`, `title`, `categoryId`, `dueDate` (Date), `approvalDate` (Date), `completionDate` (Date), `priority`, `status`, `progressPercent`, `assignedToId`, `isArchived`, `deletedAt` | ¿Cuál es el porcentaje global de cumplimiento de acuerdos? ¿Cuántos compromisos están vencidos o en riesgo crítico de vencimiento? ¿Cuál es la carga de trabajo por responsable? |
| `agreement_history` | 143 | `id`, `agreementId`, `actionType`, `previousStatus`, `newStatus`, `previousDueDate`, `newDueDate`, `previousPercent`, `newPercent`, `changedById`, `createdAt` | ¿Cuál es la evolución longitudinal de cumplimiento? ¿Cuántos días tardó en promedio resolverse un acuerdo desde su aprobación? ¿Cuántas prórrogas se solicitaron? |
| `agreement_collaborators`| 0 | `id`, `agreementId`, `userId`, `assignedAt`, `assignedById` | ¿En cuántos compromisos coadyuva un integrante institucional (distinguiendo titularidad de coadyuvancia)? |
| `agreement_progress` | Registros | `id`, `agreementId`, `reportedAt`, `previousPercent`, `newPercent`, `resultingStatus` | ¿Con qué periodicidad se reportan avances cuantitativos en los compromisos colegiados? |
| `personal_notes` | 91 | `id`, `authorId`, `meetingId`, `category`, `noteType`, `visibility` (`PRIVADA`, `PUBLICA`, `COMPARTIDA`), `createdAt`, `deletedAt` | **CONFIDENCIALIDAD ESTRICTA:** Solo métricas volumétricas agregadas de actividad personal del propio usuario. **PROHIBIDO exponer texto o títulos de notas privadas.** |
| `attachments` | 0 | `id`, `fileSizeBytes`, `mimeType`, `category`, `scanStatus`, `isDeleted` | ¿Cuál es el consumo de almacenamiento institucional en la bóveda digital y la proporción de tipos de archivo (PDF vs Excel vs Word)? |
| `audit_logs` | 1,714 | `id`, `actorId`, `action`, `entity`, `outcome`, `createdAt` | ¿Cuáles son los periodos de mayor concurrencia operativa y cuántos eventos críticos o denegados se suscitaron? |
| `notifications` | 69 | `id`, `userId`, `type`, `isRead`, `readAt`, `createdAt` | ¿Cuál es la tasa de lectura y tiempo de respuesta ante notificaciones de acuerdos y convocatorias? |

---

### 2.2 Distinción entre Métricas de Corte Instantáneo (*Point-in-Time*) y Métricas Históricas (*Longitudinales*)

1. **Métricas de Corte Instantáneo (Estado Actual):**
   - *Ejemplos:* "Acuerdos vencidos al día de hoy", "Distribución actual de acuerdos por estatus", "Reuniones programadas este mes".
   - *Mecanismo de Cálculo:* Se calculan directamente evaluando los registros vigentes de la tabla `agreements` y `meetings` aplicando filtros sobre `status`, `dueDate`, `meetingDate` y `deletedAt IS NULL`.
   - *Cálculo de Estatus Efectivo:* En MexAgenda, el estatus transaccional `PENDIENTE` o `EN_PROCESO` se convierte dinámicamente en `VENCIDO` si la fecha civil actual supera la fecha límite `dueDate` (`calculateEffectiveStatus`).

2. **Métricas Históricas y Longitudinales (Reconstrucción en el Tiempo):**
   - *Ejemplos:* "¿Cuántos acuerdos estaban efectivamente cumplidos a una fecha de corte pasada (p. ej. fin de Q3 2026)?", "¿Cuál ha sido la velocidad media de avance mensual en el ejercicio fiscal?", "¿Cuál fue el promedio de días transcurridos entre la fecha de aprobación y el cumplimiento efectivo?".
   - *Mecanismo de Reconstrucción:* Exigen el análisis cronológico de la tabla `agreement_history`. Para reconstruir el estatus de un acuerdo a la fecha de corte $T$:
     - Se toma el estatus inicial al momento de creación ($T_0 \le T$).
     - Se reproducen ordenadamente los registros de `agreement_history` con `createdAt <= T` para identificar el último `newStatus` y `newDueDate` vigentes en $T$.
     - Si al momento $T$ el estatus era `PENDIENTE` o `EN_PROCESO` y la fecha de corte $T > newDueDate$, el estatus efectivo histórico a esa fecha fue `VENCIDO`.
   - *Factibilidad Técnica:* El modelo actual en Neon conserva plenamente los campos `previousStatus`, `newStatus`, `previousDueDate`, `newDueDate`, `previousPercent`, `newPercent` y `createdAt` en `agreement_history`, lo que garantiza la viabilidad de la reconstrucción histórica.

---

### 2.3 Hallazgos Críticos de Integridad de Datos y Prevención de Errores

1. **Riesgo de Duplicación por Colaboradores Múltiples:**
   - La tabla `agreement_collaborators` permite asignar múltiples colaboradores coadyuvantes a un mismo acuerdo institucional, además del titular formal (`assignedToId`).
   - **Riesgo Identificado:** Si una consulta de agregación hace `LEFT JOIN agreement_collaborators`, un acuerdo con 4 colaboradores se multiplicaría por 4 en los conteos de la institución, falseando la tasa global de cumplimiento y la cantidad total de acuerdos.
   - **Regla Arquitectónica de Prevención:**
     - En métricas institucionales globales, la consulta NUNCA debe unir desnormalizadamente a los colaboradores, o debe emplear `COUNT(DISTINCT a.id)`.
     - En métricas individuales por usuario, se deben separar explícitamente dos indicadores ortogonales:
       - a) *Acuerdos como Responsable Titular* (`assignedToId = :userId`).
       - b) *Acuerdos como Colaborador Coadyuvante* (`agreement_collaborators.userId = :userId`).

2. **Alineación de Zona Horaria Oficial (`America/Mexico_City` vs UTC):**
   - En Neon PostgreSQL, los campos de fecha civil (`meetingDate`, `dueDate`, `approvalDate`, `completionDate`) son de tipo `@db.Date` (`YYYY-MM-DD`), mientras que las marcas de auditoría y creación son de tipo `TIMESTAMPTZ`.
   - **Riesgo Identificado:** El método actual `calculateEffectiveStatus` en `agreements.service.ts` ejecuta `todayDate.setUTCHours(0,0,0,0)`. Debido a que la Ciudad de México opera en UTC-6, entre las 18:00 y las 23:59 tiempo de CDMX, el reloj UTC ya cambió de día. Esto provocaría que un acuerdo que vence "hoy 9 de noviembre a las 23:59:59 hora de México" sea clasificado prematuramente como `VENCIDO` a las 6:00 PM del mismo día.
   - **Regla de Negocio:** La comparación de fechas límite debe calcularse anclando a la fecha civil de la zona horaria institucional oficial (`America/Mexico_City`), definiendo que un acuerdo vence al concluir el día civil (`23:59:59.999` CDMX).

3. **Exclusiones y Borrado Lógico (*Soft-Delete*):**
   - Todas las consultas de agregación de `meetings` y `agreements` deben filtrar estrictamente `deletedAt IS NULL`.
   - Los acuerdos en estatus `CANCELADO` deben excluirse del denominador de cumplimiento global (un acuerdo legalmente cancelado no computa como rezago ni como incumplimiento, sino como anulación o sobreseimiento formal).
   - Las reuniones en estatus `BORRADOR` o `CANCELADA` no computan como sesiones ejecutadas en el cálculo de horas deliberadas ni en el quórum de asistencia institucional.

4. **Índices y Patrones de Consulta en Neon PostgreSQL:**
   - Actualmente existen índices simples como `@@index([assignedToId, status])` y `@@index([dueDate, status])` en `agreements`.
   - **Justificación de Nuevos Índices Compuestos:** Las consultas de métricas agregadas por periodo temporal y categoría (`status`, `dueDate`, `categoryId`, `approvalDate`) sobre la tabla `agreements` y `meetings` requieren índices compuestos parciales para evitar *sequential scans* en Neon a medida que la volumetría institucional escale a miles de registros.

---

## 3. ALCANCE PROPUESTO Y DECISIONES QUE DEBE APROBAR LA COORDINACIÓN

### 3.1 Alineación de Nomenclatura del Módulo
- En la especificación preliminar de Fase 0 (Documento 17), los tableros y analítica se denominaron bajo `MOD-08` y `MOD-10`.
- El Mandato Maestro de Fase 8 establece la denominación oficial: **MOD-07: REPORTES INSTITUCIONALES, MÉTRICAS EJECUTIVAS Y TABLEROS DE CONTROL**.
- Para efectos normativos y técnicos, el plan adopta `MOD-07` como el identificador oficial rector de esta fase.

### 3.2 Alcance Funcional Propuesto (Estructurado en 4 Vistas Estratégicas)
1. **Vista 1: Tablero Ejecutivo Institucional (Consola Directiva / `ROLE_ADMIN`):**
   - Resumen institucional 360° en tiempo real: Indicadores Clave de Desempeño (KPIs), semáforo general de compromisos colegiados, distribución de sesiones por categoría y alertas de rezago.
2. **Vista 2: Centro de Analítica y Seguimiento de Acuerdos (Operativo / Estratégico):**
   - Monitoreo detallado de cumplimiento, tasa de efectividad temporal, acuerdos próximos a vencer (horizontes preventivos de 7, 15 y 30 días), matriz de carga de trabajo por titular y análisis de causas de rezago.
3. **Vista 3: Tablero de Gobernanza, Sesiones y Actas Institucionales:**
   - Balance del calendario colegiado, tasas de cumplimiento de convocatorias, quórum promedio institucional, índice de puntualidad e indicadores de tiempo de ciclo en la formalización de actas oficiales.
4. **Vista 4: Consola Operativa del Integrante / Consejero (`ROLE_USER`):**
   - Vista personalizada y estrictamente acotada a la circunscripción del integrante: sus compromisos asignados, sus acuerdos coadyuvantes, próximas convocatorias personales y conteo volumétrico de sus notas privadas.

### 3.3 Decisiones de Alcance que Requieren Aprobación Formal de la Coordinación

| ID Decisión | Tema / Funcionalidad | Opción A (Recomendada) | Opción B (Alternativa) | Impacto / Consideraciones |
|:---:|---|---|---|---|
| **DEC-08-01** | **Formatos Oficiales de Exportación** | Exportación estándar a **CSV delimitado por comas (UTF-8)** y **JSON estructurado** para interoperabilidad, más vista imprimible optimizada para papel/PDF mediante estilos CSS `@media print` institucionales. | Incorporar generación binaria pesada en servidor de archivos XLSX y PDFs con `pdfkit`/`exceljs`. | La Opción A aprovecha el motor de impresión del navegador, evita sobrecargar de dependencias y memoria el servidor NestJS en Neon, y cumple el requisito institucional de auditoría. |
| **DEC-08-02** | **Tratamiento de Acuerdos SUSPENDIDOS en Semáforos** | Contabilizar los acuerdos `SUSPENDIDOS` en una categoría neutral independiente, congelando su plazo fatal sin marcarlos como vencidos ni como cumplidos. | Tratar los acuerdos suspendidos dentro del grupo de pendientes activos. | La Opción A refleja con precisión el estado jurídico del acuerdo (detenido por causa justificada y aprobada en sesión). |
| **DEC-08-03** | **Estrategia de Agregación: Consultas Directas vs Tablas Materializadas** | Ejecutar agregaciones optimizadas SQL mediante `GROUP BY` y agregaciones nativas de Prisma en tiempo real con índices compuestos en PostgreSQL. | Crear tablas resumen o vistas materializadas con refresco periódico programado vía cron. | Con la volumetría esperada de MexAgenda (< 100,000 registros), las consultas directas indexadas responden en < 80 ms y garantizan datos 100% en tiempo real sin latencias de sincronización. |
| **DEC-08-04** | **Alcance del Buscador Facetado** | Incluir en esta fase filtros facetados por fecha, categoría, estado y titular en los tableros de reportes. Dejar la indexación全文 con PostgreSQL `tsvector`/`GIN` para el buscador global del sistema en Fase 9. | Implementar indexación completa `tsvector` en PostgreSQL y diccionario en español en esta misma fase. | Permite focalizar la Fase 8 estrictamente en la analítica y reportes de control, garantizando robustez y cumplimiento de plazos. |

---

## 4. CATÁLOGO EXHAUSTIVO DE MÉTRICAS INSTITUCIONALES

A continuación se presenta la matriz formal de indicadores institucionales para MOD-07:

| Indicador | Pregunta que responde | Fuente | Fórmula | Fecha y zona horaria aplicables | Filtros | Exclusiones | Rol y alcance de visibilidad |
|---|---|---|---|---|---|---|---|
| **IND-01: Tasa de Cumplimiento Global de Acuerdos** | ¿Qué porcentaje de los compromisos institucionales se han cumplido satisfactoriamente? | `agreements` | $$\frac{\text{Cumplidos} + \text{Completados}}{\text{Total Acuerdos Válidos}} \times 100$$ | `dueDate`, `completionDate` en `America/Mexico_City` | Rango de fechas de aprobación (`approvalDate`), categoría opcional | `deletedAt IS NOT NULL`, `isArchived = true`, `status = 'CANCELADO'` | `ROLE_ADMIN`: Global institucional. `ROLE_USER`: Solo acuerdos asignados o coadyuvantes. |
| **IND-02: Índice de Efectividad Temporal (Cumplimiento en Plazo)** | ¿Qué porcentaje de los acuerdos cumplidos se solventaron antes o en la fecha límite establecida? | `agreements` | $$\frac{\text{Cumplidos con } completionDate \le dueDate}{\text{Total Cumplidos}} \times 100$$ | Fechas civiles en `America/Mexico_City` | Rango por fecha de cumplimiento (`completionDate`) | Acuerdos no cumplidos, cancelados o con `deletedAt IS NOT NULL` | `ROLE_ADMIN`: Global institucional. `ROLE_USER`: Circunscripción personal. |
| **IND-03: Cartera de Acuerdos Vencidos** | ¿Cuántos acuerdos institucionales tienen la fecha límite rebasada y qué porcentaje representan? | `agreements` | $$\text{Count}(a) \text{ donde } a.status \in \{\text{'PENDIENTE'}, \text{'EN\_PROCESO'}\} \land a.dueDate < \text{Hoy}$$ | Fecha civil límite `dueDate` < `Hoy (CDMX)` | Acuerdos activos sin resolución | `status \in \{'CUMPLIDO', 'COMPLETADO', 'CANCELADO', 'SUSPENDIDO'\}`, eliminados | `ROLE_ADMIN`: Global institucional. `ROLE_USER`: Sus acuerdos asignados. |
| **IND-04: Semáforo Preventivo de Vencimiento (7, 15, 30 días)** | ¿Cuántos compromisos vigentes están en riesgo inminente de vencer en las próximas semanas? | `agreements` | **Rojo:** $0 \le (dueDate - Hoy) \le 7\text{ días}$.<br>**Amarillo:** $8 \le (dueDate - Hoy) \le 15\text{ días}$.<br>**Verde:** $> 15\text{ días}$. | Fecha civil `dueDate` referenciada a `Hoy (CDMX)` | Estatus `PENDIENTE` o `EN_PROCESO` | Cumplidos, cancelados, suspendidos o eliminados | `ROLE_ADMIN`: Global. `ROLE_USER`: Personales. |
| **IND-05: Carga Operativa por Titular Responsable** | ¿Cómo se distribuyen los acuerdos activos y el rezago entre los integrantes del colegiado? | `agreements`, `users` | Por cada usuario: $\text{Total}$, $\text{Cumplidos}$, $\text{En Proceso}$, $\text{Vencidos}$, $\%$ Cumplimiento | Fecha de corte actual (`America/Mexico_City`) | Usuarios institucionales activos | `deletedAt IS NOT NULL`, `agreements.deletedAt IS NOT NULL` | `ROLE_ADMIN`: Directorio institucional completo. `ROLE_USER`: Deshabilitado (previene inferencias). |
| **IND-06: Tiempo Promedio de Resolución de Compromisos** | ¿Cuántos días tarda en promedio la institución en solventar un acuerdo colegiado? | `agreements` | $$\frac{1}{N} \sum_{i=1}^N (completionDate_i - approvalDate_i)$$ | Fechas civiles en `America/Mexico_City` | Acuerdos con estatus `CUMPLIDO` | Acuerdos cancelados, pendientes o con fechas inválidas | `ROLE_ADMIN`: Global. `ROLE_USER`: Personales. |
| **IND-07: Tasa de Efectividad del Calendario de Sesiones** | ¿Qué proporción de las sesiones programadas se celebraron exitosamente vs canceladas? | `meetings` | $$\frac{\text{Finalizadas} + \text{Archivadas}}{\text{Total Convocadas}} \times 100$$ | `meetingDate` en `America/Mexico_City` | Periodo mensual o anual seleccionado | `deletedAt IS NOT NULL`, `status = 'BORRADOR'` | `ROLE_ADMIN`: Global institucional. `ROLE_USER`: Global institucional (datos públicos). |
| **IND-08: Quórum Promedio de Asistencia a Sesiones** | ¿Cuál es el promedio porcentual de participación de los integrantes en las sesiones convocadas? | `meeting_participants`, `meetings` | $$\frac{\sum \text{Asistieron}}{\sum \text{Convocados}} \times 100$$ Asistencia = `ASISTIO`, `PRESENTE`, `TARDANZA`, `PARTICIPACION_REMOTA` | `meetingDate` de la sesión en `America/Mexico_City` | Sesiones con estatus `FINALIZADA` o `ARCHIVADA` | Sesiones canceladas o borradores | `ROLE_ADMIN`: Global institucional. `ROLE_USER`: Su propio récord de asistencia. |
| **IND-09: Tasa de Retardos e Inasistencias Justificadas** | ¿Qué proporción de las ausencias fueron justificadas oportunamente vs faltas injustificadas? | `meeting_participants` | $$\frac{\text{Justificadas}}{\text{Total Inasistencias}} \times 100$$ | `meetingDate` en `America/Mexico_City` | Participantes convocados no presentes | Asistencias efectivas | `ROLE_ADMIN`: Global institucional. `ROLE_USER`: Personal. |
| **IND-10: Tiempo Medio de Aprobación de Actas (Formalización)** | ¿Cuántos días transcurren desde la celebración de la sesión hasta la aprobación formal de su acta? | `meeting_minutes`, `meetings` | $$\frac{1}{M} \sum_{j=1}^M (\text{Date}(approvedAt_j) - meetingDate_j)$$ | Fechas en `America/Mexico_City` | Actas con `status = 'APROBADA'` | Actas en estado `BORRADOR` | `ROLE_ADMIN`: Global institucional. `ROLE_USER`: Global (metadatos de actas públicas). |
| **IND-11: Distribución Temática por Categoría Colegiada** | ¿Qué proporción de sesiones y acuerdos corresponden a cada órgano o comisión? | `meeting_categories`, `meetings`, `agreements` | Por categoría: $\text{Count}(meetings)$ y $\text{Count}(agreements)$ | `meetingDate`, `approvalDate` | Categorías activas (`isActive = true`) | Registros eliminados lógicamente | `ROLE_ADMIN`: Global. `ROLE_USER`: Global. |
| **IND-12: Métricas de Actividad Personal del Consejero** | ¿Cuál es la actividad deliberativa personal del integrante institucional autenticado? | `personal_notes`, `agreement_collaborators` | $\text{Count}(notes)$ en la última semana; $\text{Count}(agreements)$ como colaborador | `createdAt` de notas en `America/Mexico_City` | Autoría propia (`authorId = session.userId`) | Notas eliminadas (`deletedAt IS NOT NULL`) | `ROLE_USER` exclusivamente sobre sus propios registros. `ROLE_ADMIN` no lee notas privadas ajenas. |

---

### 4.1 Reglas Explícitas para Casos Borde
1. **Denominador Cero (Ausencia de Datos):** Si para un periodo o filtro no existen acuerdos o reuniones (denominador = 0), la fórmula devolverá formalmente `0%` (o valor nulo con indicador `N/A`), previniendo excepciones de división por cero en el backend o `NaN` en la interfaz.
2. **Resultados Vacíos:** Cuando un usuario no tenga compromisos asignados, la API responderá con un arreglo vacío `[]` y contadores en `0`, activando componentes visuales de "Estado Vacío" (*Empty State*) informativos y cordiales.
3. **Manejo de Prórrogas de Acuerdos:** Cuando a un acuerdo se le actualice la fecha límite mediante un cambio registrado en `agreement_history`, la métrica de corte actual evaluará contra la fecha vigente (`agreements.dueDate`). Para la métrica histórica de efectividad original, se evaluará contra la primera fecha límite pactada en el acta de origen.

---

### 4.2 Ejemplos Numéricos con Datos Sintéticos Paso a Paso

#### Ejemplo 1: Tasa de Cumplimiento Global (IND-01) y Cartera Vencida (IND-03)
- **Conjunto de Datos de Entrada:**
  - Acuerdo A-1: `status = CUMPLIDO`, `dueDate = 2026-11-01`, `completionDate = 2026-10-28`.
  - Acuerdo A-2: `status = CUMPLIDO`, `dueDate = 2026-11-05`, `completionDate = 2026-11-08` (Cumplido con rezago).
  - Acuerdo A-3: `status = PENDIENTE`, `dueDate = 2026-11-02` (Estatus efectivo: `VENCIDO` pues Hoy = 2026-11-09).
  - Acuerdo A-4: `status = EN_PROCESO`, `dueDate = 2026-11-20` (Activo, en plazo).
  - Acuerdo A-5: `status = CANCELADO`, `dueDate = 2026-11-01` (Excluido de la tasa).
- **Cálculo Paso a Paso:**
  - Total Acuerdos Válidos: $5 - 1\text{ (Cancelado)} = 4$.
  - Cumplidos: $2$ (A-1 y A-2).
  - Vencidos: $1$ (A-3).
  - En Proceso en plazo: $1$ (A-4).
- **Resultados:**
  - **Tasa de Cumplimiento Global:** $\frac{2}{4} \times 100 = \mathbf{50.0\%}$.
  - **Índice de Efectividad en Plazo (IND-02):** $\frac{1 \text{ (A-1)}}{2 \text{ (Cumplidos)}} \times 100 = \mathbf{50.0\%}$.
  - **Cartera Vencida:** $1 \text{ acuerdo } (\mathbf{25.0\%})$.

#### Ejemplo 2: Prevención de Duplicación por Colaboradores Múltiples
- **Conjunto de Datos de Entrada:**
  - Acuerdo B-1: Asignado a Titular $U_1$. Colaboradores registrados: $U_2$, $U_3$.
  - Acuerdo B-2: Asignado a Titular $U_2$. Sin colaboradores.
- **Cálculo Paso a Paso:**
  - Si se realizara un `COUNT(*)` sobre la relación con colaboradores, B-1 contaría 3 veces y B-2 contaría 1 vez, arrojando falsamente 4 acuerdos institucionales.
  - Aplicando la regla de MexAgenda:
    - **Total Acuerdos Institucionales:** $\text{COUNT(DISTINCT a.id)} = \mathbf{2}$.
    - **Carga de $U_1$:** 1 como Titular, 0 como Colaborador.
    - **Carga de $U_2$:** 1 como Titular, 1 como Colaborador.
    - **Carga de $U_3$:** 0 como Titular, 1 como Colaborador.
- **Resultado:** Integridad matemática preservada, sin inflación artificial de acuerdos.

#### Ejemplo 3: Cálculo de Quórum de Asistencia (IND-08)
- **Conjunto de Datos de Entrada:**
  - Sesión S-10: 10 integrantes convocados (`CONVOCADO`).
  - Al concluir la sesión: 7 con `PRESENTE`, 1 con `TARDANZA`, 1 con `JUSTIFICADO`, 1 con `FALTA_INJUSTIFICADA`.
- **Cálculo:**
  - Integrantes que participaron efectivamente: $7 + 1 = 8$.
  - Convocados totales: $10$.
- **Resultado:**
  - **Quórum de Asistencia Institucional:** $\frac{8}{10} \times 100 = \mathbf{80.0\%}$.
  - **Tasa de Inasistencia:** $20.0\%$ (desglosada en $10.0\%$ justificada y $10.0\%$ injustificada).

---

## 5. PERMISOS, PRIVACIDAD Y BLINDAJE INSTITUCIONAL

### 5.1 Matriz de Acceso por Rol (RBAC / ABAC)

| Módulo / Funcionalidad de Reporte | Permiso Granular Backend | `ROLE_ADMIN` | `ROLE_USER` (Consejero) | Regla de Alcance y Aislamiento en Backend |
|---|---|:---:|:---:|---|
| **Consola Ejecutiva General** | `report:view:executive` | **[✔] Permitido** | **[✖] Prohibido (403)** | Visualización 360° de toda la institución. |
| **Tablero Operativo de Acuerdos** | `report:view:operational` | **[✔] Permitido** | **[✔] Permitido (Acotado)** | `ROLE_USER` solo visualiza sus propios acuerdos asignados y en los que colabora. |
| **Reporte de Sesiones y Quórum** | `meeting:read` | **[✔] Permitido** | **[✔] Permitido (Público)** | Datos agregados de sesiones finalizadas y actas públicas. Sin datos privados. |
| **Desglose de Carga por Usuario** | `report:view:executive` | **[✔] Permitido** | **[✖] Prohibido (403)** | Previene que un integrante supervise la carga laboral de otros integrantes sin facultad de mando. |
| **Exportación de Datos (CSV/Impresión)** | `report:export` | **[✔] Permitido** | **[✔] Permitido (Acotado)** | La exportación generada en backend aplica los mismos filtros de alcance del usuario autenticado. |

---

### 5.2 Blindaje de Confidencialidad y Prevención de Fugas de Información

1. **Aislamiento Previo a la Agregación en el Backend (NestJS):**
   - El filtrado de permisos y ámbito de posesión se aplica **en la consulta a la base de datos** (`WHERE assignedToId = user.id OR ...`).
   - El backend JAMÁS devuelve un conjunto de datos consolidado para que el frontend lo oculte condicionalmente.
2. **Exclusión Absoluta de Contenido de Notas Privadas:**
   - La regla ABAC de soberanía de autoría (`MOD-04` y `MOD-05`) establece que el texto y anexos de las notas privadas solo pueden ser leídos por su autor.
   - En MOD-07, **NINGÚN reporte institucional incluirá el contenido, ni los títulos, ni los tags de notas privadas**.
   - La única interacción con `personal_notes` en los tableros es una métrica volumétrica personal para el propio autor en su consola privada ("Mis notas creadas esta semana: N").
3. **Prevención de Ataques de Inferencia Estadística (*Inference Leaks*):**
   - Si en un reporte administrativo se mostrara un desglose con grupos de un solo individuo (por ejemplo, "Reuniones con notas privadas clasificadas como URGENTES por el Usuario X"), se podría inferir la deliberación secreta de ese consejero.
   - Para prevenir esto, los reportes institucionales colectivos quedan totalmente desvinculados de la tabla `personal_notes`.
4. **Seguridad y Trazabilidad en Exportaciones:**
   - Las exportaciones aplicarán un límite superior de filas (máximo 5,000 registros por descarga) para evitar saturación de memoria (*Denial of Service*).
   - Toda solicitud de exportación será interceptada por `AuditInterceptor` y registrada en `audit_logs` con la acción `REPORT_EXPORTED`, los parámetros de filtro aplicados y el ID del actor solicitante.

---

## 6. DISEÑO TÉCNICO DE IMPLEMENTACIÓN

### 6.1 Arquitectura de Backend (NestJS 11)

Se propone la creación de un nuevo módulo especializado `ReportsModule` en `apps/backend/src/modules/reports/`:

```
apps/backend/src/modules/reports/
├── dto/
│   ├── executive-summary.dto.ts      # DTO de respuesta para consola ejecutiva
│   ├── agreements-metrics.dto.ts     # DTO de respuesta para métricas de acuerdos
│   ├── meetings-metrics.dto.ts       # DTO de métricas de sesiones y quórum
│   ├── query-reports.dto.ts          # DTO de parámetros de consulta y filtros
│   └── export-report.dto.ts          # DTO de opciones de exportación
├── reports.controller.ts             # Controlador REST con guardias RBAC/ABAC
├── reports.service.ts                # Servicio de lógica de agregación y análisis
└── reports.module.ts                 # Declaración de dependencias y proveedores
```

#### Endpoints REST Propuestos:

1. `GET /api/v1/reports/executive-summary`
   - **Propósito:** KPIs globales y semáforo general para la dirección institucional.
   - **Guardias:** `@UseGuards(SessionAuthGuard, PermissionsGuard)`
   - **Permiso:** `@RequirePermissions('report:view:executive')`
   - **Respuesta:** Objeto `ExecutiveSummaryDto` con totales de acuerdos, tasa de cumplimiento, reuniones del periodo y compromisos vencidos.

2. `GET /api/v1/reports/agreements/metrics`
   - **Propósito:** Analítica detallada de acuerdos con soporte de filtros multicriterio.
   - **Parámetros:** `from`, `to`, `categoryId`, `assignedToId`, `status`, `priority`.
   - **Permiso:** `@RequirePermissions('report:view:operational')` (con control de ámbito por rol en servicio).
   - **Respuesta:** Objeto `AgreementMetricsDto` con semáforo preventivo (7, 15, 30 días), efectividad temporal, promedio de días de resolución y desglose por categoría.

3. `GET /api/v1/reports/meetings/metrics`
   - **Propósito:** Métricas de gobernanza, quórum y tiempos de formalización de actas.
   - **Parámetros:** `from`, `to`, `categoryId`.
   - **Permiso:** `@RequirePermissions('meeting:read')`
   - **Respuesta:** Objeto `MeetingMetricsDto` con tasa de asistencia institucional, distribución por modalidad y tiempo medio de aprobación de actas.

4. `GET /api/v1/reports/user-dashboard`
   - **Propósito:** Métricas operativas de la consola privada del usuario conectado.
   - **Permiso:** Autenticación activa requerida.
   - **Respuesta:** Acuerdos asignados propios, acuerdos en colaboración, próximas sesiones convocadas y conteo de notas propias.

5. `GET /api/v1/reports/export`
   - **Propósito:** Generación de reporte descargable en formato CSV con cabeceras institucionales.
   - **Parámetros:** `type` (`agreements` | `meetings`), filtros de fecha y categoría.
   - **Permiso:** `@RequirePermissions('report:export')`

---

### 6.2 Estrategia de Capa de Datos (Prisma y Neon PostgreSQL)

1. **Agregaciones Nativas vs Carga en Memoria:**
   - En el código legado de `agreements.service.ts` (`getDashboardMetrics`), se realizaba un `findMany` completo de todos los acuerdos hacia la memoria de Node.js y un bucle `for...of`.
   - **Mejora Arquitectónica en Fase 8:** El nuevo `ReportsService` utilizará agregaciones optimizadas de base de datos (`prisma.agreement.groupBy`, `prisma.agreement.count`, `_avg`, `_sum`), delegando el cálculo de totales al motor relacional de PostgreSQL.
2. **Propuesta de Índices Compuestos (Migración Justificada):**
   - Para garantizar que las consultas de agregación por fecha y estatus no degraden la base de datos a gran escala:
     ```sql
     -- Índice compuesto para métricas de acuerdos por estatus y vencimiento
     CREATE INDEX IF NOT EXISTS idx_agreements_status_duedate 
     ON agreements(status, due_date) 
     WHERE deleted_at IS NULL;

     -- Índice compuesto para métricas de sesiones por fecha y estatus
     CREATE INDEX IF NOT EXISTS idx_meetings_status_date 
     ON meetings(status, meeting_date) 
     WHERE deleted_at IS NULL;
     ```

---

### 6.3 Diseño de Frontend (Next.js 15 y React)

1. **Rutas y Estructura:**
   - Consolidar las vistas de reportes en:
     - `apps/frontend/src/app/(dashboard)/reports/page.tsx` (Centro de Analítica y Tableros Institucionales).
     - Conservar retrocompatibilidad de rutas en `agreements/dashboard` y `agreements/reports` redirigiendo fluidamente a la nueva consola unificada.
2. **Componentes Visuales Institucionales:**
   - `KpiCard`: Tarjeta ejecutiva con valor numérico, variación porcentual, icono y semáforo visual (Esmeralda, Ámbar, Rojo).
   - `StatusDonutChart` / `ProgressBar`: Gráficos semánticos en CSS/SVG nativo accesibles (sin bibliotecas externas pesadas).
   - `DateRangeFilter`: Selector de periodos rápidos (Mes Actual, Trimestre Actual, Año en Curso, Periodo Personalizado).
   - `PrintReportView`: Estilos `@media print` para generar informes oficiales con membrete institucional, fecha y sello de agua directamente en PDF mediante el diálogo de impresión del sistema operativo.
3. **Gestión de Estados:**
   - *Cargando:* Componentes esqueleto (*Skeleton loaders*) que preservan la jerarquía visual mientras se resuelven las consultas en Neon.
   - *Error:* Mensajes de error claros con botón de reintento manual (`RefreshCw`).
   - *Sin Datos:* Mensajes ilustrativos con sugerencias de ajuste de filtros.

---

## 7. CRITERIOS DE ACEPTACIÓN Y PLAN DE PRUEBAS

### 7.1 Criterios de Aceptación Funcional y Técnica
- **CA-01 (Exactitud Matemática):** Los totales, porcentajes y promedios calculados por la API coinciden exactamente con los registros en base de datos. La suma de las partes desglosadas por categoría es idéntica al total institucional reportado.
- **CA-02 (Aislamiento de Privacidad):** Un usuario con rol `ROLE_USER` no puede consultar endpoints restringidos a `ROLE_ADMIN` (`HTTP 403 Forbidden`). En reportes operacionales, el usuario solo recibe datos de compromisos que le conciernen formalmente.
- **CA-03 (Exclusión de Borrados y Cancelados):** Ningún registro con `deletedAt IS NOT NULL` afecta los conteos ni métricas. Los acuerdos cancelados no forman parte del denominador de cumplimiento global.
- **CA-04 (Anti-Duplicación de Colaboradores):** En los reportes institucionales, los acuerdos con múltiples colaboradores se contabilizan exactamente una sola vez.
- **CA-05 (Robustez ante Denominador Cero):** Filtros sobre rangos de fecha sin actividad retornan contadores en 0 y porcentajes en 0% sin arrojar errores `NaN` ni fallos 500 en la API.
- **CA-06 (Rendimiento en Servidor):** La respuesta de los endpoints de tablero ejecutivo no supera los 150 ms en condiciones de red estándar en Neon PostgreSQL.
- **CA-07 (Regresión Histórica):** El 100% de las 333 pruebas de fases anteriores (Fases 2 a 7) continúa aprobándose sin alteraciones.
- **CA-08 (Compilación Monorepo):** `pnpm build` compila con 0 errores de tipado o de empaquetado en todos los workspaces.

---

### 7.2 Plan de Pruebas Automatizadas Propuesto para Fase 8
Se creará la suite `scripts/test-phase8.js` estructurada en los siguientes bloques de verificación:
1. **Bloque 1: Integridad del Catálogo de Permisos RBAC:**
   - Verificación de los permisos `report:view:executive`, `report:view:operational` y `report:export`.
2. **Bloque 2: Cálculo Matemático y Semáforos con Ground Truth:**
   - Creación de un conjunto de datos controlado en Neon (acuerdos cumplidos a tiempo, cumplidos tarde, vencidos, en proceso y cancelados).
   - Verificación estricta de las fórmulas contra los valores esperados.
3. **Bloque 3: Aislamiento por Rol y Prevención IDOR/BOLA:**
   - Solicitud de `ROLE_USER` a `/reports/executive-summary` -> Espera `403 Forbidden`.
   - Consulta de `/reports/user-dashboard` -> Verifica que solo devuelva datos asignados al token de sesión.
4. **Bloque 4: Validación de No-Duplicación por Colaboradores:**
   - Creación de un acuerdo con 3 colaboradores coadyuvantes. Verificación de que el total global incremente en 1 y no en 4.
5. **Bloque 5: Casos Borde y Denominador Vacío:**
   - Consulta sobre rango temporal en el año 2040. Espera `total: 0, porcentaje: 0`.
6. **Bloque 6: Exportación de Reportes:**
   - Descarga de exportación CSV con verificación de cabeceras, formato RFC 4180 y contenido sanitizado.
7. **Bloque 7: Limpieza Atómica:**
   - Eliminación estricta de todos los registros sintéticos de prueba generados en Neon.

---

## 8. REGISTRO DE OBSERVACIONES Y CONDICIONES DE PRODUCCIÓN

En cumplimiento de las directrices institucionales, se mantiene el seguimiento de las observaciones técnicas abiertas identificadas en fases precedentes:

| Código | Descripción y Estado Actual | Dependencia / Impacto sobre Fase 8 | Mitigación / Estrategia |
|---|---|---|---|
| **OBS-07-01** | Concurrencia distribuida y colas Redis/BullMQ (actualmente implementado con patrón Outbox transaccional en Neon). | **Ninguno.** La Fase 8 opera en lectura y agregación analítica de datos ya consolidados en PostgreSQL. No depende del despacho de correos en tiempo real. | Se mantendrá en el registro de pase a producción final (Fase 9). |
| **OBS-07-02** | Política avanzada de reintentos y recuperación de fallos transitorios en worker de correo. | **Ninguno.** Los reportes no emiten correos electrónicos masivos. | Registrado para hardening final en Fase 9. |
| **OBS-07-03** | Conexión con servidor SMTP institucional real (actualmente opera con Transporter Mock verificado en auditoría). | **Ninguno.** La generación y consulta de reportes se realiza vía HTTP en frontend y backend. | Dependiente de aprovisionamiento de infraestructura de red institucional. |
| **OBS-06-01** | Bóveda documental S3 real de AWS (actualmente con adaptador S3 y metadatos en Neon). | **Bajo.** Los reportes de almacenamiento consultan únicamente metadatos de tamaño en bytes y cantidad de archivos en `attachments`. | Totalmente compatible con la persistencia relacional existente. |
| **OBS-06-02** | Demonio ClamAV en contenedor para escaneo antivirus de archivos. | **Ninguno.** Las métricas reflejan el campo `scanStatus` existente en Neon. | Hardening de infraestructura para despliegue final. |

---

## 9. ORDEN DE IMPLEMENTACIÓN PROPUESTA Y PLAN DE TRABAJO

Una vez que la Coordinación General del Proyecto evalúe y apruebe este plan y las decisiones de alcance (**DEC-08-01 a DEC-08-04**), se procederá con la ejecución técnica en el siguiente orden secuencial estricto:

```
[FASE 8: RUTA CRÍTICA DE EJECUCIÓN TÉCNICA]
  │
  ├─ Paso 1: Configuración de Permisos RBAC y Contratos Compartidos
  │          • Adición de permisos en packages/shared y script de inicialización.
  │          • Creación de DTOs e interfaces de contratos en @mexagenda/shared.
  │
  ├─ Paso 2: Creación del Módulo Backend ReportsModule (NestJS)
  │          • Implementación de ReportsService con agregaciones optimizadas.
  │          • Creación de endpoints en ReportsController con guardias RBAC/ABAC.
  │          • Endpoint de exportación tabular segura.
  │
  ├─ Paso 3: Optimización de Persistencia e Índices en Neon PostgreSQL
  │          • Incorporación de índices compuestos para meetings y agreements.
  │
  ├─ Paso 4: Implementación de la Interfaz de Usuario (Next.js 15)
  │          • Creación de apps/frontend/src/app/(dashboard)/reports/page.tsx.
  │          • Tarjetas KPI, semáforos, gráficos accesibles y filtros de periodo.
  │          • Estilos institucionales de impresión (@media print).
  │          • Enlace y acceso en la navegación principal (header-nav.tsx).
  │
  ├─ Paso 5: Suite de Pruebas Automatizadas y Verificación de Regresión
  │          • Creación y ejecución de scripts/test-phase8.js.
  │          • Verificación de 333 pruebas de regresión histórica.
  │          • Verificación de pnpm build exitoso en monorepo.
  │
  └─ Paso 6: Documentación Formal y Entrega para Auditoría Independiente
             • Generación del informe de implementación en docs/phase-8/.
```

---

## 10. ESTADO FINAL DE LA ETAPA

Conforme a las instrucciones del Mandato Maestro de Fase 8, la célula técnica concluye la inspección diagnóstica y la formulación del plan técnico, deteniendo cualquier acción de codificación, migración o despliegue a la espera de la autorización formal de la Coordinación.

**ESTADO ACTUAL:**  
**PLAN TÉCNICO DE FASE 8 LISTO PARA REVISIÓN**


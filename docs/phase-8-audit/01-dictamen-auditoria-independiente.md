# DICTAMEN DE AUDITORÍA TÉCNICA INDEPENDIENTE — FASE 8
## MEXAGENDA — SISTEMA PRIVADO DE GESTIÓN INSTITUCIONAL
### MOD-07: REPORTES INSTITUCIONALES, MÉTRICAS EJECUTIVAS Y TABLEROS DE CONTROL

**Fecha de Auditoría:** 09 de Noviembre de 2026  
**Carácter de la Revisión:** Auditoría Técnica Independiente — **REVISIÓN PRELIMINAR (ÁRBOL DE TRABAJO LOCAL)**  
**Auditor Responsable:** Auditoría Técnica y de Aseguramiento de Calidad de Software Independiente  
**Estado:** **APROBADO EN LO TÉCNICO (PRELIMINAR)** — Pendiente de consolidación reproducible en Git para certificación de cierre definitivo.

---

## 1. IDENTIFICACIÓN DE LA ENTREGA Y LÍMITES DE AUDITORÍA

En cumplimiento del mandato de auditoría independiente, se procedió a la inspección forense del repositorio Git para identificar la referencia exacta de la entrega:

- **Rama Activa:** `master`
- **Último Commit en Historial Git:** `9d2cf017b36c75f3f07d1769f736550c7c466a69` (*"feat(phase-7): consolidacion de Fase 7 y resolucion de hallazgos post-auditoria FIND-07-01 y FIND-07-02"*, Mon Nov 9 18:15:20 2026 -0500).
- **Tag Base:** `v0.7.1-phase7-fixes`
- **Estado del Árbol de Trabajo (`git status -s`):**
  ```
   M apps/backend/src/app.module.ts
   M apps/frontend/src/app/header-nav.tsx
   M packages/shared/src/contracts/index.ts
   M scripts/bootstrap-admin.js
  ?? apps/backend/src/modules/reports/
  ?? apps/frontend/src/app/(dashboard)/reports/
  ?? docs/phase-8/
  ?? scripts/test-phase8.js
  ```

### Declaración de Carácter Preliminar:
> [!IMPORTANT]
> Los artefactos de código, interfaces compartidas, controladores, vistas frontend, pruebas automatizadas y documentación de la Fase 8 residen actualmente como **cambios locales sin consolidar en el árbol de trabajo** sobre el commit base `9d2cf017b36c75f3f07d1769f736550c7c466a69`.
> 
> En estricto apego a las directrices de auditoría independiente, esta revisión se emite con carácter **PRELIMINAR**. Para que la Coordinación General declare el cierre formal y definitivo de la Fase 8, el equipo implementador deberá consolidar estos cambios en un commit limpio y reproducible en Git.

---

## 2. VERIFICACIÓN DE LAS CUATRO VISTAS (API E INTERFAZ)

Se auditó de manera integral la implementación de las cuatro vistas requeridas tanto en los servicios y controladores de backend (`apps/backend/src/modules/reports/`) como en el cliente web Next.js (`apps/frontend/src/app/(dashboard)/reports/page.tsx`):

### 2.1 Vista 1: Tablero Ejecutivo Directivo (`/reports/executive`)
- **Control de Acceso y RBAC:** Protegido con el permiso institucional `report:view:executive`. Se comprobó que usuarios con rol ordinario (`ROLE_USER`) son estrictamente rechazados con código HTTP `403 Forbidden`.
- **Métricas e Indicadores Clave:**
  - Tasa Global de Cumplimiento de Acuerdos: Computa con precisión la razón de acuerdos cumplidos frente a acuerdos activos válidos.
  - Efectividad de Calendario: Evalúa sesiones celebradas sobre sesiones totales convocadas terminadas (celebradas + canceladas).
  - Tasa de Asistencia Promedio: Agrega la asistencia porcentual real de los órganos colegiados en sesiones concluidas.
  - Alertas de Acuerdos Vencidos: Lista ejecutiva con folio, título, titular y días de rezago, ordenada descendentemente.
  - Distribución por Categoría: Barras porcentuales y conteos absolutos vinculados al catálogo institucional de categorías (`MeetingCategory`).

### 2.2 Vista 2: Seguimiento de Acuerdos (`/reports/agreements`)
- **Aislamiento por Rol y Titularidad:** Para `ROLE_ADMIN`, permite consultar todos los acuerdos institucionales y filtrar por `assignedToId`; para `ROLE_USER`, acota automáticamente a acuerdos donde el usuario es titular o colaborador (`collaborators.some.userId == user.id`).
- **Resumen de Estados:** Desglose exacto de Pendientes, En Proceso, Cumplidos, Vencidos, Suspendidos y Cancelados.
- **Desglose Multidimensional:** Agrupaciones automáticas por Prioridad (`ALTA`, `MEDIA`, `BAJA`) y Tipo (`INFORMATIVO`, `ACCIONABLE`, etc.).
- **Gobernanza de Carga de Trabajo (`distribucionResponsables`):** Visible única y exclusivamente para `ROLE_ADMIN`. Para usuarios ordinarios, el arreglo se devuelve vacío, previniendo fuga de información sobre la asignación de recursos humanos.
- **Detalle Operativo Paginado:** Lista de acuerdos con cálculo dinámico de `effectiveStatus` y `daysRemaining`.

### 2.3 Vista 3: Gobernanza de Sesiones y Órganos Colegiados (`/reports/sessions`)
- **Evaluación de Convocatorias:** Conteo de sesiones convocadas, celebradas, canceladas y programadas.
- **Regla Reglamentaria de Quórum Legal:** Evalúa la mayoría simple estricta de integrantes convocados presentes ($\text{presentes} > \frac{\text{convocados}}{2}$).
- **Ciclo de Formalización de Actas:** Calcula el tiempo medio en días transcurrido entre la fecha de sesión y la aprobación definitiva de su acta oficial (`MeetingMinutes.approvedAt`).
- **Desglose por Modalidad:** Clasificación de sesiones en Presencial, Virtual e Híbrida.

### 2.4 Vista 4: Consola Personal para Servidores Públicos (`/reports/personal`)
- **Compromisos Directos como Titular:** Resumen personal de compromisos, pendientes, en proceso, cumplidos, vencidos y tasa de cumplimiento individual.
- **Compromisos en Coadyuvancia:** Sección independiente para acuerdos donde participa como colaborador, evitando doble conteo en las métricas institucionales globales.
- **Próximas Sesiones Convocadas:** Listado cronológico de las sesiones agendadas para el servidor público autenticado.
- **Historial de Asistencia Personal:** Ratio de asistencias efectivas sobre sesiones convocadas pasadas.
- **Anotaciones Personales (Privacidad Absoluta):** Conteo volumétrico de notas activas (`authorId: user.id`), acompañado de aviso institucional de confidencialidad.

---

## 3. CONTRASTE DE MÉTRICAS CON DATOS DE RESULTADO CONOCIDO (GROUND TRUTH)

Se contrastaron formalmente las fórmulas implementadas frente a datos de prueba de resultado conocido y al marco reglamentario institucional:

### 3.1 Regla de Quórum Legal y Respaldo Institucional
- **Fórmula Implementada en Código:**
  ```typescript
  const tieneQuorum = numParticipants > 0 && presentes > numParticipants / 2;
  ```
- **Fundamento Institucional:**
  En el régimen jurídico y administrativo mexicano aplicable a cuerpos colegiados, comités y consejos institucionales, el quórum de instalación y deliberación ordinario se constituye por la **mayoría simple de los miembros convocados (la mitad más uno)**.
- **Comprobación de Casos de Frontera (Edge Cases):**
  - **Caso Par (4 convocados):** Si asisten 2, $2 > 4/2$ es falso $\rightarrow$ **NO HAY QUÓRUM**. Se requieren al menos 3 integrantes presentes para alcanzar la mayoría simple.
  - **Caso Impar (5 convocados):** Si asisten 3, $3 > 2.5$ es verdadero $\rightarrow$ **HAY QUÓRUM**.
  - **Caso Cero Convocados:** $numParticipants = 0 \rightarrow$ Falso, no se computa en el denominador de quórum.
  - **Tasa de Cumplimiento de Quórum:** Se calcula sobre el universo de sesiones celebradas con integrantes convocados:
    $$\text{tasaCumplimientoQuorum} = \left(\frac{\text{sesionesConQuorum}}{\text{sesionesConQuorum} + \text{sesionesSinQuorum}}\right) \times 100$$
  - **Veredicto:** **CONFORME Y JURÍDICAMENTE SÓLIDO**.

### 3.2 Distinción Estricta entre Acuerdos Vencidos y Próximos a Vencer
- **Partición en Semáforo Preventivo:**
  El semáforo preventivo clasifica los acuerdos de forma disjunta (no solapada) en función de $d = \text{calculateDaysRemaining}(dueDate, today)$:
  - `vencidos`: $d < 0$ o estatus registrado `VENCIDO`.
  - `critico7Dias`: $0 \le d \le 7$ días.
  - `medio15Dias`: $8 \le d \le 15$ días.
  - `lejano30Dias`: $16 \le d \le 30$ días.
  - `enPlazoMas30`: $d > 30$ días.
  - `sinPlazo`: acuerdos sin fecha límite definida.
  - `suspendidos`: acuerdos con estatus formal `SUSPENDIDO`.
- **Alertas de Rezago (`overdueAlerts`):**
  Filtra exclusivamente los acuerdos con estatus efectivo `VENCIDO`, calculando los días de retraso mediante $\text{abs}(d)$ y ordenándolos en forma descendente para atención prioritaria de la Dirección.
- **Veredicto:** **CONFORME Y MATEMÁTICAMENTE EXACTO**.

### 3.3 Tratamiento de Acuerdos Suspendidos (DEC-08-02)
- **Aislamiento en Semáforo:** Los acuerdos suspendidos se excluyen formalmente de las categorías del semáforo preventivo (no incrementan verde, amarillo ni rojo) y se presentan en un indicador independiente (`suspendidos: N`).
- **Exclusión del Denominador de Cumplimiento:**
  $$\text{totalValidos} = \text{total} - \text{cancelados}$$
  $$\text{denominadorActivo} = \text{totalValidos} - \text{suspendidos}$$
  $$\text{tasaCumplimientoGlobal} = \frac{\text{cumplidos}}{\text{denominadorActivo}} \times 100$$
- **Comprobación Ground Truth:** En la suite de prueba con 6 acuerdos (2 cumplidos, 1 vencido, 1 cancelado, 1 suspendido, 1 pendiente en plazo), el denominador activo fue $6 - 1 - 1 = 4$, y la tasa de cumplimiento resultante fue exactamente **50.0%** (2 / 4).
- **Veredicto:** **CONFORME CON DEC-08-02**.

### 3.4 Delimitación Temporal y Límites de Día Institucional
- **Huso Horario Oficial:** Todas las fechas civiles se calculan con el huso horario oficial `America/Mexico_City` a través de `Intl.DateTimeFormat`.
- **Filtros de Período:** Los filtros `from` y `to` se ajustan a `00:00:00.000Z` y `23:59:59.999Z` respectivamente, manteniendo coherencia con el esquema de almacenamiento UTC en Neon PostgreSQL utilizado en los módulos previos.
- **Veredicto:** **CONFORME**.

### 3.5 Resultados sin Datos y Protección contra División por Cero
- Cuando no existen acuerdos o reuniones en el período consultado, los denominadores son cero.
- El backend retorna formalmente `null` en lugar de emitir excepciones, valores `NaN`, `Infinity` o porcentajes ficticios (0% o 100%).
- La interfaz de usuario Next.js interpreta `null` y renderiza la etiqueta clara *"Sin datos"*.
- **Veredicto:** **CONFORME**.

---

## 4. VERIFICACIÓN DE EXPORTACIÓN CSV, SANITIZACIÓN Y PRIVACIDAD

Se auditó el cumplimiento de la decisión **DEC-08-01** y las garantías de privacidad:

### 4.1 Neutralización de Inyección de Fórmulas (CSV Injection)
- **Implementación (`sanitizeCsvField`):**
  Cualquier celda que inicie con los caracteres `=`, `+`, `-`, `@`, tabulador (`\t`) o retorno de carro (`\r`) es prefijada con una comilla simple (`'`). Adicionalmente, las celdas que contienen comas, comillas o saltos de línea se escapan envolviéndose en comillas dobles conforme al estándar RFC 4180.
- **Prueba Forense:** Se inyectó el payload malicioso `=cmd|'/C calc'!A0` en un título de acuerdo. La función lo sanitizó convirtiéndolo en `"'=cmd|'/C calc'!A0"`, neutralizando la ejecución arbitraria en Microsoft Excel, LibreOffice Calc y Google Sheets.
- **Veredicto:** **CONFORME**.

### 4.2 Límite Volumétrico de 5,000 Registros
- El backend ejecuta una consulta previa `prisma.agreement.count` / `prisma.meeting.count`. Si el total supera los 5,000 registros, lanza `BadRequestException` (`400 Bad Request`) impidiendo la sobrecarga del servidor y evitando el truncamiento silencioso de reportes institucionales.
- **Veredicto:** **CONFORME**.

### 4.3 Auditoría Forense de Exportaciones
- El evento `REPORT_EXPORTED` se registra inmutablemente en `audit_logs` con `actorId`, `entity: 'reports'`, `entityId` (`agreements` o `meetings`) y metadatos en `diffPayload` (`rowCount`, `filters`, `format: 'CSV'`).
- **Verificación Forense:** Se confirmó en Neon PostgreSQL que **no se guardan las filas ni los contenidos exportados** dentro de la bitácora, evitando el crecimiento desmedido de la base de datos y la fuga de información sensible.
- **Veredicto:** **CONFORME**.

### 4.4 Aislamiento Estricto de Notas Personales (MOD-04)
- La Consola Personal consulta exclusivamente:
  ```typescript
  this.prisma.personalNote.count({
    where: { authorId: user.id, deletedAt: null }
  });
  ```
- **Blindaje Comprobado:** Ningún endpoint institucional expone títulos, cuerpos de notas, marcas de tiempo ni conteos de otros usuarios. El aviso institucional de privacidad es desplegado permanentemente en la interfaz.
- **Veredicto:** **CONFORME**.

---

## 5. RESULTADOS DE EJECUCIÓN DE PRUEBAS Y COMPILACIÓN

El auditor ejecutó en el entorno de pruebas local enlazado a Neon PostgreSQL la suite de Fase 8, las 13 suites de línea base históricas y la compilación completa de la plataforma:

### 5.1 Suite de Fase 8
```bash
node scripts/test-phase8.js
```
- **Total Pruebas Ejecutadas:** 35
- **Pruebas Superadas (PASS):** 35 (100%)
- **Pruebas Fallidas (FAIL):** 0
- **Código de Salida (Exit Code):** 0
- **Limpieza de Datos:** Atómica (7 acuerdos, 2 participantes, 1 sesión, 1 categoría, 1 nota y 3 usuarios temporales eliminados al concluir).

### 5.2 Suites de Línea Base Históricas (13 Suites de Fases 2 a 7)
Se ejecutaron secuencialmente las 13 suites de auditoría y regresión acumuladas:

| No. | Comando de Suite | Pruebas | Resultado | Código Salida | Duración |
| :---: | :--- | :---: | :---: | :---: | :---: |
| 1 | `node scripts/test-phase2.js` | 17 | 17 PASS / 0 FAIL | **0** | 20.78s |
| 2 | `node scripts/test-phase3.js` | 44 | 44 PASS / 0 FAIL | **0** | 66.39s |
| 3 | `node scripts/test-phase3-audit.js` | 29 | 29 PASS / 0 FAIL | **0** | 31.98s |
| 4 | `node scripts/test-phase4.js` | 29 | 29 PASS / 0 FAIL | **0** | 54.27s |
| 5 | `node scripts/test-phase4-audit.js` | 37 | 37 PASS / 0 FAIL | **0** | 58.01s |
| 6 | `node scripts/test-phase5.js` | 21 | 21 PASS / 0 FAIL | **0** | 21.87s |
| 7 | `node scripts/test-phase5-audit.js` | 19 | 19 PASS / 0 FAIL | **0** | 19.27s |
| 8 | `node scripts/test-phase6.js` | 22 | 22 PASS / 0 FAIL | **0** | 26.24s |
| 9 | `node scripts/test-phase6-audit.js` | 14 | 14 PASS / 0 FAIL | **0** | 15.86s |
| 10 | `node scripts/test-phase7.js` | 21 | 21 PASS / 0 FAIL | **0** | 12.86s |
| 11 | `node scripts/test-phase7-audit.js` | 22 | 22 PASS / 0 FAIL | **0** | 21.19s |
| 12 | `node scripts/test-phase7-fixes.js` | 29 | 29 PASS / 0 FAIL | **0** | 61.24s |
| 13 | `node scripts/independent-phase7-audit.js` | 29 | 29 PASS / 0 FAIL | **0** | 51.72s |
| **TOT** | **13 Suites de Línea Base** | **333** | **333 PASS / 0 FAIL** | **0** | **461.68s** |

### 5.3 Resumen Global de Pruebas Automatizadas
- **Total de Pruebas de Línea Base (Fases 2 a 7):** 333 superadas (100%)
- **Total de Pruebas de Fase 8:** 35 superadas (100%)
- **TOTAL DE PRUEBAS AUTOMATIZADAS EN EL PROYECTO:** **368 de 368 superadas (100% de éxito)**.
- **Pruebas Pendientes:** **0 pruebas pendientes**.

### 5.4 Compilación de la Plataforma Turborepo
```bash
pnpm build
```
- **Resultado:** **Exit Code 0**
- **Paquetes Compilados:**
  - `@mexagenda/shared`: Compilado con éxito (`tsc`).
  - `@mexagenda/validation`: Compilado con éxito (`tsc`).
  - `@mexagenda/backend`: Compilado con éxito (`nest build`).
  - `@mexagenda/frontend`: Compilado con éxito (`next build`), generando 27 rutas estáticas y dinámicas (incluyendo `/reports`).

---

## 6. ANÁLISIS DE LA MEDICIÓN DE RENDIMIENTO (230.49 ms)

En cumplimiento de la orden de auditar las condiciones y el alcance de los **230.49 ms** reportados por el equipo implementador:

### 6.1 Condiciones de la Medición
- **Script Empleado:** `scratch/measure-latency.js`.
- **Infraestructura:** Conexión TCP/TLS desde host local en México hacia la base de datos Neon PostgreSQL Serverless ubicada en la región AWS `us-east-2` (Ohio).
- **Estado del Pool de Conexiones:** **Warm Pool (Pool Caliente)**. Se ejecutó una consulta previa `SELECT 1` para asegurar que el pool de Prisma mantuviera la conexión abierta y el cálculo de latencia no incluyera el apretón de manos inicial TLS ni el encendido del computo serverless de Neon.
- **Consultas Ejecutadas Concurrentemente:**
  ```typescript
  await Promise.all([
    prisma.agreement.findMany({
      where: { deletedAt: null, isArchived: false },
      select: { id: true, status: true, dueDate: true, completionDate: true },
    }),
    prisma.meeting.findMany({
      where: { deletedAt: null },
      select: { id: true, status: true, meetingDate: true },
    }),
    prisma.meetingCategory.findMany({ where: { isActive: true } }),
  ]);
  ```

### 6.2 Alcance y Limitaciones de la Medición
1. **Componente de Red Predominante:** Del total de 230.49 ms, aproximadamente **160-190 ms corresponden al RTT de red internacional** (ida y vuelta entre México y Ohio, EE.UU.), y entre **40-70 ms corresponden a la ejecución de consultas y agregación interna en PostgreSQL**.
2. **Exclusiones de la Métrica:** La medición no incluye:
   - Tiempo de ejecución de interceptores, guards de autenticación JWT y validación DTO en NestJS (~5-15 ms).
   - Bucles de JavaScript en memoria para clasificación en semáforo preventivo (~2-5 ms en volumen actual).
   - Latencia de cold-start (arranque en frío) de Neon PostgreSQL Serverless si el cómputo ha entrado en suspensión por inactividad (que puede oscilar entre 1.5 y 3.0 segundos).
3. **Comportamiento ante Volumen Máximo:** Con el límite autorizado de 5,000 registros (DEC-08-01), el tiempo de transferencia de red del payload JSON completo incrementará el tiempo de respuesta total a un rango estimado de 600 ms a 1,200 ms, lo cual se mantiene plenamente aceptable para reportes interactivos institucionales.

---

## 7. REGISTRO INSTITUCIONAL DE OBSERVACIONES Y PENDIENTES DE PRODUCCIÓN

En cumplimiento del mandato de trazabilidad, se preserva íntegramente el registro histórico de observaciones de producción emitidas en fases previas y se incorporan las correspondientes a la Fase 8:

| Identificador | Módulo | Fase Origen | Descripción y Estado para Entornos Productivos |
| :--- | :---: | :---: | :--- |
| **`OBS-06-01`** | MOD-05 | Fase 6 | **Procesamiento de Antivirus Asíncrono:** Máquina de estados y cuarentena lógica operativas; pendiente integración de daemon ClamAV o AWS Lambda en worker asíncrono para producción. |
| **`OBS-06-02`** | MOD-05 | Fase 6 | **Operación en Modo Sandbox Local HMAC:** Código integra SDK AWS S3; en local conmuta a driver HMAC-SHA256. Certificación en la nube condicionada al aprovisionamiento de bucket S3 y credenciales IAM. |
| **`OBS-07-01`** | MOD-06 | Fase 7 | **Concurrencia del Worker Outbox entre Réplicas:** Consulta de pendientes en `OutboxWorkerService` no implementa `FOR UPDATE SKIP LOCKED`. Condicionante para clusters multi-pod o escalado masivo (migración a BullMQ/Redis). |
| **`OBS-07-02`** | MOD-06 | Fase 7 | **Recuperación de Entregas Atascadas:** Si el backend se reinicia durante el despacho, la entrega queda en `EN_PROCESO`. Se requiere cron de barrido para revertir a `PENDIENTE` entregas con más de 15 min de rezago. |
| **`OBS-07-03`** | MOD-06 | Fase 7 | **Homologación de SMTP Real:** El sistema opera en modo Mock Transporter seguro por diseño; requiere aprovisionamiento de credenciales SMTP institucionales en producción. |
| **`OBS-08-01`** | MOD-07 | Fase 8 | **Consolidación en Git:** Para certificar el cierre definitivo, el código debe registrarse en un commit reproducible con tag `v0.8.0-phase8`. |
| **`OBS-08-02`** | MOD-07 | Fase 8 | **Monitoreo de Cold-Start en Neon:** Supervisar los tiempos de respuesta del tablero ejecutivo cuando el cómputo serverless de Neon se active desde estado suspendido. |

---

## 8. DICTAMEN DE AUDITORÍA Y CONCLUSIÓN

1. **Cumplimiento Técnico y Funcional:**
   La Fase 8 (MOD-07: Reportes Institucionales, Métricas Ejecutivas y Tableros de Control) cumple satisfactoriamente con la totalidad de los requisitos funcionales, matemáticos, de seguridad RBAC, neutralización de inyecciones CSV y aislamiento de privacidad aprobados.
2. **Estatus de Pruebas y Compilación:**
   La plataforma cuenta con 368 de 368 pruebas automatizadas superadas (100% de efectividad) y compilación limpia `pnpm build` (Exit Code 0).
3. **Decisión del Auditor:**
   Se otorga la **APROBACIÓN TÉCNICA PRELIMINAR** de la Fase 8.
4. **Acción Requerida para Cierre Definitivo:**
   La Coordinación General debe instruir la consolidación del árbol de trabajo en un commit reproducible etiquetado formalmente en Git (ej. `v0.8.0-phase8`). Una vez consolidado y verificado en limpio, procederá la emisión de la certificación final de cierre.
5. **Instrucción de Detención:**
   El equipo auditor **se detiene formalmente en este punto**. Se ratifica que la **Fase 9 no ha sido autorizada** y no debe ejecutarse ninguna acción de despliegue a producción.


# CONSOLIDACIÓN TÉCNICA Y TRAZABILIDAD — FASE 8
## MEXAGENDA — SISTEMA PRIVADO DE GESTIÓN INSTITUCIONAL
### MOD-07: REPORTES INSTITUCIONALES, MÉTRICAS EJECUTIVAS Y TABLEROS DE CONTROL

**Fecha:** 09 de Noviembre de 2026  
**Base de Código:** Commit `9d2cf017b36c75f3f07d1769f736550c7c466a69` (Tag `v0.7.1-phase7-fixes`)  
**Hito:** Consolidación de Fase 8 previa al tag `v0.8.0-phase8`

---

## 1. CONJUNTO DE CAMBIOS AUDITADO

El conjunto de cambios que compone formalmente la Fase 8 (MOD-07) comprende:

1. **Contratos y DTOs Compartidos (`packages/shared/src/contracts/index.ts`):**
   - Interfaces `ExecutiveDashboardDto`, `AgreementsTrackingDto`, `SessionGovernanceDto`, `PersonalConsoleDto`, `QueryReportsDto`, `ReportExpirationTrafficLight`, `ReportCategoryDistribution`, `ReportOverdueAlert`.
2. **Backend NestJS 11 (`apps/backend/src/`):**
   - Módulo `ReportsModule` ([reports.module.ts](file:///d:/MexAgenda/apps/backend/src/modules/reports/reports.module.ts)) registrado en [app.module.ts](file:///d:/MexAgenda/apps/backend/src/app.module.ts).
   - Servicio `ReportsService` ([reports.service.ts](file:///d:/MexAgenda/apps/backend/src/modules/reports/reports.service.ts)) implementando agregaciones nativas Prisma/PostgreSQL, semáforo preventivo disjunto, gobernanza de quórum, aislamiento de notas personales y exportación tabular CSV con sanitización de inyección de fórmulas.
   - Controlador `ReportsController` ([reports.controller.ts](file:///d:/MexAgenda/apps/backend/src/modules/reports/reports.controller.ts)) con endpoints `/reports/executive`, `/reports/agreements`, `/reports/sessions`, `/reports/personal`, `/reports/export`.
   - DTOs de validación con `class-validator` ([query-reports.dto.ts](file:///d:/MexAgenda/apps/backend/src/modules/reports/dto/query-reports.dto.ts), [export-reports.dto.ts](file:///d:/MexAgenda/apps/backend/src/modules/reports/dto/export-reports.dto.ts)).
3. **Frontend Next.js 15 (`apps/frontend/src/`):**
   - Interfaz unificada de reportes en [page.tsx](file:///d:/MexAgenda/apps/frontend/src/app/(dashboard)/reports/page.tsx) con 4 pestañas institucionales, filtros reactivos, descarga de CSV y vista oficial imprimible (`@media print`).
   - Acceso en navegación principal [header-nav.tsx](file:///d:/MexAgenda/apps/frontend/src/app/header-nav.tsx).
4. **Seguridad y Permisos RBAC (`scripts/bootstrap-admin.js`):**
   - Incorporación de `report:view:executive`, `report:view:operational`, `report:export` (51 permisos institucionales totales en Neon PostgreSQL).
5. **Verificación y Pruebas Automatizadas (`scripts/test-phase8.js`):**
   - Suite completa de 35 pruebas automatizadas cubriendo RBAC isolation, ground truth, semáforo, quórum, notas personales y neutralización CSV.
6. **Documentación Oficial (`docs/phase-8/` y `docs/phase-8-audit/`):**
   - [01-plan-tecnico-y-diagnostico.md](file:///d:/MexAgenda/docs/phase-8/01-plan-tecnico-y-diagnostico.md)
   - [02-informe-implementacion.md](file:///d:/MexAgenda/docs/phase-8/02-informe-implementacion.md)
   - [03-consolidacion-y-trazabilidad.md](file:///d:/MexAgenda/docs/phase-8/03-consolidacion-y-trazabilidad.md)
   - [01-dictamen-auditoria-independiente.md](file:///d:/MexAgenda/docs/phase-8-audit/01-dictamen-auditoria-independiente.md)

---

## 2. CONTRASTE DE UMBRALES DEL SEMÁFORO PREVENTIVO

Se realizó una contrastación técnica forense entre la definición inicial del plan, la lógica implementada en backend y las etiquetas renderizadas en la interfaz:

| Categoría Semáforo | Lógica en Backend (`reports.service.ts`) | Etiqueta Interfaz Web (`page.tsx`) | Comportamiento en los Límites |
| :--- | :--- | :--- | :--- |
| **Ya Vencidos** | $d < 0$ o status = `VENCIDO` | *"Ya Vencidos"* (Badge Rose-500) | Si la fecha límite fue ayer o antes, entra de inmediato en rezago. |
| **Crítico** | $0 \le d \le 7$ días | *"Crítico (0 a 7 días)"* (Badge Amber-500) | **Límite $d=0$:** Si el acuerdo vence el día de hoy, se clasifica como crítico ($d=0$). Abarca hoy hasta 7 días naturales. |
| **Medio** | $8 \le d \le 15$ días | *"Medio (8 a 15 días)"* (Badge Yellow-400) | **Límites $d=8$ y $d=15$:** Abarca exactamente la segunda semana previa al vencimiento. |
| **Lejano** | $16 \le d \le 30$ días | *"Lejano (16 a 30 días)"* (Badge Sky-400) | **Límites $d=16$ y $d=30$:** Abarca de la tercera semana hasta el mes civil. |
| **En Plazo** | $d \ge 31$ días | *"En Plazo (> 30 días)"* (Badge Emerald-500) | **Límite $d=31$:** Compromisos con horizonte superior a un mes civil. |
| **Sin Plazo** | `!dueDate` | Contabilizado en métrica de apoyo | Acuerdos accionables sin fecha límite asignada. |
| **En Suspensión** | status = `SUSPENDIDO` | *"En Suspensión Jurídica"* (Badge Slate-400) | **DEC-08-02:** Aislado completamente del semáforo activo; no altera verde, amarillo ni rojo. |

### Resolución de Discrepancia Textual:
- En borradores previos de diseño se consideró un semáforo tricromático simple ($\le 2$ días, 3-7 días, $> 7$ días).
- La implementación final consolidó formalmente el **modelo quinquepartito institucional** más categoría de suspensión jurídica (6 tramos en total), el cual ofrece mayor granularidad ejecutiva a los órganos de gobierno.
- Se homologó la etiqueta del frontend en [page.tsx](file:///d:/MexAgenda/apps/frontend/src/app/(dashboard)/reports/page.tsx) a `"Crítico (0 a 7 días)"` para eliminar cualquier ambigüedad sobre el día $d=0$ (vence hoy).

---

## 3. FUNDAMENTO INSTITUCIONAL DE LA REGLA DE QUÓRUM LEGAL

### Regla Vigente en Código:
```typescript
const tieneQuorum = numParticipants > 0 && presentes > numParticipants / 2;
```

### Respaldo Reglamentario:
1. **Marco General del Sector Público Mexicano:**
   Conforme al régimen jurídico aplicable a cuerpos colegiados, comités técnicos y comisiones de la administración pública (ej. *Ley Federal de Entidades Paraestatales* art. 20, *Ley General de Instituciones y Procedimientos Electorales*, y reglamentos interiores de cuerpos colegiados gubernamentales), el quórum legal de instalación y sesión ordinaria se alcanza con la **mayoría simple de sus integrantes convocados (la mitad más uno)**.
2. **Validación en Fronteras:**
   - 4 convocados, 2 presentes: $2 > 4/2$ es falso $\rightarrow$ **NO HAY QUÓRUM** (empate a la mitad no es mayoría; requiere 3).
   - 4 convocados, 3 presentes: $3 > 2$ es verdadero $\rightarrow$ **HAY QUÓRUM**.
   - 5 convocados, 3 presentes: $3 > 2.5$ es verdadero $\rightarrow$ **HAY QUÓRUM**.
3. **Reserva Técnica para Comités Especiales:**
   Se deja asentado formalmente que en órganos colegiados que por estatuto particular exijan **quórum calificado** (dos tercios) o presencia obligatoria de determinadas dignidades (Presidencia y Secretaría Técnica concurrentes), dicha regla podrá parametrizarse en futuras versiones dentro de la entidad `MeetingCategory` sin alterar la regla general por mayoría simple que opera actualmente.

---

## 4. RESTAURACIÓN DE TRAZABILIDAD DE OBSERVACIONES DE PRODUCCIÓN

Se restaura la trazabilidad estricta de las observaciones emanadas de los dictámenes originales de auditoría de Fase 6 ([15-matriz-hallazgos-remediacion.md](file:///d:/MexAgenda/docs/phase-6-audit/15-matriz-hallazgos-remediacion.md)) y Fase 7 ([12-verificacion-independiente-correcciones.md](file:///d:/MexAgenda/docs/phase-7-audit/12-verificacion-independiente-correcciones.md)):

| Identificador | Módulo | Fase Origen | Descripción Técnica y Estado para Entornos Productivos |
| :--- | :---: | :---: | :--- |
| **`OBS-06-01`** | MOD-05 | Fase 6 | **Procesamiento de Antivirus Asíncrono:** Máquina de estados `FileScanStatus` y cuarentena lógica operativas en backend; pendiente integración de daemon ClamAV o AWS Lambda en worker asíncrono para producción. |
| **`OBS-06-02`** | MOD-05 | Fase 6 | **Operación en Modo Sandbox Local HMAC:** Código integra SDK AWS S3; en local conmuta a driver HMAC-SHA256. Certificación en la nube condicionada al aprovisionamiento de bucket S3 y credenciales IAM. |
| **`OBS-07-01`** | MOD-06 | Fase 7 | **Concurrencia del Worker Outbox entre Réplicas:** Consulta de pendientes en `OutboxWorkerService` no implementa `FOR UPDATE SKIP LOCKED`. Condicionante para clusters multi-pod o escalado masivo (migración a BullMQ/Redis). |
| **`OBS-07-02`** | MOD-06 | Fase 7 | **Recuperación de Entregas Atascadas:** Si el backend se reinicia durante el despacho, la entrega queda en `EN_PROCESO`. Se requiere cron de barrido para revertir a `PENDIENTE` entregas con más de 15 min de rezago. |
| **`OBS-07-03`** | MOD-06 | Fase 7 | **Homologación de SMTP Real:** El sistema opera en modo Mock Transporter seguro por diseño; requiere aprovisionamiento de credenciales SMTP institucionales en producción. |
| **`OBS-08-01`** | MOD-07 | Fase 8 | **Consolidación en Git:** Para certificar el cierre definitivo, el código debe registrarse en un commit reproducible con tag `v0.8.0-phase8`. |
| **`OBS-08-02`** | MOD-07 | Fase 8 | **Monitoreo de Cold-Start en Neon:** Supervisar los tiempos de respuesta del tablero ejecutivo cuando el cómputo serverless de Neon se active desde estado suspendido. |

---

## 5. ESTADO DE VERIFICACIÓN PREVIO AL ETIQUETADO

- **Suite de Fase 8 (`test-phase8.js`):** 35 / 35 superadas (100%).
- **Suites de Línea Base Históricas (13 suites):** 333 / 333 superadas (100%).
- **Total Pruebas en el Sistema:** **368 / 368 superadas (100%)**.
- **Compilación Turborepo (`pnpm build`):** Exit Code 0 (cero errores en backend, frontend y packages).

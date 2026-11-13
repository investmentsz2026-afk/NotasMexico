# 09. BITÁCORA DE HALLAZGOS Y CORRECCIONES TÉCNICAS
## Proyecto: MexAgenda — Sistema Privado de Gestión Institucional
### Módulo: MOD-02 — Gestión Institucional de Reuniones y Sesiones

---

## 1. RESUMEN DE HALLAZGOS

Durante las actividades de inspección profunda, pruebas de estrés y auditoría de código del módulo MOD-02, el equipo de auditoría identificó **6 hallazgos técnicos** relacionados con concurrencia, control de excepciones, integridad de actas, mapeo de rutas y tratamiento temporal.

Todos los hallazgos fueron catalogados, analizados, mitigados e incorporados al código fuente antes de emitir el dictamen final.

---

## 2. DETALLE DE HALLAZGOS Y MITIGACIONES IMPLEMENTADAS

### Hallazgo H-01: Excepciones Nativas de Prisma ORM Escapando como Errores 500
- **Severidad:** Media (Riesgo de denegación de servicio o fuga de trazas en fallos concurrentes).
- **Diagnóstico:** El filtro global [`GlobalExceptionFilter`](file:///d:/MexAgenda/apps/backend/src/common/filters/global-exception.filter.ts) solo evaluaba instancias de `HttpException`. Si ocurría una violación de unicidad de base de datos (`P2002`) o clave foránea (`P2003`), la excepción caía en la rama genérica de `Error`, retornando HTTP 500 Internal Server Error.
- **Corrección Implementada:**
  Se integró detección nativa de códigos de error Prisma en `GlobalExceptionFilter`:
  - `P2002` -> `HttpStatus.CONFLICT` (HTTP 409) con código `DUPLICATE_RESOURCE_CONFLICT`.
  - `P2025` -> `HttpStatus.NOT_FOUND` (HTTP 404) con código `RESOURCE_NOT_FOUND`.
  - `P2003` -> `HttpStatus.BAD_REQUEST` (HTTP 400) con código `FOREIGN_KEY_VIOLATION`.
- **Efecto de la Corrección:** Las colisiones concurrentes y violaciones de unicidad se transforman en respuestas estandarizadas RFC 7807 sin generar errores 500.

---

### Hallazgo H-02: Colisión de Folios Autogenerados en Creaciones Simultáneas
- **Severidad:** Alta (Experiencia de usuario y fallo transaccional en horas pico).
- **Diagnóstico:** Cuando dos usuarios creaban reuniones para la misma categoría y fecha en el mismo milisegundo, ambos calculaban el mismo candidato a folio secuencial. El primero insertaba exitosamente, pero el segundo recibía un fallo de restricción única en base de datos.
- **Corrección Implementada:**
  En [`MeetingsService.create`](file:///d:/MexAgenda/apps/backend/src/modules/meetings/meetings.service.ts), se incorporó un bucle transaccional de reintento automático (`maxAttempts = 3`). Si se captura `err.code === 'P2002'` sobre un folio autogenerado, el servicio regenera inmediatamente el siguiente folio secuencial y reintenta la inserción sin interrumpir la operación del usuario.
- **Efecto de la Corrección:** La prueba `CONCURR-AUDIT-01` demostró que dos reuniones creadas en paralelo en el mismo instante reciben `AUD-2026-001` y `AUD-2026-002` de forma limpia y transparente.

---

### Hallazgo H-03: Ausencia de Control de Concurrencia Optimista en Edición de Sesiones
- **Severidad:** Media (Riesgo de sobreescritura sucia por operadores simultáneos).
- **Diagnóstico:** El modelo de datos poseía el campo numérico `version` con auto-incremento, pero el servicio de actualización no permitía a los clientes especificar la versión esperada para validar que el registro no hubiera sido alterado mientras el usuario editaba el formulario.
- **Corrección Implementada:**
  1. Se agregó la propiedad opcional `expectedVersion?: number` en [`UpdateMeetingDto`](file:///d:/MexAgenda/apps/backend/src/modules/meetings/dto/update-meeting.dto.ts).
  2. En `MeetingsService.update`, se incorporó la validación:
     ```typescript
     if (dto.expectedVersion !== undefined && existing.version !== dto.expectedVersion) {
       throw new ConflictException(
         `Conflicto de concurrencia optimista: el registro ha sido modificado por otro usuario (versión actual: ${existing.version}, versión esperada: ${dto.expectedVersion}).`,
       );
     }
     ```
- **Efecto de la Corrección:** Los clientes web y móviles pueden enviar `expectedVersion` para garantizar que no se sobreescriban modificaciones ajenas inadvertidamente.

---

### Hallazgo H-04: Exigencia Imperativa de Justificación Institucional en Actas Aprobadas
- **Severidad:** Alta (Integridad de instrumentos de gobernanza colegiada).
- **Diagnóstico:** Al modificar un acta aprobada, el código asignaba un texto por defecto si el usuario omitía `changeReason` (`dto.changeReason || 'Modificación posterior a la aprobación formal'`), permitiendo modificaciones sin justificación explícita fundamentada.
- **Corrección Implementada:**
  Se condicionó la edición en `MeetingsService.createOrUpdateMinutes`:
  ```typescript
  if (existingMinutes && existingMinutes.status === 'APROBADA') {
    if (!dto.changeReason || dto.changeReason.trim().length === 0) {
      throw new BadRequestException(
        'Para modificar un acta formalmente aprobada es obligatorio registrar una justificación institucional (changeReason).',
      );
    }
    // ...
  }
  ```
- **Efecto de la Corrección:** Queda bloqueada cualquier alteración de un acta oficial sin que el operador asiente formalmente la causa colegiada o jurídica que la motivó.

---

### Hallazgo H-05: Discrepancia de Ruta en Registro de Asistencia
- **Severidad:** Baja (Incompatibilidad potencial entre frontend y backend).
- **Diagnóstico:** El controlador backend exponía `@Patch(':id/participants/:participantId/attendance')`, mientras que una función auxiliar del frontend invocaba `/meetings/${id}/attendance/${participantId}`.
- **Corrección Implementada:**
  1. En [`MeetingsController`](file:///d:/MexAgenda/apps/backend/src/modules/meetings/meetings.controller.ts), se declaró soporte multi-ruta:
     ```typescript
     @Patch([':id/participants/:participantId/attendance', ':id/attendance/:participantId'])
     ```
  2. En [`apps/frontend/src/app/(dashboard)/meetings/[id]/page.tsx`](file:///d:/MexAgenda/apps/frontend/src/app/(dashboard)/meetings/[id]/page.tsx), se actualizó la llamada a la ruta canónica `/meetings/${id}/participants/${participantId}/attendance`.
- **Efecto de la Corrección:** Compatibilidad total y redundante garantizada.

---

### Hallazgo H-06: Descarte de Horas en Límites de Día en Filtros de Fecha
- **Severidad:** Baja (Ocultamiento inadvertido de reuniones en reportes).
- **Diagnóstico:** Si una consulta enviaba `endDate: "2026-11-20"` sin componente de hora, JavaScript interpretaba `2026-11-20T00:00:00.000Z`, descartando reuniones celebradas más tarde en ese mismo día.
- **Corrección Implementada:**
  En `MeetingsService.findAll`, se normalizó:
  ```typescript
  const endStr = query.endDate.includes('T') ? query.endDate : `${query.endDate}T23:59:59.999Z`;
  where.meetingDate.lte = new Date(endStr);
  ```
- **Efecto de la Corrección:** Las búsquedas por rango de fecha cubren exactamente la totalidad de las 24 horas del día límite.

---

## 3. ESTADO FINAL DE LOS HALLAZGOS

| Identificador | Descripción Breve | Severidad | Estado Actual | Verificado por |
| :--- | :--- | :--- | :--- | :--- |
| **H-01** | Mapeo de errores de Prisma en GlobalExceptionFilter | Media | **RESUELTO** | `CONCURR-AUDIT-04` |
| **H-02** | Reintento automático en colisión de folios | Alta | **RESUELTO** | `CONCURR-AUDIT-01` |
| **H-03** | Control de concurrencia optimista (`expectedVersion`) | Media | **RESUELTO** | `CONCURR-AUDIT-03` |
| **H-04** | Exigencia obligatoria de `changeReason` en actas | Alta | **RESUELTO** | `MIN-AUDIT-02` |
| **H-05** | Soporte de rutas alias en registro de asistencia | Baja | **RESUELTO** | `MeetingsController` |
| **H-06** | Normalización de límites `23:59:59.999Z` en filtros | Baja | **RESUELTO** | `TZ-AUDIT-02` |

**Resultado:** Cero hallazgos abiertos o vulnerabilidades no mitigadas en el módulo MOD-02.


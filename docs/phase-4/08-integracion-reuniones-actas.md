# 08. INTEGRACIÓN CON REUNIONES, AGENDA Y ACTAS INSTITUCIONALES (MOD-02)
## MexAgenda — Sistema Privado de Gestión Institucional

### 1. Marco de Interoperabilidad MOD-02 ↔ MOD-03

En la gestión pública colegiada, los acuerdos no surgen de forma aislada: emanan indefectiblemente de la deliberación formal de un órgano colegiado en sesión debidamente convocada y documentada.

El módulo **MOD-03 (Acuerdos Institucionales)** se encuentra estrechamente integrado con el módulo **MOD-02 (Gestión Institucional de Reuniones y Sesiones)**, manteniendo consistencia transaccional, trazabilidad cruzada e integridad referencial en Neon PostgreSQL.

```
+----------------------------------------------------------------------------+
|                               MOD-02: REUNIÓN                              |
|  - Identificador: id (UUID)                                                |
|  - Folio de Sesión: SO-2026-001                                            |
|  - Categoría: Ordinaria / Extraordinaria (define el prefijo institucional)  |
|  - Puntos del Orden del Día: AgendaItem (Punto 3: Aprobación Presupuestal) |
|  - Acta Institucional Aprobada: MeetingMinutes                             |
+----------------------------------------------------------------------------+
                                      │
                                      ▼ [Emisión Colegiada]
+----------------------------------------------------------------------------+
|                              MOD-03: ACUERDO                               |
|  - Folio Institucional: ACU-ORD-2026-0003                                  |
|  - meetingId ──────────────▶ Vinculación obligatoria a la sesión de origen |
|  - agendaItemId ───────────▶ Vinculación contextual al punto de debate     |
|  - minutesId ──────────────▶ Referencia cruzada al acta formal aprobada    |
+----------------------------------------------------------------------------+
```

---

### 2. Puntos de Acoplamiento y Reglas de Integridad

#### 2.1. Vinculación Obligatoria a la Sesión Convocante
Todo acuerdo requiere la llave foránea obligatoria `meetingId`. El servicio de acuerdos verifica:
1. Existencia del registro en la tabla `meetings`.
2. Que el estado de la reunión sea válido (no cancelada). Si la reunión se encuentra en estado `CANCELADA`, se rechaza la creación del acuerdo con un error de negocio.
3. Se hereda el contexto de la reunión para la determinación del prefijo del folio institucional (ej. `ORD` para sesiones ordinarias, `EXT` para extraordinarias, `SEC` por defecto).

#### 2.2. Vinculación Contextual al Orden del Día (`agendaItemId`)
Un acuerdo puede estar directamente relacionado con un punto específico del orden del día (`AgendaItem`):
- Facilita la trazabilidad entre el planteamiento del tema, el debate sostenido y la resolución acordada.
- Permite a los servidores públicos revisar los antecedentes de la discusión directamente desde el expediente del acuerdo.
- Es opcional (nullable) para admitir acuerdos plenarios o resoluciones sobre la marcha aprobadas por la asamblea.

#### 2.3. Respaldo en Actas Institucionales Aprobadas (`MeetingMinutes`)
Conforme a la auditoría técnica de la Fase 3:
- Toda sesión formal culmina en un acta institucional (`MeetingMinutes`) sujeta a versiones inmutables y sellado criptográfico.
- Los acuerdos adoptados quedan transcritos en el cuerpo del acta aprobada y son auditables de manera cruzada.
- Ningún acuerdo puede desvincularse unilateralmente de la reunión de origen ni del acta que le dio validez jurídica.

---

### 3. Restricciones de Base de Datos y No Destructividad

1. **Integridad Referencial (`ON DELETE RESTRICT`):**  
   Una reunión que cuente con acuerdos institucionales vinculados no puede ser eliminada físicamente de la base de datos (`ON DELETE RESTRICT`). Para archivar una reunión con acuerdos vigentes, debe recurrirse a los procedimientos de baja institucional lógica supervisados.
2. **Navegación Bidireccional en Frontend:**  
   - En el expediente de la reunión (`/meetings/[id]`), la pestaña correspondiente lista todos los acuerdos emanados, mostrando su folio, responsable, porcentaje de avance y semáforo de estado.
   - En el expediente del acuerdo (`/agreements/[id]`), la tarjeta superior ofrece un hipervínculo directo al expediente de la sesión convocante (`/meetings/[meetingId]`), permitiendo consultar el orden del día, lista de asistencia y el acta formal aprobada.


# MATRIZ DE HALLAZGOS Y REMEDIACIÓN — FASE 5
## Módulo MOD-04: Anotaciones Personales y Notas de Sesión

### 1. OBSERVACIONES HEREDADAS DE FASE 4 (MANTENIDAS VIGENTES)

En cumplimiento con el mandato del prompt de auditoría, se conservan vigentes y sin resolver los siguientes puntos históricos:

#### [OBS-04-01] Validación de Pertenencia Titular/Colaborador para Registro de Avances
- **Módulo Afectado:** MOD-03 — Acuerdos Institucionales.
- **Clasificación:** MEDIO (Heredado de Fase 4).
- **Estado:** VIGENTE. La implementación de Fase 5 no introdujo regresiones en este flujo.
- **Recomendación:** Mantener en el backlog de refinamiento de Fase 6 o fase de hardening.

#### [OBS-04-02] Protección Nativa del Historial de Acuerdos mediante Mecanismos PostgreSQL
- **Módulo Afectado:** MOD-03 — Acuerdos Institucionales (`agreement_history`).
- **Clasificación:** INFORMATIVO / HARDENING (Heredado de Fase 4).
- **Estado:** VIGENTE. La inmutabilidad en la capa de aplicación NestJS permanece sólida al 100%.

---

### 2. MATRIZ DE HALLAZGOS PROPIOS DE LA AUDITORÍA DE FASE 5

No se detectaron hallazgos de severidad **CRÍTICA** ni **ALTA**. Se identificaron 2 hallazgos de severidad **MEDIA**, 1 **BAJO** y 1 **INFORMATIVO**.

---

#### [FIND-05-01] Ausencia de Transaccionalidad Atómica en Creación de Snapshots
- **Clasificación:** **MEDIO**
- **Archivo Afectado:** [`apps/backend/src/modules/notes/notes.service.ts`](file:///d:/MexAgenda/apps/backend/src/modules/notes/notes.service.ts) (Líneas 498-528 y 600-630).
- **Descripción:** En los métodos `update` y `adminIntervene`, la inserción del snapshot en `personal_note_versions` y la actualización del registro principal en `personal_notes` se efectúan mediante dos llamadas secuenciales `await` sin estar agrupadas dentro de una transacción interactiva `prisma.$transaction`.
- **Evidencia:**
  ```typescript
  // Snapshot independiente:
  await this.prisma.personalNoteVersion.create({ data: { ... } });
  // Actualización posterior independiente:
  const updatedNote = await this.prisma.personalNote.update({ where: { id }, data: { ... } });
  ```
- **Impacto:** Si la base de datos o el proceso Node.js experimentan una caída forzada en el milisegundo intermedio entre ambas sentencias, se crearía una versión histórica huérfana mientras que la nota principal mantendría su versión y contenido antiguos.
- **Reproducción:** Simular una desconexión de red mediante proxy entre la primera y la segunda llamada.
- **Recomendación:** Envolver ambas operaciones en un bloque transaccional:
  ```typescript
  await this.prisma.$transaction(async (tx) => {
    await tx.personalNoteVersion.create({ data: { ... } });
    await tx.personalNote.update({ where: { id }, data: { ... } });
  });
  ```
- **Criterio de Aceptación:** Ambas escrituras se confirman o revierten atómicamente.

---

#### [FIND-05-02] Alcance de Visibilidad `REUNION` sin Verificación de Participación
- **Clasificación:** **MEDIO**
- **Archivo Afectado:** [`apps/backend/src/modules/notes/notes.service.ts`](file:///d:/MexAgenda/apps/backend/src/modules/notes/notes.service.ts) (Líneas 80-83 y 257-262).
- **Descripción:** Cuando una nota posee `visibility: 'REUNION'`, cualquier usuario autenticado de la institución con permiso `note:read` puede visualizarla en el catálogo general o por UUID directo, sin verificar si dicho usuario se encuentra registrado en `meeting_participants` para la reunión vinculada (`note.meetingId`).
- **Evidencia:**
  ```typescript
  if (!isAdmin) {
    where.OR = [
      { authorId: user.id },
      { visibility: NoteVisibility.PUBLICA },
      { visibility: NoteVisibility.REUNION }, // <--- Cualquier usuario la ve
    ];
  }
  ```
- **Impacto:** Las notas colaborativas redactadas en comisiones o comités de acceso reservado podrían ser leídas por otros servidores públicos que no formen parte del cuerpo colegiado.
- **Reproducción:** Crear una reunión M1 con participantes U1 y U2. U1 crea una nota con visibilidad `REUNION`. U3 (no convocado a M1) consulta `GET /notes` y visualiza la nota.
- **Recomendación:** Restringir la visibilidad `REUNION` comprobando la pertenencia formal a la reunión:
  ```typescript
  // En findById:
  if (note.visibility === NoteVisibility.REUNION && note.meetingId && note.authorId !== user.id && !isAdmin) {
    const isParticipant = await this.prisma.meetingParticipant.findFirst({
      where: { meetingId: note.meetingId, userId: user.id }
    });
    if (!isParticipant) throw new ForbiddenException('Acceso denegado: Nota reservada a integrantes de la sesión.');
  }
  ```
- **Criterio de Aceptación:** Usuarios no convocados a la reunión reciben 403 Forbidden al intentar consultar notas de tipo `REUNION`.

---

#### [FIND-05-03] Asincronía del Campo Booleano `is_archived` en Soft Delete
- **Clasificación:** **BAJO**
- **Archivo Afectado:** [`apps/backend/src/modules/notes/notes.service.ts`](file:///d:/MexAgenda/apps/backend/src/modules/notes/notes.service.ts) (Líneas 680-684).
- **Descripción:** La tabla `personal_notes` contiene la columna `is_archived` (con índice compuesto en PostgreSQL). Sin embargo, el método `archive` únicamente actualiza `deletedAt: new Date()` y el método `restore` actualiza `deletedAt: null`, dejando `is_archived = false`.
- **Evidencia:**
  ```typescript
  await this.prisma.personalNote.update({
    where: { id },
    data: { deletedAt: new Date() }, // No sincroniza isArchived: true
  });
  ```
- **Impacto:** Menor eficiencia potencial en consultas externas que utilicen el índice `personal_notes_author_id_is_archived_idx`. La lógica de la aplicación opera correctamente porque se apoya en `deletedAt`.
- **Recomendación:** Actualizar concurrentemente `isArchived: true` en `archive` e `isArchived: false` en `restore`.
- **Criterio de Aceptación:** El campo `is_archived` y `deleted_at` reflejan el mismo estado de baja lógica.

---

#### [FIND-05-04] Inmutabilidad de Versiones Basada en Capa de Aplicación
- **Clasificación:** **INFORMATIVO**
- **Archivo Afectado:** Motor de base de datos Neon PostgreSQL (`personal_note_versions`).
- **Descripción:** La inmutabilidad de los snapshots históricos se encuentra garantizada al 100% por la arquitectura de la API NestJS (ausencia de rutas o métodos de mutación), pero la tabla no cuenta con triggers nativos en PostgreSQL que impidan `UPDATE` o `DELETE` directos desde conexiones SQL directas.
- **Impacto:** Ninguno a nivel de aplicación web. Relevante únicamente para auditorías de nivel forense de infraestructura.
- **Recomendación:** Se integra con la observación `OBS-04-01` para el futuro plan de hardening de base de datos.
- **Criterio de Aceptación:** Añadir triggers `BEFORE UPDATE OR DELETE ON personal_note_versions` en la fase correspondiente.


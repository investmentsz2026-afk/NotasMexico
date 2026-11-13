# AUDITORÍA DE PRIVACIDAD Y REGLAS DE VISIBILIDAD — FASE 5
## Módulo MOD-04: Anotaciones Personales y Notas de Sesión

### 1. EVALUACIÓN DE LAS MODALIDADES DE VISIBILIDAD

El modelo de datos y la lógica de negocio de MOD-04 definen tres niveles de visibilidad:

```
+-------------------+-----------------------------------------------------------------+
| NIVEL VISIBILIDAD | INTENCIÓN INSTITUCIONAL SEGÚN FASE 0                            |
+-------------------+-----------------------------------------------------------------+
| PRIVADA           | Confidencialidad estricta. Exclusiva para el autor y auditoría. |
| REUNION           | Compartida entre los integrantes convocados a la sesión colegial|
| PUBLICA           | Documento institucional visible para todo servidor público.     |
+-------------------+-----------------------------------------------------------------+
```

---

### 2. COMPORTAMIENTO VERIFICADO POR MODALIDAD

#### A. Modalidad `PRIVADA`
- **En `findById`:** Si el solicitante no es el autor y no posee credenciales administrativas de auditoría (`note:admin:read` / `ROLE_ADMIN`), el backend detiene el procesamiento inmediatamente y arroja un error HTTP `403 Forbidden` (`Acceso denegado: Esta anotación es de carácter estrictamente privado para su autor`).
- **En `findAll` y Motor de Búsqueda:** La cláusula SQL inyectada por Prisma excluye categóricamente cualquier registro privado cuyo `authorId` sea diferente al del usuario en sesión.
- **En `getVersions`:** Se invoca de manera previa la validación de `findById`, bloqueando cualquier intento de auditar snapshots privados de otros servidores públicos.

#### B. Modalidad `PUBLICA`
- Accesible en modo de solo lectura para cualquier servidor público debidamente autenticado con permiso `note:read`.
- **Regla de Soberanía:** La visibilidad pública **NO otorga facultades de edición ni de eliminación a terceros**. La titularidad de modificación permanece rígidamente confinada al autor original o al protocolo de intervención extraordinaria.

#### C. Modalidad `REUNION` (Hallazgo de Auditoría `FIND-05-02`)
Durante la inspección de la lógica de autorización en [`NotesService`](file:///d:/MexAgenda/apps/backend/src/modules/notes/notes.service.ts), el Comité Auditor detectó el siguiente comportamiento:

```typescript
// Líneas 78-83 de notes.service.ts:
if (!isAdmin) {
  where.OR = [
    { authorId: user.id },
    { visibility: NoteVisibility.PUBLICA },
    { visibility: NoteVisibility.REUNION }, // <--- Consulta abierta a nivel catálogo
  ];
}
```

```typescript
// Líneas 257-262 de notes.service.ts:
if (note.visibility === NoteVisibility.PRIVADA && note.authorId !== user.id && !isAdmin) {
  throw new ForbiddenException(
    'Acceso denegado: Esta anotación es de carácter estrictamente privado para su autor.',
  );
}
// <--- Las notas con visibilidad REUNION son permitidas a cualquier usuario con note:read
```

---

### 3. ANÁLISIS DE IMPACTO DEL HALLAZGO `FIND-05-02`

- **Severidad:** **MEDIA**.
- **Descripción:** Cuando una anotación se etiqueta con visibilidad `REUNION`, el sistema permite su consulta a cualquier usuario autenticado de la institución que posea el permiso estándar `note:read`, sin validar relacionalmente si el usuario solicitante figura formalmente como participante en la tabla `meeting_participants` de la reunión vinculada (`note.meetingId`).
- **Impacto Institucional:** En reuniones de carácter reservado o sensible (ej. Comités Especiales o sesiones a puerta cerrada), las notas colaborativas de sesión etiquetadas como `REUNION` podrían ser leídas por servidores públicos acreditados que no forman parte de dicha comisión.
- **Nota Aclaratoria:** La privacidad de las notas `PRIVADA` permanece 100% blindada; el hallazgo concierne exclusivamente al alcance colaborativo de la etiqueta `REUNION`.
- **Recomendación de Remediación:**
  En `findById` y `findAll`, incorporar un filtro que corrobore:
  ```typescript
  if (note.visibility === NoteVisibility.REUNION && note.meetingId) {
    const isParticipant = await this.prisma.meetingParticipant.findFirst({
      where: { meetingId: note.meetingId, userId: user.id }
    });
    if (!isParticipant && note.authorId !== user.id && !isAdmin) {
      throw new ForbiddenException('Acceso denegado: Únicamente los participantes convocados pueden consultar esta nota de sesión.');
    }
  }
  ```

---

### 4. CONCLUSIÓN DEL CAPÍTULO DE PRIVACIDAD

La protección de anotaciones estrictamente privadas (`PRIVADA`) es **total, hermética y conforme con la normativa LGPDPPSO**. Se emite la observación no bloqueante `FIND-05-02` para refinar en la siguiente iteración el acotamiento de participantes en notas de sesión colegiada.


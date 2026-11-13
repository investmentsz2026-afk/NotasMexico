# INFORME DE AUDITORÍA FASE 6 — DOCUMENTO 08
## AUDITORÍA DE PRIVACIDAD HEREDADA Y CONFIDENCIALIDAD TRANSVERSAL
### MÓDULO: MOD-05 — BÓVEDA DIGITAL Y GESTIÓN SEGURA DE ARCHIVOS ADJUNTOS (S3)

---

### 1. MODELO INSTITUCIONAL DE PRIVACIDAD HEREDADA

En MexAgenda, un documento adjunto no existe de forma aislada en la mayoría de los casos; suele estar vinculado a:
1. Una **Anotación Personal o Nota de Sesión** (Módulo MOD-04).
2. Una **Reunión Colegiada** (Módulo MOD-02).
3. Un **Acuerdo Institucional** (Módulo MOD-03).
4. Un **Acta Oficial** (Módulo MOD-02).

El principio de **Privacidad Heredada** exige que el nivel de confidencialidad del documento adjunto replique con exactitud las reglas de visibilidad de la entidad padre.

---

### 2. AUDITORÍA DE VÍNCULO CON NOTAS PERSONALES (`PersonalNote`)

Se evaluó la regla de herencia implementada en [`documents.service.ts`](file:///d:/MexAgenda/apps/backend/src/modules/documents/documents.service.ts):

#### A. Notas con Visibilidad `PRIVADA` (Auditado y Aprobado):
- **Regla:** El documento adjunto pertenece exclusivamente al redactor de la nota.
- **Verificación:** Cuando `doc.personalNote.visibility === 'PRIVADA'`, el sistema compara el `userId` solicitante contra `doc.personalNote.userId`. Si no coinciden y el usuario no ostenta `ROLE_ADMIN`, se emite de inmediato un `ForbiddenException`.
- **Eficacia:** **100% EFECTIVA**. No existe fuga de información en adjuntos clasificados como privados.

---

### 3. IDENTIFICACIÓN Y REGISTRO DEL HALLAZGO `FIND-06-01`

Durante el análisis del flujo de resolución de permisos para notas con visibilidad `REUNION` y documentos vinculados directamente a `meetingId`:

#### Descripción de la Vulnerabilidad:
En `DocumentsService.findOne()` y en el método de listado `findAll()`:
```typescript
if (doc.personalNote && doc.personalNote.visibility === 'PRIVADA') {
  if (doc.personalNote.userId !== user.id && user.role !== 'ROLE_ADMIN') {
    throw new ForbiddenException('No tiene permisos para acceder a este documento adjunto');
  }
}
// NOTA DE AUDITORÍA: Si visibility === 'REUNION' o si existe doc.meetingId,
// el código NO consulta la tabla 'meeting_participants' para verificar si el
// usuario solicitante fue efectivamente convocado a dicha sesión colegiada.
```

#### Impacto Institucional:
- Un usuario institucional autenticado (`ROLE_USER`), que **NO fue convocado ni forma parte de una reunión colegiada reservada**, podría listar y descargar un documento adjunto vinculado a dicha sesión o a una nota compartida de la sesión, siempre que conozca el identificador del adjunto o liste la bóveda general.
- Este comportamiento hereda directamente la observación histórica de Fase 5 (`FIND-05-02`), donde la validación de participantes en base de datos quedó delegada a nivel de aplicación general.

#### Ficha del Hallazgo `FIND-06-01`:
- **Código:** `FIND-06-01`
- **Clasificación:** **MEDIA (Medium)**
- **Componente:** `apps/backend/src/modules/documents/documents.service.ts`
- **Vector:** BOLA / Permisividad de visibilidad colegiada transversal.
- **Evidencia Reproducible:** Un usuario que no pertenece al comité de una reunión privada puede invocar `GET /api/documents/:id` de un anexo de dicha reunión y obtener respuesta HTTP 200 en lugar de HTTP 403.
- **Plan de Remediación Recomendado:**
  Incorporar una verificación explícita en la consulta de base de datos o en la validación del servicio:
  ```typescript
  if (doc.meetingId || (doc.personalNote && doc.personalNote.visibility === 'REUNION')) {
    const targetMeetingId = doc.meetingId || doc.personalNote.meetingId;
    if (targetMeetingId && user.role !== 'ROLE_ADMIN') {
      const isParticipant = await this.prisma.meetingParticipant.findFirst({
        where: { meetingId: targetMeetingId, userId: user.id },
      });
      if (!isParticipant && doc.uploadedById !== user.id) {
        throw new ForbiddenException('No es participante autorizado de la sesión a la que pertenece este adjunto.');
      }
    }
  }
  ```

---

### 4. AUDITORÍA DE VÍNCULO CON ACUERDOS Y ACTAS OFICIALES

- **Acuerdos Institucionales (`Agreement`):** Los acuerdos institucionales en MexAgenda son de naturaleza pública interna para todos los usuarios con rol colegiado. El acceso a anexos vinculados a acuerdos (`agreementId IS NOT NULL`) es consistente con la política institucional de transparencia de acuerdos aprobada en Fase 4.
- **Actas Oficiales (`Minutes`):** Los adjuntos a actas oficiales publicadas son accesibles para miembros con permisos de lectura institucional (`document:read`), preservando la integridad del acta.

**Dictamen de Privacidad Heredada:** El módulo protege con éxito absoluto la privacidad de notas personales individuales, pero requiere la subsanación de `FIND-06-01` para sellar la herencia de participantes en reuniones cerradas.


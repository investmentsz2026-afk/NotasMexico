# DOCUMENTO 08: MATRIZ DE ROLES Y CONTROL DE ACCESO (RBAC/ABAC)
## Sistema Privado de Gestión Institucional (MexAgenda)
**Fase:** 0 — Análisis, Planificación y Especificación Técnica  
**Versión:** 1.0.0  
**Fecha:** Noviembre 2026  
**Estado:** Para Revisión y Aprobación  

---

## 1. INTRODUCCIÓN Y MODELO DE AUTORIZACIÓN

El sistema implementa un modelo híbrido de **Control de Acceso Basado en Roles (RBAC - Role-Based Access Control)** complementado con **Control de Acceso Basado en Atributos / Posesión de Recursos (ABAC - Attribute-Based Access Control)** para la soberanía de anotaciones y documentos.

### Principio Fundamental:
> **La autorización se evalúa y decide exclusivamente en el backend (NestJS).**  
> Ninguna interfaz gráfica, componente oculto o menú deshabilitado en Next.js sustituye ni exime la validación de permisos en el servidor. La manipulación de parámetros HTTP, identificadores en rutas o payloads siempre es contrastada contra el contexto de la sesión y la base de datos.

---

## 2. CATÁLOGO DE ROLES INSTITUCIONALES

| Rol | Código | Propósito y Alcance |
|---|---|---|
| **Administrador Institucional** | `ROLE_ADMIN` | Control total del sistema: gestión de usuarios, taxonomías, configuración de seguridad, supervisión de auditoría y facultad de intervención extraordinaria en notas ajenas con justificación y trazabilidad. |
| **Usuario Institucional (Consejero)** | `ROLE_USER` | Integrante de la institución con voz y voto: consulta de reuniones, convocatorias, redacción de notas propias, lectura de notas ajenas, carga de anexos y gestión de acuerdos asignados. |

### Extensibilidad Futura:
El diseño relacional permite añadir sin cambios estructurales roles como:
- `ROLE_SECRETARY` (Secretario Técnico: gestión de actas oficiales y asistencias sin permisos de administración de usuarios).
- `ROLE_AUDITOR` (Auditor Externo: acceso de solo lectura estricta a reuniones, anexos y bitácora de auditoría sin facultades de edición).

---

## 3. CATÁLOGO DE PERMISOS GRANULARES DE RECURSO

| Código de Permiso | Módulo | Descripción Operativa |
|---|---|---|
| `auth:mfa_reset` | Seguridad | Restablecer factores MFA de usuarios con justificación. |
| `user:create` | Usuarios | Aprovisionar nuevas cuentas de integrantes. |
| `user:read` | Usuarios | Consultar el directorio institucional y perfiles de usuario. |
| `user:update` | Usuarios | Modificar datos institucionales de usuarios. |
| `user:status_change` | Usuarios | Activar, suspender (`INACTIVO`) o bloquear cuentas. |
| `user:sessions_revoke`| Usuarios | Invalidar sesiones activas de cualquier usuario. |
| `category:manage` | Categorías | Crear, editar, activar, inactivar y ordenar clasificaciones. |
| `meeting:create` | Reuniones | Convocar y programar nuevas sesiones de trabajo. |
| `meeting:read` | Reuniones | Consultar la información compartida y orden del día de reuniones. |
| `meeting:update` | Reuniones | Modificar datos generales, agenda y minutas colaborativas. |
| `meeting:status_change`| Reuniones | Finalizar, cancelar o archivar formalmente una reunión. |
| `note:create` | Anotaciones | Redactar y publicar una anotación propia en una sesión. |
| `note:read` | Anotaciones | Leer de forma transparente las anotaciones de sus pares. |
| `note:update_own` | Anotaciones | Modificar exclusivamente el contenido de sus propias notas. |
| `note:delete_own` | Anotaciones | Archivar o eliminar lógicamente sus propias notas. |
| `note:override_any` | Anotaciones | Intervención administrativa extraordinaria sobre notas ajenas (auditada). |
| `agreement:create` | Acuerdos | Formalizar compromisos institucionales derivados de reuniones. |
| `agreement:read` | Acuerdos | Consultar el tablero y catálogo histórico de acuerdos. |
| `agreement:update` | Acuerdos | Actualizar estado, comentarios y avances de acuerdos asignados. |
| `document:upload` | Documentos | Subir archivos a reuniones o notas autorizadas. |
| `document:download` | Documentos | Solicitar URLs pre-firmadas para descarga o lectura de anexos. |
| `document:delete_own` | Documentos | Marcar como borrado lógico un documento propio. |
| `document:delete_any` | Documentos | Borrado lógico administrativo de anexos con registro auditado. |
| `audit:read` | Auditoría | Consultar y exportar la bitácora inmutable de eventos. |
| `dashboard:admin_read`| Dashboard | Visualizar analítica y métricas globales de gestión. |

---

## 4. MATRIZ FORMAL RBAC (ROLES VS. PERMISOS)

```
Leyenda:
[✔] = Permitido de forma incondicional.
[OWN] = Permitido ÚNICAMENTE sobre recursos propios (ABAC: session.user_id === resource.author_id).
[AUD] = Permitido ÚNICAMENTE con Justificación Obligatoria y Registro Crítico en Auditoría.
[✖] = Expresamente Prohibido (Rechazado con HTTP 403 Forbidden).
```

| Permiso Operativo | `ROLE_ADMIN` | `ROLE_USER` |
|---|:---:|:---:|
| `auth:mfa_reset` | **[✔]** | **[✖]** |
| `user:create` | **[✔]** | **[✖]** |
| `user:read` | **[✔]** | **[✔]** (Directorio básico) |
| `user:update` | **[✔]** | **[OWN]** (Solo datos personales no críticos) |
| `user:status_change` | **[✔]** | **[✖]** |
| `user:sessions_revoke`| **[✔]** | **[OWN]** (Cerrar sus propias sesiones) |
| `category:manage` | **[✔]** | **[✖]** |
| `meeting:create` | **[✔]** | **[✔]** |
| `meeting:read` | **[✔]** | **[✔]** |
| `meeting:update` | **[✔]** | **[✔]** |
| `meeting:status_change`| **[✔]** | **[✔]** (Creador o Administrador) |
| `note:create` | **[✔]** | **[✔]** |
| `note:read` | **[✔]** | **[✔]** (Lectura abierta entre pares) |
| `note:update_own` | **[OWN]** | **[OWN]** (Estricto bloqueo cruzado) |
| `note:delete_own` | **[OWN]** | **[OWN]** |
| `note:override_any` | **[AUD]** | **[✖]** (Intento genera alerta IDOR) |
| `agreement:create` | **[✔]** | **[✔]** |
| `agreement:read` | **[✔]** | **[✔]** |
| `agreement:update` | **[✔]** | **[✔]** (Responsable o Creador) |
| `document:upload` | **[✔]** | **[✔]** |
| `document:download` | **[✔]** | **[✔]** (Sesión activa requerida) |
| `document:delete_own` | **[OWN]** | **[OWN]** |
| `document:delete_any` | **[AUD]** | **[✖]** |
| `audit:read` | **[✔]** | **[✖]** |
| `dashboard:admin_read`| **[✔]** | **[✖]** |

---

## 5. MECANISMO DE ENFORCEMENT EN EL BACKEND (NESTJS)

Para garantizar que estas reglas sean inviolables, la arquitectura backend dispone de un mecanismo de evaluación en tres niveles jerárquicos:

```
[Solicitud Entrante]
         │
         ▼
[1. SessionAuthGuard] ───────────────────────────> ¿El token es válido y el usuario está ACTIVO?
         │ (Si no: HTTP 401 Unauthorized)
         ▼
[2. PermissionsGuard] ───────────────────────────> ¿El rol del usuario posee el permiso base?
         │ (Si no: HTTP 403 Forbidden)            (ej. note:update_own o note:override_any)
         ▼
[3. Domain Ownership Check (Service Layer / ABAC)] > Si la acción es sobre un recurso existente:
         │                                         ¿El `author_id` coincide con `session.user_id`?
         │                                         O si es Admin, ¿se proveyó la justificación?
         ▼
[Ejecución de la Transacción en Base de Datos]
```

### Pseudocódigo de Control en el Servicio de Anotaciones (`NotesService`):
```typescript
async updateNote(
  noteId: string, 
  dto: UpdateNoteDto, 
  currentUser: AuthenticatedUser
): Promise<PersonalNote> {
  const note = await this.prisma.personalNote.findUnique({
    where: { id: noteId },
  });

  if (!note) {
    throw new NotFoundException(`Anotación con ID ${noteId} no encontrada`);
  }

  // 1. Caso normal: El autor original modifica su propia nota
  if (note.authorId === currentUser.id) {
    return this.executeStandardNoteUpdate(note, dto, currentUser);
  }

  // 2. Caso extraordinario: Intervención administrativa
  if (currentUser.role === 'ROLE_ADMIN') {
    if (!dto.adminJustification || dto.adminJustification.trim().length < 15) {
      throw new BadRequestException(
        'Toda intervención administrativa sobre anotaciones ajenas exige una justificación formal institucional de al menos 15 caracteres.'
      );
    }
    return this.executeAdminOverride(note, dto, currentUser);
  }

  // 3. Intento no autorizado (Usuario B intentando modificar nota de Usuario A)
  await this.auditService.logSecurityAlert({
    actorId: currentUser.id,
    action: 'UNAUTHORIZED_NOTE_MUTATION_ATTEMPT',
    entity: 'PersonalNote',
    entityId: noteId,
    details: { targetAuthorId: note.authorId },
  });

  throw new ForbiddenException(
    'Violación de Soberanía: No tiene autorización para modificar anotaciones redactadas por otro integrante.'
  );
}
```


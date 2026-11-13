# HISTORIAL INMUTABLE Y AUDITORÍA FORENSE — MOD-04
## MexAgenda: Trazabilidad Integral de Anotaciones Institucionales

### 1. MODELO DE DOBLE CAPA DE TRAZABILIDAD

Para satisfacer los requerimientos de auditoría y transparencia de la administración pública, el módulo MOD-04 implementa dos niveles complementarios de registro histórico:

```
[ACCIÓN DEL USUARIO] -> NotesService
                             |
         +-------------------+-------------------+
         |                                       |
         v                                       v
[CAPA 1: SNAPSHOT DE NEGOCIO]           [CAPA 2: AUDITORÍA FORENSE]
Tabla: personal_note_versions           Tabla: audit_logs
- Instantánea íntegra del contenido     - Actor institucional (actorId)
- Título y categoría archivados         - Dirección IP y User-Agent
- Motivo del cambio / Justificación     - Acción normalizada (NOTE_*)
- Bandera isAdminIntervention           - Resultado (SUCCESS / DENIED)
- Identificador del editor              - Payload sanitizado (sin credenciales)
```

---

### 2. SNAPSHOTS INMUTABLES EN `personal_note_versions`

Cada vez que una anotación sufre una modificación (ya sea por su autor original o mediante intervención extraordinaria), el servicio ejecuta de forma obligatoria la creación de un asiento en `personal_note_versions`:

1. **Captura del Estado Previo:** Se toma una fotografía exacta del registro antes de aplicar los nuevos valores:
   ```typescript
   await this.prisma.personalNoteVersion.create({
     data: {
       personalNoteId: note.id,
       versionNumber: note.version,
       titleSnapshot: note.title,
       contentSnapshot: note.content,
       categorySnapshot: note.category,
       modifiedById: user.id,
       changeReason: dto.changeReason?.trim() || 'Modificación ordinaria del autor',
       adminJustification: dto.adminJustification || null,
       isAdminIntervention: isAdminInterventionBool,
     },
   });
   ```
2. **Incremento Monótono de Versión:** La nota principal incrementa su contador de versión (`version: { increment: 1 }`).
3. **Inmutabilidad Absoluta:** No existe ningún controlador, servicio ni endpoint REST que permita la edición o eliminación de registros individuales en `personal_note_versions`. Los registros son estrictamente de solo inserción (*append-only*).

---

### 3. EVENTOS EN LA BITÁCORA FORENSE CENTRALIZADA (`audit_logs`)

Todas las operaciones del módulo se encuentran vinculadas al `AuditService` de MexAgenda, registrando eventos indelebles en la tabla `audit_logs`:

| Evento | Acción | Severidad | Resultado | Descripción del Payload |
| :--- | :--- | :---: | :---: | :--- |
| Creación | `NOTE_CREATED` | INFO | `SUCCESS` | Título, categoría, visibilidad, tipo y vínculos institucionales. |
| Modificación Autor | `NOTE_UPDATED` | INFO | `SUCCESS` | Versión previa, nueva versión y motivo del cambio. |
| Intervención Extraordinaria | `NOTE_ADMIN_OVERRIDE` | **CRITICAL** | `SUCCESS` | Justificación (>= 15 chars), autor afectado, campos intervenidos. |
| Intento No Autorizado | `UNAUTHORIZED_NOTE_MUTATION_ATTEMPT` | WARNING | `DENIED` | Atacante, autor destino y motivo del rechazo. |
| Intento de Baja Ajena | `UNAUTHORIZED_NOTE_DELETION_ATTEMPT` | WARNING | `DENIED` | Solicitante no propietario y nota objetivo. |
| Archivado | `NOTE_ARCHIVED` | INFO | `SUCCESS` | Identificador de nota enviada a papelera. |
| Restauración | `NOTE_RESTORED` | INFO | `SUCCESS` | Identificador de nota recuperada de papelera. |
| Eliminación Definitiva | `NOTE_PERMANENTLY_DELETED` | WARNING | `SUCCESS` | Depuración administrativa con cascada de versiones. |

---

### 4. SANITIZACIÓN AUTOMÁTICA DE DATOS SENSIBLES

El servicio `AuditService` aplica inspección y sanitización recursiva sobre el payload antes de persistir en Neon PostgreSQL. Cualquier clave sensible coincidente con la lista negra institucional (`password`, `token`, `secret`, `key`, `code`, etc.) es reemplazada automáticamente por la marca `[REDACTADO]`, impidiendo fugas de información confidencial en los registros forenses.


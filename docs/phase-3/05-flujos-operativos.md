# 05 — Flujos Operativos y Procesos de Negocio Colegiado

## 1. Flujo Integral de una Sesión Colegiada

El siguiente diagrama describe el ciclo de vida completo desde la planificación de la reunión hasta la consolidación del acta aprobada y su eventual archivado en el acervo institucional:

```mermaid
sequenceDiagram
    autonumber
    actor Convocador as Convocador Institucional
    actor Consejero as Integrante Colegiado
    actor Mesa as Presidencia / Secretaría
    participant Sistema as MexAgenda Platform
    participant DB as Neon PostgreSQL

    Note over Convocador,DB: 1. PROGRAMACIÓN Y CONVOCATORIA
    Convocador->>Sistema: Crea reunión (Categoría, fecha, horas, recinto)
    Sistema->>DB: Inserta Meeting (status=PROGRAMADA, genera folio)
    Convocador->>Sistema: Define Orden del Día y Padrón de Integrantes
    Sistema->>DB: Inserta AgendaItems y Participants
    Convocador->>Sistema: Publica Convocatoria Oficial
    Sistema->>DB: Inserta Convocatoria, congela padrón y actualiza status=CONVOCADA

    Note over Consejero,DB: 2. DESARROLLO DE LA SESIÓN EN VIVO
    Mesa->>Sistema: Apertura formal de Sesión
    Sistema->>DB: Actualiza status=EN_DESARROLLO, registra realStartTime y log INICIO
    Mesa->>Sistema: Pase de lista de asistencia (Presente, Justificado, etc.)
    Sistema->>DB: Actualiza AttendanceStatus y registra en MeetingAttendanceHistory
    Mesa->>Sistema: Desahogo de puntos del Orden del Día
    Sistema->>DB: Marca AgendaItem isTreated=true y genera log en bitácora
    Mesa->>Sistema: Asienta deliberaciones, recesos o mociones
    Sistema->>DB: Inserta MeetingSessionLog
    Mesa->>Sistema: Clausura formal de Sesión
    Sistema->>DB: Actualiza status=FINALIZADA, registra realEndTime y log CIERRE

    Note over Mesa,DB: 3. DOCUMENTACIÓN, ACTA Y VERSIONAMIENTO
    Mesa->>Sistema: Redacta Acta Institucional (Borrador / Revisión)
    Sistema->>DB: Inserta MeetingMinutes (status=EN_REVISION, version=1)
    Mesa->>Sistema: Aprueba formalmente el Acta Institucional
    Sistema->>DB: Actualiza status=APROBADA, registra approvedAt y approvedById

    opt Modificación posterior a la Aprobación (MIN-006)
        Mesa->>Sistema: Edita Acta Aprobada indicando motivo del cambio
        Sistema->>DB: Archiva snapshot previo en MeetingMinutesVersion (v1)
        Sistema->>DB: Actualiza MeetingMinutes a version=2 con Fe de Erratas
    end

    Note over Convocador,DB: 4. ARCHIVADO HISTÓRICO
    Convocador->>Sistema: Archiva sesión formalmente
    Sistema->>DB: Actualiza status=ARCHIVADA (Preservación inmutable)
```

---

## 2. Puntos Clave de Control Reglamentario

1. **Quórum y Porcentaje de Asistencia:**
   - La plataforma calcula en tiempo real el porcentaje colegiado:
     $$\text{Porcentaje} = \left(\frac{\text{Presentes} + \text{Tardanzas} + \text{Remotos}}{\text{Total Convocados}}\right) \times 100$$
   - Permite a la mesa directiva determinar la validez legal de los acuerdos antes de dar apertura.

2. **Cédula Notificatoria Inalterable:**
   - Una vez publicada la convocatoria, el texto de la notificación y el listado de personas destinatarias quedan sellados. Cualquier ajuste de fecha posterior requiere una circular o adenda registrada en las observaciones de la sesión.

3. **Bitácora Inmutable en Vivo:**
   - Durante la sesión, la secretaría asienta los sucesos relevantes. Las entradas en `MeetingSessionLog` no permiten edición física ni eliminación, conformando el testimonio fidedigno de lo acontecido para la elaboración posterior del acta.

4. **Versionamiento Histórico de Actas (MIN-006):**
   - Una vez aprobada un acta, cualquier corrección de estilo, aclaración de voto o fe de erratas crea obligatoriamente un registro histórico inmutable en `meeting_minutes_versions`. El expediente conserva siempre el documento original aprobado y la traza de versiones con el usuario responsable y la justificación institucional.


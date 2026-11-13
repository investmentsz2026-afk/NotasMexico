# AUDITORÍA DEL HISTORIAL Y SNAPSHOTS INMUTABLES — FASE 5
## Módulo MOD-04: Anotaciones Personales y Notas de Sesión

### 1. OBJETIVO DE LA AUDITORÍA DE SNAPSHOTS

Evaluar la integridad, veracidad y garantías de inmutabilidad de la tabla `personal_note_versions` como mecanismo probatorio y de control de cambios institucional.

---

### 2. MECÁNICA DE CAPTURA DE INSTANTÁNEAS

Se verificó el flujo de captura de snapshots mediante inspección del código fuente y pruebas dinámicas en Neon PostgreSQL:

1. **Lectura Previa del Estado:** Antes de aplicar cualquier modificación a `personal_notes`, el servicio recupera el registro existente con sus valores exactos.
2. **Generación del Snapshot:** Se inserta una tupla en `personal_note_versions` con:
   - `personalNoteId`: UUID de la nota.
   - `versionNumber`: Versión actual que está por ser reemplazada (ej. versión 1).
   - `titleSnapshot`: Título exacto en dicha versión.
   - `contentSnapshot`: Texto íntegro sin truncamiento.
   - `categorySnapshot`: Clasificación temática archivada.
   - `modifiedById`: UUID del usuario que ejecuta la acción (autor o interventor).
   - `changeReason`: Justificación declarada del cambio.
   - `isAdminIntervention`: `true` si es intervención administrativa; `false` en caso ordinario.
   - `adminJustification`: Fundamento legal en caso de intervención.
3. **Avance Monótono de Versión:** La nota principal incrementa su contador `version` a `N + 1`.
4. **Verificación de Inexistencia de Sobrescritura Silenciosa:** Se demostró mediante la prueba `IMMUT-AUDIT-01` que ningún cambio se efectúa en la nota sin que quede asentada previamente su versión histórica.

---

### 3. TRES NIVELES DE INMUTABILIDAD: ANÁLISIS CRÍTICO

El prompt maestro de auditoría exige distinguir con rigor técnico tres dimensiones de protección:

```
+-----------------------------------------------------------------------------------+
|               NIVEL A: PROTECCIÓN A NIVEL DE APLICACIÓN (NestJS)                  |
| Estado: IMPLEMENTADA AL 100%.                                                     |
| Evidencia: No existe ningún controlador, ruta, servicio ni método que exponga     |
| operaciones UPDATE o DELETE sobre personal_note_versions.                         |
+-----------------------------------------------------------------------------------+
|               NIVEL B: PERMISOS Y RESTRICCIONES DE POSTGRESQL                     |
| Estado: PARCIALMENTE IMPLEMENTADA.                                                |
| Evidencia: Llaves foráneas con ON DELETE CASCADE hacia personal_notes garantizan  |
| integridad estructural, pero el rol de conexión a base de datos (neondb_owner)   |
| posee privilegios DML plenos sobre el esquema público.                            |
+-----------------------------------------------------------------------------------+
|               NIVEL C: INMUTABILIDAD REAL A NIVEL MOTOR (TRIGGERS)                |
| Estado: PENDIENTE DE AUTORIZACIÓN (OBS-04-01 VIGENTE).                            |
| Evidencia: No existen triggers BEFORE UPDATE OR DELETE en Neon que bloqueen       |
| modificaciones manuales directas ejecutadas desde consolas de administración SQL. |
+-----------------------------------------------------------------------------------+
```

> [!NOTE]
> **Dictamen del Comité sobre Inmutabilidad:** MexAgenda garantiza la inmutabilidad de los snapshots **a nivel de aplicación institucional y API REST**. Para declarar "inmutabilidad absoluta a nivel de motor de datos", se requiere implementar los triggers evaluados en la observación heredada `OBS-04-01`.

---

### 4. AUDITORÍA DE TRANSACCIONALIDAD (HALLAZGO `FIND-05-01`)

Durante la inspección de los métodos `update` y `adminIntervene` en [`NotesService`](file:///d:/MexAgenda/apps/backend/src/modules/notes/notes.service.ts), el Comité detectó la siguiente estructura:

```typescript
// Líneas 498-528 de notes.service.ts:
// 1. Guardar snapshot inmutable de la versión previa
await this.prisma.personalNoteVersion.create({
  data: { ... }
});

// 2. Actualizar registro incrementando versión
const updatedNote = await this.prisma.personalNote.update({
  where: { id },
  data: { ... }
});
```

#### Análisis del Hallazgo `FIND-05-01`:
- **Severidad:** **MEDIA**.
- **Descripción:** Ambas operaciones se ejecutan de manera secuencial mediante dos promesas `await` independientes, sin estar contenidas dentro de una transacción atómica `this.prisma.$transaction([...])`.
- **Riesgo:** Si ocurriera un fallo de conectividad o reinicio del pod de backend exactamente después de que `personalNoteVersion.create` concluya y antes de que `personalNote.update` se complete, se generaría un snapshot huérfano con una versión adelantada que no coincidiría con el estado de la nota principal.
- **Contraste:** En el método `deletePermanently` el agente implementador sí utilizó `this.prisma.$transaction`, lo que demuestra que la técnica es conocida pero fue omitida en `update` y `adminIntervene`.
- **Recomendación de Remediación:**
  Envolver ambas operaciones en una transacción interactiva:
  ```typescript
  await this.prisma.$transaction(async (tx) => {
    await tx.personalNoteVersion.create({ ... });
    await tx.personalNote.update({ ... });
  });
  ```

---

### 5. CONCLUSIÓN DEL CAPÍTULO DE HISTORIAL

La bitácora histórica de versiones en `personal_note_versions` satisface plenamente los requisitos de auditoría institucional y no presenta fugas de inmutabilidad en la API REST. Se emite la recomendación `FIND-05-01` para asegurar atomicidad ACID en futuras revisiones.


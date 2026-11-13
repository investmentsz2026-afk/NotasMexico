# 05. FLUJOS OPERATIVOS INSTITUCIONALES (MOD-03)
## MexAgenda — Sistema Privado de Gestión Institucional

### 1. Introducción y Propósito

El módulo **MOD-03** normaliza la gestión colegiada de acuerdos institucionales en apego a los principios de legalidad, transparencia, eficiencia y rendición de cuentas de la administración pública en México.

A continuación se detallan los procedimientos institucionales paso a paso que rigen el ciclo de vida de los acuerdos.

---

### 2. Flujo 1: Emisión y Registro Colegiado del Acuerdo

```
[Sesión Colegiada Aprobada] ──▶ [Punto de Orden del Día Tratado]
                                          │
                                          ▼
                         [Secretaría Técnica / Moderador]
                                          │
                                          ▼
                         [Captura en /agreements/new]
                                          │
                    ┌─────────────────────┴─────────────────────┐
                    ▼                                           ▼
          [Validaciones Backend]                     [Generación de Folio]
     - Sesión válida no cancelada              - Formato: ACU-[PRE]-[AÑO]-[SEQ]
     - Titular responsable ACTIVO              - Transacción concurrente segura
                    │                                           │
                    └─────────────────────┬─────────────────────┘
                                          ▼
                          [Acuerdo Creado: PENDIENTE]
                               (Progreso inicial: 0%)
```

1. **Origen Institucional:** Durante o al concluir una sesión plenaria (MOD-02), la Secretaría Técnica o el Administrador accede a la vista `/agreements/new` o pulsa "Crear Acuerdo" directamente desde el expediente de la reunión.
2. **Captura de Parámetros:** Se selecciona la reunión convocante, el punto específico del orden del día (opcional si es un acuerdo plenario general), el tipo de acuerdo (`ORDINARIO`, `EXTRAORDINARIO`, `NORMATIVO`, `ADMINISTRATIVO`), la prioridad institucional (`BAJA`, `MEDIA`, `ALTA`, `URGENTE`), la fecha compromiso (`dueDate`) y el servidor público responsable.
3. **Consignación Transaccional:** El backend valida que la reunión no se encuentre cancelada y que el responsable sea un usuario activo. Se genera el folio institucional de forma automática e incremental (`ACU-SEC-2026-0001`) y se almacena con estado `PENDIENTE`.

---

### 3. Flujo 2: Asignación y Coadyuvancia Institucional

1. **Designación del Responsable Titular:**  
   Todo acuerdo cuenta con un único titular directo responsable del cumplimiento de la instrucción colegiada.
2. **Reasignación de Titularidad:**  
   Si las necesidades operativas o cambios orgánicos lo demandan, un usuario con permiso `agreement:assign` puede reasignar el acuerdo vía `/agreements/:id/assign`.
   - **Requisito Obligatorio:** Fundamentación formal (`justification`).
   - Si el nuevo responsable formaba parte del equipo de colaboradores, el sistema lo promueve a titular y lo remueve automáticamente de la lista de colaboradores para evitar inconsistencias relacionales.
3. **Incorporación de Colaboradores Coadyuvantes:**  
   El titular puede apoyarse en un equipo de colaboradores institucionales. La asignación se realiza mediante `/agreements/:id/collaborators` especificando el rol operativo desempeñado.
   - **Restricción de Integridad:** El sistema prohíbe explícitamente agregar al propio responsable titular como colaborador.

---

### 4. Flujo 3: Registro Periódico de Avances (0% a 100%)

1. **Reporte Operativo:** El titular asignado o los colaboradores autorizados registran avances en la pestaña "Avances" del expediente (`/agreements/[id]`).
2. **Datos del Reporte:**  
   - Nuevo porcentaje de avance acumulado (entero de 0 a 100).
   - Bitácora narrativa detallada de acciones implementadas (`description`).
3. **Efecto en el Estado Operativo:**  
   - Si el acuerdo se encontraba en estado `PENDIENTE` y el nuevo porcentaje es mayor a 0%, el sistema transiciona automáticamente a `EN_PROCESO`.
   - El acuerdo actualiza su campo `currentProgress`.

---

### 5. Flujo 4: Procedimiento Especial de Reducción de Avance

En la práctica institucional pueden presentarse contingencias (observaciones de auditoría, dictámenes técnicos desfavorables o replanteamiento de proyectos) que obliguen a reducir el porcentaje reportado previamente:

1. **Detección Automática:** Al enviar un avance donde `newPercent < currentProgress`, el sistema detecta un decremento.
2. **Exigencia de Justificación:** El campo `justification` se convierte en un requerimiento no subsanable (mínimo 5 caracteres).
3. **Bloqueo Preventivo:** Si la justificación es omitida o contiene caracteres vacíos, el backend aborta la transacción arrojando un error `400 Bad Request`.
4. **Asiento Inmutable:** La bitácora `agreement_history` registra la reducción, almacenando el valor anterior, el nuevo valor y la justificación institucional indeleble.

---

### 6. Flujo 5: Certificación y Formalización del Cumplimiento (Regla de Oro)

```
+--------------------------------------------------------------------------+
|                  REGLA DE ORO DE CUMPLIMIENTO INSTITUCIONAL              |
|                                                                          |
|     El registro del 100% de avance por parte del responsable operativo   |
|         NO transmuta automáticamente el estado a CUMPLIDO.               |
|                                                                          |
|       El cumplimiento exige un acto formal y deliberado de validación    |
|             por la autoridad competente vía el endpoint /complete.       |
+--------------------------------------------------------------------------+
```

1. **Finalización Técnica:** El responsable reporta el `100%` de avance, describiendo la entrega de los trabajos. El acuerdo permanece en estado `EN_PROCESO`.
2. **Revisión Colegiada:** La autoridad convocante o el Administrador analiza las evidencias aportadas.
3. **Formalización Colegiada:** Se ejecuta la acción "Formalizar Cumplimiento" (`POST /agreements/:id/complete`):
   - Se capturan las notas formales de resolución (`resolutionNotes`).
   - El estado del acuerdo cambia a `CUMPLIDO`.
   - Se sella la fecha de cierre `closedAt = NOW()`.
   - El expediente entra en estado de solo lectura. Quedan bloqueadas adiciones de avance, modificaciones generales o reasignaciones.

---

### 7. Flujo 6: Suspensión Temporal y Reactivación

#### 7.1. Suspensión Temporal
- **Causas Institucionales:** Contingencias legales, vedas electorales, falta de liquidez presupuestal o instrucciones judiciales.
- **Acción:** `POST /agreements/:id/suspend`.
- **Requisitos:** Fundamentación obligatoria (`justification`).
- **Consecuencias:** El acuerdo pasa a `SUSPENDIDO`. Los plazos de cómputo para semáforo de vencimiento quedan pausados y no admite nuevos registros de avance hasta su formal reactivación.

#### 7.2. Reactivación Formal
- **Acción:** `POST /agreements/:id/reactivate`.
- **Efecto:**
  - Si el acuerdo contaba con `currentProgress > 0`, retorna a `EN_PROCESO`.
  - Si el acuerdo contaba con `currentProgress = 0`, retorna a `PENDIENTE`.
  - Se reactiva la evaluación del semáforo temporal.

---

### 8. Flujo 7: Cancelación Definitiva e Inmutable

- **Causas Institucionales:** Pérdida de materia del acuerdo, sustitución por un nuevo mandato del pleno o nulidad administrativa.
- **Acción:** `POST /agreements/:id/cancel` (Requiere permiso `agreement:cancel`).
- **Requisito:** Fundamentación legal obligatoria (`justification`).
- **Consecuencias:**
  - El acuerdo pasa al estado terminal `CANCELADO`.
  - Cesa cualquier obligación de seguimiento.
  - Ninguna operación de avance, asignación o modificación es permitida sobre un acuerdo cancelado.
  - El expediente permanece accesible para consulta histórica y fiscalización por parte de los órganos de control.

---

### 9. Flujo 8: Incorporación de Evidencias Documentales

1. **Referenciación:** En cumplimiento con la delimitación de la Fase 4 (previo a la bóveda física S3 de la Fase 6), las evidencias se integran como referencias formales de expedientes, oficios, decretos o hipervínculos internos.
2. **Acción:** `POST /agreements/:id/evidences`.
3. **Registro:** Se documenta el folio del documento oficial (`documentReference`), descripción contextual y el servidor público que registra la evidencia.


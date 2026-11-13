# MANUAL FUNCIONAL Y OPERATIVO — MOD-04
## Guía de Usuario y Administración de Anotaciones Institucionales

### 1. INTRODUCCIÓN

El módulo **MOD-04: Anotaciones Personales y Notas de Sesión** permite a los servidores públicos de la institución documentar reflexiones de trabajo, observaciones técnicas y apuntes durante las sesiones de los órganos colegiados.

---

### 2. GUÍA OPERATIVA PARA EL SERVIDOR PÚBLICO

#### A. Acceso al Módulo
1. Inicie sesión en MexAgenda con sus credenciales institucionales y segundo factor de autenticación (MFA).
2. En la barra de navegación superior, haga clic en el botón **Anotaciones** (icono de libro abierto).
3. Se desplegará el catálogo principal con las pestañas: *Todas mis notas*, *Notas de Sesión*, *Favoritas* y *Archivadas / Papelera*.

#### B. Redacción de una Nueva Anotación
1. En el catálogo principal, haga clic en el botón **+ Nueva Anotación**.
2. Complete los campos obligatorios:
   - **Título Institucional:** Sintetice el asunto de la nota (ej. *Observaciones a la minuta de la Comisión de Hacienda*).
   - **Cuerpo y Detalle:** Redacte las notas o comentarios pertinentes.
3. Configure los metadatos institucionales:
   - **Categoría Temática:** Seleccione la clasificación adecuada (`GENERAL`, `JURIDICO`, `TECNICO`, `PRESUPUESTAL`, `ACUERDO`, `SESION`, `SEGUIMIENTO`).
   - **Tipo de Nota:** Indique si se trata de una nota personal, de sesión colegiada, observación técnica o asunto pendiente.
   - **Nivel de Visibilidad:**
     - *Privada:* Exclusivamente visible para usted.
     - *Reunión:* Compartida con los integrantes convocados a la sesión vinculada.
     - *Pública:* Consultable por cualquier servidor público acreditado en la institución.
   - **Vinculaciones Opcionales:** Si la nota deriva de una reunión o acuerdo, seleccione la sesión correspondiente en el menú desplegable.
   - **Etiquetas:** Ingrese palabras clave separadas por coma para facilitar búsquedas futuras.
4. Haga clic en **Guardar Anotación**. El sistema creará la versión 1 de la nota y lo redirigirá al expediente.

#### C. Edición Ordinaria de una Anotación Propia
1. En el expediente de la nota (`/notes/[id]`), haga clic en **Editar Anotación**.
2. Modifique el título, categoría, visibilidad o contenido.
3. Opcionalmente, ingrese una breve síntesis o motivo del cambio en el campo *Motivo o síntesis del cambio*.
4. Haga clic en **Guardar y Generar Versión**. La nota actualizará su contenido, incrementará su versión (ej. v1 -> v2) y archivará la versión previa en la pestaña *Historial de Versiones*.

#### D. Consulta del Historial de Versiones
1. En el expediente de la nota, haga clic en la pestaña **Historial de Versiones**.
2. Podrá revisar en orden cronológico inverso cada una de las versiones previas, quién la modificó, la fecha exacta y el contenido íntegro que tenía en ese momento.

#### E. Archivado y Recuperación de Notas
- **Archivar (Baja Lógica):** Haga clic en el botón **Archivar** (icono de caja). La nota se moverá a la papelera sin borrarse de la base de datos.
- **Consultar Papelera:** En el catálogo principal, seleccione la pestaña **Archivadas / Papelera**.
- **Restaurar:** En la papelera o en el expediente de la nota archivada, haga clic en **Restaurar**. La nota volverá a figurar de inmediato en el catálogo activo.

---

### 3. GUÍA OPERATIVA PARA EL ADMINISTRADOR INSTITUCIONAL

#### Protocolo de Intervención Administrativa Extraordinaria
Los administradores institucionales cuentan con la atribución extraordinaria de intervenir notas cuando exista requerimiento formal del Órgano Interno de Control, mandato judicial o necesidad de corrección institucional:

1. Ingrese a la nota correspondiente como usuario con rol `ROLE_ADMIN` o permiso `note:override_any`.
2. Al tratarse de una nota de otro autor, el sistema mostrará el botón púrpura **Intervención Administrativa**.
3. En el modal emergente:
   - Capture obligatoriamente la **Justificación Administrativa Obligatoria** (mínimo 15 caracteres explicativos, ej. *Corrección instruida mediante oficio OIC-2026-088*).
   - Ajuste el título, contenido o nivel de visibilidad según corresponda.
   - Haga clic en **Ejecutar Intervención Extraordinaria**.
4. **Consecuencias Institucionales del Procedimiento:**
   - Se crea un snapshot inmutable con la marca `isAdminIntervention = true`.
   - La nota queda identificada de manera visible e indeleble con un banner púrpura: *Nota Sujeta a Intervención Administrativa Extraordinaria*, mostrando el nombre del administrador y la justificación.
   - Se genera un registro forense en `audit_logs` con acción `NOTE_ADMIN_OVERRIDE` y severidad `CRITICAL`.


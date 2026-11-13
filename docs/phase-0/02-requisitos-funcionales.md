# DOCUMENTO 02: ESPECIFICACIÓN DE REQUISITOS FUNCIONALES (SRS)
## Sistema Privado de Gestión Institucional (MexAgenda)
**Fase:** 0 — Análisis, Planificación y Especificación Técnica  
**Versión:** 1.0.0  
**Fecha:** Noviembre 2026  
**Estado:** Para Revisión y Aprobación  

---

## 1. INTRODUCCIÓN Y NOMENCLATURA

Este documento especifica de forma rigurosa y exhaustiva los requisitos funcionales del sistema, organizados por módulos de negocio (`MOD-01` a `MOD-10`). Cada requisito cuenta con un identificador único con la siguiente convención:
`RF-[MÓDULO]-[CORRELATIVO]` (Ejemplo: `RF-AUTH-001`, `RF-NOTE-003`).

Cada requisito incluye:
- **Descripción:** Comportamiento esperado del sistema.
- **Actores involucrados:** Roles que disparan o participan en la función.
- **Precondiciones:** Estado necesario del sistema antes de la ejecución.
- **Postcondiciones:** Estado resultante y efectos secundarios (incluyendo auditoría).
- **Reglas de Negocio Específicas:** Restricciones de validación y control de acceso.

---

## 2. DESGLOSE MODULAR DE REQUISITOS FUNCIONALES

```
+-----------------------------------------------------------------------------------+
|                        MAPA MODULAR DEL SISTEMA MEXAGENDA                         |
+-----------------------------------------------------------------------------------+
| MOD-01: Autenticación, MFA y Sesiones  | MOD-02: Gestión Integral de Usuarios     |
| MOD-03: Clasificación de Reuniones     | MOD-04: Gestión del Ciclo de Reuniones   |
| MOD-05: Anotaciones y Soberanía        | MOD-06: Gestión Documental Segura        |
| MOD-07: Acuerdos, Tareas y Compromisos | MOD-08: Motor de Búsqueda e Historial    |
| MOD-09: Auditoría Forense y Eventos    | MOD-10: Dashboard Ejecutivo y Analítica  |
+-----------------------------------------------------------------------------------+
```

---

### MÓDULO 01: AUTENTICACIÓN, MFA Y GESTIÓN DE SESIONES (`MOD-01`)

#### RF-AUTH-001: Autenticación Primaria con Credenciales Únicas
- **Descripción:** El sistema autenticará a los usuarios mediante correo institucional y contraseña secreta.
- **Actores:** Cualquier usuario registrado previamente por el Administrador.
- **Reglas de Negocio:**
  - Las contraseñas deben procesarse exclusivamente mediante **Argon2id** (configuración recomendada RFC 9106: memoria = 64 MB, iteraciones = 3, paralelismo = 4).
  - La contraseña nunca debe ser almacenada, transmitida o expuesta en texto plano en logs ni respuestas de API.
  - La política de contraseñas exige: mínimo 12 caracteres, al menos una mayúscula, una minúscula, un número y un carácter especial (`!@#$%^&*()_+-=[]{}|;:,.<>?`).
  - No se permite el acceso a cuentas cuyo estado sea `INACTIVO` o `BLOQUEADO`. En tal caso, el sistema devolverá un mensaje genérico para evitar enumeración de usuarios: *"Credenciales no válidas o cuenta no disponible"*.

#### RF-AUTH-002: Autenticación Multifactor Obligatoria (MFA / TOTP)
- **Descripción:** Tras la verificación exitosa de contraseña, el sistema exigirá un segundo factor de autenticación basado en contraseñas de un solo uso por tiempo (TOTP conforme a RFC 6238, periodo de 30 segundos, código de 6 dígitos).
- **Actores:** Todos los usuarios autenticados.
- **Reglas de Negocio:**
  - El aprovisionamiento de MFA genera un secreto base32 y un código QR renderizado en pantalla para vincular con Google Authenticator, Microsoft Authenticator o gestor compatible.
  - El sistema suministrará 8 códigos de recuperación de un solo uso (*backup codes*), almacenados mediante hash criptográfico (Argon2id o SHA-256 con salt único).
  - El secreto TOTP debe almacenarse cifrado en reposo en la base de datos utilizando AES-256-GCM con una llave de cifrado maestra administrada por variables de entorno.
  - Si un usuario no ha enrolado su MFA en su primer acceso, el sistema forzará el flujo de enrolamiento antes de conceder acceso a los módulos operativos.

#### RF-AUTH-003: Gestión de Sesiones y Protección de Tokens
- **Descripción:** El sistema emitirá y gestionará sesiones de usuario mediante cookies seguras o pares de tokens con persistencia en la tabla `user_sessions`.
- **Reglas de Negocio:**
  - Cookies con atributos: `HttpOnly`, `Secure` (forzado en producción por HTTPS), `SameSite=Strict` y `Path=/`.
  - Expiración de sesión por inactividad absoluta: 30 minutos sin solicitudes authenticated.
  - Expiración de sesión máxima: 8 horas continuas (renovación de token de sesión requerida).
  - Cada sesión en la base de datos almacenará: `id` (UUIDv4), `user_id`, `token_hash`, `ip_address`, `user_agent`, `last_activity_at`, `expires_at`, `is_revoked`.

#### RF-AUTH-004: Protección contra Ataques de Fuerza Bruta y Bloqueo Temporal
- **Descripción:** El sistema monitoreará los intentos fallidos de autenticación por usuario y por dirección IP.
- **Reglas de Negocio:**
  - Tras 5 intentos fallidos consecutivos en una ventana de 15 minutos, la cuenta se bloqueará temporalmente durante 20 minutos.
  - Se emitirá una notificación de alerta a la bitácora de auditoría.
  - Un administrador podrá desbloquear manualmente la cuenta antes de la expiración temporal.
  - Implementación de *Rate Limiting* en el endpoint de autenticación (máximo 5 peticiones por minuto por IP).

#### RF-AUTH-005: Cierre de Sesión y Revocación Inmediata
- **Descripción:** El usuario podrá finalizar su sesión voluntariamente en el dispositivo actual o en todos sus dispositivos abiertos.
- **Reglas de Negocio:**
  - La llamada a `POST /auth/logout` marcará la sesión actual como `is_revoked = true` en la base de datos y limpiará las cookies del cliente.
  - El endpoint `POST /auth/logout-all` invalidará todas las sesiones activas del usuario.

#### RF-AUTH-006: Recuperación Segura de Contraseñas Gestionada por Administrador
- **Descripción:** Dado que no existe registro público ni se desea recuperación autónoma que exponga la superficie de ataque, el restablecimiento de contraseñas es gestionado mediante invitación administrativa o token criptográfico de un solo uso con vigencia de 15 minutos, entregado de forma segura y auditada.
- **Reglas de Negocio:**
  - El token es de uso único y se invalida automáticamente tras ser consumido o vencido.
  - El restablecimiento fuerza el cierre inmediato de todas las sesiones activas previas del usuario.

---

### MÓDULO 02: ADMINISTRACIÓN DE USUARIOS Y CONTROL DE ACCESO (`MOD-02`)

#### RF-USER-001: Creación de Cuentas por el Administrador
- **Descripción:** El Administrador podrá registrar nuevos integrantes institucionales en la plataforma.
- **Campos obligatorios:**
  - Correo electrónico institucional (único, validado con formato RFC 5322).
  - Nombres y Apellidos.
  - Cargo o Puesto institucional (ej. *Consejero Titular*, *Secretario Técnico*, *Director General*).
  - Rol asignado (`ADMINISTRADOR`, `USUARIO`).
  - Teléfono institucional (opcional).
- **Postcondición:** El sistema crea al usuario en estado `PENDIENTE_ACTIVACION`, genera un enlace seguro de bienvenida con token efímero y registra la acción en la bitácora de auditoría.

#### RF-USER-002: Modificación de Datos de Perfil y Estados de Cuenta
- **Descripción:** El Administrador podrá actualizar la información de los usuarios y modificar su estado operativo:
  - `ACTIVO`: Cuenta habilitada para operar.
  - `INACTIVO`: Cuenta suspendida formalmente (no puede iniciar sesión; sus datos históricos se preservan intactos).
  - `BLOQUEADO`: Cuenta bloqueada por seguridad o intervención administrativa.
- **Reglas de Negocio:**
  - Al cambiar el estado de un usuario a `INACTIVO` o `BLOQUEADO`, el sistema ejecutará en la misma transacción la revocación inmediata de todas sus sesiones activas en `user_sessions`.
  - No es posible eliminar físicamente (*hard delete*) un usuario para garantizar la integridad referencial de minutas, notas y auditoría. Se aplica exclusivamente eliminación lógica o desactivación.

#### RF-USER-003: Restablecimiento de Credenciales y MFA por Administrador
- **Descripción:** El Administrador podrá forzar el restablecimiento de contraseña de un usuario o reiniciar su enrolamiento MFA en caso de extravío de dispositivo.
- **Reglas de Negocio:**
  - Requiere justificación obligatoria en el formulario administrativo.
  - La justificación y el ID del administrador ejecutor quedan registrados en la tabla de auditoría.

#### RF-USER-004: Consulta de Historial de Actividad del Usuario
- **Descripción:** El Administrador podrá visualizar el historial cronológico de eventos generados por un usuario específico (inicios de sesión, reuniones creadas, anotaciones, documentos visualizados).

---

### MÓDULO 03: CLASIFICACIONES DE REUNIONES (`MOD-03`)

#### RF-CAT-001: Gestión Dinámica de Categorías de Reunión
- **Descripción:** El Administrador podrá crear, editar, reordenar y deshabilitar categorías de sesiones institucionales.
- **Campos:**
  - `id`: UUIDv4.
  - `name`: Nombre descriptivo (ej. *Sesión Ordinaria*, *Sesión Extraordinaria*, *Comité de Auditoría*, *Reunión de Trabajo*, *Reunión Especial*). Único en la institución.
  - `code`: Código alfanumérico para referencias (ej. `SES-ORD`, `SES-EXT`).
  - `description`: Descripción del alcance legal o reglamentario de la categoría.
  - `color_hex`: Código de color institucional para identificación visual en calendarios.
  - `display_order`: Entero para ordenamiento visual preferente.
  - `is_active`: Booleano (categorías inactivas no se muestran al crear nuevas reuniones, pero se conservan para reuniones históricas).
- **Reglas de Negocio:**
  - Prohibido codificar (*hardcode*) categorías en el frontend. Toda la lista debe poblarse dinámicamente desde el endpoint `GET /categories`.
  - No se permite la eliminación de una categoría si existen reuniones asociadas; en su lugar, se desactiva (`is_active = false`).

#### RF-CAT-002: Indicadores y Métricas por Categoría
- **Descripción:** El sistema presentará al Administrador y a los usuarios el conteo consolidado de reuniones asociadas a cada categoría activa o histórica.

---

### MÓDULO 04: GESTIÓN DEL CICLO DE VIDA DE REUNIONES (`MOD-04`)

#### RF-MEET-001: Convocatoria y Creación de Reuniones
- **Descripción:** Cualquier usuario autenticado con permisos de creación (`meeting:create`) podrá programar una nueva reunión.
- **Campos de la Reunión:**
  - `id`: UUIDv4.
  - `title`: Título de la reunión (mínimo 5, máximo 200 caracteres).
  - `category_id`: Clave foránea hacia `meeting_categories`.
  - `date`: Fecha de la reunión (`YYYY-MM-DD`).
  - `start_time`: Hora programada de inicio (`HH:mm:ss`).
  - `end_time`: Hora programada de término (`HH:mm:ss`).
  - `location`: Ubicación física (ej. *Sala de Juntas B*) o enlace a sala virtual autorizada (Teams/Meet).
  - `modality`: Modalidad (`PRESENCIAL`, `VIRTUAL`, `HIBRIDA`).
  - `description`: Resumen ejecutivo u objetivo de la sesión.
  - `agenda_topics`: Orden del día formal / temas a tratar (formato Markdown o JSON enriquecido).
  - `minutes_development`: Desarrollo formal de la sesión, transcripción o síntesis de debates.
  - `status`: Estado de la reunión:
    - `PROGRAMADA`: Convocada y pendiente de realización.
    - `EN_DESARROLLO`: Sesión activa en curso.
    - `FINALIZADA`: Sesión concluida; acuerdos y minutas consolidados.
    - `CANCELADA`: Sesión anulada antes de su ejecución.
    - `ARCHIVADA`: Sesión histórica cerrada para consulta documental.
  - `created_by_id`: ID del usuario creador.
- **Reglas de Negocio:**
  - La hora de término debe ser estrictamente posterior a la hora de inicio.
  - Cada reunión creada queda automáticamente disponible para consulta compartida por todos los usuarios autorizados de la plataforma.

#### RF-MEET-002: Actualización Colaborativa con Registro de Modificaciones
- **Descripción:** Los usuarios autorizados podrán editar los campos descriptivos de una reunión (temas tratados, desarrollo, minuta).
- **Reglas de Negocio:**
  - Para evitar sobreescritura accidental entre múltiples participantes (*lost update problem*), el sistema implementará control de concurrencia optimista mediante el campo `version` (entero incremental) o timestamp `updated_at`.
  - Si un usuario intenta guardar una versión obsoleta, el sistema rechazará la petición con un error HTTP 409 Conflict y ofrecerá al usuario el diff de cambios.
  - Toda modificación de los campos de la reunión generará un registro en `audit_logs` con el diff de campos alterados.

#### RF-MEET-003: Participantes y Convocados
- **Descripción:** El creador o administrador podrá asociar a los usuarios de la plataforma como participantes formales de la reunión, asignando roles en la sesión (*Presidente*, *Secretario*, *Vocal*, *Invitado*) y registrando asistencia (*Asistió*, *Falta justificada*, *Falta injustificada*).

---

### MÓDULO 05: ANOTACIONES INDIVIDUALES Y SOBERANÍA DE AUTORÍA (`MOD-05`)

Este es un pilar arquitectónico central del sistema. Modela la interacción deliberativa donde múltiples consejeros plasman sus razonamientos dentro de una misma sesión.

```
+-----------------------------------------------------------------------------------+
|              MÓDULO DE ANOTACIONES INDIVIDUALES - FLUJO DE SOBERANÍA              |
+-----------------------------------------------------------------------------------+
|  [Reunión #042]                                                                   |
|   ├── Anotación Consejero A: "Observación sobre el presupuesto de egresos..."    |
|   │     └── Lectura: PÚBLICA (Consejero B, C, Admin pueden leer)                  |
|   │     └── Edición: EXCLUSIVA de Consejero A (Consejero B o C son RECHAZADOS)    |
|   │     └── Intervención Admin: PERMITIDA con JUSTIFICACIÓN, AUDITADA y VERSIONADA|
|   ├── Anotación Consejero B: "Reserva de opinión respecto al artículo 4..."       |
|   │     └── Lectura: PÚBLICA (Consejero A, C, Admin pueden leer)                  |
|   │     └── Edición: EXCLUSIVA de Consejero B                                     |
|   └── Anotación Consejero C: "Pregunta formulada al auditor externo..."           |
|         └── Lectura: PÚBLICA / Edición: EXCLUSIVA de Consejero C                  |
+-----------------------------------------------------------------------------------+
```

#### RF-NOTE-001: Creación de Anotaciones Personales Vinculadas
- **Descripción:** Cualquier usuario participante podrá redactar una o varias anotaciones vinculadas a una reunión específica.
- **Campos:**
  - `id`: UUIDv4.
  - `meeting_id`: ID de la reunión.
  - `author_id`: ID del usuario que crea la nota (asignado inmutablemente desde el token de sesión autenticado, nunca desde el body de la petición).
  - `content`: Texto enriquecido / Markdown con las observaciones, argumentos o votos razonados del autor.
  - `version`: Entero incremental que inicia en 1.
  - `created_at` / `updated_at`: Marcas de tiempo ISO 8601.
  - `is_archived`: Booleano para archivo lógico.

#### RF-NOTE-002: Consulta Transparente y Compartida
- **Descripción:** Todos los usuarios autorizados de la plataforma pueden listar y leer las anotaciones de sus pares dentro de cualquier reunión a la que tengan acceso.
- **Objetivo:** Fomentar la deliberación transparente y la alineación entre consejeros.

#### RF-NOTE-003: Bloqueo Estricto de Modificación Cruzada (Anti-IDOR)
- **Descripción:** Un usuario normal (`ROLE_USER`) solo podrá modificar o eliminar sus **propias** anotaciones (`author_id == session.user_id`).
- **Reglas de Negocio:**
  - El backend validará a nivel de servicio y guardia de dominio la correspondencia estricta entre el `author_id` del registro en base de datos y el `user_id` de la sesión.
  - Si el usuario `B` intenta invocar `PUT /notes/:id` o `DELETE /notes/:id` sobre una nota cuyo autor es `A`, la petición se rechazará inmediatamente con HTTP 403 Forbidden.
  - La tentativa de manipulación no autorizada se clasificará como posible intento de ataque IDOR (*Insecure Direct Object Reference*) y se registrará en la auditoría de seguridad con nivel `WARNING`.

#### RF-NOTE-004: Versionado Obligatorio de Anotaciones
- **Descripción:** Toda actualización al contenido de una anotación creará automáticamente una entrada histórica en la tabla `personal_note_versions`.
- **Campos de la versión:**
  - `id`: UUIDv4.
  - `note_id`: ID de la anotación padre.
  - `version_number`: Número correlativo de la versión previa.
  - `content_snapshot`: Contenido exacto antes de la modificación.
  - `modified_by_id`: ID del usuario que realizó la edición.
  - `modified_at`: Marca de tiempo del cambio.
  - `change_reason`: Motivo o justificación (opcional en autor, obligatorio en intervención admin).

#### RF-NOTE-005: Intervención Administrativa Extraordinaria Auditada
- **Descripción:** El Administrador (`ROLE_ADMIN`) posee facultades de gestión para casos de fuerza mayor (ej. depuración de datos erróneos flagrantes o cumplimiento de mandatos judiciales), pero **bajo ninguna circunstancia** podrá alterar una nota ajena de forma silenciosa.
- **Reglas de Negocio:**
  - La intervención administrativa sobre una nota ajena exige:
    1. Envío obligatorio del campo `admin_justification` en el payload de la petición.
    2. Creación obligatoria de una versión histórica previa intacta en `personal_note_versions` registrando el autor original y el snapshot.
    3. Marca de agua o flag en la nota: `is_admin_modified = true` y `last_admin_intervenor_id`.
    4. Registro crítico en `audit_logs` catalogado con severidad `CRITICAL` con el texto anterior, el nuevo texto y la justificación.

---

### MÓDULO 06: GESTIÓN DOCUMENTAL Y EXPEDIENTE DIGITAL (`MOD-06`)

#### RF-DOC-001: Subida Segura de Archivos Adjuntos
- **Descripción:** Los usuarios autorizados podrán subir archivos vinculados a reuniones o a anotaciones específicas.
- **Formatos Admitidos:**
  - Documentos: PDF (`application/pdf`), DOCX (`application/vnd.openxmlformats-officedocument.wordprocessingml.document`), XLSX (`application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`).
  - Imágenes técnicas/anexos: PNG (`image/png`), JPG/JPEG (`image/jpeg`).
- **Reglas de Negocio:**
  - Límite máximo de tamaño por archivo: 25 Megabytes (MB).
  - **Validación profunda de firmas binarias (*Magic Bytes*):** El backend no confiará en la extensión de archivo ni en el header `Content-Type` enviado por el navegador. Inspeccionará los primeros bytes del archivo en un buffer de memoria antes de aceptar el almacenamiento.
  - **Saneamiento de Nombres:** El nombre original se almacena como metadato; el archivo físico se almacenará en el bucket S3 bajo una clave aleatoria UUIDv4 criptográfica (`s3://mexagenda-vault/attachments/<uuid>/<sha256>`).
  - Prohibido almacenar binarios en tablas de PostgreSQL.

#### RF-DOC-002: Almacenamiento en Bucket S3 Privado con Cifrado en Reposo
- **Descripción:** Los archivos se depositarán en almacenamiento de objetos compatible con AWS S3 con acceso público 100% bloqueado (*Block Public Access: ON*) y cifrado del lado del servidor (SSE-S3 o SSE-KMS mediante AES-256).

#### RF-DOC-003: Descarga y Visualización Mediante URLs Pre-firmadas de Vida Efímera
- **Descripción:** Ningún archivo es accesible directamente mediante URL pública.
- **Reglas de Negocio:**
  - Para descargar o previsualizar un archivo, el frontend solicitará un token/URL al endpoint `GET /attachments/:id/download-url`.
  - El backend validará que el usuario solicitante esté autenticado, activo y tenga permisos de lectura sobre la reunión correspondiente.
  - Tras la validación, el backend generará una URL pre-firmada S3 con tiempo de vida (TTL) de 10 minutos (600 segundos).
  - La emisión de la URL pre-firmada se registrará en `audit_logs` con el ID del documento, tamaño, usuario y timestamp.

#### RF-DOC-004: Versionado y Eliminación Lógica de Documentos
- **Descripción:** Si se sube una nueva versión de un anexo existente, se mantendrá la referencia al documento anterior en `attachment_versions`.
- **Reglas de Negocio:**
  - Los archivos no se borran físicamente del bucket ante una eliminación de usuario; se marcan como `is_deleted = true` (eliminación lógica).
  - La purga física solo podrá ser ejecutada por el Administrador mediante un procedimiento de ciclo de vida programado y auditado.

---

### MÓDULO 07: ACUERDOS Y SEGUIMIENTO DE COMPROMISOS (`MOD-07`)

#### RF-AGR-001: Registro de Acuerdos Vinculantes
- **Descripción:** Durante o al finalizar una reunión, los usuarios con permisos podrán registrar acuerdos formales derivados de los puntos del orden del día.
- **Campos:**
  - `id`: UUIDv4.
  - `meeting_id`: ID de la reunión de origen.
  - `code`: Folio o clave secuencial institucional (ej. `ACU-2026-042-01`).
  - `title`: Título sintético del acuerdo.
  - `description`: Redacción íntegra y vinculante del compromiso.
  - `assigned_user_id`: ID del usuario institucional responsable de la ejecución.
  - `due_date`: Fecha fatal de cumplimiento (`YYYY-MM-DD`).
  - `status`: Estado del acuerdo (`PENDIENTE`, `EN_PROCESO`, `COMPLETADO`, `CANCELADO`).
  - `completion_date`: Fecha real en la que se marca como completado.
  - `observations`: Bitácora de seguimiento y avances.

#### RF-AGR-002: Transición de Estados e Histórico de Avances
- **Descripción:** El usuario responsable o el administrador podrán actualizar el estado del acuerdo y agregar notas de avance.
- **Reglas de Negocio:**
  - Toda transición de estado (ej. de `EN_PROCESO` a `COMPLETADO`) exigirá un comentario explicativo.
  - Se genera un registro histórico en `agreement_history` con: estado previo, nuevo estado, usuario que autoriza, fecha y comentarios.

#### RF-AGR-003: Alertas y Monitoreo de Vencimientos
- **Descripción:** El sistema calculará automáticamente si un acuerdo se encuentra:
  - *En tiempo:* Más de 5 días hábiles antes de `due_date`.
  - *Próximo a vencer:* Entre 1 y 5 días antes de `due_date`.
  - *Vencido:* Fecha actual posterior a `due_date` sin estar en estado `COMPLETADO`.
- Esta clasificación se proyectará en el Dashboard y en los filtros de búsqueda.

---

### MÓDULO 08: BUSCADOR INTEGRAL E HISTORIAL INSTITUCIONAL (`MOD-08`)

#### RF-SRCH-001: Búsqueda Facetada Multicriterio
- **Descripción:** El sistema proveerá un motor de búsqueda parametrizado para localizar cualquier reunión, acuerdo o documento en el repositorio institucional.
- **Criterios de Filtro combinables:**
  - Rango de fechas (desde / hasta).
  - Categoría de reunión.
  - Modalidad (Presencial / Virtual / Híbrida).
  - Estado de la reunión (`PROGRAMADA`, `EN_DESARROLLO`, `FINALIZADA`, etc.).
  - Usuario creador o participante.
  - Palabras clave en título, descripción o minutas (empleando búsqueda textual acelerada por índices PostgreSQL `GIN` o `tsvector`).

#### RF-SRCH-002: Vista Integral Consolidada de la Reunión (Expediente Único)
- **Descripción:** Al acceder a una reunión específica desde el buscador, el usuario dispondrá de una interfaz unificada en pestañas sincronizadas que expone:
  1. *Ficha Técnica:* Datos generales, horarios, ubicación, modalidad y estado.
  2. *Orden del Día y Desarrollo:* Minuta formal aprobada.
  3. *Anotaciones de los Integrantes:* Muro ordenado de todas las notas de los miembros con identificación visual de autor.
  4. *Expediente Documental:* Listado de anexos con opción de visualización segura.
  5. *Acuerdos Vinculados:* Tabla de compromisos y sus estados de cumplimiento.
  6. *Lista de Asistencia:* Integrantes convocados y su estado de comparecencia.

---

### MÓDULO 09: AUDITORÍA FORENSE Y TRAZABILIDAD INTEGRAL (`MOD-09`)

#### RF-AUD-001: Bitácora de Auditoría de Tipo Append-Only
- **Descripción:** El sistema registrará de forma automática, síncrona e ineludible cada evento de negocio o de seguridad ocurrido en la plataforma.
- **Campos de cada Evento de Auditoría:**
  - `id`: BigInt o UUIDv7 (secuencial en tiempo).
  - `actor_id`: ID del usuario que realizó la acción (o `NULL` en intentos de login fallidos con usuario inexistente).
  - `action`: Verbo estandarizado en mayúsculas (ej. `LOGIN_SUCCESS`, `LOGIN_FAILED`, `MFA_CHALLENGE_FAILED`, `MEETING_CREATED`, `NOTE_UPDATED`, `ADMIN_NOTE_OVERRIDE`, `FILE_DOWNLOADED`, `USER_DEACTIVATED`, etc.).
  - `entity`: Nombre de la entidad afectada (`User`, `Meeting`, `PersonalNote`, `Attachment`, `Agreement`).
  - `entity_id`: ID del registro afectado.
  - `ip_address`: Dirección IP del cliente solicitante (obtenida de headers validados tras proxy inverso confiable).
  - `user_agent`: Cadena descriptiva del navegador/dispositivo.
  - `outcome`: Resultado del evento (`SUCCESS`, `FAILURE`, `DENIED`).
  - `diff_payload`: Objeto JSON con el estado anterior (`before`) y el nuevo estado (`after`), omitiendo terminantemente campos sensibles.
  - `timestamp`: Marca de tiempo UTC de alta precisión.

#### RF-AUD-002: Inmutabilidad Absoluta y Protección de Secretos
- **Reglas de Negocio:**
  - La tabla `audit_logs` no cuenta con operaciones de `UPDATE` ni `DELETE` expuestas en ningún servicio ni endpoint de API.
  - Se configurarán reglas o disparadores a nivel de base de datos (`REVOKE UPDATE, DELETE ON audit_logs FROM app_user`) para que ni siquiera un usuario con permisos de escritura general en la aplicación pueda modificar o borrar entradas históricas.
  - **Filtro de Secretos (*Sanitization Pipe*):** El interceptor de auditoría limpiará y enmascarará automáticamente cualquier propiedad denominada `password`, `token`, `secret`, `totp`, `backup_code` o similar, garantizando que nunca se persistan credenciales en los logs.

#### RF-AUD-003: Visualización Exclusiva para el Administrador
- **Descripción:** Únicamente los usuarios con el rol `ADMINISTRADOR` (`audit:read`) tendrán acceso al panel de visualización y exportación de la auditoría.
- **Capacidades:** Filtrar por fecha, por usuario actor, por entidad, por tipo de acción y por resultado.

---

### MÓDULO 10: DASHBOARD EJECUTIVO Y ANALÍTICA DE GESTIÓN (`MOD-10`)

#### RF-DASH-001: Panel Operativo del Usuario Institucional
- **Descripción:** Al iniciar sesión, el usuario visualizará una consola ejecutiva personalizada con:
  - Widget de Próximas Reuniones convocadas (con cuenta regresiva y acceso directo a agenda y anexos).
  - Widget de Mis Acuerdos Pendientes (con indicador visual de semáforo según proximidad de vencimiento).
  - Accesos rápidos a reuniones recientes en las que participó.
  - Resumen de notas redactadas en la última semana.

#### RF-DASH-002: Panel Estratégico y Administrativo
- **Descripción:** Los usuarios administradores tendrán una vista ampliada que incluye:
  - Total de reuniones por categoría (gráfica de barras/pastel).
  - Tasa de cumplimiento global de acuerdos (% completados vs vencidos).
  - Métricas de salud del sistema (usuarios activos, bloqueados, sesiones concurrentes).
  - Registro de últimos eventos críticos de seguridad (bloqueos temporales, intentos fallidos).


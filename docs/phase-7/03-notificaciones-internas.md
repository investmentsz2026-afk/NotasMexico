# SISTEMA DE NOTIFICACIONES INTERNAS (IN-APP) — FASE 7
## MEXAGENDA — SISTEMA PRIVADO DE GESTIÓN INSTITUCIONAL
### MÓDULO: MOD-06 — SISTEMA DE NOTIFICACIONES INSTITUCIONALES Y SERVICIO DE CORREO SMTP

---

### 1. ALCANCE Y EXPERIENCIA DE USUARIO DENTRO DE LA PLATAFORMA

El sistema de notificaciones internas de MexAgenda mantiene a los funcionarios y miembros de cuerpos colegiados permanentemente informados sobre eventos institucionales críticos sin requerir recargar la página ni depender exclusivamente de clientes de correo externos.

---

### 2. MATRIZ DE EVENTOS INSTITUCIONALES Y REGLAS DE DESTINATARIOS

| Evento de Negocio | Tipo Interno | Criterio de Selección de Destinatarios | Enlace Interno (`actionUrl`) |
| :--- | :--- | :--- | :--- |
| **Convocatoria a Sesión** | `REUNION_CONVOCATORIA` | Integrantes con registro formal en `meeting_participants`. Excluye terceros ajenos al órgano. | `/meetings/:id` |
| **Actualización de Sesión** | `REUNION_MODIFICADA` | Integrantes convocados a la sesión afectada. | `/meetings/:id` |
| **Cancelación de Sesión** | `REUNION_CANCELADA` | Integrantes convocados a la sesión cancelada. | `/meetings` |
| **Publicación de Acta** | `ACTA_PUBLICADA` | Participantes de la sesión y miembros con permiso de consulta de actas. | `/meetings/:id` |
| **Nuevo Acuerdo Asignado** | `ACUERDO_ASIGNADO` | Responsable titular y colaboradores expresamente designados en el acuerdo. | `/agreements/:id` |
| **Cambio de Estado de Acuerdo** | `ACUERDO_ESTADO_CAMBIO` | Creador del acuerdo, responsable titular y equipo de colaboradores. | `/agreements/:id` |
| **Anotación Compartida** | `NOTA_COMPARTIDA` | Participantes de la sesión vinculada. **PROHIBIDO para notas `PRIVADA`**. | `/notes/:id` |
| **Expediente en Bóveda** | `DOCUMENTO_ADJUNTO` | Usuarios con acceso a la entidad vinculada. | `/vault/:id` |
| **Aviso Institucional** | `INSTITUCIONAL_GENERAL` | Usuarios activos destinatarios del comunicado. | `/notifications` |

---

### 3. FUNCIONALIDADES OPERATIVAS IMPLEMENTADAS

1. **Bandeja de Entrada Unificada (`/notifications`):**
   - Consulta paginada con filtrado dinámico por estado de lectura (`Todas`, `No Leídas`) y categorías (`Reuniones`, `Acuerdos`, `Actas`).
   - Iconografía diferenciada por tipo de evento institucional.
   - Acceso con un clic al recurso vinculado mediante el botón *"Ver Recurso"*.
2. **Contador en Tiempo Real de Avisos Pendientes:**
   - Endpoint ligero optimizado `GET /notifications/unread-count`.
   - Consulta indexada sobre `[user_id, is_read]`.
   - Reflejado en la barra superior de navegación mediante badge numérico pulsante.
3. **Gestión de Lectura Individual y Masiva:**
   - `PATCH /notifications/:id/read`: Marca una notificación individual y estampa la fecha `readAt` en UTC.
   - `PATCH /notifications/read-all`: Actualiza en una sola transacción atómica todas las notificaciones pendientes del usuario autenticado.
4. **Descarte y Eliminación de Avisos:**
   - `DELETE /notifications/:id`: Permite al usuario purgar avisos atendidos de su bandeja personal sin afectar los registros de entrega ni la bitácora de auditoría.
5. **Control Estricto de Pertenencia (Anti-IDOR / Anti-BOLA):**
   - Un usuario únicamente puede listar, leer o descartar notificaciones donde `notification.userId === authUser.id`.
   - Cualquier intento de manipulación devuelve de inmediato **HTTP 403 Forbidden**.


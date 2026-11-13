# INFORME DE PRUEBAS DE SEGURIDAD Y PENETRACIÓN — FASE 7
## MEXAGENDA — SISTEMA PRIVADO DE GESTIÓN INSTITUCIONAL
### MÓDULO: MOD-06 — SISTEMA DE NOTIFICACIONES INSTITUCIONALES Y SERVICIO DE CORREO SMTP

---

### 1. OBJETIVO DE LAS PRUEBAS DE SEGURIDAD

Comprobar que el módulo de notificaciones y correo no introduce vectores de fuga de información institucional, violaciones de privacidad ni vulnerabilidades de control de acceso entre usuarios.

---

### 2. RESULTADOS DE LOS ENSAYOS DE PENETRACIÓN (OWASP API TOP 10)

#### Ensayo 2.1: BOLA / IDOR en Marcado de Lectura (`PATCH /notifications/:id/read`)
- **Escenario:** El Usuario B (ajeno) intenta marcar como leída una notificación perteneciente al Usuario A enviando el UUID en la ruta.
- **Respuesta del Servidor:** **HTTP 403 Forbidden** (*"No tiene permisos para modificar esta notificación"*).
- **Resultado:** **VULNERABILIDAD MITIGADA (PROTEGIDO)**.

#### Ensayo 2.2: BOLA / IDOR en Eliminación (`DELETE /notifications/:id`)
- **Escenario:** El Usuario B intenta eliminar un aviso de la bandeja del Usuario A.
- **Respuesta del Servidor:** **HTTP 403 Forbidden** (*"No tiene permisos para eliminar esta notificación"*).
- **Resultado:** **VULNERABILIDAD MITIGADA (PROTEGIDO)**.

#### Ensayo 2.3: Aislamiento en Listado General (`GET /notifications`)
- **Escenario:** El Usuario B solicita su listado de notificaciones intentando filtrar o inyectar identificadores del Usuario A.
- **Comportamiento en Backend:** La cláusula `where: { userId: user.id }` está cableada en el servicio a partir del token de sesión verificado por el guard.
- **Resultado:** Ningún registro del Usuario A es retornado al Usuario B. **AISLAMIENTO COMPLETO (PROTEGIDO)**.

---

### 3. AUDITORÍA CRÍTICA DE PRIVACIDAD EN ANOTACIONES PERSONALES

- **Prueba:** Se creó una anotación personal con visibilidad `PRIVADA` y se intentó disparar el despacho de notificaciones a través de `notifyNoteShared`.
- **Comportamiento Registrado:**
  ```text
  [NotificationsService] [SEGURIDAD] Intento interceptado de notificar una nota con visibilidad PRIVADA (ID: b2aa9058-...). Operación abortada.
  ```
- **Respuesta:** **HTTP 400 Bad Request** (*"Las notas privadas no pueden emitir notificaciones institucionales"*).
- **Dictamen:** **GARANTÍA ABSOLUTA DE CONFIDENCIALIDAD**. Es técnicamente imposible que el contenido o la existencia de una nota privada se filtre a terceros por el canal de notificaciones.

---

### 4. AUDITORÍA DE TRANSMISIÓN Y CONFIDENCIALIDAD SMTP

1. **Ausencia de Exposición Masiva en CC:**
   - Se verificó en el código de despacho que los bucles de notificación envían mensajes individuales e independientes por cada destinatario.
   - En ningún caso se concatenan correos en cabeceras `Cc` o `Bcc`, impidiendo que un participante conozca direcciones externas de otros convocados.
2. **Inexistencia de Tokens o Credenciales en Enlaces:**
   - Se inspeccionaron los enlaces generados en las plantillas HTML.
   - Todos los hipervínculos dirigen a rutas puras (ej. `/meetings/d0d34...`, `/agreements/a1b2...`).
   - Ningún enlace contiene tokens JWT, claves de sesión ni parámetros de bypass de autenticación.
3. **Sanitización de Logs:**
   - Los registros de auditoría y terminal enmascaran las cuentas de correo (`d***o@institucion.gob.mx`) y omiten cualquier contraseña de servidor.


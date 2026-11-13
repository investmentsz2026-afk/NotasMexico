# SERVICIO DE CORREO SMTP, SEGURIDAD Y PLANTILLAS — FASE 7
## MEXAGENDA — SISTEMA PRIVADO DE GESTIÓN INSTITUCIONAL
### MÓDULO: MOD-06 — SISTEMA DE NOTIFICACIONES INSTITUCIONALES Y SERVICIO DE CORREO SMTP

---

### 1. ARQUITECTURA DEL SERVICIO SMTP (`SmtpService`)

El servicio de correo electrónico fue diseñado como un componente desacoplado basado en la librería oficial **`Nodemailer`**, permitiendo operar tanto con servidores SMTP reales (Amazon SES, SendGrid, Mailgun, servidores corporativos on-premise) como con transportadores seguros de prueba en memoria.

---

### 2. CONFIGURACIÓN MEDIANTE VARIABLES DE ENTORNO

El servicio se parametriza a través de las siguientes variables de configuración:

```env
SMTP_HOST=smtp.mailtrap.io
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=placeholder_smtp_user
SMTP_PASSWORD=placeholder_smtp_password
SMTP_FROM_NAME=MexAgenda Institucional
SMTP_FROM_EMAIL=notificaciones@institucion.gob.mx
```

#### Mecanismo de Fallback y Modo Mock Transporter:
- Al arrancar el módulo, el constructor de `SmtpService` evalúa la legitimidad de las credenciales:
  ```typescript
  const hasRealCredentials = Boolean(
    host && user && pass &&
    user !== 'placeholder_smtp_user' &&
    !host.includes('placeholder')
  );
  ```
- Si no existen credenciales reales en `.env.local`, el servicio activa automáticamente el **Mock Transporter en memoria** (`jsonTransport: true`).
- **Garantía de Estabilidad:** Los flujos institucionales y las pruebas automatizadas se ejecutan sin arrojar excepciones de conexión ni demoras por timeout de red, capturando los correos emitidos para su verificación.

---

### 3. DIRECTRICES DE SEGURIDAD EN EL ENVÍO DE CORREOS

1. **Envíos Individuales (Anti-Fuga de Destinatarios):**
   - MexAgenda prohíbe el uso de listas masivas o campos `CC` / `BCC` visibles.
   - Cada destinatario recibe un correo generado de forma individual, impidiendo que terceros conozcan las direcciones de correo de otros participantes de la sesión.
2. **Enmascaramiento de Direcciones en Logs:**
   - Para cumplir con la normativa de privacidad de datos personales, los registros del servidor enmascaran el usuario del correo (ej. `d***o@institucion.gob.mx`).
3. **Ausencia Absoluta de Secretos y Enlaces Permanentes:**
   - **NUNCA** se incluyen tokens de sesión, códigos OTP/TOTP, contraseñas ni hashes en el cuerpo del mensaje.
   - No se envían enlaces de descarga directa sin autenticación. Los botones redirigen a la plataforma web (`https://mexagenda.gob.mx/...`), obligando al usuario a identificarse antes de acceder a la información.
4. **Validación Sintáctica de Correo:**
   - Se valida el formato de la dirección antes de la entrega; correos malformados se descartan con estado `FALLIDO` sin detener la ejecución del lote.

---

### 4. CATÁLOGO DE PLANTILLAS INSTITUCIONALES RESPONSIVAS

Todas las plantillas comparten el diseño base estandarizado en [`base.template.ts`](file:///d:/MexAgenda/apps/backend/src/modules/notifications/templates/base.template.ts), ofreciendo:
- Cabecera con identidad corporativa MexAgenda y badge temático.
- Tipografía del sistema de alta legibilidad en clientes móviles y de escritorio.
- Botón de llamado a la acción (*Call to Action*).
- Aviso legal obligatorio de confidencialidad institucional.
- Versión dual en HTML y texto plano (*multipart/alternative*).

#### Plantillas Implementadas:
1. **Convocatoria a Sesión (`renderMeetingInviteEmail`):** Informa fecha, hora, modalidad y órgano colegiado con botón para confirmar asistencia.
2. **Modificación de Sesión (`renderMeetingUpdateEmail`):** Resalta los cambios en la programación o sede colegiada.
3. **Cancelación de Sesión (`renderMeetingCancelEmail`):** Notifica con claridad la baja de la reunión y la causa institucional.
4. **Asignación de Acuerdo (`renderAgreementNewEmail`):** Especifica el rol asignado (Titular o Colaborador), prioridad y fecha límite.
5. **Actualización de Acuerdo (`renderAgreementUpdateEmail`):** Notifica avances y transiciones de estado.
6. **Publicación de Acta (`renderMinutesPublishedEmail`):** Comunica la disponibilidad del documento oficial aprobado.
7. **Aviso General (`renderGeneralNotificationEmail`):** Comunicados administrativos globales.


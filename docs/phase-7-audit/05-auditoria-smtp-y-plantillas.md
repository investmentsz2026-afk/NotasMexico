# Auditoría Fase 7 — 05. Auditoría de Servicio SMTP, Plantillas y Sanitización

## 1. Comportamiento de SmtpService (Mock Transporter vs Real)

Se auditó el servicio [`SmtpService`](file:///d:/MexAgenda/apps/backend/src/modules/notifications/smtp/smtp.service.ts).

### Detección Inteligente de Credenciales
- El servicio inspecciona las variables de entorno: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM_NAME`, `SMTP_FROM_EMAIL`.
- Si las credenciales contienen valores vacíos, nulos o de plantilla (`placeholder_smtp_user`, `placeholder`), conmuta automáticamente a **Mock Transporter** (`nodemailer.createTransport({ jsonTransport: true })`).
- **Aislamiento Seguro:** Los correos no salen a la red física, evitando intentos fallidos de conexión TCP en frío o exposición involuntaria de mensajes durante suites de prueba.
- **Validación en Producción:** La validación con un servidor SMTP físico real queda catalogada como **Pendiente de Homologación de Infraestructura (OBS-07-03)** hasta contar con los secretos de red institucionales.

---

## 2. Sanitización y Enmascaramiento de PII en Registros

Se verificó en `AUDIT-20`:
1. **Validación Sintáctica:** Direcciones como `invalid-format`, `not-an-email` o cadenas sin `@` son rechazadas de inmediato sin invocar al transporte.
2. **Enmascaramiento de Direcciones:** En las bitácoras del sistema, cualquier correo procesado se anonimiza mediante `maskEmail` (ejemplo: `funcionario.titular@institucion.gob.mx` se registra como `f***r@institucion.gob.mx`), cumpliendo los estándares de protección de datos personales.

---

## 3. Catálogo de Plantillas HTML y Hallazgo FIND-07-02

### 3.1. Evaluación del Diseño de Plantillas
- El catálogo de plantillas corporativas en `templates/`:
  - Utiliza tablas estructuradas HTML 4.01 / XHTML y estilos en línea (*inline CSS*).
  - Incluye cabecera institucional (`Sistema Privado de Gestión Institucional`), botón de llamada a la acción (CTA) y pie legal con aviso formal de confidencialidad institucional.
  - Implementa escape estricto de entidades HTML (`&`, `<`, `>`, `"`, `'`) en campos dinámicos para prevenir inyección de código o XSS en clientes de correo.

### 3.2. Hallazgo FIND-07-02 (Severidad Baja): Carga Útil en Outbox Worker
- **Descripción:** `NotificationsService.dispatchNotification()` genera la plantilla HTML completa llamando a `this.generateEmailPayload()`, pasándola como parámetro a `outboxWorker.enqueueEmailDelivery({ subject, html, text })`.
- **Inconsistencia Detectada:** El modelo `NotificationDelivery` en `prisma/schema.prisma` carece de columnas para persistir el `html` o el `subject`. Por ello, `enqueueEmailDelivery` no guarda dichos campos en base de datos.
- **Efecto:** Cuando `OutboxWorkerService.processPendingDeliveries()` ejecuta el envío del lote, despacha a través de SMTP:
  ```typescript
  const result = await this.smtpService.sendMail({
    to: recipientEmail,
    subject: job.notification.title,
    html: `<p>${job.notification.message}</p>`,
    text: job.notification.message,
  });
  ```
- **Impacto:** El correo entregado contiene la información correcta en texto, pero pierde la presentación corporativa responsiva y el descargo legal formal.
- **Corrección Requerida:** Añadir un campo `htmlContent` o `payload` (Json/Text) a la tabla `notification_deliveries` para que el worker despache directamente el HTML generado.

**Resultado de la Auditoría SMTP y Plantillas:** **VERIFICADO CON HALLAZGO FIND-07-02 (NO BLOQUEANTE).**


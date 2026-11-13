# ARQUITECTURA TÉCNICA Y ESPECIFICACIÓN — FASE 7
## MEXAGENDA — SISTEMA PRIVADO DE GESTIÓN INSTITUCIONAL
### MÓDULO: MOD-06 — SISTEMA DE NOTIFICACIONES INSTITUCIONALES Y SERVICIO DE CORREO SMTP

---

### 1. DIAGRAMA DE FLUJO ARQUITECTÓNICO

El sistema de notificaciones opera bajo un modelo de desacoplamiento asíncrono y consistencia transaccional:

```
[ Módulos de Negocio ]
(Reuniones / Acuerdos / Actas / Bóveda)
           │
           ▼ invoca
┌────────────────────────────────────────────────────────┐
│               NotificationsService                     │
│  - Evalúa permisos y relaciones de destinatarios       │
│  - Consulta preferencias del usuario (NotificationPref)│
│  - Descarta eventos si usuario desactivó alertas      │
└──────────┬─────────────────────────────────────────────┘
           │
           ├────────────────────────────┐
           ▼ (In-App)                   ▼ (Email)
┌───────────────────────┐   ┌───────────────────────────────────┐
│     Notification      │   │       NotificationDelivery        │
│ (Persistida en Neon)  │   │     (Transactional Outbox)        │
└──────────┬────────────┘   └─────────────────┬─────────────────┘
           │                                  │
           ▼ API REST                         ▼ Asíncrono
┌───────────────────────┐   ┌───────────────────────────────────┐
│  Frontend Next.js 15  │   │       Queue & Outbox Worker       │
│  - Campana / Badge    │   │  - Reintentos con Backoff Exp.   │
│  - Panel desplegable  │   │  - Control de Idempotencia        │
│  - Centro /notif      │   └─────────────────┬─────────────────┘
└───────────────────────┘                     │
                                              ▼
                                    ┌───────────────────┐
                                    │    SmtpService    │
                                    │  - Plantillas HTML│
                                    │  - Mock / Real    │
                                    └───────────────────┘
```

---

### 2. COMPONENTES Y RESPONSABILIDADES

1. **`NotificationsService`:**
   - Orquestador principal de la lógica de notificaciones institucionales.
   - Aplica filtros de privacidad (p. ej. validar que una nota compartida no sea `PRIVADA` y que el destinatario sea participante en la reunión).
   - Verifica las preferencias del usuario receptor antes de generar registros de entrega.
   - Administra el contador de notificaciones no leídas (`unreadCount`), el marcado individual (`markAsRead`) y masivo (`markAllAsRead`).

2. **`SmtpService`:**
   - Módulo desacoplado para el despacho de correos electrónicos mediante `nodemailer`.
   - Carga dinámica y sanitización de plantillas HTML corporativas con diseño institucional responsivo.
   - Soporte automático para fallback a transporte de prueba seguro cuando `SMTP_HOST` no está configurado.
   - Sanitización absoluta: nunca incluye tokens de sesión, contraseñas, URLs permanentes con credenciales ni archivos confidenciales adjuntos en los correos.

3. **`OutboxWorkerService` (Procesador Asíncrono y Cola):**
   - Ejecuta periódicamente la lectura de registros `PENDIENTE` en `notification_deliveries`.
   - Aplica control de duplicados mediante `idempotencyKey` único derivado de `hash(userId + type + resourceId + eventTimestamp)`.
   - Implementa reintentos automáticos con backoff exponencial:
     * Intento 1: Inmediato
     * Intento 2: +2 minutos
     * Intento 3: +10 minutos
     * Fallo definitivo: Transición a estado `FALLIDO` y registro de error no sensible.

4. **`NotificationsController`:**
   - Proporciona endpoints REST seguros con `@UseGuards(SessionAuthGuard, PermissionsGuard)`.
   - Control estricto de propiedad (BOLA / IDOR): un usuario no puede consultar, marcar como leída ni eliminar una notificación de otro usuario.

---

### 3. SEGURIDAD Y PRIVACIDAD DE DATOS (MÁXIMA PRIORIDAD)

1. **Protección de Notas Personales:**
   - Se establece como regla inquebrantable que **ninguna nota con `visibility = 'PRIVADA'` podrá jamás generar una notificación a terceros**, ni interna ni por correo electrónico.
   - Las notas con visibilidad `REUNION` solo generarán notificaciones a los integrantes que figuren activamente en `meeting_participants`.
2. **Protección de Documentos:**
   - Las notificaciones sobre adjuntos o acuerdos nunca incluirán enlaces presignados de descarga directa en el cuerpo del correo. Dirigirán exclusivamente al recurso en la plataforma web (`https://mexagenda.gob.mx/vault/...`), donde el backend forzará la autenticación y verificará los permisos del usuario antes de otorgar acceso.
3. **Protección de Credenciales:**
   - Ninguna variable SMTP (`SMTP_PASSWORD`, `SMTP_USER`) se guardará en bases de datos ni se expondrá en logs.


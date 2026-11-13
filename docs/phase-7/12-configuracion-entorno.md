# CONFIGURACIÓN DE ENTORNO Y GUÍA DE DESPLIEGUE — FASE 7
## MEXAGENDA — SISTEMA PRIVADO DE GESTIÓN INSTITUCIONAL
### MÓDULO: MOD-06 — SISTEMA DE NOTIFICACIONES INSTITUCIONALES Y SERVICIO DE CORREO SMTP

---

### 1. VARIABLES DE ENTORNO REQUERIDAS

Las variables de entorno necesarias para operar el módulo de notificaciones y correo se encuentran declaradas en el archivo de plantilla [`.env.example`](file:///d:/MexAgenda/.env.example):

| Variable | Tipo / Formato | Valor por Defecto / Ejemplo | Propósito en Producción |
| :--- | :--- | :--- | :--- |
| `SMTP_HOST` | String | `smtp.mailtrap.io` | Servidor SMTP institucional o proveedor SaaS (Amazon SES, SendGrid, Exchange). |
| `SMTP_PORT` | Entero | `587` | Puerto de comunicación (587 STARTTLS, 465 SSL/TLS, 25 relay interno). |
| `SMTP_SECURE`| Boolean | `false` | `true` para puerto 465 (TLS directo); `false` para 587 (STARTTLS). |
| `SMTP_USER` | String | `placeholder_smtp_user` | Nombre de usuario o API Key para autenticación SMTP. |
| `SMTP_PASSWORD`| String | `placeholder_smtp_password`| Contraseña o secreto del usuario SMTP. |
| `SMTP_FROM_NAME` | String | `MexAgenda Institucional` | Nombre visible del remitente en los clientes de correo. |
| `SMTP_FROM_EMAIL`| Email | `notificaciones@institucion.gob.mx` | Dirección de remitente institucional oficial autorizada (con SPF/DKIM). |
| `REDIS_HOST` | String | `127.0.0.1` | Host del clúster Redis para BullMQ (opcional, fallback a outbox en Neon). |
| `REDIS_PORT` | Entero | `6379` | Puerto de escucha de Redis. |
| `REDIS_PASSWORD` | String | `""` | Contraseña de autenticación de Redis (AUTH). |

---

### 2. PROTOCOLO DE CONMUTACIÓN AUTOMÁTICA (FALLBACK)

1. **Entornos de Desarrollo y Auditoría Local:**
   - Si `SMTP_HOST` no está presente o contiene valores de placeholder, `SmtpService` activa el **Mock Transporter en memoria**.
   - Los correos se formatean y validan completamente sin emitir tráfico de red hacia el exterior ni requerir credenciales reales.
2. **Entorno de Producción:**
   - Se suministran las credenciales oficiales institucionales en `.env.local` o en el gestor de secretos de la infraestructura cloud (AWS Secrets Manager, Doppler, Vault).
   - El sistema conmuta automáticamente a despacho real con cifrado TLS.

---

### 3. RECOMENDACIONES DE CONFIGURACIÓN DNS PARA PRODUCCIÓN

Para asegurar una alta entregabilidad y prevenir que los correos sean catalogados como Spam:
- **Registro SPF:** `v=spf1 include:_spf.institucion.gob.mx ~all`
- **Firma DKIM:** Clave pública RSA de 2048 bits configurada en la zona DNS del dominio.
- **Política DMARC:** `v=DMARC1; p=reject; rua=mailto:dmarc-reports@institucion.gob.mx`


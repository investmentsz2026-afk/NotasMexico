# Documentación de Fase 7 — Limitaciones Técnicas y Observaciones Heredadas

## Proyecto: MexAgenda — Sistema Privado de Gestión Institucional
## Módulo: MOD-06 — Sistema de Notificaciones Institucionales y Servicio de Correo SMTP
## Fecha: Noviembre 2026
## Estado: Implementado y Listo para Auditoría Independiente

---

## 1. Alcance y Propósito

El presente documento detalla las limitaciones técnicas operativas del módulo MOD-06 identificadas durante su diseño e implementación, así como la reconciliación y trazabilidad de los hallazgos y observaciones heredados de la Fase 6 (Bóveda Digital y Gestión Documental).

---

## 2. Limitaciones Técnicas del Módulo MOD-06

### 2.1. Despacho SMTP en Modo Simulado (Mock Transporter)
- **Condición Actual:** En entornos de desarrollo local y CI/CD donde no se suministran credenciales de un servidor SMTP institucional real (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`), el servicio `SmtpService` activa automáticamente el adaptador simulado en memoria (`nodemailer.createTransport({ jsonTransport: true })`).
- **Comportamiento:**
  - Los correos no se transmiten físicamente por la red hacia servidores de correo externos.
  - La carga útil del correo (destinatario enmascarado, asunto, HTML renderizado, identificadores de idempotencia) se serializa en memoria y se registra en la bitácora institucional con nivel informativo (`[SMTP-MOCK] Correo simulado...`).
  - El registro en `notification_deliveries` se marca como `DELIVERED`, registrando `responseSummary: 'Simulated dispatch (JSON Transport)'`.
- **Mitigación / Paso a Producción:** Una vez que la infraestructura institucional suministre credenciales SMTP válidas (mediante variables seguras en el orquestador o archivo `.env.local`), el sistema conmuta a modo real de manera transparente y sin alterar el código ni la base de datos.

### 2.2. Procesamiento Asíncrono: Transactional Outbox vs. BullMQ / Redis
- **Condición Actual:** Durante el diagnóstico inicial se constató que la instancia de Redis no se encuentra activa en el entorno de desarrollo local (`127.0.0.1:6379` cerrado).
- **Solución Implementada:** Se diseñó e implementó el patrón **Transactional Outbox** desacoplado mediante la entidad `notification_deliveries` en PostgreSQL Neon y un servicio de sondeo periódico no bloqueante (`OutboxWorkerService`).
- **Características Operativas:**
  - Las notificaciones por correo y webhooks se persisten en la misma transacción atómica de la base de datos relacional.
  - El worker procesa lotes de hasta 20 entregas cada 10 segundos, con reintentos controlados (máximo 3) y retroceso exponencial (`2^attempts` minutos).
  - Ofrece resiliencia total frente a caídas de red y garantiza cero pérdida de mensajes sin requerir un cluster Redis en modo mononodo local.
- **Ruta de Escalabilidad:** Para entornos con alto volumen concurrente (>10,000 notificaciones/minuto), se conservan documentadas las variables de entorno (`REDIS_HOST`, `REDIS_PORT`, `QUEUE_DRIVER=redis`) para activar opcionalmente BullMQ sin alterar la lógica de negocio ni el esquema transaccional.

### 2.3. Renderizado y Compatibilidad de Clientes de Correo
- Las plantillas HTML generadas en `apps/backend/src/modules/notifications/templates/` emplean tablas estructuradas HTML 4.01 / XHTML y estilos en línea (*inline CSS*), garantizando compatibilidad con clientes corporativos exigentes (Microsoft Outlook de escritorio, Outlook Web, Gmail Web, Apple Mail e interfaces móviles iOS/Android).
- Sin embargo, clientes de correo con bloqueo estricto de imágenes remotas no descargarán el logotipo institucional hasta que el usuario final autorice la visualización de contenido externo.

### 2.4. Respeto Estricto de la Privacidad de Anotaciones Personales
- Por diseño arquitectónico y regla innegociable de seguridad, **las anotaciones con visibilidad `PRIVADA` bajo ninguna circunstancia admiten despacho de notificaciones externas ni internas a terceros**.
- Cualquier invocación transversal que intente notificar una anotación privada es interceptada y rechazada con excepción HTTP 400 (`BadRequestException: 'No se permite emitir notificaciones para notas personales privadas'`).
- Las notas de tipo `REUNION` únicamente permiten notificar a los participantes formalmente registrados y verificados en la sesión colegiada respectiva.

---

## 3. Reconciliación y Estado de Observaciones Previas Heredadas de Fase 6

Durante la auditoría independiente de la Fase 6 (MOD-05: Bóveda Digital y Gestión Documental), se emitieron los siguientes hallazgos y observaciones. A continuación se describe su estado y tratamiento en relación con la Fase 7:

| Identificador | Descripción Original en Fase 6 | Tratamiento en Fase 7 | Estado en Fase 7 |
| :--- | :--- | :--- | :--- |
| **FIND-06-01** | *Gestión de expiración temporal de URLs prefirmadas de S3 y reintentos ante desconexión transitoria.* | Las notificaciones que refieren a documentos o actas descargables envían enlaces que dirigen al portal institucional autenticado (`/vault` o `/meetings/:id`), evitando enviar URLs prefirmadas de S3 directamente en el cuerpo del correo, lo cual previene expiraciones de enlaces en correos archivados. | **Reconciliado y Respetado.** No interfiere con MOD-06. |
| **FIND-06-02** | *Validación estricta de extensiones contra cabeceras MIME (*magic numbers*) en subida de adjuntos.* | MOD-06 no introduce subida directa de archivos en correos; los adjuntos institucionales se gestionan exclusivamente mediante el módulo de Bóveda (MOD-05). MOD-06 envía referencias a las actas y acuerdos sin realizar cargas multipart inseguras. | **Sin Afectación.** No aplica a MOD-06. |
| **OBS-06-01** | *Integración futura con daemon antivirus ClamAV para análisis en segundo plano.* | El worker asíncrono implementado en Fase 7 (`OutboxWorkerService`) demuestra la madurez del patrón de procesamiento en segundo plano en la plataforma, sirviendo de referencia de arquitectura para futuros workers de infraestructura sin anticipar ni inventar cierres prematuros en la bóveda. | **Pendiente Institucional (Roadmap).** Preservado intacto. |
| **OBS-06-02** | *Cuotas de almacenamiento por órgano colegiado o usuario en bóveda digital.* | Las notificaciones institucionales no consumen cuota de almacenamiento de archivos en S3; la persistencia de las entidades `Notification` y `NotificationDelivery` se realiza en la base de datos Neon PostgreSQL con índices optimizados y bajo impacto volumétrico. | **Sin Afectación.** Preservado intacto. |

---

## 4. Conclusiones y Recomendaciones para Producción

1. **Configuración de Relay SMTP Real:** En el despliegue al entorno de pruebas de integración institucional (UAT) o producción, se deberá cargar el secreto de conexión SMTP provisto por el área de infraestructura de TI.
2. **Monitoreo de Entregas Fallidas:** Se recomienda que los administradores institucionales auditen periódicamente la ruta `/api/v1/notifications/admin/deliveries?status=FAILED` para detectar reintentos agotados por direcciones de correo inexistentes o buzones saturados.
3. **Purga Periódica:** Se sugiere implementar en fases de gobernanza una política de archivado o depuración de notificaciones leídas con más de 180 días de antigüedad para mantener un desempeño óptimo en Neon PostgreSQL.


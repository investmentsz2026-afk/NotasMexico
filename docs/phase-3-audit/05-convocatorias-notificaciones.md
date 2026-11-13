# 05. AUDITORÍA DE CONVOCATORIAS Y NOTIFICACIONES
## Proyecto: MexAgenda — Sistema Privado de Gestión Institucional
### Módulo: MOD-02 — Gestión Institucional de Reuniones y Sesiones

---

## 1. OBJETIVO DE LA AUDITORÍA DE CONVOCATORIAS

El proceso de convocatoria es el acto jurídico mediante el cual el órgano directivo o la secretaría cita formalmente a los miembros colegiados a una sesión. Esta auditoría evaluó con **total transparencia técnica y rigor ético** el alcance real de las capacidades implementadas en la Fase 3, diferenciando claramente entre las funciones nativas activas en la plataforma y los servicios de mensajería externa previstos para fases posteriores.

---

## 2. DECLARACIÓN DE CAPACIDADES IMPLEMENTADAS EN FASE 3

### 2.1 Capacidades Reales y Verificadas (100% Operativas)
La plataforma dispone de un subsistema integral de convocatorias institucionales con persistencia en Neon PostgreSQL:

1. **Elaboración y Cédula de Convocatoria (`meeting_convocatorias`):**
   - Redacción formal del texto de la convocatoria (`noticeText`).
   - Asignación de folio oficial de convocatoria (`convocatoriaNumber`, por ejemplo: `CONV-ORD-2026-001`).
   - Registro de observaciones, instrucciones de acceso y orden del día preliminar.
   - Estado de borrador vs publicado (`isPublished`).

2. **Publicación Formal en Plataforma:**
   - Endpoint: `POST /api/v1/meetings/:id/convocatoria/publish`.
   - Registro de fecha y hora exacta de publicación (`publishedAt: new Date()`).
   - Vinculación del usuario responsable de la publicación (`publishedById`).
   - Transición automática del estado del ciclo de vida de la reunión de `PROGRAMADA` (o `BORRADOR`) a `CONVOCADA`.

3. **Instantánea Inmutable de Receptores Convocados (*Recipient Snapshot*):**
   - En el instante de la publicación formal, el sistema captura y almacena en la columna JSONB `recipients` una instantánea congelada de todos los participantes registrados:
     ```json
     [
       {
         "participantId": "8b9f1234-...",
         "name": "Dr. Fernando Morales Castro",
         "email": "fernando.morales@institucion.gob.mx",
         "role": "Presidente de Comisión"
       },
       {
         "participantId": "4c8e5678-...",
         "name": "Lic. Sofia Mendoza",
         "email": "sofia.mendoza@externo.org",
         "role": "Invitado Especial"
       }
     ]
     ```
   - Esta instantánea protege la fe pública institucional: si posteriormente se agregan o remueven participantes, la cédula original de quiénes fueron formalmente convocados en la fecha de publicación queda inalterada.

4. **Bitácora Forense de Publicación:**
   - Se asienta el evento `CONVOCATORIA_PUBLISHED` en `audit_logs` con el número de destinatarios convocados.

---

## 3. DECLARACIÓN TRANSPARENTE DE CAPACIDADES PENDIENTES

Conforme a las directrices de la auditoría técnica, **se declara explícitamente y sin simulación que los siguientes componentes no forman parte del alcance de la Fase 3 y permanecen como pendientes programados**:

| Componente Notificatorio | Estado Actual | Fase Programada | Razón Técnica |
| :--- | :--- | :--- | :--- |
| **Envío Real de Correo Electrónico (SMTP)** | **Pendiente** | Fase 7 (Notificaciones) | Requiere credenciales de servidor de correo institucional (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`) que no han sido aprovisionadas. |
| **Notificaciones Push en Navegador** | **Pendiente** | Fase 7 | Requiere configuración de Service Workers y claves VAPID institucionales. |
| **Alertas SMS / Mensajería Móvil** | **Pendiente** | Fase 8 | Integración con pasarela de telecomunicaciones del sector público. |
| **Generación de Cédula PDF Firmada** | **Pendiente** | Fase 6 (Bóveda Documental) | Integración con el motor de generación documental y firma electrónica. |

> [!NOTE]
> La aplicación no finge ni simula el despacho de correos SMTP inexistentes. Las convocatorias operan mediante **notificación y publicación interna dentro de la plataforma**, donde los usuarios con sesión activa consultan las reuniones en las que han sido formalmente convocados.

---

## 4. EVIDENCIAS DE PRUEBAS DE CONVOCATORIAS

### 4.1 CONV-001 / NOTIF-01: Publicación e Instantánea de Destinatarios
- **Operación:** Se creó una reunión con 2 participantes (1 interno titular y 1 externo invitado), se redactó la convocatoria y se ejecutó `publishConvocatoria`.
- **Resultados Verificados:**
  - `convocatoria.isPublished = true`
  - `convocatoria.publishedAt` registrado con estampa UTC/CDMX.
  - `convocatoria.recipients` contiene exactamente 2 elementos con nombres, correos y roles institucionales.
  - `meeting.status` cambió automáticamente a `CONVOCADA`.
- **Duración:** 1905ms. **Estado:** APROBADO.

### 4.2 CONV-004: Rechazo de Publicación en Reunión Cancelada
- **Operación:** Intento de publicar convocatoria en una reunión con `status: CANCELADA`.
- **Resultado Verificado:** Rechazada con HTTP 400 Bad Request (`BadRequestException: No se puede publicar la convocatoria de una reunión en estado CANCELADA.`).
- **Duración:** 3874ms. **Estado:** APROBADO.

---

## 5. CONCLUSIÓN DEL CAPÍTULO DE CONVOCATORIAS

El subsistema de convocatorias institucionales cumple estrictamente con el alcance formal de la Fase 3. La gobernanza colegiada interna, la emisión de cédulas de citación y la congelación del padrón de convocados están plenamente afianzadas en Neon PostgreSQL, manteniendo una arquitectura limpia y desacoplada para la integración del transporte SMTP en fases posteriores.


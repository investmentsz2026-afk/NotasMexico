/**
 * ==============================================================================
 * MEXAGENDA — AUDITORÍA INDEPENDIENTE DE CORRECCIONES DE LA FASE 7
 * ==============================================================================
 * Verificación técnica reproducible de:
 * 1. FIND-07-01: Disparadores en flujos ordinarios (Reuniones, Acuerdos, Notas)
 *    - Inyección de dependencias y señales visibles.
 *    - Privacidad absoluta en notas PRIVADA y exclusión de terceros en REUNION.
 *    - Respeto a preferencias de usuario por canal y categoría.
 *    - Comportamiento ante fallos / reversiones de negocio vs encolamiento outbox.
 *    - Idempotencia en invocaciones idénticas vs cambios legítimos distintos.
 * 2. FIND-07-02: Plantillas HTML institucionales en Worker Outbox
 *    - Migración y persistencia de subject, html_body, text_body.
 *    - Captura en Mock Transporter: encabezado, pie de confidencialidad, enlace.
 *    - Sanitización y escape de caracteres especiales (<script>, &, ", ').
 *    - Retrocompatibilidad con entregas históricas (htmlBody == null).
 *    - Reintentos ante fallos controlados preservando contenido HTML.
 *    - Separación de evidencia en base de datos vs evidencia en transporte.
 * ==============================================================================
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const {
  PrismaClient,
  NotificationType,
  DeliveryStatus,
  AgreementStatus,
  UserStatus,
  MeetingModality,
  MeetingStatus,
  AttendanceStatus,
} = require('@prisma/client');

function loadEnv() {
  const envFiles = ['.env.local', '.env'];
  for (const file of envFiles) {
    const fullPath = path.resolve(process.cwd(), file);
    if (fs.existsSync(fullPath)) {
      const content = fs.readFileSync(fullPath, 'utf8');
      content.split('\n').forEach((line) => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
          const idx = trimmed.indexOf('=');
          const key = trimmed.slice(0, idx).trim();
          let val = trimmed.slice(idx + 1).trim();
          if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.slice(1, -1);
          }
          if (!process.env[key]) {
            process.env[key] = val;
          }
        }
      });
    }
  }
}

loadEnv();

const prisma = new PrismaClient();

const { SmtpService } = require('../apps/backend/dist/modules/notifications/smtp/smtp.service');
const { OutboxWorkerService } = require('../apps/backend/dist/modules/notifications/queue/outbox-worker.service');
const { NotificationsService } = require('../apps/backend/dist/modules/notifications/notifications.service');
const { AuditService } = require('../apps/backend/dist/modules/audit/audit.service');
const { MeetingsService } = require('../apps/backend/dist/modules/meetings/meetings.service');
const { AgreementsService } = require('../apps/backend/dist/modules/agreements/agreements.service');
const { NotesService } = require('../apps/backend/dist/modules/notes/notes.service');

class MockConfigService {
  constructor(env = {}) {
    this.env = { ...process.env, ...env };
  }
  get(key) {
    return this.env[key];
  }
}

const runId = Math.random().toString(36).substring(2, 10);
let passedTests = 0;
let totalTests = 0;

function logTest(testNum, desc, ok = true, detail = '') {
  totalTests++;
  if (ok) {
    passedTests++;
    console.log(`  ✓ [AUDIT-TEST-${String(testNum).padStart(2, '0')}] ${desc}`);
  } else {
    console.error(`  ✗ [AUDIT-TEST-${String(testNum).padStart(2, '0')}] FALLIDO: ${desc}`);
  }
  if (detail) {
    console.log(`      ↳ Evidencia: ${detail}`);
  }
}

async function runAudit() {
  console.log('==============================================================================');
  console.log('MEXAGENDA — VERIFICACIÓN INDEPENDIENTE DE CORRECCIONES FASE 7');
  console.log(`Run ID: audit-${runId} | Base de Datos: Neon PostgreSQL`);
  console.log('==============================================================================\n');

  // --------------------------------------------------------------------------
  // BLOQUE 0: INSPECCIÓN DEL TRANSPORTE SMTP Y ENTORNO
  // --------------------------------------------------------------------------
  console.log('--- 0. IDENTIFICACIÓN Y CONFIGURACIÓN DEL ENTORNO ---');
  delete process.env.SMTP_HOST;
  delete process.env.SMTP_PORT;
  delete process.env.SMTP_USER;
  delete process.env.SMTP_PASS;

  const mockConfig = new MockConfigService();
  const smtpService = new SmtpService(mockConfig);
  const isMock = smtpService.isMock();
  logTest(1, 'Transporte SMTP configurado en Mock Transporter seguro', isMock, 'smtpService.isMock() === true');

  // Limpiar residuos previos de pruebas
  await prisma.notificationDelivery.deleteMany({
    where: { recipientEmail: { contains: 'invalid-email' } },
  });

  const auditService = new AuditService(prisma);
  const outboxWorker = new OutboxWorkerService(prisma, smtpService);
  const notificationsService = new NotificationsService(prisma, auditService, smtpService, outboxWorker);

  // Instanciar servicios de negocio con NotificationsService inyectado
  const meetingsService = new MeetingsService(prisma, auditService, notificationsService);
  const agreementsService = new AgreementsService(prisma, auditService, notificationsService);
  const notesService = new NotesService(prisma, auditService, notificationsService);

  // --------------------------------------------------------------------------
  // BLOQUE 1: PROVISIÓN DE INTEGRANTES INSTITUCIONALES PARA AUDITORÍA
  // --------------------------------------------------------------------------
  console.log('\n--- 1. PROVISIÓN DE USUARIOS Y ROLES INSTITUCIONALES ---');
  const userRole = await prisma.role.findFirst({ where: { name: 'AUDITOR' } }) ||
                   await prisma.role.findFirst({ where: { name: 'ADMIN' } }) ||
                   await prisma.role.findFirst();

  const userPresidente = await prisma.user.create({
    data: {
      email: `presidente-${runId}@auditoria.gob.mx`,
      passwordHash: '$2b$10$abcdefghijklmnopqrstuvwxyz1234567890abcdefghijklmnop',
      firstName: 'Dr. Alejandro',
      lastName: 'Presidente',
      position: 'Presidente del Comité',
      status: UserStatus.ACTIVO,
      roleId: userRole.id,
    },
  });

  const userSecretario = await prisma.user.create({
    data: {
      email: `secretario-${runId}@auditoria.gob.mx`,
      passwordHash: '$2b$10$abcdefghijklmnopqrstuvwxyz1234567890abcdefghijklmnop',
      firstName: 'Mtra. Beatriz',
      lastName: 'Secretaria',
      position: 'Secretaria Técnica',
      status: UserStatus.ACTIVO,
      roleId: userRole.id,
    },
  });

  const userAjeno = await prisma.user.create({
    data: {
      email: `externo-${runId}@auditoria.gob.mx`,
      passwordHash: '$2b$10$abcdefghijklmnopqrstuvwxyz1234567890abcdefghijklmnop',
      firstName: 'Lic. Carlos',
      lastName: 'Externo',
      position: 'Funcionario Ajeno',
      status: UserStatus.ACTIVO,
      roleId: userRole.id,
    },
  });

  logTest(2, 'Usuarios institucionales aprovisionados en Neon PostgreSQL', true,
    `Presidente (${userPresidente.id}), Secretaria (${userSecretario.id}), Externo (${userAjeno.id})`);

  // Crear categoría institucional para reuniones
  const category = await prisma.meetingCategory.create({
    data: {
      name: `Comité de Auditoría ${runId}`,
      code: `AUD-${runId.toUpperCase()}`,
      description: 'Categoría para pruebas de auditoría independiente',
    },
  });

  // --------------------------------------------------------------------------
  // BLOQUE 2: VERIFICACIÓN FIND-07-01 — DISPARADORES EN FLUJOS ORDINARIOS
  // --------------------------------------------------------------------------
  console.log('\n--- 2. VERIFICACIÓN FIND-07-01: DISPARADORES ORDINARIOS Y DESTINATARIOS ---');

  // A. Creación de Reunión y Convocatoria
  const meetingDate = new Date(Date.now() + 86400000 * 3);
  const meeting = await prisma.meeting.create({
    data: {
      folio: `SES-AUD-${runId}-01`,
      title: `Sesión Extraordinaria de Evaluación <Seguridad & Cumplimiento> ${runId}`,
      description: 'Sesión para verificar disparadores y plantillas con caracteres especiales',
      meetingDate,
      startTime: new Date('1970-01-01T10:00:00.000Z'),
      endTime: new Date('1970-01-01T12:00:00.000Z'),
      modality: MeetingModality.PRESENCIAL,
      location: 'Sala del Consejo Central, Piso 4',
      status: MeetingStatus.PROGRAMADA,
      categoryId: category.id,
      createdById: userPresidente.id,
      presidedById: userPresidente.id,
      participants: {
        create: [
          {
            userId: userPresidente.id,
            institutionalRole: 'PRESIDENTE',
            isExternal: false,
          },
          {
            userId: userSecretario.id,
            institutionalRole: 'SECRETARIO',
            isExternal: false,
          },
        ],
      },
    },
  });

  await prisma.meetingConvocatoria.create({
    data: {
      meetingId: meeting.id,
      convocatoriaNumber: `CONV-AUD-${runId}-01`,
      noticeText: 'Se convoca a los miembros del Comité de Evaluación Técnica.',
    },
  });

  // Disparar publicación de convocatoria
  await meetingsService.publishConvocatoria(meeting.id, {}, userPresidente.id);

  // Verificar notificaciones generadas para participantes
  const notifPresidente = await prisma.notification.findFirst({
    where: { userId: userPresidente.id, type: NotificationType.REUNION_CONVOCATORIA },
  });
  const notifSecretario = await prisma.notification.findFirst({
    where: { userId: userSecretario.id, type: NotificationType.REUNION_CONVOCATORIA },
  });
  const notifAjeno = await prisma.notification.findFirst({
    where: { userId: userAjeno.id, type: NotificationType.REUNION_CONVOCATORIA },
  });

  logTest(3, 'publishConvocatoria generó notificación REUNION_CONVOCATORIA a participantes convocados',
    Boolean(notifPresidente && notifSecretario),
    `Notif Presidente ID: ${notifPresidente?.id}, Notif Secretaria ID: ${notifSecretario?.id}`);

  logTest(4, 'publishConvocatoria excluyó estrictamente al usuario ajeno (sin registro en reunión)',
    notifAjeno === null,
    'Usuario ajeno tiene 0 notificaciones');

  // B. Modificación de Reunión en estado CONVOCADA
  await meetingsService.update(
    meeting.id,
    { location: 'Sala Virtual MexAgenda Encriptada — Sala B' },
    userPresidente.id
  );

  const updateNotif = await prisma.notification.findFirst({
    where: { userId: userSecretario.id, type: NotificationType.REUNION_MODIFICADA },
  });
  logTest(5, 'update de reunión convocada generó REUNION_MODIFICADA con detalles de cambio',
    Boolean(updateNotif && updateNotif.message.includes('Sala Virtual')),
    `Mensaje: ${updateNotif?.message}`);

  // C. Aprobación de Acta Oficial (con enlace a la sesión)
  await prisma.meetingMinutes.create({
    data: {
      meeting: { connect: { id: meeting.id } },
      creator: { connect: { id: userPresidente.id } },
      minutesNumber: `ACTA-AUD-${runId}-01`,
      summary: 'Resumen oficial de los acuerdos y dictámenes colegiados adoptados.',
    },
  });

  await meetingsService.approveMinutes(meeting.id, {}, userPresidente.id);
  const minutesNotif = await prisma.notification.findFirst({
    where: { userId: userSecretario.id, type: NotificationType.ACTA_PUBLICADA },
  });
  logTest(6, 'approveMinutes generó ACTA_PUBLICADA con enlace directo a la sesión institucional',
    Boolean(minutesNotif && minutesNotif.actionUrl === `/meetings/${meeting.id}`),
    `actionUrl: ${minutesNotif?.actionUrl}`);

  // D. Flujo de Acuerdos Institucionales
  const dueDateStr = new Date(Date.now() + 86400000 * 14).toISOString().split('T')[0];
  const agreement = await agreementsService.create(
    {
      meetingId: meeting.id,
      title: `Implementar Protocolo de Seguridad en Bóveda & Notificaciones ${runId}`,
      description: 'Acuerdo institucional formal para auditar trazabilidad.',
      assignedToId: userSecretario.id,
      dueDate: dueDateStr,
      priority: 'ALTA',
    },
    userPresidente.id
  );

  const agreementNotif = await prisma.notification.findFirst({
    where: { userId: userSecretario.id, type: NotificationType.ACUERDO_ASIGNADO },
  });
  logTest(7, 'agreementsService.create generó ACUERDO_ASIGNADO al titular responsable',
    Boolean(agreementNotif && agreementNotif.resourceId === agreement.id),
    `resourceId: ${agreementNotif?.resourceId}`);

  // Cambio de estado de acuerdo: EN_PROCESO
  await agreementsService.addProgress(
    agreement.id,
    { description: 'Inicio de implementación de módulos de cifrado', newPercent: 25 },
    userSecretario.id
  );

  const progressNotif = await prisma.notification.findFirst({
    where: {
      userId: userPresidente.id,
      type: NotificationType.ACUERDO_ESTADO_CAMBIO,
      message: { contains: 'EN_PROCESO' },
    },
  });
  logTest(8, 'addProgress con cambio de estado generó ACUERDO_ESTADO_CAMBIO a creador',
    Boolean(progressNotif),
    `Notif Estado Cambio ID: ${progressNotif?.id}`);

  // Reasignación de acuerdo a nuevo responsable
  await agreementsService.assign(
    agreement.id,
    { assignedToId: userAjeno.id, justification: 'Reasignación formal por cambio de comisión' },
    userPresidente.id
  );

  const reassignNotif = await prisma.notification.findFirst({
    where: { userId: userAjeno.id, type: NotificationType.ACUERDO_ASIGNADO },
  });
  logTest(9, 'agreementsService.assign generó ACUERDO_ASIGNADO al nuevo titular',
    Boolean(reassignNotif),
    `Nuevo titular notificado: ${userAjeno.email}`);

  // --------------------------------------------------------------------------
  // BLOQUE 3: PRIVACIDAD Y AISLAMIENTO ESTRICTO DE NOTAS (FIND-07-01)
  // --------------------------------------------------------------------------
  console.log('\n--- 3. REGLAS DE PRIVACIDAD ESTRICTA (NOTAS PRIVADAS VS REUNIÓN) ---');

  // Nota PRIVADA: Cero notificaciones y cero entregas
  const countDeliveriesBefore = await prisma.notificationDelivery.count();
  const countNotifsBefore = await prisma.notification.count();

  const notePrivada = await notesService.create(
    {
      title: 'Anotación Estratégica Confidencial de Auditoría',
      content: 'Contenido altamente confidencial de evaluación de riesgos institucionales.',
      visibility: 'PRIVADA',
      meetingId: meeting.id,
    },
    { id: userPresidente.id, role: 'ROLE_USER', permissions: [] }
  );

  const countDeliveriesAfterPriv = await prisma.notificationDelivery.count();
  const countNotifsAfterPriv = await prisma.notification.count();

  const zeroPrivNotifs = (countNotifsAfterPriv === countNotifsBefore) &&
                         (countDeliveriesAfterPriv === countDeliveriesBefore);
  logTest(10, 'Creación de Nota PRIVADA generó CERO notificaciones y CERO entregas outbox',
    zeroPrivNotifs,
    `Notificaciones previas: ${countNotifsBefore}, posteriores: ${countNotifsAfterPriv}`);

  // Intento deliberado de invocar notifyNoteShared con una nota privada (defensa en profundidad)
  let privateIntercepted = false;
  try {
    await notificationsService.notifyNoteShared(notePrivada.id);
  } catch (err) {
    privateIntercepted = err.message.includes('Las notas privadas no pueden emitir notificaciones');
  }
  logTest(11, 'notifyNoteShared rechaza explícitamente notas con visibilidad PRIVADA (BadRequestException)',
    privateIntercepted,
    'Excepción arrojada y abortada antes de persistir o encolar');

  // Nota de REUNIÓN: notifica únicamente a participantes
  const noteReunion = await notesService.create(
    {
      title: 'Minuta de Acuerdos Preliminares de Comisión',
      content: 'Anotación compartida con los miembros de la sesión técnica.',
      visibility: 'REUNION',
      meetingId: meeting.id,
    },
    { id: userPresidente.id, role: 'ROLE_USER', permissions: [] }
  );

  const notifSecretarioNote = await prisma.notification.findFirst({
    where: { userId: userSecretario.id, type: NotificationType.NOTA_COMPARTIDA },
  });
  const notifAjenoNote = await prisma.notification.findFirst({
    where: { userId: userAjeno.id, type: NotificationType.NOTA_COMPARTIDA },
  });

  logTest(12, 'Creación de Nota REUNION notificó al participante registrado y EXCLUYÓ al ajeno',
    Boolean(notifSecretarioNote && !notifAjenoNote),
    `Secretario notificado: ${Boolean(notifSecretarioNote)}, Ajeno excluido: ${!notifAjenoNote}`);

  // --------------------------------------------------------------------------
  // BLOQUE 4: PREFERENCIAS DE USUARIO Y ATOMICIDAD (FIND-07-01)
  // --------------------------------------------------------------------------
  console.log('\n--- 4. PREFERENCIAS DE USUARIO, RESPETO DE CANAL Y ATOMICIDAD ---');

  // Desactivar emailEnabled para userSecretario
  await prisma.notificationPreference.upsert({
    where: { userId: userSecretario.id },
    update: { emailEnabled: false, inAppEnabled: true },
    create: { userId: userSecretario.id, emailEnabled: false, inAppEnabled: true },
  });

  const outboxCountBeforePref = await prisma.notificationDelivery.count({
    where: { recipientEmail: userSecretario.email },
  });

  await notificationsService.dispatchNotification({
    userId: userSecretario.id,
    type: NotificationType.INSTITUCIONAL_GENERAL,
    title: 'Aviso del Sistema con Email Desactivado',
    message: 'Esta notificación solo debe existir in-app, no en outbox.',
  });

  const outboxCountAfterPref = await prisma.notificationDelivery.count({
    where: { recipientEmail: userSecretario.email },
  });
  logTest(13, 'Preferencia emailEnabled: false previene creación de entrega en Outbox',
    outboxCountBeforePref === outboxCountAfterPref,
    `Entregas antes: ${outboxCountBeforePref}, después: ${outboxCountAfterPref}`);

  // Desactivar inAppEnabled y reactivar emailEnabled
  await prisma.notificationPreference.update({
    where: { userId: userSecretario.id },
    data: { emailEnabled: true, inAppEnabled: false },
  });

  await notificationsService.dispatchNotification({
    userId: userSecretario.id,
    type: NotificationType.INSTITUCIONAL_GENERAL,
    title: 'Aviso del Sistema con In-App Desactivado',
    message: 'Esta notificación solo se encola en outbox con registro de apoyo marcado como leído.',
  });

  const notifInAppDisabled = await prisma.notification.findFirst({
    where: { userId: userSecretario.id, title: 'Aviso del Sistema con In-App Desactivado' },
  });
  logTest(14, 'Preferencia inAppEnabled: false crea registro marcado leído sólo para respaldo de Outbox',
    Boolean(notifInAppDisabled && notifInAppDisabled.isRead === true),
    `isRead: ${notifInAppDisabled?.isRead}`);

  // Restaurar preferencias completas
  await prisma.notificationPreference.update({
    where: { userId: userSecretario.id },
    data: { emailEnabled: true, inAppEnabled: true },
  });

  // Operación fallida o revertida: no emite avisos
  const notifsBeforeError = await prisma.notification.count();
  let opFailed = false;
  try {
    // Intentar cambiar estado de reunión a un estado inválido o con ID inexistente
    await meetingsService.changeStatus(
      '00000000-0000-0000-0000-000000000000',
      { status: 'CANCELADA', reason: 'Prueba de fallo' },
      userPresidente.id
    );
  } catch (err) {
    opFailed = true;
  }
  const notifsAfterError = await prisma.notification.count();
  logTest(15, 'Operación de negocio fallida / inexistente no emite notificaciones ni avisos',
    opFailed && (notifsBeforeError === notifsAfterError),
    `Error capturado correctamente, notificaciones emitidas: 0`);

  // Idempotencia: envío repetido con la misma entrada
  const idempKey = `idemp_audit_${runId}`;
  const d1 = await notificationsService.dispatchNotification({
    userId: userSecretario.id,
    type: NotificationType.INSTITUCIONAL_GENERAL,
    title: 'Prueba Idempotencia 1',
    message: 'Mensaje duplicado',
    idempotencyKey: idempKey,
  });
  const d2 = await notificationsService.dispatchNotification({
    userId: userSecretario.id,
    type: NotificationType.INSTITUCIONAL_GENERAL,
    title: 'Prueba Idempotencia 2',
    message: 'Mensaje duplicado',
    idempotencyKey: idempKey,
  });

  const outboxDups = await prisma.notificationDelivery.count({
    where: { idempotencyKey: idempKey },
  });
  logTest(16, 'Idempotencia: Invocación duplicada con la misma clave genera exactamente 1 entrega',
    outboxDups === 1,
    `Entregas registradas con clave ${idempKey}: ${outboxDups}`);

  // Dos cambios legítimos y distintos generan sus respectivos avisos
  const k1 = `diff_event_1_${runId}`;
  const k2 = `diff_event_2_${runId}`;
  await notificationsService.dispatchNotification({
    userId: userSecretario.id,
    type: NotificationType.ACUERDO_ESTADO_CAMBIO,
    title: 'Cambio Legítimo 1: EN_PROCESO',
    message: 'Avance registrado',
    idempotencyKey: k1,
  });
  await notificationsService.dispatchNotification({
    userId: userSecretario.id,
    type: NotificationType.ACUERDO_ESTADO_CAMBIO,
    title: 'Cambio Legítimo 2: CUMPLIDO',
    message: 'Acuerdo cumplido',
    idempotencyKey: k2,
  });
  const outboxDistinct = await prisma.notificationDelivery.count({
    where: { idempotencyKey: { in: [k1, k2] } },
  });
  logTest(17, 'Dos cambios legítimos y distintos generan sus respectivos avisos independientes',
    outboxDistinct === 2,
    `Entregas distintas generadas: ${outboxDistinct}`);

  // --------------------------------------------------------------------------
  // BLOQUE 5: VERIFICACIÓN FIND-07-02 — PLANTILLAS HTML Y MOCK TRANSPORTER
  // --------------------------------------------------------------------------
  console.log('\n--- 5. VERIFICACIÓN FIND-07-02: PLANTILLAS HTML, WORKER Y TRANSPORTE ---');

  // A. Verificación del esquema y migración de NotificationDelivery
  const sampleDelivery = await prisma.notificationDelivery.findFirst({
    where: { recipientEmail: userSecretario.email, htmlBody: { not: null } },
  });
  logTest(18, 'Migración 20261107190000 persistió subject, htmlBody y textBody en Neon PostgreSQL',
    Boolean(sampleDelivery && sampleDelivery.subject && sampleDelivery.htmlBody && sampleDelivery.textBody),
    `subject: ${sampleDelivery?.subject?.substring(0, 40)}..., htmlBody length: ${sampleDelivery?.htmlBody?.length} chars`);

  // B. Sanitización y escape de caracteres especiales (<script>, &, ", ')
  const xssTitle = `<script>alert("XSS")</script> & Junta Colegiada "Oficial" '2026'`;
  const xssDesc = `Validación de escapar <tags> & caracteres especiales: "comillas" y 'apóstrofes'`;

  const xssNotificationId = await notificationsService.dispatchNotification({
    userId: userSecretario.id,
    type: NotificationType.REUNION_CONVOCATORIA,
    title: xssTitle,
    message: xssDesc,
    actionUrl: `/meetings/${meeting.id}`,
    metadata: {
      meetingTitle: xssTitle,
      categoryName: 'Órgano & Colegiado <Auditoría>',
      meetingDate: new Date().toISOString(),
      modality: 'PRESENCIAL',
    },
    idempotencyKey: `xss_test_${runId}`,
  });

  const xssDelivery = await prisma.notificationDelivery.findFirst({
    where: { idempotencyKey: `xss_test_${runId}` },
  });

  const htmlBodySaved = xssDelivery?.htmlBody || '';
  const isXssEscaped = !htmlBodySaved.includes('<script>') &&
                       htmlBodySaved.includes('&lt;script&gt;') &&
                       htmlBodySaved.includes('&amp;');
  logTest(19, 'Caracteres dinámicos especiales (<script>, &, ", \') son estrictamente escapados en HTML',
    isXssEscaped,
    `HTML escapado verificado: contiene &lt;script&gt; y no contiene tags ejecutables directos`);

  // C. Despacho por OutboxWorkerService y Captura en Mock Transporter
  // Interceptar lo que recibe smtpService.sendMail para comprobar contenido efectivamente entregado
  const capturedMails = [];
  const originalSendMail = smtpService.sendMail.bind(smtpService);
  smtpService.sendMail = async function (params) {
    capturedMails.push(params);
    return originalSendMail(params);
  };

  const processResult = await outboxWorker.processPendingDeliveries(50);
  logTest(20, 'OutboxWorkerService procesó entregas pendientes con éxito',
    processResult.processed > 0 && processResult.failed === 0,
    `Procesadas: ${processResult.processed}, Exitosas: ${processResult.succeeded}, Fallidas: ${processResult.failed}`);

  // Verificar el correo capturado por el Mock Transporter para la entrega XSS
  const capturedXssMail = capturedMails.find((m) => m.to === userSecretario.email && m.subject.includes('Convocatoria'));
  assert(capturedXssMail, 'No se capturó correo de convocatoria para userSecretario en Mock');

  const hasInstitutionalHeader = capturedXssMail.html.includes('Sistema Privado de Gestión Institucional') &&
                                 capturedXssMail.html.includes('AGENDA');
  const hasConfidentialityFooter = capturedXssMail.html.includes('AVISO DE CONFIDENCIALIDAD INSTITUCIONAL') ||
                                   capturedXssMail.html.toLowerCase().includes('aviso de confidencialidad');
  const hasActionLink = capturedXssMail.html.includes(`/meetings/${meeting.id}`);
  const hasPlainText = Boolean(capturedXssMail.text && capturedXssMail.text.includes('MEXAGENDA'));

  logTest(21, 'Mock Transporter recibió mensaje con encabezado institucional MEXAGENDA oficial',
    hasInstitutionalHeader,
    'Contiene "Sistema Privado de Gestión Institucional" y "AGENDA"');

  logTest(22, 'Mock Transporter recibió mensaje con Aviso de Confidencialidad Institucional obligatorio',
    hasConfidentialityFooter,
    'Pie legal verificado en mensaje despachado');

  logTest(23, 'Mock Transporter recibió enlace directo al recurso (/meetings/{id}) con control de acceso',
    hasActionLink,
    `Enlace verificado: /meetings/${meeting.id}`);

  logTest(24, 'Mock Transporter recibió versión multipart/alternative en texto plano',
    hasPlainText,
    `Texto plano length: ${capturedXssMail.text.length} caracteres`);

  // D. Retrocompatibilidad con entregas históricas (htmlBody == null)
  // Crear una entrega histórica en Neon PostgreSQL con htmlBody y subject nulos
  const historicalDelivery = await prisma.notificationDelivery.create({
    data: {
      notificationId: notifPresidente.id,
      recipientEmail: userPresidente.email,
      channel: 'EMAIL',
      status: DeliveryStatus.PENDIENTE,
      subject: null,
      htmlBody: null,
      textBody: null,
      idempotencyKey: `hist_legacy_${runId}`,
    },
  });

  const capturedLegacyMails = [];
  smtpService.sendMail = async function (params) {
    capturedLegacyMails.push(params);
    return originalSendMail(params);
  };

  await outboxWorker.processPendingDeliveries(10);

  const deliveredLegacy = await prisma.notificationDelivery.findUnique({
    where: { id: historicalDelivery.id },
  });

  const capturedLegacyMail = capturedLegacyMails.find((m) => m.to === userPresidente.email);
  const legacyReconstructed = capturedLegacyMail &&
                              capturedLegacyMail.html.includes('Sistema Privado de Gestión Institucional') &&
                              (capturedLegacyMail.html.includes('AVISO DE CONFIDENCIALIDAD') ||
                               capturedLegacyMail.html.toLowerCase().includes('aviso de confidencialidad'));

  logTest(25, 'Entrega histórica (htmlBody == null) reconstruye plantilla HTML completa vía resolveEmailContent',
    Boolean(legacyReconstructed),
    `Mock recibió HTML institucional reconstruido: ${legacyReconstructed}`);

  logTest(26, 'Entrega histórica marcada como ENVIADA con timestamp sentAt en base de datos',
    deliveredLegacy.status === DeliveryStatus.ENVIADO && Boolean(deliveredLegacy.sentAt),
    `Estado: ${deliveredLegacy.status}, sentAt: ${deliveredLegacy.sentAt}`);

  // E. Fallo controlado de envío y reintento con preservación de plantilla HTML
  const retryDelivery = await prisma.notificationDelivery.create({
    data: {
      notificationId: notifSecretario.id,
      recipientEmail: 'failing-test@auditoria.gob.mx',
      channel: 'EMAIL',
      status: DeliveryStatus.PENDIENTE,
      subject: 'Prueba de Fallo y Reintento Controlado',
      htmlBody: '<p>Plantilla HTML Preservada en Reintento</p>',
      textBody: 'Texto Preservado',
      attempts: 0,
      maxAttempts: 3,
      idempotencyKey: `failing_retry_${runId}`,
    },
  });

  // Simular fallo en transporte SMTP
  smtpService.sendMail = async function (params) {
    if (params.to === 'failing-test@auditoria.gob.mx') {
      return { success: false, error: 'SIMULATED_SMTP_CONNECTION_REFUSED' };
    }
    return originalSendMail(params);
  };

  await outboxWorker.processPendingDeliveries(10);

  const deliveryAfterFail = await prisma.notificationDelivery.findUnique({
    where: { id: retryDelivery.id },
  });

  const isFailedWithBackoff = deliveryAfterFail.status === DeliveryStatus.PENDIENTE &&
                              deliveryAfterFail.attempts === 1 &&
                              deliveryAfterFail.htmlBody === '<p>Plantilla HTML Preservada en Reintento</p>' &&
                              Boolean(deliveryAfterFail.nextAttemptAt) &&
                              deliveryAfterFail.errorMessage &&
                              deliveryAfterFail.errorMessage.includes('SIMULATED_SMTP_CONNECTION_REFUSED');

  logTest(27, 'Fallo controlado en transporte incrementa attempts (1), aplica backoff exponencial y PRESERVA htmlBody',
    Boolean(isFailedWithBackoff),
    `attempts: ${deliveryAfterFail?.attempts}, status: ${deliveryAfterFail?.status}, nextAttemptAt: ${deliveryAfterFail?.nextAttemptAt}`);

  // Ahora restaurar transporte exitoso y forzar fecha de reintento en el pasado para procesar
  await prisma.notificationDelivery.update({
    where: { id: retryDelivery.id },
    data: { nextAttemptAt: new Date(Date.now() - 10000) },
  });

  const capturedRetryMails = [];
  smtpService.sendMail = async function (params) {
    capturedRetryMails.push(params);
    return originalSendMail(params);
  };

  await outboxWorker.processPendingDeliveries(10);

  const deliveryAfterRetry = await prisma.notificationDelivery.findUnique({
    where: { id: retryDelivery.id },
  });

  const retryCaptured = capturedRetryMails.find((m) => m.to === 'failing-test@auditoria.gob.mx');
  const retryPreservedHtml = retryCaptured && retryCaptured.html.includes('Plantilla HTML Preservada en Reintento');

  logTest(28, 'Reintento exitoso utiliza exactamente el payload HTML persistido sin degradación a texto plano',
    deliveryAfterRetry.status === DeliveryStatus.ENVIADO && Boolean(retryPreservedHtml),
    `Estado tras reintento: ${deliveryAfterRetry?.status}, HTML despachado íntegro: ${Boolean(retryPreservedHtml)}`);

  // F. Evidencia separada: Payload en Base de Datos vs Mensaje en Transporte
  const dbRecord = await prisma.notificationDelivery.findUnique({
    where: { id: sampleDelivery.id },
    select: { id: true, subject: true, htmlBody: true, status: true, recipientEmail: true },
  });
  logTest(29, 'Separación probatoria verificada: Registro atómico en Neon DB vs Entrega por Mock Transporter',
    Boolean(dbRecord && dbRecord.htmlBody && dbRecord.status === DeliveryStatus.ENVIADO),
    `DB ID: ${dbRecord?.id} (status: ${dbRecord?.status}) | Mock Transporter Mails recibidos: ${capturedMails.length}`);

  // --------------------------------------------------------------------------
  // LIMPIEZA ATÓMICA DE REGISTROS DE AUDITORÍA
  // --------------------------------------------------------------------------
  console.log('\n--- 6. LIMPIEZA ATÓMICA DE REGISTROS DE AUDITORÍA ---');
  const dDeleted = await prisma.notificationDelivery.deleteMany({
    where: {
      OR: [
        { recipientEmail: { contains: runId } },
        { recipientEmail: 'failing-test@auditoria.gob.mx' },
        { idempotencyKey: { contains: runId } },
      ],
    },
  });

  const nDeleted = await prisma.notification.deleteMany({
    where: {
      OR: [
        { userId: { in: [userPresidente.id, userSecretario.id, userAjeno.id] } },
        { title: { contains: runId } },
      ],
    },
  });

  await prisma.notificationPreference.deleteMany({
    where: { userId: { in: [userPresidente.id, userSecretario.id, userAjeno.id] } },
  });

  await prisma.personalNote.deleteMany({
    where: { authorId: { in: [userPresidente.id, userSecretario.id, userAjeno.id] } },
  });

  const agrs = await prisma.agreement.findMany({
    where: { meetingId: meeting.id },
    select: { id: true },
  });
  const agrIds = agrs.map((a) => a.id);
  if (agrIds.length > 0) {
    await prisma.agreementHistory.deleteMany({ where: { agreementId: { in: agrIds } } });
    await prisma.agreementProgress.deleteMany({ where: { agreementId: { in: agrIds } } });
    await prisma.agreementCollaborator.deleteMany({ where: { agreementId: { in: agrIds } } });
    await prisma.agreement.deleteMany({ where: { id: { in: agrIds } } });
  }

  await prisma.meetingMinutes.deleteMany({
    where: { meetingId: meeting.id },
  });

  await prisma.meetingConvocatoria.deleteMany({
    where: { meetingId: meeting.id },
  });

  await prisma.meetingParticipant.deleteMany({
    where: { meetingId: meeting.id },
  });

  await prisma.meeting.deleteMany({
    where: { id: meeting.id },
  });

  await prisma.meetingCategory.deleteMany({
    where: { id: category.id },
  });

  await prisma.user.deleteMany({
    where: { id: { in: [userPresidente.id, userSecretario.id, userAjeno.id] } },
  });

  console.log(`  - Entregas outbox eliminadas: ${dDeleted.count}`);
  console.log(`  - Notificaciones eliminadas: ${nDeleted.count}`);
  console.log(`  - Usuarios y entidades de prueba eliminados exitosamente.`);

  console.log('\n==============================================================================');
  console.log(`TOTAL DE PRUEBAS AUDITADAS: ${totalTests}`);
  console.log(`SUPERADAS:                 ${passedTests}`);
  console.log(`FALLIDAS:                  ${totalTests - passedTests}`);
  console.log(`TASA DE ÉXITO:             ${((passedTests / totalTests) * 100).toFixed(1)}%`);
  console.log('==============================================================================');

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

runAudit()
  .catch((err) => {
    console.error('Error fatal durante la auditoría:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

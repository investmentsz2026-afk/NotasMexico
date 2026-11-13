/**
 * ==============================================================================
 * MEXAGENDA — SUITE DE VERIFICACIÓN DE CORRECCIONES POST-AUDITORÍA FASE 7
 * ==============================================================================
 * RESOLUCIÓN DE HALLAZGOS:
 * - FIND-07-01: Disparadores automáticos transversales en flujos de negocio reales:
 *               Reuniones, Acuerdos institucionales y Notas de sesión (con privacidad).
 * - FIND-07-02: Carga útil y plantilla HTML institucional en worker asíncrono
 *               (Transactional Outbox) con compatibilidad hacia atrás.
 * ==============================================================================
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const {
  PrismaClient,
  NotificationType,
  NotificationChannel,
  DeliveryStatus,
  AgreementStatus,
  UserStatus,
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

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function check(condition, testName, details = '') {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✓ [TEST-${String(totalTests).padStart(2, '0')}] ${testName}`);
  } else {
    failedTests++;
    console.error(`  ✗ [FAIL-${String(totalTests).padStart(2, '0')}] ${testName}: ${details}`);
  }
}

async function runPhase7FixesSuite() {
  console.log('==============================================================================');
  console.log('MEXAGENDA — VERIFICACIÓN POST-AUDITORÍA FASE 7 (FIND-07-01 & FIND-07-02)');
  console.log('Base de Datos: Neon PostgreSQL Serverless');
  console.log('==============================================================================\n');

  // Track created entities for atomic cleanup
  const cleanup = {
    deliveries: new Set(),
    notifications: new Set(),
    notes: new Set(),
    agreements: new Set(),
    meetings: new Set(),
    users: new Set(),
  };

  // Captured emails for Outbox worker inspection
  const sentEmails = [];

  try {
    // --------------------------------------------------------------------------
    // SECCIÓN 0: INICIALIZACIÓN DE SERVICIOS Y SPY DE TRANSPORTE SMTP
    // --------------------------------------------------------------------------
    console.log('--- 0. PREPARACIÓN DEL ENTORNO DE PRUEBAS ---');

    const mockConfig = new MockConfigService();
    const smtpService = new SmtpService(mockConfig);

    // Interceptar sendMail de SmtpService para validar HTML y texto transportados
    const originalSendMail = smtpService.sendMail.bind(smtpService);
    smtpService.sendMail = async (options) => {
      sentEmails.push({ ...options });
      return originalSendMail(options);
    };

    const auditService = new AuditService(prisma);
    const outboxWorker = new OutboxWorkerService(prisma, smtpService);
    const notificationsService = new NotificationsService(prisma, auditService, smtpService, outboxWorker);

    // Limpiar entregas residuales previas de tests anteriores con direcciones inválidas
    await prisma.notificationDelivery.deleteMany({
      where: {
        OR: [
          { recipientEmail: { contains: 'invalid-email' } },
          { recipientEmail: null },
        ],
      },
    });

    const meetingsService = new MeetingsService(prisma, auditService, notificationsService);
    const agreementsService = new AgreementsService(prisma, auditService, notificationsService);
    const notesService = new NotesService(prisma, auditService, notificationsService);

    check(smtpService.isMock() === true, 'SmtpService inicializado en modo Mock seguro');

    // --------------------------------------------------------------------------
    // SECCIÓN 1: CREACIÓN DE USUARIOS INSTITUCIONALES DE PRUEBA
    // --------------------------------------------------------------------------
    console.log('\n--- 1. CREACIÓN DE INTEGRANTES INSTITUCIONALES PARA PRUEBAS ---');

    const suffix = Date.now().toString(36);
    const defaultPasswordHash = '$2b$10$wT0vVbQxT/h27cRfZv3yReR7bY1fFqM4Y1e8b9s1Wc9i2k3l4m5n6'; // placeholder

    const userRole = await prisma.role.findFirst({
      where: { code: 'ROLE_USER' },
    });

    const userA = await prisma.user.create({
      data: {
        email: `coord-${suffix}@institucion.gob.mx`,
        passwordHash: defaultPasswordHash,
        firstName: 'Coordinador',
        lastName: 'General',
        position: 'Coordinador General',
        status: UserStatus.ACTIVO,
        roleId: userRole.id,
      },
    });
    cleanup.users.add(userA.id);

    const userB = await prisma.user.create({
      data: {
        email: `vocal-${suffix}@institucion.gob.mx`,
        passwordHash: defaultPasswordHash,
        firstName: 'Vocal',
        lastName: 'Colegiado',
        position: 'Vocal Colegiado',
        status: UserStatus.ACTIVO,
        roleId: userRole.id,
      },
    });
    cleanup.users.add(userB.id);

    const userThird = await prisma.user.create({
      data: {
        email: `ajeno-${suffix}@institucion.gob.mx`,
        passwordHash: defaultPasswordHash,
        firstName: 'Funcionario',
        lastName: 'Externo',
        position: 'Funcionario Externo',
        status: UserStatus.ACTIVO,
        roleId: userRole.id,
      },
    });
    cleanup.users.add(userThird.id);

    // Asegurar preferencias activadas para userB
    await notificationsService.getOrCreatePreferences(userB.id);
    await notificationsService.getOrCreatePreferences(userThird.id);

    check(
      userA.id && userB.id && userThird.id,
      '3 usuarios institucionales aprovisionados en Neon PostgreSQL'
    );

    // Obtener categoría de reunión válida
    let meetingCategory = await prisma.meetingCategory.findFirst({
      where: { isActive: true },
    });
    if (!meetingCategory) {
      meetingCategory = await prisma.meetingCategory.create({
        data: {
          name: 'Comité Directivo Post-Audit',
          code: `CD-${suffix.slice(0, 4).toUpperCase()}`,
          colorHex: '#1e3a8a',
          isActive: true,
        },
      });
    }

    // --------------------------------------------------------------------------
    // SECCIÓN 2: FIND-07-01 EN REUNIONES INSTITUCIONALES
    // --------------------------------------------------------------------------
    console.log('\n--- 2. FLUJO REAL DE REUNIONES: CONVOCATORIA, ACTUALIZACIÓN, CANCELACIÓN Y ACTAS ---');

    // 2.1 Crear Reunión con UserA (Preside) y UserB (Participante colegiado)
    const meeting = await prisma.meeting.create({
      data: {
        folio: `SES-FIX1-${suffix.toUpperCase()}-${Date.now()}`,
        title: `Sesión Extraordinaria ${suffix}`,
        meetingDate: new Date(Date.now() + 86400000 * 3),
        startTime: new Date('1970-01-01T10:00:00.000Z'),
        endTime: new Date('1970-01-01T12:00:00.000Z'),
        location: 'Sala de Juntas de Rectoría',
        modality: 'PRESENCIAL',
        status: 'PROGRAMADA',
        categoryId: meetingCategory.id,
        createdById: userA.id,
        presidedById: userA.id,
        participants: {
          create: [
            { userId: userA.id, institutionalRole: 'PRESIDENTE', isExternal: false },
            { userId: userB.id, institutionalRole: 'VOCAL', isExternal: false },
          ],
        },
        convocatoria: {
          create: {
            convocatoriaNumber: `CONV-${suffix.toUpperCase()}-${Date.now()}`,
            noticeText: 'Por acuerdo de la Presidencia se convoca a sesión institucional ordinaria.',
            isPublished: false,
          },
        },
      },
    });
    cleanup.meetings.add(meeting.id);

    // 2.2 Publicar Convocatoria
    await meetingsService.publishConvocatoria(meeting.id, {}, userA.id);

    // Verificar notificación generada para UserB
    const convNotif = await prisma.notification.findFirst({
      where: {
        userId: userB.id,
        type: NotificationType.REUNION_CONVOCATORIA,
        resourceId: meeting.id,
      },
    });
    check(
      convNotif !== null,
      'FIND-07-01: publishConvocatoria disparó automáticamente notificación REUNION_CONVOCATORIA para participante'
    );
    if (convNotif) cleanup.notifications.add(convNotif.id);

    // Verificar encolamiento en Transactional Outbox con plantilla HTML institucional (FIND-07-02)
    const convDelivery = await prisma.notificationDelivery.findFirst({
      where: {
        notificationId: convNotif?.id,
        recipientEmail: userB.email,
      },
    });
    check(
      convDelivery !== null &&
        convDelivery.channel === NotificationChannel.EMAIL &&
        convDelivery.status === DeliveryStatus.PENDIENTE &&
        convDelivery.htmlBody !== null &&
        convDelivery.htmlBody.includes('Sistema Privado de Gestión Institucional') &&
        convDelivery.htmlBody.includes('AVISO DE CONFIDENCIALIDAD INSTITUCIONAL') &&
        convDelivery.subject.includes('[MexAgenda] Convocatoria'),
      'FIND-07-02: Entrega en Outbox almacena subject y htmlBody con plantilla HTML institucional completa'
    );
    if (convDelivery) cleanup.deliveries.add(convDelivery.id);

    // 2.3 Modificar Reunión (Reunión en estado CONVOCADA)
    await meetingsService.update(
      meeting.id,
      {
        title: `Sesión Extraordinaria Actualizada ${suffix}`,
        location: 'Auditorio Principal de Posgrado',
      },
      userA.id
    );

    const updateNotif = await prisma.notification.findFirst({
      where: {
        userId: userB.id,
        type: NotificationType.REUNION_MODIFICADA,
        resourceId: meeting.id,
      },
    });
    check(
      updateNotif !== null,
      'FIND-07-01: update de reunión en estado CONVOCADA disparó notificación REUNION_MODIFICADA'
    );
    if (updateNotif) cleanup.notifications.add(updateNotif.id);

    const updateDelivery = await prisma.notificationDelivery.findFirst({
      where: { notificationId: updateNotif?.id },
    });
    check(
      updateDelivery !== null &&
        updateDelivery.htmlBody !== null &&
        updateDelivery.htmlBody.includes('Actualización de Sesión Colegiada'),
      'FIND-07-02: Outbox para REUNION_MODIFICADA incluye plantilla HTML de actualización'
    );
    if (updateDelivery) cleanup.deliveries.add(updateDelivery.id);

    // 2.4 Cancelar Reunión
    await meetingsService.changeStatus(
      meeting.id,
      {
        status: 'CANCELADA',
        reason: 'Causa de fuerza mayor institucional por suspensión de actividades',
      },
      userA.id
    );

    const cancelNotif = await prisma.notification.findFirst({
      where: {
        userId: userB.id,
        type: NotificationType.REUNION_CANCELADA,
        resourceId: meeting.id,
      },
    });
    check(
      cancelNotif !== null,
      'FIND-07-01: changeStatus a CANCELADA disparó notificación REUNION_CANCELADA a participantes'
    );
    if (cancelNotif) cleanup.notifications.add(cancelNotif.id);

    const cancelDelivery = await prisma.notificationDelivery.findFirst({
      where: { notificationId: cancelNotif?.id },
    });
    check(
      cancelDelivery !== null &&
        cancelDelivery.htmlBody !== null &&
        cancelDelivery.htmlBody.includes('Aviso de Cancelación de Sesión'),
      'FIND-07-02: Outbox para REUNION_CANCELADA incluye plantilla HTML de cancelación'
    );
    if (cancelDelivery) cleanup.deliveries.add(cancelDelivery.id);

    // 2.5 Aprobación de Acta Oficial
    // Crear una segunda reunión para desarrollo y acta
    const meetingForMinutes = await prisma.meeting.create({
      data: {
        folio: `SES-FIX2-${suffix.toUpperCase()}-${Date.now()}`,
        title: `Sesión para Aprobación de Acta ${suffix}`,
        meetingDate: new Date(),
        startTime: new Date('1970-01-01T09:00:00.000Z'),
        endTime: new Date('1970-01-01T11:00:00.000Z'),
        location: 'Virtual',
        modality: 'VIRTUAL',
        status: 'FINALIZADA',
        categoryId: meetingCategory.id,
        createdById: userA.id,
        participants: {
          create: [{ userId: userB.id, institutionalRole: 'SECRETARIO', isExternal: false }],
        },
        minutes: {
          create: {
            minutesNumber: `ACTA-${suffix.toUpperCase()}-${Date.now()}`,
            summary: 'Siendo las 9:00 horas se reunieron los miembros colegiados para desahogar la orden del día...',
            status: 'BORRADOR',
            createdById: userA.id,
          },
        },
      },
    });
    cleanup.meetings.add(meetingForMinutes.id);

    await meetingsService.approveMinutes(
      meetingForMinutes.id,
      { approvalNotes: 'Aprobada sin modificaciones en sesión plenaria' },
      userA.id
    );

    const minutesNotif = await prisma.notification.findFirst({
      where: {
        userId: userB.id,
        type: NotificationType.ACTA_PUBLICADA,
        resourceId: meetingForMinutes.id,
      },
    });
    check(
      minutesNotif !== null,
      'FIND-07-01: approveMinutes disparó notificación ACTA_PUBLICADA a los participantes'
    );
    if (minutesNotif) cleanup.notifications.add(minutesNotif.id);

    const minutesDelivery = await prisma.notificationDelivery.findFirst({
      where: { notificationId: minutesNotif?.id },
    });
    check(
      minutesDelivery !== null &&
        minutesDelivery.htmlBody !== null &&
        minutesDelivery.htmlBody.includes('Publicación de Acta Institucional'),
      'FIND-07-02: Outbox para ACTA_PUBLICADA contiene la plantilla HTML de acta institucional'
    );
    if (minutesDelivery) cleanup.deliveries.add(minutesDelivery.id);

    // --------------------------------------------------------------------------
    // SECCIÓN 3: FIND-07-01 EN ACUERDOS INSTITUCIONALES
    // --------------------------------------------------------------------------
    console.log('\n--- 3. FLUJO REAL DE ACUERDOS: ASIGNACIÓN, REASIGNACIÓN, AVANCE, CUMPLIMIENTO, SUSPENSIÓN ---');

    // 3.1 Crear acuerdo institucional asignado a UserB
    const agreementDto = {
      title: `Acuerdo de Digitalización ${suffix}`,
      description: 'Implementar la digitalización del acervo patrimonial conforme a la norma.',
      meetingId: meetingForMinutes.id,
      assignedToId: userB.id,
      dueDate: new Date(Date.now() + 86400000 * 30).toISOString().split('T')[0],
      priority: 'ALTA',
    };

    const createdAgreement = await agreementsService.create(agreementDto, userA.id);
    cleanup.agreements.add(createdAgreement.id);

    const agrNotif = await prisma.notification.findFirst({
      where: {
        userId: userB.id,
        type: NotificationType.ACUERDO_ASIGNADO,
        resourceId: createdAgreement.id,
      },
    });
    check(
      agrNotif !== null,
      'FIND-07-01: agreementsService.create disparó automáticamente notificación ACUERDO_ASIGNADO al titular'
    );
    if (agrNotif) cleanup.notifications.add(agrNotif.id);

    const agrDelivery = await prisma.notificationDelivery.findFirst({
      where: { notificationId: agrNotif?.id },
    });
    check(
      agrDelivery !== null &&
        agrDelivery.htmlBody !== null &&
        agrDelivery.htmlBody.includes('Asignación de Acuerdo Institucional') &&
        agrDelivery.htmlBody.includes('RESPONSABLE'),
      'FIND-07-02: Outbox para ACUERDO_ASIGNADO incluye plantilla HTML de acuerdo con rol RESPONSABLE'
    );
    if (agrDelivery) cleanup.deliveries.add(agrDelivery.id);

    // 3.2 Reasignar acuerdo a UserThird
    await agreementsService.assign(
      createdAgreement.id,
      {
        assignedToId: userThird.id,
        justification: 'Cambio de titular de la coordinación técnica institucional',
      },
      userA.id
    );

    const reassignNotif = await prisma.notification.findFirst({
      where: {
        userId: userThird.id,
        type: NotificationType.ACUERDO_ASIGNADO,
        resourceId: createdAgreement.id,
      },
    });
    check(
      reassignNotif !== null,
      'FIND-07-01: agreementsService.assign disparó notificación ACUERDO_ASIGNADO al nuevo titular'
    );
    if (reassignNotif) cleanup.notifications.add(reassignNotif.id);

    // 3.3 Asentar avance de acuerdo (cambio de estado PENDIENTE -> EN_PROCESO)
    await agreementsService.addProgress(
      createdAgreement.id,
      {
        newPercent: 45,
        description: 'Avance del 45% verificado en plataforma de digitalización',
      },
      userThird.id
    );

    const progressNotif = await prisma.notification.findFirst({
      where: {
        userId: userA.id,
        type: NotificationType.ACUERDO_ESTADO_CAMBIO,
        resourceId: createdAgreement.id,
      },
    });
    check(
      progressNotif !== null,
      'FIND-07-01: addProgress provocó cambio de estado a EN_PROCESO y notificó a los involucrados'
    );
    if (progressNotif) cleanup.notifications.add(progressNotif.id);

    // 3.4 Completar acuerdo (CUMPLIDO)
    await agreementsService.complete(
      createdAgreement.id,
      {
        completionNotes: 'Certificación de cumplimiento al 100% recibida por el comité',
      },
      userA.id
    );

    const completedNotif = await prisma.notification.findFirst({
      where: {
        userId: userThird.id,
        type: NotificationType.ACUERDO_ESTADO_CAMBIO,
        resourceId: createdAgreement.id,
        message: { contains: 'CUMPLIDO' },
      },
    });
    check(
      completedNotif !== null,
      'FIND-07-01: agreementsService.complete notificó el estado CUMPLIDO al responsable'
    );
    if (completedNotif) cleanup.notifications.add(completedNotif.id);

    // 3.5 Crear segundo acuerdo para probar Suspensión y Reactivación
    const agreement2 = await agreementsService.create(
      {
        title: `Acuerdo de Auditoría ${suffix}`,
        description: 'Revisión técnica de los sistemas institucionales.',
        meetingId: meetingForMinutes.id,
        assignedToId: userB.id,
        dueDate: new Date(Date.now() + 86400000 * 45).toISOString().split('T')[0],
        priority: 'MEDIA',
      },
      userA.id
    );
    cleanup.agreements.add(agreement2.id);

    await agreementsService.suspend(
      agreement2.id,
      { justification: 'Suspensión temporal por veda presupuestaria' },
      userA.id
    );

    const suspendedNotif = await prisma.notification.findFirst({
      where: {
        userId: userB.id,
        type: NotificationType.ACUERDO_ESTADO_CAMBIO,
        resourceId: agreement2.id,
        message: { contains: 'SUSPENDIDO' },
      },
    });
    check(
      suspendedNotif !== null,
      'FIND-07-01: agreementsService.suspend notificó el estado SUSPENDIDO al responsable'
    );
    if (suspendedNotif) cleanup.notifications.add(suspendedNotif.id);

    await agreementsService.reactivate(
      agreement2.id,
      { justification: 'Aprobación de suficiencia presupuestaria para reanudar' },
      userA.id
    );

    const reactivatedNotif = await prisma.notification.findFirst({
      where: {
        userId: userB.id,
        type: NotificationType.ACUERDO_ESTADO_CAMBIO,
        resourceId: agreement2.id,
        message: { contains: 'PENDIENTE' },
      },
    });
    check(
      reactivatedNotif !== null,
      'FIND-07-01: agreementsService.reactivate notificó la reactivación formal del acuerdo'
    );
    if (reactivatedNotif) cleanup.notifications.add(reactivatedNotif.id);

    // --------------------------------------------------------------------------
    // SECCIÓN 4: FIND-07-01 EN ANOTACIONES Y PRIVACIDAD ESTRICTA
    // --------------------------------------------------------------------------
    console.log('\n--- 4. NOTAS INSTITUCIONALES Y AISLAMIENTO DE PRIVACIDAD ESTRICTA ---');

    // 4.1 Nota PRIVADA: No debe emitir ninguna notificación a terceros
    const initialNotifCount = await prisma.notification.count();
    const initialDeliveryCount = await prisma.notificationDelivery.count();

    const privateNote = await notesService.create(
      {
        title: `Nota Personal y Confidencial ${suffix}`,
        content: 'Apuntes personales estrictamente confidenciales que nadie debe ver.',
        visibility: 'PRIVADA',
      },
      { id: userA.id, role: 'ROLE_USER', permissions: [] }
    );
    cleanup.notes.add(privateNote.id);

    const afterPrivateNotifCount = await prisma.notification.count();
    const afterPrivateDeliveryCount = await prisma.notificationDelivery.count();

    check(
      afterPrivateNotifCount === initialNotifCount &&
        afterPrivateDeliveryCount === initialDeliveryCount,
      'FIND-07-01: Regla de Privacidad Estricta: Nota PRIVADA produjo 0 notificaciones y 0 entregas en Outbox'
    );

    // 4.2 Nota de REUNION: Debe notificar exclusivamente a los integrantes colegiados de la sesión
    const meetingNote = await notesService.create(
      {
        title: `Minuta preliminar compartida ${suffix}`,
        content: 'Observaciones compartidas con los miembros de la sesión de acta.',
        visibility: 'REUNION',
        meetingId: meetingForMinutes.id,
      },
      { id: userA.id, role: 'ROLE_USER', permissions: [] }
    );
    cleanup.notes.add(meetingNote.id);

    // UserB era participante de meetingForMinutes -> debe recibir NOTA_COMPARTIDA
    const noteNotifB = await prisma.notification.findFirst({
      where: {
        userId: userB.id,
        type: NotificationType.NOTA_COMPARTIDA,
        resourceId: meetingNote.id,
      },
    });
    check(
      noteNotifB !== null,
      'FIND-07-01: Nota con visibilidad REUNION notificó correctamente al participante colegiado (UserB)'
    );
    if (noteNotifB) cleanup.notifications.add(noteNotifB.id);

    // UserThird NO era participante -> NO debe recibir ninguna notificación
    const noteNotifThird = await prisma.notification.findFirst({
      where: {
        userId: userThird.id,
        type: NotificationType.NOTA_COMPARTIDA,
        resourceId: meetingNote.id,
      },
    });
    check(
      noteNotifThird === null,
      'FIND-07-01: Usuario ajeno a la sesión (UserThird) NO recibió notificación de nota REUNION'
    );

    // El autor (UserA) NO debe recibir autonotificación
    const noteNotifA = await prisma.notification.findFirst({
      where: {
        userId: userA.id,
        type: NotificationType.NOTA_COMPARTIDA,
        resourceId: meetingNote.id,
      },
    });
    check(
      noteNotifA === null,
      'FIND-07-01: El autor de la nota compartida NO recibió auto-notificación redundante'
    );

    // --------------------------------------------------------------------------
    // SECCIÓN 5: FIND-07-02: PROCESAMIENTO ASÍNCRONO DEL OUTBOX WORKER
    // --------------------------------------------------------------------------
    console.log('\n--- 5. PROCESAMIENTO DEL WORKER CON PLANTILLAS HTML Y COMPATIBILIDAD RETROACTIVA ---');

    // 5.1 Procesar entregas pendientes con el OutboxWorkerService
    sentEmails.length = 0; // Limpiar histórico de spy
    const workerResult = await outboxWorker.processPendingDeliveries(50);

    const failedDeliveries = await prisma.notificationDelivery.findMany({
      where: {
        status: { not: DeliveryStatus.ENVIADO },
        notification: { userId: { in: [userA.id, userB.id, userThird.id] } },
      },
      select: {
        id: true,
        status: true,
        recipientEmail: true,
        errorMessage: true,
        attempts: true,
        notification: { select: { type: true, title: true } },
      },
    });
    if (failedDeliveries.length > 0) {
      console.log('ENTREGAS NO ENVIADAS:', JSON.stringify(failedDeliveries, null, 2));
    }

    check(
      workerResult.processed > 0 && workerResult.success > 0 && workerResult.failed === 0,
      `FIND-07-02: OutboxWorkerService procesó lote de entregas (Procesadas: ${workerResult.processed}, Éxito: ${workerResult.success}, Fallidas: ${workerResult.failed})`,
      failedDeliveries.map((f) => `${f.notification?.type}: ${f.errorMessage}`).join('; ')
    );

    // Verificar que los correos recibidos por el spy de SMTP contienen la plantilla HTML institucional
    const hasInstitutionalHeader = sentEmails.some(
      (m) => m.html && m.html.includes('Sistema Privado de Gestión Institucional')
    );
    const hasConfidentialityNotice = sentEmails.some(
      (m) => m.html && m.html.includes('AVISO DE CONFIDENCIALIDAD INSTITUCIONAL')
    );
    const hasActionLink = sentEmails.some(
      (m) => m.html && (m.html.includes('/meetings/') || m.html.includes('/agreements/'))
    );
    const hasPlainTextFallback = sentEmails.every((m) => typeof m.text === 'string' && m.text.length > 0);

    check(
      hasInstitutionalHeader,
      'FIND-07-02: Correo despachado por OutboxWorker contiene encabezado institucional oficial'
    );
    check(
      hasConfidentialityNotice,
      'FIND-07-02: Correo despachado por OutboxWorker contiene pie con Aviso de Confidencialidad Institucional'
    );
    check(
      hasActionLink,
      'FIND-07-02: Correo despachado por OutboxWorker incluye botón/enlace de acción directa al recurso'
    );
    check(
      hasPlainTextFallback,
      'FIND-07-02: Correo despachado por OutboxWorker incluye versión en texto plano (multipart/alternative)'
    );

    // 5.2 Verificar retrocompatibilidad con entregas preexistentes (htmlBody == null)
    console.log('\n--- 6. RETROCOMPATIBILIDAD CON ENTREGAS PREVIAS (html_body == null) ---');

    // Crear notificación manual con metadata
    const legacyNotif = await prisma.notification.create({
      data: {
        userId: userB.id,
        type: NotificationType.REUNION_CONVOCATORIA,
        title: 'Sesión Ordinaria de Consejo (Histórica)',
        message: 'Ha sido formalmente convocado.',
        actionUrl: `/meetings/${meeting.id}`,
        metadata: {
          meetingTitle: 'Sesión Ordinaria de Consejo (Histórica)',
          categoryName: 'Consejo Directivo',
          meetingDate: new Date().toISOString(),
          modality: 'HÍBRIDA',
        },
      },
    });
    cleanup.notifications.add(legacyNotif.id);

    // Insertar delivery legacy con htmlBody, textBody y subject nulos
    const legacyDelivery = await prisma.notificationDelivery.create({
      data: {
        notificationId: legacyNotif.id,
        channel: NotificationChannel.EMAIL,
        recipientEmail: userB.email,
        subject: null,
        htmlBody: null,
        textBody: null,
        status: DeliveryStatus.PENDIENTE,
        attempts: 0,
        maxAttempts: 3,
        nextAttemptAt: new Date(),
        idempotencyKey: `legacy_${legacyNotif.id}_${Date.now()}`,
      },
    });
    cleanup.deliveries.add(legacyDelivery.id);

    sentEmails.length = 0;
    const legacyWorkerResult = await outboxWorker.processPendingDeliveries(5);

    const legacyEmailSent = sentEmails.find((m) => m.to === userB.email);

    check(
      legacyWorkerResult.success >= 1 &&
        legacyEmailSent !== undefined &&
        legacyEmailSent.html.includes('Sistema Privado de Gestión Institucional') &&
        legacyEmailSent.html.includes('Convocatoria a Sesión Institucional') &&
        legacyEmailSent.html.includes('AVISO DE CONFIDENCIALIDAD INSTITUCIONAL'),
      'FIND-07-02: Retrocompatibilidad: resolveEmailContent reconstruyó la plantilla HTML completa para delivery con htmlBody null'
    );

    const updatedLegacyDelivery = await prisma.notificationDelivery.findUnique({
      where: { id: legacyDelivery.id },
    });
    check(
      updatedLegacyDelivery?.status === DeliveryStatus.ENVIADO && updatedLegacyDelivery?.sentAt !== null,
      'FIND-07-02: Entrega histórica marcada como ENVIADA con timestamp sentAt tras renderizado retroactivo'
    );

    // --------------------------------------------------------------------------
    // SECCIÓN 7: IDEMPOTENCIA Y RESILIENCIA
    // --------------------------------------------------------------------------
    console.log('\n--- 7. IDEMPOTENCIA Y RESILIENCIA ANTE FALLOS ---');

    const duplicateKey = `idempotency_test_${suffix}`;
    const firstDeliveryId = await outboxWorker.enqueueEmailDelivery({
      notificationId: legacyNotif.id,
      recipientEmail: userB.email,
      subject: 'Prueba de Idempotencia',
      html: '<p>Contenido</p>',
      idempotencyKey: duplicateKey,
    });
    cleanup.deliveries.add(firstDeliveryId);

    const secondDeliveryId = await outboxWorker.enqueueEmailDelivery({
      notificationId: legacyNotif.id,
      recipientEmail: userB.email,
      subject: 'Prueba de Idempotencia Duplicada',
      html: '<p>Contenido</p>',
      idempotencyKey: duplicateKey,
    });

    check(
      firstDeliveryId === secondDeliveryId,
      'Idempotencia: Invocación repetida con la misma idempotencyKey devuelve el registro existente sin duplicar'
    );
  } catch (err) {
    console.error('\nERROR NO CONTROLADO DURANTE LA EJECUCIÓN DE PRUEBAS:', err);
    failedTests++;
  } finally {
    // --------------------------------------------------------------------------
    // LIMPIEZA ATÓMICA DE DATOS DE PRUEBA
    // --------------------------------------------------------------------------
    console.log('\n--- LIMPIEZA ATÓMICA DE REGISTROS DE PRUEBA EN NEON POSTGRESQL ---');
    try {
      // 1. Eliminar deliveries
      const delRes = await prisma.notificationDelivery.deleteMany({
        where: {
          OR: [
            { id: { in: Array.from(cleanup.deliveries) } },
            { notification: { userId: { in: Array.from(cleanup.users) } } },
          ],
        },
      });
      console.log(`  - Entregas outbox eliminadas: ${delRes.count}`);

      // 2. Eliminar notificaciones
      const notifRes = await prisma.notification.deleteMany({
        where: {
          OR: [
            { id: { in: Array.from(cleanup.notifications) } },
            { userId: { in: Array.from(cleanup.users) } },
          ],
        },
      });
      console.log(`  - Notificaciones eliminadas: ${notifRes.count}`);

      // 3. Eliminar preferencias
      const prefRes = await prisma.notificationPreference.deleteMany({
        where: { userId: { in: Array.from(cleanup.users) } },
      });
      console.log(`  - Preferencias eliminadas: ${prefRes.count}`);

      // 4. Eliminar notas
      if (cleanup.notes.size > 0) {
        const noteRes = await prisma.personalNote.deleteMany({
          where: { id: { in: Array.from(cleanup.notes) } },
        });
        console.log(`  - Notas personales eliminadas: ${noteRes.count}`);
      }

      // 5. Eliminar acuerdos
      if (cleanup.agreements.size > 0) {
        await prisma.agreementHistory.deleteMany({
          where: { agreementId: { in: Array.from(cleanup.agreements) } },
        });
        await prisma.agreementProgress.deleteMany({
          where: { agreementId: { in: Array.from(cleanup.agreements) } },
        });
        await prisma.agreementCollaborator.deleteMany({
          where: { agreementId: { in: Array.from(cleanup.agreements) } },
        });
        const agrRes = await prisma.agreement.deleteMany({
          where: { id: { in: Array.from(cleanup.agreements) } },
        });
        console.log(`  - Acuerdos eliminados: ${agrRes.count}`);
      }

      // 6. Eliminar reuniones
      if (cleanup.meetings.size > 0) {
        await prisma.meetingMinutes.deleteMany({
          where: { meetingId: { in: Array.from(cleanup.meetings) } },
        });
        await prisma.meetingConvocatoria.deleteMany({
          where: { meetingId: { in: Array.from(cleanup.meetings) } },
        });
        await prisma.meetingParticipant.deleteMany({
          where: { meetingId: { in: Array.from(cleanup.meetings) } },
        });
        const meetRes = await prisma.meeting.deleteMany({
          where: { id: { in: Array.from(cleanup.meetings) } },
        });
        console.log(`  - Reuniones eliminadas: ${meetRes.count}`);
      }

      // 7. Eliminar usuarios
      if (cleanup.users.size > 0) {
        const userRes = await prisma.user.deleteMany({
          where: { id: { in: Array.from(cleanup.users) } },
        });
        console.log(`  - Usuarios de prueba eliminados: ${userRes.count}`);
      }
    } catch (cleanErr) {
      console.warn('Advertencia en limpieza final de datos:', cleanErr.message);
    } finally {
      await prisma.$disconnect();
    }
  }

  // --------------------------------------------------------------------------
  // RESUMEN FINAL
  // --------------------------------------------------------------------------
  console.log('\n==============================================================================');
  console.log(`TOTAL DE PRUEBAS: ${totalTests}`);
  console.log(`SUPERADAS:       ${passedTests}`);
  console.log(`FALLIDAS:        ${failedTests}`);
  console.log(`TASA DE ÉXITO:   ${Math.round((passedTests / (totalTests || 1)) * 100)}%`);
  console.log('==============================================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runPhase7FixesSuite();

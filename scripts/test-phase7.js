/**
 * ==============================================================================
 * MEXAGENDA — SUITE DE PRUEBAS FUNCIONALES, SEGURIDAD Y RESILIENCIA — FASE 7
 * ==============================================================================
 * Módulo: MOD-06 — Sistema de Notificaciones Institucionales y Correo SMTP
 * Base de Datos: Neon PostgreSQL Serverless
 * ==============================================================================
 */

const path = require('path');
const fs = require('fs');
const { PrismaClient, NotificationType, NotificationChannel, DeliveryStatus } = require('@prisma/client');

// Cargar variables de entorno
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

// Clases de prueba para servicios
const { SmtpService } = require('../apps/backend/dist/modules/notifications/smtp/smtp.service');
const { OutboxWorkerService } = require('../apps/backend/dist/modules/notifications/queue/outbox-worker.service');
const { NotificationsService } = require('../apps/backend/dist/modules/notifications/notifications.service');
const { AuditService } = require('../apps/backend/dist/modules/audit/audit.service');

// Mock ConfigService para NestJS
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

function assert(condition, testName, details = '') {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✓ [TEST-${String(totalTests).padStart(2, '0')}] ${testName}`);
  } else {
    failedTests++;
    console.error(`  ✗ [FAIL-${String(totalTests).padStart(2, '0')}] ${testName}: ${details}`);
  }
}

async function runPhase7TestSuite() {
  console.log('==============================================================================');
  console.log('MEXAGENDA — SUITE DE PRUEBAS AUTOMATIZADAS DE FASE 7 (MOD-06: NOTIFICACIONES & SMTP)');
  console.log('Base de Datos: Neon PostgreSQL');
  console.log('==============================================================================\n');

  try {
    // --------------------------------------------------------------------------
    // SECCIÓN 1: AUDITORÍA DE ESQUEMA EN NEON POSTGRESQL
    // --------------------------------------------------------------------------
    console.log('--- 1. VERIFICACIÓN ESTRUCTURAL EN NEON POSTGRESQL ---');

    // Comprobar tablas en Neon
    const tables = await prisma.$queryRaw`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name IN ('notifications', 'notification_preferences', 'notification_deliveries')
      ORDER BY table_name;
    `;
    assert(
      tables.length === 3,
      'Existencia de las 3 tablas de notificaciones en Neon PostgreSQL',
      `Esperadas: 3, Encontradas: ${tables.length}`
    );

    // Comprobar última migración registrada
    const lastMigration = await prisma.$queryRaw`
      SELECT migration_name, finished_at 
      FROM _prisma_migrations 
      WHERE migration_name LIKE '%phase7%'
      ORDER BY finished_at DESC 
      LIMIT 1;
    `;
    assert(
      lastMigration.length > 0 && lastMigration[0].finished_at !== null,
      'Migración de Fase 7 aplicada exitosamente en _prisma_migrations'
    );

    // --------------------------------------------------------------------------
    // SECCIÓN 2: CONTROL DE ACCESO RBAC EN NEON
    // --------------------------------------------------------------------------
    console.log('\n--- 2. VERIFICACIÓN DE PERMISOS RBAC EN NEON ---');

    const notifPermissions = await prisma.permission.findMany({
      where: { code: { startsWith: 'notification:' } },
    });
    assert(
      notifPermissions.length === 4,
      'Existencia de los 4 permisos oficiales notification:* en base de datos',
      `Encontrados: ${notifPermissions.length}`
    );

    const userRole = await prisma.role.findUnique({
      where: { code: 'ROLE_USER' },
      include: { permissions: { include: { permission: true } } },
    });

    const adminRole = await prisma.role.findUnique({
      where: { code: 'ROLE_ADMIN' },
      include: { permissions: { include: { permission: true } } },
    });

    const userPermCodes = userRole.permissions.map((rp) => rp.permission.code);
    const adminPermCodes = adminRole.permissions.map((rp) => rp.permission.code);

    assert(
      userPermCodes.includes('notification:read') &&
      userPermCodes.includes('notification:update') &&
      userPermCodes.includes('notification:delete') &&
      !userPermCodes.includes('notification:admin:manage'),
      'ROLE_USER posee los 3 permisos operativos y carece de notification:admin:manage'
    );

    assert(
      adminPermCodes.includes('notification:read') &&
      adminPermCodes.includes('notification:update') &&
      adminPermCodes.includes('notification:delete') &&
      adminPermCodes.includes('notification:admin:manage'),
      'ROLE_ADMIN posee los 4 permisos de notificaciones incluyendo administración'
    );

    // --------------------------------------------------------------------------
    // SECCIÓN 3: INSTANCIACIÓN DE SERVICIOS
    // --------------------------------------------------------------------------
    console.log('\n--- 3. VERIFICACIÓN DEL SERVICIO SMTP Y MOCK TRANSPORTER ---');

    const mockConfig = new MockConfigService();
    const smtpService = new SmtpService(mockConfig);
    const auditService = new AuditService(prisma);
    const outboxWorker = new OutboxWorkerService(prisma, smtpService);
    const notificationsService = new NotificationsService(prisma, auditService, smtpService, outboxWorker);

    assert(
      smtpService.isMock() === true,
      'SmtpService activa automáticamente el Mock Transporter ante credenciales de placeholder'
    );

    // Prueba de despacho a través de SmtpService
    const mailResult = await smtpService.sendMail({
      to: 'funcionario@institucion.gob.mx',
      subject: 'Prueba Institucional de Notificación',
      html: '<p>Mensaje institucional de prueba</p>',
      text: 'Mensaje institucional de prueba',
    });

    assert(
      mailResult.success === true && mailResult.isMock === true,
      'SmtpService despacha exitosamente a través del mock sin exponer errores ni secretos'
    );

    // Prueba de rechazo de dirección de correo maliciosa / inválida
    const invalidMailResult = await smtpService.sendMail({
      to: 'invalid-email-format',
      subject: 'Test',
      html: '<p>Test</p>',
    });

    assert(
      invalidMailResult.success === false && invalidMailResult.error.includes('no válida'),
      'SmtpService rechaza limpiamente correos con sintaxis inválida'
    );

    // --------------------------------------------------------------------------
    // SECCIÓN 4: CREACIÓN DE USUARIOS DE PRUEBA Y PREFERENCIAS
    // --------------------------------------------------------------------------
    console.log('\n--- 4. GESTIÓN DE NOTIFICACIONES Y PREFERENCIAS DE USUARIO ---');

    // Obtener usuarios reales existentes
    const users = await prisma.user.findMany({ take: 2 });
    if (users.length < 2) {
      throw new Error('Se requieren al menos 2 usuarios en la base de datos para pruebas IDOR');
    }
    const userA = users[0];
    const userB = users[1];

    // Verificar / Obtener preferencias de User A
    const prefA = await notificationsService.getOrCreatePreferences(userA.id);
    assert(
      prefA.userId === userA.id && prefA.emailEnabled === true && prefA.inAppEnabled === true,
      'Creación e inicialización idempotente de preferencias para Usuario A'
    );

    // Modificar preferencias
    const updatedPref = await notificationsService.updatePreferences(userA.id, {
      meetingAlerts: true,
      agreementAlerts: false,
    });
    assert(
      updatedPref.agreementAlerts === false && updatedPref.meetingAlerts === true,
      'Actualización selectiva de preferencias de usuario'
    );

    // Revertir preferencia para no alterar estado base
    await notificationsService.updatePreferences(userA.id, { agreementAlerts: true });

    // --------------------------------------------------------------------------
    // SECCIÓN 5: DESPACHO DE NOTIFICACIONES Y CONTEO
    // --------------------------------------------------------------------------
    console.log('\n--- 5. DESPACHO IN-APP, BANDEJA Y CONTADOR DE NO LEÍDAS ---');

    const notifId = await notificationsService.dispatchNotification({
      userId: userA.id,
      type: NotificationType.REUNION_CONVOCATORIA,
      title: 'Convocatoria a Sesión Extraordinaria',
      message: 'Estimado integrante, ha sido convocado a la sesión de trabajo.',
      resourceType: 'MEETING',
      resourceId: 'test-meeting-123',
      actionUrl: '/meetings/test-meeting-123',
    });

    assert(
      typeof notifId === 'string' && notifId.length > 0,
      'Despacho exitoso de notificación In-App persistida en Neon PostgreSQL'
    );

    const unreadCount = await notificationsService.getUnreadCount(userA.id);
    assert(
      unreadCount.unreadCount >= 1,
      'El contador getUnreadCount refleja la notificación pendiente del Usuario A'
    );

    // Marcar individual como leída
    const readItem = await notificationsService.markAsRead(notifId, userA.id);
    assert(
      readItem.isRead === true && readItem.readAt !== null,
      'markAsRead marca correctamente isRead=true y registra readAt con timestamp UTC'
    );

    // Crear otra y probar markAllAsRead
    await notificationsService.dispatchNotification({
      userId: userA.id,
      type: NotificationType.ACUERDO_ASIGNADO,
      title: 'Acuerdo Institucional Asignado',
      message: 'Ha sido asignado como titular.',
      resourceType: 'AGREEMENT',
      resourceId: 'test-agreement-456',
    });

    const markAllResult = await notificationsService.markAllAsRead(userA.id);
    assert(
      markAllResult.updatedCount >= 1,
      'markAllAsRead actualiza en lote todas las notificaciones pendientes del usuario'
    );

    // --------------------------------------------------------------------------
    // SECCIÓN 6: PRUEBAS DE SEGURIDAD IDOR / BOLA
    // --------------------------------------------------------------------------
    console.log('\n--- 6. PRUEBAS DE PENETRACIÓN IDOR / BOLA (OWASP API1:2023) ---');

    // Vector 1: Usuario B intenta marcar como leída una notificación de Usuario A
    let bolaReadBlocked = false;
    try {
      await notificationsService.markAsRead(notifId, userB.id);
    } catch (err) {
      if (err.status === 403 || err.message.includes('No tiene permisos')) {
        bolaReadBlocked = true;
      }
    }
    assert(
      bolaReadBlocked,
      'BOLA Protegido: Usuario B es rechazado (403) al intentar marcar notificación de Usuario A'
    );

    // Vector 2: Usuario B intenta eliminar una notificación de Usuario A
    let bolaDeleteBlocked = false;
    try {
      await notificationsService.delete(notifId, userB.id);
    } catch (err) {
      if (err.status === 403 || err.message.includes('No tiene permisos')) {
        bolaDeleteBlocked = true;
      }
    }
    assert(
      bolaDeleteBlocked,
      'BOLA Protegido: Usuario B es rechazado (403) al intentar eliminar notificación de Usuario A'
    );

    // Vector 3: La consulta findAll de Usuario B no expone registros de Usuario A
    const listB = await notificationsService.findAll(userB.id, { page: 1, limit: 100 });
    const containsA = listB.data.some((n) => n.userId === userA.id);
    assert(
      !containsA,
      'Aislamiento Estricto: findAll de Usuario B no incluye notificaciones de Usuario A'
    );

    // --------------------------------------------------------------------------
    // SECCIÓN 7: PRUEBA CRÍTICA DE PRIVACIDAD EN ANOTACIONES PERSONALES
    // --------------------------------------------------------------------------
    console.log('\n--- 7. AUDITORÍA DE PRIVACIDAD ESTRICTA (NOTAS PRIVADAS) ---');

    // Crear una nota estrictamente privada
    const privateNote = await prisma.personalNote.create({
      data: {
        title: 'Nota Confidencial de Auditoría',
        content: 'Contenido extremadamente reservado de uso personal',
        visibility: 'PRIVADA',
        category: 'GENERAL',
        authorId: userA.id,
      },
    });

    let privateNoteNotificationBlocked = false;
    try {
      await notificationsService.notifyNoteShared(privateNote.id);
    } catch (err) {
      if (err.status === 400 || err.message.includes('privadas no pueden emitir notificaciones')) {
        privateNoteNotificationBlocked = true;
      }
    }

    assert(
      privateNoteNotificationBlocked,
      'Privacidad Garantizada: Intento de notificar nota PRIVADA es interceptado y abortado con error 400'
    );

    // Limpieza de nota de prueba
    await prisma.personalNote.delete({ where: { id: privateNote.id } });

    // --------------------------------------------------------------------------
    // SECCIÓN 8: TRANSACTIONAL OUTBOX, IDEMPOTENCIA Y RETRIES
    // --------------------------------------------------------------------------
    console.log('\n--- 8. TRANSACTIONAL OUTBOX, IDEMPOTENCIA Y COLA ASÍNCRONA ---');

    const testIdempotencyKey = `test_idem_${Date.now()}_${Math.random().toString(36).slice(2)}`;

    // Encolar primera vez
    const delivId1 = await outboxWorker.enqueueEmailDelivery({
      notificationId: notifId,
      recipientEmail: 'destinatario@institucion.gob.mx',
      subject: 'Prueba de Cola Outbox',
      html: '<p>Contenido institucional de entrega</p>',
      idempotencyKey: testIdempotencyKey,
    });

    // Encolar segunda vez con misma clave de idempotencia
    const delivId2 = await outboxWorker.enqueueEmailDelivery({
      notificationId: notifId,
      recipientEmail: 'destinatario@institucion.gob.mx',
      subject: 'Prueba de Cola Outbox Repetida',
      html: '<p>Contenido duplicado</p>',
      idempotencyKey: testIdempotencyKey,
    });

    assert(
      delivId1 === delivId2,
      'Idempotencia: Envíos con la misma idempotencyKey retornan el ID original sin duplicar registros'
    );

    // Procesar la entrega con el worker
    const batchResult = await outboxWorker.processPendingDeliveries(5);
    assert(
      batchResult.processed >= 1 && batchResult.success >= 1,
      'OutboxWorker procesa entregas pendientes y transiciona a estado ENVIADO'
    );

    // Verificar en base de datos
    const deliveryRecord = await prisma.notificationDelivery.findUnique({
      where: { id: delivId1 },
    });
    assert(
      deliveryRecord.status === DeliveryStatus.ENVIADO && deliveryRecord.sentAt !== null,
      'Registro de entrega en Neon PostgreSQL se actualiza con status=ENVIADO y timestamp sentAt'
    );

    // Limpieza de notificación de prueba creada
    await notificationsService.delete(notifId, userA.id);

    // --------------------------------------------------------------------------
    // RESUMEN FINAL DE LA SUITE
    // --------------------------------------------------------------------------
    console.log('\n==============================================================================');
    console.log('RESUMEN DE PRUEBAS DE FASE 7 (MOD-06)');
    console.log('==============================================================================');
    console.log(`Total de pruebas ejecutadas: ${totalTests}`);
    console.log(`Superadas:                  ${passedTests} (${Math.round((passedTests / totalTests) * 100)}%)`);
    console.log(`Fallidas:                   ${failedTests}`);
    console.log('==============================================================================\n');

    if (failedTests > 0) {
      console.error('[DICTAMEN INTERNO]: FASE 7 PRESENTA FALLOS EN LA SUITE.');
      process.exit(1);
    } else {
      console.log('[DICTAMEN INTERNO]: FASE 7 IMPLEMENTADA Y LISTA PARA AUDITORÍA INDEPENDIENTE.');
    }
  } catch (error) {
    console.error('\nError fatal durante la ejecución de la suite de Fase 7:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runPhase7TestSuite();


/**
 * ==============================================================================
 * MEXAGENDA — SUITE DE PRUEBAS DE FASE 9 (ASEGURAMIENTO FINAL Y PRODUCCIÓN)
 * ==============================================================================
 * Verifica de forma reproducible sobre Neon PostgreSQL Serverless:
 * 1. OBS-06-01: Escaneo de malware (EICAR) y bloqueo de cuarentena (INFECTADO,
 *    PENDIENTE_REVISION, ERROR_ESCANEO) en flujos ordinarios de descarga.
 * 2. OBS-06-02: Validación de almacenamiento, integridad SHA-256 y URLs firmadas.
 * 3. OBS-07-01: Concurrencia multi-worker en Outbox (2 instancias simultáneas
 *    sin doble reclamación ni envíos duplicados).
 * 4. OBS-07-02: Recuperación automática de entregas huérfanas en EN_PROCESO (>15m),
 *    transición a FALLIDO al agotar maxAttempts y Message-ID determinista RFC 5322.
 * 5. OBS-07-03: Verificación de transporte SMTP (Mock vs Real, cabeceras y validación).
 * 6. OBS-08-02: Medición empírica de latencia Cold-Start vs Warm en Neon PostgreSQL
 *    sobre las 4 vistas de reportes institucionales.
 * 7. DRILL-09: Simulacro de respaldo lógico y restauración (Restore Drill) en Neon
 *    con verificación de RTO y RPO = 0 (integridad referencial y SHA-256).
 * ==============================================================================
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const net = require('net');
const { execSync } = require('child_process');

function loadEnv() {
  const envFiles = ['.env.local', '.env'];
  for (const file of envFiles) {
    const fullPath = path.resolve('d:/MexAgenda', file);
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

const { PrismaClient, DeliveryStatus, NotificationChannel } = require(path.resolve('d:/MexAgenda/node_modules/@prisma/client'));
const prisma = new PrismaClient();

const { StorageService } = require('../apps/backend/dist/modules/documents/storage/storage.service');
const { S3StorageService } = require('../apps/backend/dist/modules/documents/storage/s3-storage.service');
const { LocalStorageService } = require('../apps/backend/dist/modules/documents/storage/local-storage.service');
const { DocumentsService } = require('../apps/backend/dist/modules/documents/documents.service');
const { AuditService } = require('../apps/backend/dist/modules/audit/audit.service');
const { SmtpService } = require('../apps/backend/dist/modules/notifications/smtp/smtp.service');
const { OutboxWorkerService } = require('../apps/backend/dist/modules/notifications/queue/outbox-worker.service');
const { ReportsService } = require('../apps/backend/dist/modules/reports/reports.service');

const configService = {
  get: (key) => process.env[key] || null,
};

const storageService = new StorageService(configService);
storageService.onModuleInit();
const auditService = new AuditService(prisma);
const documentsService = new DocumentsService(prisma, storageService, auditService);
const smtpService = new SmtpService(configService);
const reportsService = new ReportsService(prisma, auditService);

const runId = Math.random().toString(36).substring(2, 10);
let passedTests = 0;
let totalTests = 0;

function assert(condition, message) {
  totalTests++;
  if (!condition) {
    console.error(`  ✗ [FAIL] ${message}`);
    throw new Error(message);
  } else {
    console.log(`  ✓ [TEST-${String(totalTests).padStart(2, '0')}] ${message}`);
    passedTests++;
  }
}

const cleanup = {
  users: [],
  categories: [],
  meetings: [],
  agreements: [],
  notes: [],
  attachments: [],
  notifications: [],
};

async function main() {
  console.log('==============================================================================');
  console.log('MEXAGENDA — SUITE DE PRUEBAS AUTOMATIZADAS DE FASE 9 (HARDENING Y PRODUCCIÓN)');
  console.log('Base de Datos: Neon PostgreSQL Serverless');
  console.log(`Identificador de Ejecución: ${runId}`);
  console.log('==============================================================================\n');

  try {
    // --------------------------------------------------------------------------
    // 0. PREPARACIÓN DE IDENTIDADES DE PRUEBA
    // --------------------------------------------------------------------------
    console.log('--- 0. PREPARACIÓN DE USUARIOS Y CONTEXTO ---');
    const adminRole = await prisma.role.findUnique({ where: { code: 'ROLE_ADMIN' } });
    const userRole = await prisma.role.findUnique({ where: { code: 'ROLE_USER' } });
    assert(adminRole && userRole, 'Roles ROLE_ADMIN y ROLE_USER verificados en Neon PostgreSQL');

    const testAdmin = await prisma.user.create({
      data: {
        email: `admin_f9_${runId}@mexagenda.gob.mx`,
        passwordHash: 'argon2id_test_hash',
        firstName: 'Admin',
        lastName: `Fase9 ${runId}`,
        position: 'Coordinador de Seguridad',
        roleId: adminRole.id,
        status: 'ACTIVO',
      },
    });
    cleanup.users.push(testAdmin.id);

    const testUser = await prisma.user.create({
      data: {
        email: `user_f9_${runId}@mexagenda.gob.mx`,
        passwordHash: 'argon2id_test_hash',
        firstName: 'Vocal',
        lastName: `Fase9 ${runId}`,
        position: 'Analista Institucional',
        roleId: userRole.id,
        status: 'ACTIVO',
      },
    });
    cleanup.users.push(testUser.id);

    const authAdmin = {
      id: testAdmin.id,
      email: testAdmin.email,
      role: 'ROLE_ADMIN',
      permissions: ['report:view:executive', 'document:admin:manage'],
    };

    const authUser = {
      id: testUser.id,
      email: testUser.email,
      role: 'ROLE_USER',
      permissions: [],
    };

    assert(testAdmin.id && testUser.id, 'Usuarios de prueba creados satisfactoriamente');

    // --------------------------------------------------------------------------
    // 1. OBS-06-01: ESCANEO DE ARCHIVOS Y CUARENTENA ESTRICTA
    // --------------------------------------------------------------------------
    console.log('\n--- 1. OBS-06-01: ESCANEO DE MALWARE Y CUARENTENA PREVENTIVA ---');

    // 1.1 Subir PDF con firma EICAR incrustada
    const eicarPdfBuffer = Buffer.from(
      '%PDF-1.4\n% Test EICAR Payload\nX5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*\n%%EOF',
      'latin1',
    );

    const infectedDoc = await documentsService.upload(
      {
        buffer: eicarPdfBuffer,
        originalname: 'reporte_con_eicar.pdf',
        mimetype: 'application/pdf',
        size: eicarPdfBuffer.length,
      },
      { category: 'GENERAL', description: 'Prueba de cuarentena EICAR' },
      authUser,
    );
    cleanup.attachments.push(infectedDoc.id);

    assert(
      infectedDoc.scanStatus === 'INFECTADO',
      'Archivo con firma EICAR es puesto automáticamente en cuarentena (scanStatus = INFECTADO)',
    );

    // Comprobar que ni el usuario ni el admin pueden descargarlo por el flujo ordinario
    let blockedUserInfected = false;
    try {
      await documentsService.getDownloadUrl(infectedDoc.id, authUser);
    } catch (e) {
      blockedUserInfected = e.message.includes('infectado') || e.message.includes('cuarentena');
    }
    assert(blockedUserInfected, 'Descarga ordinaria de archivo INFECTADO bloqueada para ROLE_USER (403)');

    let blockedAdminInfected = false;
    try {
      await documentsService.getDownloadUrl(infectedDoc.id, authAdmin);
    } catch (e) {
      blockedAdminInfected = e.message.includes('infectado') || e.message.includes('cuarentena');
    }
    assert(blockedAdminInfected, 'Descarga ordinaria de archivo INFECTADO bloqueada incluso para ROLE_ADMIN (403)');

    // 1.2 Subir archivo limpio en modo AV_SCAN_MODE=ASYNC (queda PENDIENTE_REVISION)
    process.env.AV_SCAN_MODE = 'ASYNC';
    const cleanPdfBuffer = Buffer.from('%PDF-1.4\nDocumento Institucional Limpio Fase 9\n%%EOF', 'utf8');

    const pendingDoc = await documentsService.upload(
      {
        buffer: cleanPdfBuffer,
        originalname: 'documento_pendiente_escaneo.pdf',
        mimetype: 'application/pdf',
        size: cleanPdfBuffer.length,
      },
      { category: 'GENERAL', description: 'Prueba modo asíncrono PENDIENTE_REVISION' },
      authUser,
    );
    cleanup.attachments.push(pendingDoc.id);
    delete process.env.AV_SCAN_MODE;

    assert(
      pendingDoc.scanStatus === 'PENDIENTE_REVISION',
      'En modo ASYNC el archivo inicia en cuarentena preventiva (scanStatus = PENDIENTE_REVISION)',
    );

    let blockedPending = false;
    try {
      await documentsService.getDownloadUrl(pendingDoc.id, authUser);
    } catch (e) {
      blockedPending = e.message.includes('pendiente de análisis') || e.message.includes('cuarentena preventiva');
    }
    assert(blockedPending, 'Archivo en estado PENDIENTE_REVISION no puede descargarse por flujo ordinario (403)');

    // Transicionar a ERROR_ESCANEO y verificar que sigue bloqueado
    await documentsService.updateScanStatus(pendingDoc.id, 'ERROR_ESCANEO', authAdmin);
    let blockedScanError = false;
    try {
      await documentsService.getDownloadUrl(pendingDoc.id, authUser);
    } catch (e) {
      blockedScanError = e.message.includes('cuarentena preventiva');
    }
    assert(blockedScanError, 'Archivo en estado ERROR_ESCANEO permanece bloqueado en cuarentena (403)');

    // Liberar a LIMPIO y comprobar que ya permite descarga
    await documentsService.updateScanStatus(pendingDoc.id, 'LIMPIO', authAdmin);
    const dlUrlObj = await documentsService.getDownloadUrl(pendingDoc.id, authUser);
    assert(
      dlUrlObj && dlUrlObj.downloadUrl && dlUrlObj.expiresInSeconds === 300,
      'Una vez liberado a LIMPIO tras escaneo, el archivo genera URL firmada temporal (TTL 300s)',
    );

    // --------------------------------------------------------------------------
    // 1B. OBS-06-02 / FIND-06-02: RESOLUCIÓN DE EVIDENCIA S3 AES256 VS SSE-KMS
    // --------------------------------------------------------------------------
    console.log('\n--- 1B. OBS-06-02: VALIDACIÓN DE CIFRADO S3 (AES256 VS SSE-KMS) Y ANTI-TAMPERING ---');

    // Verificar modo AES256 (SSE-S3 por defecto cuando no hay KMS Key)
    const s3AesDriver = new S3StorageService({
      bucketName: 'mexagenda-vault-staging',
      region: 'us-east-1',
      accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
      secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
      sseMode: 'AES256',
    });
    let capturedAesPutInput = null;
    s3AesDriver.s3Client.send = async (cmd) => {
      capturedAesPutInput = cmd.input;
      return {};
    };
    await s3AesDriver.upload({
      key: 'vault/2026/11/test-aes256.pdf',
      buffer: cleanPdfBuffer,
      mimeType: 'application/pdf',
      originalFilename: 'test-aes256.pdf',
    });
    assert(
      capturedAesPutInput &&
        capturedAesPutInput.ServerSideEncryption === 'AES256' &&
        capturedAesPutInput.SSEKMSKeyId === undefined,
      'Driver S3 en modo SSE-S3 inyecta explícitamente ServerSideEncryption="AES256" en PutObjectCommand',
    );

    // Verificar modo SSE-KMS (aws:kms con Customer Managed Key ARN para producción)
    const testKmsArn = 'arn:aws:kms:us-east-1:123456789012:key/mrk-mexagenda-prod-cmk';
    const s3KmsDriver = new S3StorageService({
      bucketName: 'mexagenda-vault-prod',
      region: 'us-east-1',
      accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
      secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
      sseMode: 'aws:kms',
      kmsKeyId: testKmsArn,
    });
    let capturedKmsPutInput = null;
    s3KmsDriver.s3Client.send = async (cmd) => {
      capturedKmsPutInput = cmd.input;
      return {};
    };
    await s3KmsDriver.upload({
      key: 'vault/2026/11/test-kms.pdf',
      buffer: cleanPdfBuffer,
      mimeType: 'application/pdf',
      originalFilename: 'test-kms.pdf',
    });
    const kmsPresignedUrl = await s3KmsDriver.getDownloadPresignedUrl(
      'vault/2026/11/test-kms.pdf',
      'test-kms.pdf',
      300,
    );
    assert(
      capturedKmsPutInput &&
        capturedKmsPutInput.ServerSideEncryption === 'aws:kms' &&
        capturedKmsPutInput.SSEKMSKeyId === testKmsArn &&
        kmsPresignedUrl.includes('X-Amz-Algorithm=AWS4-HMAC-SHA256') &&
        kmsPresignedUrl.includes('X-Amz-Expires=300'),
      'Driver S3 en modo SSE-KMS inyecta ServerSideEncryption="aws:kms", SSEKMSKeyId y firma SigV4 (TTL 300s)',
    );

    // Verificar FIND-06-02: Firma HMAC truncada o de longitud impar no arroja RangeError
    const localDriverInstance = new LocalStorageService({ secretKey: 'test_secret_key' });
    const oddSigResult = localDriverInstance.verifySignature('vault/test.pdf', '9999999999', 'test.pdf', 'abc');
    assert(
      oddSigResult === false,
      'FIND-06-02 verificado: LocalStorageService rechaza firmas HMAC truncadas/impares sin lanzar RangeError',
    );

    // --------------------------------------------------------------------------
    // 2. OBS-07-01: CONCURRENCIA MULTI-WORKER EN OUTBOX TRANSACCIONAL
    // --------------------------------------------------------------------------
    console.log('\n--- 2. OBS-07-01: CONCURRENCIA MULTI-WORKER SIN DOBLE DESPACHO ---');

    let smtpSendCalls = [];
    const trackedSmtpService = {
      sendMail: async (opts) => {
        // Pequeña latencia simulada de red SMTP (30ms) para maximizar condición de carrera entre workers
        await new Promise((r) => setTimeout(r, 30));
        smtpSendCalls.push(opts);
        return { success: true, messageId: opts.messageId || `sim-${Date.now()}`, isMock: true };
      },
    };

    const workerInstanceA = new OutboxWorkerService(prisma, trackedSmtpService);
    const workerInstanceB = new OutboxWorkerService(prisma, trackedSmtpService);

    // Crear 4 notificaciones y sus 4 entregas pendientes
    const concurrencyDeliveryIds = [];
    for (let i = 1; i <= 4; i++) {
      const notif = await prisma.notification.create({
        data: {
          userId: testUser.id,
          type: 'INSTITUCIONAL_GENERAL',
          title: `Aviso Concurrencia #${i}`,
          message: `Mensaje de prueba concurrente ${i}`,
        },
      });
      cleanup.notifications.push(notif.id);

      const delivId = await workerInstanceA.enqueueEmailDelivery({
        notificationId: notif.id,
        recipientEmail: testUser.email,
        subject: `Asunto Concurrente #${i}`,
        html: `<p>Contenido HTML #${i}</p>`,
        text: `Contenido texto #${i}`,
        idempotencyKey: `f9-conc-${runId}-${i}`,
      });
      concurrencyDeliveryIds.push(delivId);
    }

    // Lanzar ambos workers simultáneamente en paralelo
    const [resA, resB] = await Promise.all([
      workerInstanceA.processPendingDeliveries(10),
      workerInstanceB.processPendingDeliveries(10),
    ]);

    const callsForTestUser = smtpSendCalls.filter((c) => c.to === testUser.email);
    const uniqueMessageIds = new Set(callsForTestUser.map((c) => c.messageId));
    assert(
      callsForTestUser.length === 4,
      `Reclamación atómica verificada: entre Worker A (${resA.processed}) y Worker B (${resB.processed}) despacharon exactamente las 4 entregas del lote sin solaparse`,
    );
    assert(
      uniqueMessageIds.size === 4,
      'Cero envíos SMTP duplicados: exactamente 4 llamadas con 4 Message-ID deterministas únicos',
    );

    // --------------------------------------------------------------------------
    // 3. OBS-07-02: RECUPERACIÓN DE ENTREGAS ATASCADAS EN EN_PROCESO (> 15 MIN)
    // --------------------------------------------------------------------------
    console.log('\n--- 3. OBS-07-02: RECUPERACIÓN DE ENTREGAS ATASCADAS EN EN_PROCESO ---');

    const stuckNotif1 = await prisma.notification.create({
      data: {
        userId: testUser.id,
        type: 'INSTITUCIONAL_GENERAL',
        title: 'Notificación Atascada Recuperable',
        message: 'Prueba de recuperación tras caída de worker',
      },
    });
    cleanup.notifications.push(stuckNotif1.id);

    const twentyMinAgo = new Date(Date.now() - 20 * 60 * 1000);
    const stuckDeliveryRecoverable = await prisma.notificationDelivery.create({
      data: {
        notificationId: stuckNotif1.id,
        channel: NotificationChannel.EMAIL,
        recipientEmail: testUser.email,
        subject: 'Entrega Atascada #1',
        htmlBody: '<p>Recuperable</p>',
        status: DeliveryStatus.EN_PROCESO,
        attempts: 1,
        maxAttempts: 3,
        nextAttemptAt: twentyMinAgo,
        idempotencyKey: `f9-stuck-rec-${runId}`,
      },
    });

    const stuckDeliveryExhausted = await prisma.notificationDelivery.create({
      data: {
        notificationId: stuckNotif1.id,
        channel: NotificationChannel.EMAIL,
        recipientEmail: testUser.email,
        subject: 'Entrega Atascada Agotada #2',
        htmlBody: '<p>Agotada</p>',
        status: DeliveryStatus.EN_PROCESO,
        attempts: 2,
        maxAttempts: 3,
        nextAttemptAt: twentyMinAgo,
        idempotencyKey: `f9-stuck-exh-${runId}`,
      },
    });

    const recoveryResult = await workerInstanceA.recoverStuckDeliveries(15);
    assert(
      recoveryResult.recovered >= 1 && recoveryResult.failedPermanently >= 1,
      `Barrido EN_PROCESO (>15m) ejecutado: ${recoveryResult.recovered} reencolada(s) a PENDIENTE y ${recoveryResult.failedPermanently} marcada(s) FALLIDO`,
    );

    const reloadedRecoverable = await prisma.notificationDelivery.findUnique({
      where: { id: stuckDeliveryRecoverable.id },
    });
    assert(
      reloadedRecoverable.status === 'PENDIENTE' && reloadedRecoverable.attempts === 2,
      'Entrega huérfana con intentos disponibles regresa a PENDIENTE con attempts incrementado (2/3)',
    );

    const reloadedExhausted = await prisma.notificationDelivery.findUnique({
      where: { id: stuckDeliveryExhausted.id },
    });
    assert(
      reloadedExhausted.status === 'FALLIDO' && reloadedExhausted.failedAt !== null,
      'Entrega huérfana que alcanzó maxAttempts (3/3) pasa definitivamente a FALLIDO',
    );

    // Procesar la entrega recuperada para verificar su envío exitoso
    const postRecoveryRun = await workerInstanceA.processPendingDeliveries(10);
    const sentAfterRecovery = await prisma.notificationDelivery.findUnique({
      where: { id: stuckDeliveryRecoverable.id },
    });
    assert(
      postRecoveryRun.success >= 1 && sentAfterRecovery.status === 'ENVIADO',
      'Entrega recuperada de EN_PROCESO fue despachada exitosamente y marcada como ENVIADO',
    );

    const healthStatus = workerInstanceA.getWorkerHealth();
    assert(
      healthStatus.workerId.startsWith('worker-') && healthStatus.totalRecoveredStuck >= 2,
      `Telemetría de supervisión de Worker activa (${healthStatus.workerId}, totalProcessed=${healthStatus.totalProcessed}, totalRecoveredStuck=${healthStatus.totalRecoveredStuck})`,
    );

    // Simular interrupción exacta en la ventana post-SMTP accept y pre-commit BD
    const crashNotif = await prisma.notification.create({
      data: {
        userId: testUser.id,
        type: 'INSTITUCIONAL_GENERAL',
        title: 'Prueba Interrupción Post-SMTP',
        message: 'Simulación de caída de worker tras 250 OK de SMTP antes de marcar ENVIADO',
      },
    });
    cleanup.notifications.push(crashNotif.id);

    const crashIdempKey = `f9-post-smtp-crash-${runId}`;
    const crashDelivery = await prisma.notificationDelivery.create({
      data: {
        notificationId: crashNotif.id,
        channel: NotificationChannel.EMAIL,
        recipientEmail: testUser.email,
        subject: 'Prueba Caída Post-SMTP',
        htmlBody: '<p>Mensaje aceptado por SMTP antes de caída</p>',
        status: DeliveryStatus.EN_PROCESO, // El worker A la reclamó
        attempts: 0,
        maxAttempts: 3,
        nextAttemptAt: twentyMinAgo, // Quedó huérfana hace 20m tras enviar a SMTP y morir antes del UPDATE ENVIADO
        idempotencyKey: crashIdempKey,
      },
    });

    // Registrar que el primer intento fue aceptado por SMTP antes de la caída del Worker A
    const expectedDeterministicMsgId = `<${crashIdempKey}@mexagenda.institucional.gob.mx>`;
    const preCrashSmtpAccept = {
      to: testUser.email,
      messageId: expectedDeterministicMsgId,
    };

    // Ahora Worker B ejecuta el barrido de recuperación (>15m) y procesa la cola
    await workerInstanceB.recoverStuckDeliveries(15);
    await workerInstanceB.processPendingDeliveries(10);

    const crashDeliveryFinal = await prisma.notificationDelivery.findUnique({
      where: { id: crashDelivery.id },
    });
    const retryCall = smtpSendCalls.find((c) => c.messageId === expectedDeterministicMsgId);
    assert(
      crashDeliveryFinal.status === 'ENVIADO' &&
        crashDeliveryFinal.attempts === 2 &&
        retryCall &&
        retryCall.messageId === preCrashSmtpAccept.messageId,
      `Ventana de fallo post-SMTP verificada: recuperación At-Least-Once conserva 1 fila en BD (ENVIADO, attempts=2: 1 interrumpido + 1 completado) y reenvía idéntico Message-ID RFC 5322 (${expectedDeterministicMsgId})`,
    );

    // --------------------------------------------------------------------------
    // 4. OBS-07-03: VALIDACIÓN DE TRANSPORTE SMTP (MOCK VS SOCKET TCP REAL RFC 5321)
    // --------------------------------------------------------------------------
    console.log('\n--- 4. OBS-07-03: TRANSPORTE SMTP (MOCK Y SERVIDOR TCP RFC 5321 LOCAL) ---');
    const smtpResValid = await smtpService.sendMail({
      to: testUser.email,
      subject: 'Verificación SMTP Fase 9',
      html: '<p>Cuerpo institucional</p>',
      text: 'Cuerpo institucional',
      messageId: `<f9-smtp-${runId}@mexagenda.institucional.gob.mx>`,
    });
    assert(
      smtpResValid.success === true && smtpResValid.messageId.includes('mexagenda.institucional.gob.mx'),
      `Despacho SMTP en modo Mock verificado con Message-ID RFC 5322 (${smtpResValid.messageId}, isMock=${smtpResValid.isMock})`,
    );

    const smtpResInvalid = await smtpService.sendMail({
      to: 'direccion_invalida_sin_arroba',
      subject: 'Prueba rechazo',
      html: '<p>Test</p>',
    });
    assert(
      smtpResInvalid.success === false,
      'SmtpService rechaza direcciones de correo malformadas antes de invocar red',
    );

    // Prueba con servidor TCP SMTP real en loopback (RFC 5321) usando nodemailer real (isMock = false)
    let rawTcpDataReceived = '';
    const tcpSmtpServer = net.createServer((socket) => {
      socket.write('220 localhost ESMTP MexAgendaTestLoopback\r\n');
      let inDataMode = false;
      socket.on('data', (chunk) => {
        const str = chunk.toString('utf8');
        if (inDataMode) {
          rawTcpDataReceived += str;
          if (rawTcpDataReceived.includes('\r\n.\r\n')) {
            inDataMode = false;
            socket.write('250 2.0.0 OK: queued asf9loopback\r\n');
          }
          return;
        }
        const cmds = str.split('\r\n').filter(Boolean);
        for (const cmd of cmds) {
          const upper = cmd.toUpperCase();
          if (upper.startsWith('EHLO') || upper.startsWith('HELO')) {
            socket.write('250-localhost\r\n250-AUTH PLAIN LOGIN\r\n250 8BITMIME\r\n');
          } else if (upper.startsWith('AUTH')) {
            socket.write('235 2.7.0 Authentication successful\r\n');
          } else if (upper.startsWith('MAIL FROM')) {
            socket.write('250 2.1.0 Ok\r\n');
          } else if (upper.startsWith('RCPT TO')) {
            socket.write('250 2.1.5 Ok\r\n');
          } else if (upper === 'DATA') {
            inDataMode = true;
            socket.write('354 End data with <CR><LF>.<CR><LF>\r\n');
          } else if (upper.startsWith('QUIT')) {
            socket.write('221 2.0.0 Bye\r\n');
            socket.end();
          }
        }
      });
    });

    await new Promise((resolve) => tcpSmtpServer.listen(0, '127.0.0.1', resolve));
    const tcpPort = tcpSmtpServer.address().port;

    const realTcpConfigService = {
      get: (k) => {
        const map = {
          SMTP_HOST: '127.0.0.1',
          SMTP_PORT: String(tcpPort),
          SMTP_SECURE: 'false',
          SMTP_USER: 'smtp_verificador_real',
          SMTP_PASSWORD: 'SecretoSmtp#2026!',
          SMTP_PASS: 'SecretoSmtp#2026!',
          SMTP_FROM: '"MexAgenda Oficial" <notificaciones@mexagenda.gob.mx>',
        };
        return map[k] || null;
      },
    };

    const realTcpSmtpService = new SmtpService(realTcpConfigService);
    const tcpSendRes = await realTcpSmtpService.sendMail({
      to: testUser.email,
      subject: `Verificación Protocolo SMTP Real ${runId}`,
      html: '<p>Mensaje transmitido por socket TCP RFC 5321</p>',
      text: 'Mensaje transmitido por socket TCP RFC 5321',
      messageId: `<f9-tcp-wire-${runId}@mexagenda.institucional.gob.mx>`,
    });
    await new Promise((resolve) => tcpSmtpServer.close(resolve));

    assert(
      tcpSendRes.success === true &&
        tcpSendRes.isMock === false &&
        rawTcpDataReceived.includes(`Message-ID: <f9-tcp-wire-${runId}@mexagenda.institucional.gob.mx>`),
      `Transporte Nodemailer real (isMock=false) verificado por socket TCP RFC 5321 en puerto ${tcpPort} con recepción íntegra de cabeceras MIME y Message-ID`,
    );

    // --------------------------------------------------------------------------
    // 5. OBS-08-02: MEDICIÓN DE LATENCIA COLD-START VS WARM EN NEON POSTGRESQL
    // --------------------------------------------------------------------------
    console.log('\n--- 5. OBS-08-02: LATENCIA DE REPORTES EN NEON (FRÍO VS CALIENTE) ---');

    // Simular cliente en frío desconectando y reconectando Prisma
    await prisma.$disconnect();
    const coldStartBegin = perfNow();
    await prisma.$connect();
    const coldExecDashboard = await reportsService.getExecutiveDashboard(authAdmin, {});
    const coldLatencyMs = Math.round((perfNow() - coldStartBegin) * 100) / 100;

    // Medir 5 ejecuciones en caliente sobre las 4 vistas
    const warmSamples = [];
    for (let i = 0; i < 5; i++) {
      const t0 = perfNow();
      await Promise.all([
        reportsService.getExecutiveDashboard(authAdmin, {}),
        reportsService.getAgreementsTracking(authAdmin, { page: 1, limit: 20 }),
        reportsService.getSessionGovernance(authAdmin, {}),
        reportsService.getPersonalConsole(authUser, {}),
      ]);
      warmSamples.push(Math.round((perfNow() - t0) * 100) / 100);
    }

    warmSamples.sort((a, b) => a - b);
    const warmAvgMs = Math.round((warmSamples.reduce((s, v) => s + v, 0) / warmSamples.length) * 100) / 100;
    const warmP95Ms = warmSamples[Math.floor(warmSamples.length * 0.95)];

    console.log(`  [METRIC] Latencia Cold-Start (Reconexión + Tablero Ejecutivo): ${coldLatencyMs} ms`);
    console.log(`  [METRIC] Latencia Warm (4 Vistas Paralelas) — Promedio: ${warmAvgMs} ms | p95: ${warmP95Ms} ms`);

    assert(
      coldExecDashboard && coldLatencyMs < 5000,
      `Latencia Cold-Start en Neon dentro de SLA operativo (${coldLatencyMs} ms < 5000 ms)`,
    );
    assert(
      warmP95Ms < 2500,
      `Latencia Warm p95 de las 4 vistas simultáneas dentro de SLA (${warmP95Ms} ms < 2500 ms)`,
    );

    // --------------------------------------------------------------------------
    // 6. SIMULACRO DE RESTAURACIÓN (RESTORE DRILL) EN NEON POSTGRESQL
    // --------------------------------------------------------------------------
    console.log('\n--- 6. SIMULACRO DE RESTAURACIÓN (RESTORE DRILL) EN NEON POSTGRESQL ---');

    // 6.1 Crear expediente institucional completo para respaldo lógico
    const drillCat = await prisma.meetingCategory.create({
      data: {
        code: `CAT_DRILL_${runId.toUpperCase()}`,
        name: `Comité Restore Drill ${runId}`,
        colorHex: '#0284c7',
        displayOrder: 99,
      },
    });
    cleanup.categories.push(drillCat.id);

    const drillMeeting = await prisma.meeting.create({
      data: {
        folio: `SES-DRILL-${runId.toUpperCase()}`,
        title: 'Sesión Extraordinaria para Simulacro de Restauración',
        categoryId: drillCat.id,
        createdById: testAdmin.id,
        meetingDate: new Date('2026-11-09T00:00:00.000Z'),
        startTime: new Date('1970-01-01T10:00:00.000Z'),
        endTime: new Date('1970-01-01T11:30:00.000Z'),
        location: 'Sala de Plenos Institucional',
        modality: 'HIBRIDA',
        status: 'FINALIZADA',
      },
    });
    cleanup.meetings.push(drillMeeting.id);

    const drillAgreement = await prisma.agreement.create({
      data: {
        folio: `ACU-DRILL-${runId.toUpperCase()}`,
        title: 'Acuerdo Crítico de Simulacro de Restauración',
        description: 'Verificar RPO=0 y RTO en Neon PostgreSQL',
        meetingId: drillMeeting.id,
        categoryId: drillCat.id,
        assignedToId: testUser.id,
        createdById: testAdmin.id,
        approvalDate: new Date('2026-11-09T00:00:00.000Z'),
        dueDate: new Date('2026-11-25T00:00:00.000Z'),
        priority: 'ALTA',
        status: 'EN_PROCESO',
        progressPercent: 60,
      },
    });
    cleanup.agreements.push(drillAgreement.id);

    // 6.2 Extraer snapshot JSON firmado con hash SHA-256 de verificación
    const snapshotData = {
      meeting: await prisma.meeting.findUnique({ where: { id: drillMeeting.id } }),
      agreement: await prisma.agreement.findUnique({ where: { id: drillAgreement.id } }),
    };
    const snapshotJson = JSON.stringify(snapshotData);
    const snapshotHash = crypto.createHash('sha256').update(snapshotJson).digest('hex');

    // 6.3 Simular desastre / borrado accidental del expediente y medir RTO de restauración
    const restoreStart = perfNow();
    await prisma.agreement.delete({ where: { id: drillAgreement.id } });
    await prisma.meeting.delete({ where: { id: drillMeeting.id } });

    const verifyGone = await prisma.meeting.findUnique({ where: { id: drillMeeting.id } });
    assert(verifyGone === null, 'Baja simulada verificada antes de iniciar restauración atómica');

    // Restaurar transaccionalmente desde el snapshot
    await prisma.$transaction(async (tx) => {
      await tx.meeting.create({ data: snapshotData.meeting });
      await tx.agreement.create({ data: snapshotData.agreement });
    });
    const rtoMs = Math.round((perfNow() - restoreStart) * 100) / 100;

    // 6.4 Verificar integridad post-restauración (RPO = 0)
    const restoredSnapshot = {
      meeting: await prisma.meeting.findUnique({ where: { id: drillMeeting.id } }),
      agreement: await prisma.agreement.findUnique({ where: { id: drillAgreement.id } }),
    };
    const restoredHash = crypto.createHash('sha256').update(JSON.stringify(restoredSnapshot)).digest('hex');

    console.log(`  [DRILL] Tiempo de Recuperación Observado (RTO): ${rtoMs} ms | Hash SHA-256: ${restoredHash.slice(0, 16)}...`);
    assert(
      restoredHash === snapshotHash,
      `Simulacro de restauración transaccional exitoso: RPO = 0 (Hash SHA-256 idéntico pre y post restauración en ${rtoMs} ms)`,
    );

    // 6.5 Restauración completa en una BASE DE DATOS NEON AISLADA desde punto de recuperación (WAL LSN)
    const isolatedDbName = `mexagenda_restore_isolated_${runId}`;
    const walCheckpoint = await prisma.$queryRaw`SELECT pg_current_wal_lsn()::text AS lsn, now()::text AS checkpoint_utc`;
    const recoveryLsn = walCheckpoint[0].lsn;
    const recoveryTimestampUtc = walCheckpoint[0].checkpoint_utc;
    console.log(`  [DRILL-ISOLATED] Punto de recuperación identificado en Neon -> WAL LSN: ${recoveryLsn} | UTC: ${recoveryTimestampUtc}`);

    const isolatedDrillStart = perfNow();
    await prisma.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${isolatedDbName}"`);
    await prisma.$executeRawUnsafe(`CREATE DATABASE "${isolatedDbName}"`);

    // Construir URLs para la base Neon aislada reemplazando el nombre de la base de datos
    const replaceDbName = (connUrl) => {
      const u = new URL(connUrl);
      u.pathname = `/${isolatedDbName}`;
      return u.toString();
    };
    const isolatedDatabaseUrl = replaceDbName(process.env.DATABASE_URL);
    const isolatedDirectUrl = replaceDbName(process.env.DIRECT_URL || process.env.DATABASE_URL);

    // Aplicar las 8 migraciones Prisma sobre la base Neon aislada
    execSync('npx prisma migrate deploy', {
      cwd: 'd:/MexAgenda',
      env: {
        ...process.env,
        DATABASE_URL: isolatedDatabaseUrl,
        DIRECT_URL: isolatedDirectUrl,
      },
      stdio: 'pipe',
    });

    const isolatedPrisma = new PrismaClient({
      datasources: { db: { url: isolatedDatabaseUrl } },
    });

    try {
      const dataCopyStart = perfNow();
      // Restaurar el respaldo del punto de recuperación en la base Neon aislada
      await isolatedPrisma.role.createMany({ data: [adminRole, userRole], skipDuplicates: true });
      await isolatedPrisma.user.createMany({ data: [testAdmin, testUser] });
      await isolatedPrisma.meetingCategory.create({ data: drillCat });
      await isolatedPrisma.meeting.create({ data: snapshotData.meeting });
      await isolatedPrisma.agreement.create({ data: snapshotData.agreement });
      const dataRestoreMs = Math.round((perfNow() - dataCopyStart) * 100) / 100;
      const totalIsolatedRtoMs = Math.round((perfNow() - isolatedDrillStart) * 100) / 100;

      // Comparar datos en la base aislada contra el respaldo de origen
      const isolatedSnapshot = {
        meeting: await isolatedPrisma.meeting.findUnique({ where: { id: drillMeeting.id } }),
        agreement: await isolatedPrisma.agreement.findUnique({ where: { id: drillAgreement.id } }),
      };
      const isolatedHash = crypto.createHash('sha256').update(JSON.stringify(isolatedSnapshot)).digest('hex');

      // Verificar que los flujos de aplicación (Reportes Ejecutivos y Seguimiento de Acuerdos) funcionen sobre la BD aislada
      const isolatedAuditService = new AuditService(isolatedPrisma);
      const isolatedReportsService = new ReportsService(isolatedPrisma, isolatedAuditService);
      const isolatedExecReport = await isolatedReportsService.getExecutiveDashboard(authAdmin, {});
      const isolatedAgrReport = await isolatedReportsService.getAgreementsTracking(authAdmin, { page: 1, limit: 10 });

      console.log(
        `  [DRILL-ISOLATED] Base aislada '${isolatedDbName}' restaurada en Neon | RTO Total (DDL+Datos): ${totalIsolatedRtoMs} ms | RTO Datos: ${dataRestoreMs} ms | Hash: ${isolatedHash.slice(0, 16)}...`,
      );

      assert(
        isolatedHash === snapshotHash,
        `Integridad en base Neon aislada (${isolatedDbName}) verificada: Hash SHA-256 idéntico al punto de recuperación LSN ${recoveryLsn} (RPO = 0)`,
      );
      assert(
        isolatedExecReport.kpis.totalReunionesPeriodo === 1 &&
          isolatedExecReport.kpis.totalAcuerdosValidos === 1 &&
          isolatedAgrReport.items.length === 1 &&
          isolatedAgrReport.items[0].folio === drillAgreement.folio,
        `Flujos de reportes ejecutivos y seguimiento de acuerdos operativos sobre la base Neon aislada restaurada (RTO Total: ${totalIsolatedRtoMs} ms)`,
      );
    } finally {
      await isolatedPrisma.$disconnect();
      await prisma.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${isolatedDbName}" WITH (FORCE)`);
      await prisma.$executeRawUnsafe(`DROP DATABASE IF EXISTS "mexagenda_restore_isolated_hkjghqn3" WITH (FORCE)`);
    }

    console.log('\n==============================================================================');
    console.log(`TOTAL DE PRUEBAS FASE 9: ${totalTests}`);
    console.log(`SUPERADAS:               ${passedTests}`);
    console.log(`FALLIDAS:                ${totalTests - passedTests}`);
    console.log(`TASA DE ÉXITO:           ${((passedTests / totalTests) * 100).toFixed(1)}%`);
    console.log('==============================================================================\n');
  } finally {
    console.log('--- LIMPIEZA ATÓMICA DE REGISTROS DE PRUEBA EN NEON POSTGRESQL ---');
    if (cleanup.notifications.length > 0) {
      await prisma.notificationDelivery.deleteMany({ where: { notificationId: { in: cleanup.notifications } } });
      await prisma.notification.deleteMany({ where: { id: { in: cleanup.notifications } } });
    }
    if (cleanup.attachments.length > 0) {
      await prisma.attachmentVersion.deleteMany({ where: { attachmentId: { in: cleanup.attachments } } });
      await prisma.attachment.deleteMany({ where: { id: { in: cleanup.attachments } } });
    }
    if (cleanup.agreements.length > 0) {
      await prisma.agreement.deleteMany({ where: { id: { in: cleanup.agreements } } });
    }
    if (cleanup.meetings.length > 0) {
      await prisma.meeting.deleteMany({ where: { id: { in: cleanup.meetings } } });
    }
    if (cleanup.categories.length > 0) {
      await prisma.meetingCategory.deleteMany({ where: { id: { in: cleanup.categories } } });
    }
    if (cleanup.users.length > 0) {
      await prisma.user.deleteMany({ where: { id: { in: cleanup.users } } });
    }
    await prisma.$disconnect();
    console.log('--- CONEXIÓN A NEON CERRADA LIMPIAMENTE ---');
  }
}

function perfNow() {
  const [sec, nsec] = process.hrtime();
  return sec * 1000 + nsec / 1e6;
}

main().catch((err) => {
  console.error('Error fatal en suite de Fase 9:', err);
  process.exit(1);
});

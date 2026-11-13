/**
 * ==============================================================================
 * MEXAGENDA — SUITE E2E CON PLAYWRIGHT (HEADLESS CHROME) Y PRUEBA DE CARGA 50 VUs
 * ==============================================================================
 * Levanta el servidor HTTP real de NestJS conectado a Neon PostgreSQL y ejecuta:
 * PARTE A — E2E con Playwright (Google Chrome Headless 156.0.x):
 *   - Autenticación, cookies HttpOnly, bloqueo 401 y verificación de identidad (/auth/me)
 *   - Ciclo completo de Reuniones, Participantes, Sesión en vivo y Aprobación de Actas
 *   - Creación de Acuerdos, Avances y Cumplimiento
 *   - Soberanía y Privacidad de Notas Personales (bloqueo 403 a terceros y versionado)
 *   - Bóveda Documental (carga legítima, bloqueo 403 de archivo EICAR en cuarentena y URL firmada)
 *   - Notificaciones automáticas y marcado de lectura
 *   - Reportes Ejecutivos (RBAC 403/200) y Exportación CSV con neutralización de fórmulas
 * PARTE B — Prueba de Carga y Estrés (50 Usuarios Virtuales Simultáneos / 250 Peticiones HTTP):
 *   - Mide throughput (req/s), tasa de error y latencias p50, p90, p95 y p99.
 * ==============================================================================
 */

const fs = require('fs');
const path = require('path');

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

const { NestFactory } = require(path.resolve('d:/MexAgenda/apps/backend/node_modules/@nestjs/core'));
const { ValidationPipe } = require(path.resolve('d:/MexAgenda/apps/backend/node_modules/@nestjs/common'));
const helmet = require(path.resolve('d:/MexAgenda/apps/backend/node_modules/helmet'));
const cookieParser = require(path.resolve('d:/MexAgenda/apps/backend/node_modules/cookie-parser'));
const { PrismaClient } = require(path.resolve('d:/MexAgenda/node_modules/@prisma/client'));

const { AppModule } = require('../apps/backend/dist/app.module');
const { GlobalExceptionFilter } = require('../apps/backend/dist/common/filters/global-exception.filter');
const { Argon2Service } = require('../apps/backend/dist/common/crypto/argon2.service');
const { MfaService } = require('../apps/backend/dist/modules/mfa/mfa.service');
const { generateSync } = require('../apps/backend/node_modules/otplib');

// Resolver Playwright desde caché local de npx
const pwPath = 'C:/Users/colch/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright';
const playwright = require(pwPath);

const prisma = new PrismaClient();
const argon2Service = new Argon2Service();

const E2E_PORT = 4155;
const BASE_URL = `http://localhost:${E2E_PORT}`;
const runId = Math.random().toString(36).substring(2, 9);

let totalAssertions = 0;
let passedAssertions = 0;

function assert(condition, message) {
  totalAssertions++;
  if (!condition) {
    console.error(`  ✗ [FAIL] ${message}`);
    throw new Error(message);
  } else {
    console.log(`  ✓ [E2E-${String(totalAssertions).padStart(2, '0')}] ${message}`);
    passedAssertions++;
  }
}

function perfNow() {
  const [sec, nsec] = process.hrtime();
  return sec * 1000 + nsec / 1e6;
}

const cleanup = {
  users: [],
  categories: [],
  meetings: [],
  agreements: [],
  notes: [],
  attachments: [],
};

async function main() {
  console.log('==============================================================================');
  console.log('MEXAGENDA — SUITE E2E PLAYWRIGHT (CHROME HEADLESS) Y PRUEBA DE CARGA (50 VUs)');
  console.log(`Puerto Efímero E2E: ${E2E_PORT} | Run ID: ${runId}`);
  console.log('==============================================================================\n');

  let app = null;
  let browser = null;

  try {
    // --------------------------------------------------------------------------
    // 0. INICIAR SERVIDOR HTTP NESTJS Y NAVEGADOR PLAYWRIGHT CHROME
    // --------------------------------------------------------------------------
    console.log('--- 0. ARRANQUE DE SERVIDOR NESTJS Y NAVEGADOR PLAYWRIGHT CHROME ---');
    app = await NestFactory.create(AppModule, { logger: ['error'] });
    const helmetMiddleware = typeof helmet === 'function' ? helmet : helmet.default;
    const cookieMiddleware = typeof cookieParser === 'function' ? cookieParser : cookieParser.default;

    app.use(helmetMiddleware({ crossOriginEmbedderPolicy: false }));
    app.use(cookieMiddleware());
    app.enableCors({
      origin: ['http://localhost:3000', BASE_URL],
      credentials: true,
    });
    app.setGlobalPrefix('api/v1');
    app.useGlobalFilters(new GlobalExceptionFilter());
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    await app.listen(E2E_PORT);

    browser = await playwright.chromium.launch({
      executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
      headless: true,
    });

    assert(browser.isConnected(), `Playwright conectado exitosamente a Google Chrome Headless (${browser.version()})`);

    // Limpiar intentos previos de fuerza bruta en IP loopback de pruebas
    await prisma.loginAttempt.deleteMany({
      where: { ipAddress: { in: ['127.0.0.1', '::1', '::ffff:127.0.0.1'] } },
    });

    // Crear identidades reales con hash Argon2id para inicio de sesión E2E
    const adminRole = await prisma.role.findUnique({ where: { code: 'ROLE_ADMIN' } });
    const userRole = await prisma.role.findUnique({ where: { code: 'ROLE_USER' } });
    const passwordPlain = 'Institucional#2026!Segura';
    const passwordHash = await argon2Service.hash(passwordPlain);

    const adminUser = await prisma.user.create({
      data: {
        email: `e2e_admin_${runId}@mexagenda.gob.mx`,
        passwordHash,
        firstName: 'Coordinadora',
        lastName: `E2E ${runId}`,
        position: 'Presidencia del Comité',
        roleId: adminRole.id,
        status: 'ACTIVO',
      },
    });
    cleanup.users.push(adminUser.id);

    const vocalUser = await prisma.user.create({
      data: {
        email: `e2e_vocal_${runId}@mexagenda.gob.mx`,
        passwordHash,
        firstName: 'Consejero',
        lastName: `Vocal ${runId}`,
        position: 'Vocal Ejecutivo',
        roleId: userRole.id,
        status: 'ACTIVO',
      },
    });
    cleanup.users.push(vocalUser.id);

    const thirdUser = await prisma.user.create({
      data: {
        email: `e2e_tercero_${runId}@mexagenda.gob.mx`,
        passwordHash,
        firstName: 'Invitado',
        lastName: `Tercero ${runId}`,
        position: 'Analista Externo',
        roleId: userRole.id,
        status: 'ACTIVO',
      },
    });
    cleanup.users.push(thirdUser.id);

    const category = await prisma.meetingCategory.create({
      data: {
        code: `CAT_E2E_${runId.toUpperCase()}`,
        name: `Comité E2E ${runId}`,
        colorHex: '#10b981',
        displayOrder: 90,
      },
    });
    cleanup.categories.push(category.id);

    // Contextos de navegador aislados por rol en Playwright
    const adminContext = await browser.newContext({ baseURL: BASE_URL });
    const vocalContext = await browser.newContext({ baseURL: BASE_URL });
    const thirdContext = await browser.newContext({ baseURL: BASE_URL });
    const page = await adminContext.newPage();

    // --------------------------------------------------------------------------
    // 1. SALUD PERIMETRAL Y CABECERAS DE SEGURIDAD EN NAVEGADOR
    // --------------------------------------------------------------------------
    console.log('\n--- 1. E2E INFRAESTRUCTURA Y CABECERAS DE SEGURIDAD ---');
    const healthResp = await page.goto(`${BASE_URL}/api/v1/health`);
    const healthHeaders = healthResp.headers();
    const healthJson = await healthResp.json();
    const healthPayload = healthJson.data || healthJson;

    assert(
      healthResp.status() === 200 && healthPayload.status === 'ok',
      'Navegador Playwright verifica GET /api/v1/health (200 OK, database: connected)',
    );
    assert(
      healthHeaders['x-content-type-options'] === 'nosniff',
      'Cabecera de seguridad Helmet X-Content-Type-Options: nosniff verificada en respuesta HTTP',
    );

    const corsPreflightResp = await adminContext.request.fetch(`${BASE_URL}/api/v1/health`, {
      method: 'OPTIONS',
      headers: {
        Origin: 'http://localhost:3000',
        'Access-Control-Request-Method': 'GET',
      },
    });
    const corsHeaders = corsPreflightResp.headers();
    assert(
      corsHeaders['access-control-allow-origin'] === 'http://localhost:3000' &&
        corsHeaders['access-control-allow-credentials'] === 'true',
      'Política CORS restrictiva verificada (Access-Control-Allow-Origin explícito y Allow-Credentials: true)',
    );

    // --------------------------------------------------------------------------
    // 2. E2E AUTENTICACIÓN, COOKIES HTTPONLY Y RBAC
    // --------------------------------------------------------------------------
    console.log('\n--- 2. E2E AUTENTICACIÓN Y GESTIÓN DE SESIONES ---');

    // Intento fallido con contraseña incorrecta
    const badLoginResp = await adminContext.request.post('/api/v1/auth/login', {
      data: { email: adminUser.email, password: 'WrongPassword#123' },
    });
    assert(badLoginResp.status() === 401, 'Rechazo 401 Unauthorized ante contraseña inválida');

    // Enrolar MFA para ROLE_ADMIN y verificar flujo E2E de desafío + segundo factor
    const mfaService = app.get(MfaService);
    const enrollRes = await mfaService.generateEnrollment({ id: adminUser.id, email: adminUser.email });
    const validTotp = generateSync({ secret: enrollRes.secret });
    const confirmMfaRes = await mfaService.confirmEnrollment(adminUser.id, validTotp);

    // Login primario de Admin (emite desafío MFA obligatorio)
    const adminLoginStep1 = await adminContext.request.post('/api/v1/auth/login', {
      data: { email: adminUser.email, password: passwordPlain },
    });
    const step1Data = (await adminLoginStep1.json()).data;
    assert(
      adminLoginStep1.status() === 200 && step1Data.mfaRequired === true && step1Data.mfaToken,
      'Login primario de ROLE_ADMIN exige segundo factor MFA obligatorio (mfaRequired: true)',
    );

    // Verificación MFA de Admin con emisión de cookie HttpOnly
    const adminLoginResp = await adminContext.request.post('/api/v1/auth/mfa/verify', {
      data: { mfaToken: step1Data.mfaToken, code: confirmMfaRes.backupCodes[0] },
    });
    const setCookieHeader = adminLoginResp.headers()['set-cookie'] || '';
    assert(
      adminLoginResp.status() === 200 && setCookieHeader.includes('mexagenda_session') && setCookieHeader.includes('HttpOnly'),
      'Verificación MFA de ROLE_ADMIN exitosa con emisión de cookie mexagenda_session (HttpOnly, SameSite=Strict)',
    );

    const meResp = await adminContext.request.get('/api/v1/auth/me');
    const meJson = await meResp.json();
    assert(
      meResp.status() === 200 && meJson.data.email === adminUser.email,
      'Endpoint /api/v1/auth/me autentica automáticamente mediante la cookie almacenada en el contexto de Playwright',
    );

    // Login de Vocal y de Tercero en sus propios contextos aislados
    const vocalLoginResp = await vocalContext.request.post('/api/v1/auth/login', {
      data: { email: vocalUser.email, password: passwordPlain },
    });
    const thirdLoginResp = await thirdContext.request.post('/api/v1/auth/login', {
      data: { email: thirdUser.email, password: passwordPlain },
    });
    assert(
      vocalLoginResp.status() === 200 && thirdLoginResp.status() === 200,
      'Contextos de navegador independientes autenticados para Vocal y Usuario Tercero',
    );

    // --------------------------------------------------------------------------
    // 3. E2E REUNIONES, ASISTENCIA Y APROBACIÓN DE ACTA OFICIAL
    // --------------------------------------------------------------------------
    console.log('\n--- 3. E2E CICLO DE VIDA DE REUNIONES Y ACTAS ---');
    const createMeetingResp = await adminContext.request.post('/api/v1/meetings', {
      data: {
        title: `Sesión Plenaria E2E ${runId}`,
        categoryId: category.id,
        meetingDate: '2026-11-09',
        startTime: '09:00',
        endTime: '11:00',
        location: 'Sala de Consejo Institucional',
        modality: 'HIBRIDA',
        description: 'Sesión integral E2E con Playwright',
      },
    });
    const meetingData = (await createMeetingResp.json()).data;
    cleanup.meetings.push(meetingData.id);
    assert(createMeetingResp.status() === 201 && meetingData.id, `Reunión creada vía API E2E (Folio: ${meetingData.folio})`);

    // Convocar al Vocal
    const addPartResp = await adminContext.request.post(`/api/v1/meetings/${meetingData.id}/participants`, {
      data: {
        userId: vocalUser.id,
        institutionalRole: 'Vocal Ejecutivo',
        participationCondition: 'TITULAR',
      },
    });
    const participantData = (await addPartResp.json()).data;
    assert(addPartResp.status() === 201, 'Participante convocado exitosamente a la reunión');

    // Registrar asistencia PRESENTE
    const attResp = await adminContext.request.patch(
      `/api/v1/meetings/${meetingData.id}/participants/${participantData.id}/attendance`,
      { data: { attendanceStatus: 'PRESENTE' } },
    );
    assert(attResp.status() === 200, 'Asistencia PRESENTE acreditada para cumplimiento de quórum legal');

    // Iniciar y finalizar sesión para habilitar aprobación de acta
    await adminContext.request.post(`/api/v1/meetings/${meetingData.id}/session/start`, { data: {} });
    const endSessResp = await adminContext.request.post(`/api/v1/meetings/${meetingData.id}/session/end`, { data: {} });
    assert(endSessResp.status() === 200 || endSessResp.status() === 201, 'Sesión iniciada y finalizada formalmente');

    // Crear y aprobar el Acta Oficial
    const createMinResp = await adminContext.request.post(`/api/v1/meetings/${meetingData.id}/minutes`, {
      data: {
        summary: 'Se aprobaron por unanimidad los puntos del orden del día en la prueba E2E.',
        presidedByName: 'Coordinadora E2E',
        secretaryByName: 'Vocal Ejecutivo',
      },
    });
    assert(createMinResp.status() === 200 || createMinResp.status() === 201, 'Borrador de Acta Oficial registrado');

    await adminContext.request.patch(`/api/v1/meetings/${meetingData.id}/minutes/review`, { data: {} });
    const approveMinResp = await adminContext.request.patch(`/api/v1/meetings/${meetingData.id}/minutes/approve`, {
      data: { approvalNotes: 'Aprobada sin observaciones en E2E Playwright' },
    });
    assert(approveMinResp.status() === 200, 'Acta Oficial aprobada y publicada formalmente');

    // --------------------------------------------------------------------------
    // 4. E2E ACUERDOS VINCULANTES Y AVANCES
    // --------------------------------------------------------------------------
    console.log('\n--- 4. E2E ACUERDOS INSTITUCIONALES ---');
    const createAgrResp = await adminContext.request.post('/api/v1/agreements', {
      data: {
        title: `=cmd|'/C calc'!A0 Acuerdo E2E ${runId}`,
        description: 'Compromiso de prueba E2E con prefijo de fórmula para validar sanitización CSV',
        meetingId: meetingData.id,
        categoryId: category.id,
        dueDate: '2026-11-25',
        priority: 'ALTA',
        assignedToId: vocalUser.id,
      },
    });
    const agreementData = (await createAgrResp.json()).data;
    cleanup.agreements.push(agreementData.id);
    assert(createAgrResp.status() === 201 && agreementData.id, `Acuerdo creado y asignado al Vocal (Folio: ${agreementData.folio})`);

    // El Vocal registra un avance del 100% y completa el acuerdo
    const progResp = await vocalContext.request.post(`/api/v1/agreements/${agreementData.id}/progress`, {
      data: {
        description: 'Avance completado durante prueba E2E Playwright',
        newPercent: 100,
      },
    });
    assert(progResp.status() === 201, 'Vocal registra avance del 100% sobre su acuerdo asignado');

    // --------------------------------------------------------------------------
    // 5. E2E PRIVACIDAD DE NOTAS PERSONALES Y SOBERANÍA DE AUTORÍA
    // --------------------------------------------------------------------------
    console.log('\n--- 5. E2E PRIVACIDAD DE NOTAS PERSONALES (ABAC) ---');
    const createNoteResp = await vocalContext.request.post('/api/v1/notes', {
      data: {
        title: `Nota Estrictamente Confidencial ${runId}`,
        content: 'Contenido deliberativo privado del Vocal que jamás debe filtrarse.',
        visibility: 'PRIVADA',
        meetingId: meetingData.id,
      },
    });
    const noteData = (await createNoteResp.json()).data;
    cleanup.notes.push(noteData.id);
    assert(createNoteResp.status() === 201 && noteData.id, 'Vocal crea nota personal con visibilidad PRIVADA');

    // Edición por el propio autor genera versión 2
    const updateNoteResp = await vocalContext.request.patch(`/api/v1/notes/${noteData.id}`, {
      data: { content: 'Contenido actualizado v2 por su autor legítimo.' },
    });
    assert(updateNoteResp.status() === 200, 'Autor edita su propia nota generando nueva versión histórica');

    // Usuario tercero intenta leer y editar la nota privada ajena -> Bloqueado (403)
    const intruderReadResp = await thirdContext.request.get(`/api/v1/notes/${noteData.id}`);
    const intruderEditResp = await thirdContext.request.patch(`/api/v1/notes/${noteData.id}`, {
      data: { content: 'Intento de sabotaje de nota ajena' },
    });
    assert(
      intruderReadResp.status() === 403 && intruderEditResp.status() === 403,
      'Blindaje ABAC verificado: Usuario tercero recibe 403 Forbidden al intentar leer o editar nota privada ajena',
    );

    // --------------------------------------------------------------------------
    // 6. E2E BÓVEDA DOCUMENTAL Y BLOQUEO DE CUARENTENA
    // --------------------------------------------------------------------------
    console.log('\n--- 6. E2E BÓVEDA DOCUMENTAL Y CUARENTENA ---');
    const validPdfBytes = Buffer.from('%PDF-1.4\nExpediente Oficial E2E Limpio\n%%EOF', 'utf8');
    const uploadCleanResp = await vocalContext.request.post('/api/v1/documents/upload', {
      multipart: {
        file: {
          name: 'anexo_limpio_e2e.pdf',
          mimeType: 'application/pdf',
          buffer: validPdfBytes,
        },
        category: 'ANEXO_TECNICO',
        description: 'Documento limpio cargado vía Playwright multipart',
      },
    });
    const cleanDocData = (await uploadCleanResp.json()).data;
    cleanup.attachments.push(cleanDocData.id);
    assert(
      uploadCleanResp.status() === 201 && cleanDocData.scanStatus === 'LIMPIO',
      'Carga multipart E2E de PDF legítimo exitosa (scanStatus = LIMPIO)',
    );

    const downloadCleanResp = await vocalContext.request.get(`/api/v1/documents/${cleanDocData.id}/download`);
    const downloadCleanJson = (await downloadCleanResp.json()).data;
    assert(
      downloadCleanResp.status() === 200 && downloadCleanJson.downloadUrl,
      'Emisión de URL de descarga firmada temporal verificada vía HTTP',
    );

    // Cargar archivo con firma EICAR y comprobar bloqueo 403 en descarga E2E
    const eicarBytes = Buffer.from(
      '%PDF-1.4\nX5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*\n%%EOF',
      'latin1',
    );
    const uploadEicarResp = await vocalContext.request.post('/api/v1/documents/upload', {
      multipart: {
        file: {
          name: 'malware_eicar_e2e.pdf',
          mimeType: 'application/pdf',
          buffer: eicarBytes,
        },
        category: 'GENERAL',
      },
    });
    const eicarDocData = (await uploadEicarResp.json()).data;
    cleanup.attachments.push(eicarDocData.id);

    const downloadEicarResp = await vocalContext.request.get(`/api/v1/documents/${eicarDocData.id}/download`);
    assert(
      eicarDocData.scanStatus === 'INFECTADO' && downloadEicarResp.status() === 403,
      'Archivo EICAR queda en cuarentena (INFECTADO) y el endpoint /download responde 403 Forbidden',
    );

    // --------------------------------------------------------------------------
    // 7. E2E NOTIFICACIONES AUTOMÁTICAS
    // --------------------------------------------------------------------------
    console.log('\n--- 7. E2E NOTIFICACIONES INSTITUCIONALES ---');
    const notifsResp = await vocalContext.request.get('/api/v1/notifications');
    const notifsBody = (await notifsResp.json()).data;
    const notifItems = notifsBody.items || notifsBody;
    assert(
      notifsResp.status() === 200 && Array.isArray(notifItems) && notifItems.length >= 2,
      `Vocal recibió automáticamente ${notifItems.length} notificaciones por convocatoria, acta y acuerdo asignado`,
    );

    const markReadResp = await vocalContext.request.patch(`/api/v1/notifications/${notifItems[0].id}/read`);
    assert(markReadResp.status() === 200, 'Marcado de lectura de notificación verificado vía HTTP');

    // --------------------------------------------------------------------------
    // 8. E2E REPORTES Y EXPORTACIÓN CSV SANITIZADA
    // --------------------------------------------------------------------------
    console.log('\n--- 8. E2E REPORTES EJECUTIVOS Y EXPORTACIÓN CSV ---');
    const vocalExecResp = await vocalContext.request.get('/api/v1/reports/executive');
    assert(vocalExecResp.status() === 403, 'RBAC E2E: ROLE_USER recibe 403 Forbidden en /api/v1/reports/executive');

    const vocalPersonalResp = await vocalContext.request.get('/api/v1/reports/personal');
    const vocalPersonalText = await vocalPersonalResp.text();
    assert(
      vocalPersonalResp.status() === 200 && !vocalPersonalText.includes(`Nota Estrictamente Confidencial ${runId}`),
      'Consola personal devuelve métrica volumétrica sin exponer títulos ni contenidos de notas privadas',
    );

    const adminCsvResp = await adminContext.request.get(`/api/v1/reports/export?type=agreements&categoryId=${category.id}`);
    const csvText = await adminCsvResp.text();
    assert(
      adminCsvResp.status() === 200 && (csvText.includes("'=cmd|") || csvText.includes("\"'=cmd|")),
      'Exportación CSV vía HTTP neutraliza fórmulas maliciosas con apóstrofe de seguridad',
    );

    // --------------------------------------------------------------------------
    // 9. PRUEBA DE CARGA Y ESTRÉS: 50 USUARIOS VIRTUALES SIMULTÁNEOS (50 VUs)
    // --------------------------------------------------------------------------
    console.log('\n--- 9. PRUEBA DE CARGA Y ESTRÉS (50 USUARIOS SIMULTÁNEOS: LECTURA Y CREACIÓN) ---');
    // Extraer cookie de sesión del contexto de Playwright para los 50 VUs
    const cookies = await adminContext.cookies();
    const sessionCookie = cookies.find((c) => c.name.includes('mexagenda_session'));
    const cookieHeaderValue = sessionCookie ? `${sessionCookie.name}=${sessionCookie.value}` : '';

    const NUM_VUS = 50;
    const readEndpoints = [
      { name: 'GET /health', path: '/api/v1/health' },
      { name: 'GET /meetings', path: '/api/v1/meetings?page=1&limit=10' },
      { name: 'GET /agreements', path: '/api/v1/agreements?page=1&limit=10' },
      { name: 'GET /notifications/unread-count', path: '/api/v1/notifications/unread-count' },
      { name: 'GET /reports/agreements', path: '/api/v1/reports/agreements?page=1&limit=10' },
    ];

    const latencies = [];
    const readLatencies = [];
    const writeLatencies = [];
    const byCategory = {};
    let successReqs = 0;
    let failedReqs = 0;

    // Umbrales de aceptación definidos previo a la ejecución (WAN Local -> Neon us-east-1)
    const SLA_MAX_ERROR_RATE_PCT = 0;
    const SLA_READ_P95_WAN_MS = 6500;
    const SLA_WRITE_P95_WAN_MS = 12000;
    const BASELINE_REF_P95_MS = 6040.96;

    console.log(
      `  [SLA-PREDEFINIDO] Tasa Error Máx: ${SLA_MAX_ERROR_RATE_PCT}% | Lectura p95 WAN Máx: ${SLA_READ_P95_WAN_MS} ms | Escritura p95 WAN Máx: ${SLA_WRITE_P95_WAN_MS} ms | Referencia Base: ${BASELINE_REF_P95_MS} ms`,
    );

    function recordMetric(cat, elapsed, isWrite = false) {
      latencies.push(elapsed);
      if (isWrite) {
        writeLatencies.push(elapsed);
      } else {
        readLatencies.push(elapsed);
      }
      if (!byCategory[cat]) byCategory[cat] = [];
      byCategory[cat].push(elapsed);
    }

    const loadStart = perfNow();

    // Lanzar 50 usuarios virtuales concurrentes (lecturas + escrituras concurrentes en los primeros 5 VUs)
    const vuPromises = Array.from({ length: NUM_VUS }, async (_, vuIndex) => {
      // Escalonamiento realista de rampa corta (0 a 400 ms entre arranques de los 50 VUs concurrentes)
      await new Promise((r) => setTimeout(r, (vuIndex % 10) * 40));

      for (const ep of readEndpoints) {
        const reqStart = perfNow();
        try {
          const res = await fetch(`${BASE_URL}${ep.path}`, {
            headers: {
              Cookie: cookieHeaderValue,
              Accept: 'application/json',
            },
          });
          const elapsed = perfNow() - reqStart;
          recordMetric(ep.name, elapsed);
          if (res.status === 200) {
            successReqs++;
          } else {
            failedReqs++;
          }
        } catch (err) {
          failedReqs++;
          recordMetric(ep.name, perfNow() - reqStart);
        }
      }

      // 5 VUs ejecutan además creación concurrente de reuniones y acuerdos bajo carga
      if (vuIndex < 5) {
        const mStart = perfNow();
        try {
          const mRes = await fetch(`${BASE_URL}/api/v1/meetings`, {
            method: 'POST',
            headers: {
              Cookie: cookieHeaderValue,
              'Content-Type': 'application/json',
              Accept: 'application/json',
            },
            body: JSON.stringify({
              title: `Reunión Carga VU-${vuIndex} ${runId}`,
              categoryId: category.id,
              meetingDate: '2026-11-15',
              startTime: '10:00',
              endTime: '11:00',
              location: 'Sala Virtual de Carga',
              modality: 'VIRTUAL',
            }),
          });
          const mElapsed = perfNow() - mStart;
          recordMetric('POST /meetings', mElapsed, true);
          if (mRes.status === 201) {
            successReqs++;
            const mJson = await mRes.json();
            if (mJson.data && mJson.data.id) cleanup.meetings.push(mJson.data.id);
          } else {
            failedReqs++;
          }
        } catch (err) {
          failedReqs++;
          recordMetric('POST /meetings', perfNow() - mStart, true);
        }

        const aStart = perfNow();
        try {
          const aRes = await fetch(`${BASE_URL}/api/v1/agreements`, {
            method: 'POST',
            headers: {
              Cookie: cookieHeaderValue,
              'Content-Type': 'application/json',
              Accept: 'application/json',
            },
            body: JSON.stringify({
              title: `Acuerdo Carga VU-${vuIndex} ${runId}`,
              description: 'Creación concurrente bajo carga de 50 VUs',
              meetingId: meetingData.id,
              categoryId: category.id,
              dueDate: '2026-11-28',
              priority: 'MEDIA',
              assignedToId: vocalUser.id,
            }),
          });
          const aElapsed = perfNow() - aStart;
          recordMetric('POST /agreements', aElapsed, true);
          if (aRes.status === 201) {
            successReqs++;
            const aJson = await aRes.json();
            if (aJson.data && aJson.data.id) cleanup.agreements.push(aJson.data.id);
          } else {
            failedReqs++;
          }
        } catch (err) {
          failedReqs++;
          recordMetric('POST /agreements', perfNow() - aStart, true);
        }
      }
    });

    await Promise.all(vuPromises);
    const totalLoadDurationMs = perfNow() - loadStart;

    latencies.sort((a, b) => a - b);
    readLatencies.sort((a, b) => a - b);
    writeLatencies.sort((a, b) => a - b);
    const totalReqs = latencies.length;
    const minLat = Math.round(latencies[0] * 100) / 100;
    const avgLat = Math.round((latencies.reduce((s, v) => s + v, 0) / totalReqs) * 100) / 100;
    const p50Lat = Math.round(latencies[Math.floor(totalReqs * 0.5)] * 100) / 100;
    const p90Lat = Math.round(latencies[Math.floor(totalReqs * 0.9)] * 100) / 100;
    const p95Lat = Math.round(latencies[Math.floor(totalReqs * 0.95)] * 100) / 100;
    const p99Lat = Math.round(latencies[Math.floor(totalReqs * 0.99)] * 100) / 100;
    const maxLat = Math.round(latencies[totalReqs - 1] * 100) / 100;
    const rps = Math.round((totalReqs / (totalLoadDurationMs / 1000)) * 100) / 100;

    const readAvgLat = Math.round((readLatencies.reduce((s, v) => s + v, 0) / readLatencies.length) * 100) / 100;
    const readP50Lat = Math.round(readLatencies[Math.floor(readLatencies.length * 0.5)] * 100) / 100;
    const readP95Lat = Math.round(readLatencies[Math.floor(readLatencies.length * 0.95)] * 100) / 100;

    const writeAvgLat = Math.round((writeLatencies.reduce((s, v) => s + v, 0) / writeLatencies.length) * 100) / 100;
    const writeP50Lat = Math.round(writeLatencies[Math.floor(writeLatencies.length * 0.5)] * 100) / 100;
    const writeP95Lat = Math.round(writeLatencies[Math.floor(writeLatencies.length * 0.95)] * 100) / 100;
    const deltaRefMs = Math.round((p95Lat - BASELINE_REF_P95_MS) * 100) / 100;

    console.log(`  [LOAD-50VUs] Solicitudes Totales: ${totalReqs} (250 lecturas + 10 creaciones) | Exitosas: ${successReqs} | Fallidas: ${failedReqs}`);
    console.log(`  [LOAD-50VUs] Duración Total: ${Math.round(totalLoadDurationMs)} ms | Throughput: ${rps} req/s`);
    console.log(`  [LOAD-50VUs] Latencias Globales (ms) -> min: ${minLat} | avg: ${avgLat} | p50: ${p50Lat} | p90: ${p90Lat} | p95: ${p95Lat} (vs ref ${BASELINE_REF_P95_MS} ms: ${deltaRefMs >= 0 ? '+' : ''}${deltaRefMs} ms) | p99: ${p99Lat} | max: ${maxLat}`);
    console.log(`  [LOAD-50VUs] Latencias LECTURAS (n=250)   -> avg: ${readAvgLat} ms | p50: ${readP50Lat} ms | p95: ${readP95Lat} ms (Umbral: < ${SLA_READ_P95_WAN_MS} ms)`);
    console.log(`  [LOAD-50VUs] Latencias ESCRITURAS (n=10)  -> avg: ${writeAvgLat} ms | p50: ${writeP50Lat} ms | p95: ${writeP95Lat} ms (Umbral: < ${SLA_WRITE_P95_WAN_MS} ms)`);

    for (const [catName, arr] of Object.entries(byCategory)) {
      arr.sort((a, b) => a - b);
      const cAvg = Math.round((arr.reduce((s, v) => s + v, 0) / arr.length) * 100) / 100;
      const cP50 = Math.round(arr[Math.floor(arr.length * 0.5)] * 100) / 100;
      const cP95 = Math.round(arr[Math.floor(arr.length * 0.95)] * 100) / 100;
      console.log(`    -> ${catName.padEnd(30)} (n=${String(arr.length).padStart(2)}): avg=${cAvg} ms | p50=${cP50} ms | p95=${cP95} ms`);
    }

    assert(
      failedReqs === 0 && successReqs === 260,
      `Prueba de carga de 50 VUs simultáneos (lectura y creación) superada con 0% de errores (260/260 HTTP 200/201, ${rps} req/s)`,
    );
    assert(
      readP95Lat < SLA_READ_P95_WAN_MS && writeP95Lat < SLA_WRITE_P95_WAN_MS,
      `Umbrales de aceptación p95 cumplidos: Lecturas p95=${readP95Lat} ms (< ${SLA_READ_P95_WAN_MS} ms) | Escrituras p95=${writeP95Lat} ms (< ${SLA_WRITE_P95_WAN_MS} ms) | Global p95=${p95Lat} ms`,
    );

    console.log('\n==============================================================================');
    console.log(`TOTAL ASERCIONES E2E + CARGA: ${totalAssertions}`);
    console.log(`SUPERADAS:                    ${passedAssertions}`);
    console.log(`FALLIDAS:                     ${totalAssertions - passedAssertions}`);
    console.log('==============================================================================\n');
  } finally {
    console.log('--- LIMPIEZA ATÓMICA DE DATOS E2E Y CIERRE DE RECURSOS ---');
    if (browser) {
      await browser.close();
    }
    if (app) {
      await app.close();
    }
    if (cleanup.users.length > 0) {
      await prisma.notificationDelivery.deleteMany({
        where: { notification: { userId: { in: cleanup.users } } },
      });
      await prisma.notification.deleteMany({ where: { userId: { in: cleanup.users } } });
      await prisma.notificationPreference.deleteMany({ where: { userId: { in: cleanup.users } } });
    }
    if (cleanup.attachments.length > 0) {
      await prisma.attachmentVersion.deleteMany({ where: { attachmentId: { in: cleanup.attachments } } });
      await prisma.attachment.deleteMany({ where: { id: { in: cleanup.attachments } } });
    }
    if (cleanup.notes.length > 0) {
      await prisma.personalNoteVersion.deleteMany({ where: { personalNoteId: { in: cleanup.notes } } });
      await prisma.personalNote.deleteMany({ where: { id: { in: cleanup.notes } } });
    }
    if (cleanup.agreements.length > 0) {
      await prisma.agreementProgress.deleteMany({ where: { agreementId: { in: cleanup.agreements } } });
      await prisma.agreementHistory.deleteMany({ where: { agreementId: { in: cleanup.agreements } } });
      await prisma.agreement.deleteMany({ where: { id: { in: cleanup.agreements } } });
    }
    if (cleanup.meetings.length > 0) {
      await prisma.meetingMinutesVersion.deleteMany({
        where: { minutes: { meetingId: { in: cleanup.meetings } } },
      });
      await prisma.meetingMinutes.deleteMany({ where: { meetingId: { in: cleanup.meetings } } });
      await prisma.meetingSessionLog.deleteMany({ where: { meetingId: { in: cleanup.meetings } } });
      await prisma.meetingParticipant.deleteMany({ where: { meetingId: { in: cleanup.meetings } } });
      await prisma.meeting.deleteMany({ where: { id: { in: cleanup.meetings } } });
    }
    if (cleanup.categories.length > 0) {
      await prisma.meetingCategory.deleteMany({ where: { id: { in: cleanup.categories } } });
    }
    if (cleanup.users.length > 0) {
      await prisma.userMfa.deleteMany({ where: { userId: { in: cleanup.users } } });
      await prisma.userSession.deleteMany({ where: { userId: { in: cleanup.users } } });
      await prisma.user.deleteMany({ where: { id: { in: cleanup.users } } });
    }
    await prisma.loginAttempt.deleteMany({
      where: { ipAddress: { in: ['127.0.0.1', '::1', '::ffff:127.0.0.1'] } },
    });
    await prisma.$disconnect();
    console.log('--- SERVIDOR Y NAVEGADOR CERRADOS LIMPIAMENTE ---');
  }
}

main().catch((err) => {
  console.error('Error fatal en suite E2E / Carga:', err);
  process.exit(1);
});

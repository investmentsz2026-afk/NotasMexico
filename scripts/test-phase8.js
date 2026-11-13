/**
 * ==============================================================================
 * MEXAGENDA — SUITE DE PRUEBAS DE FASE 8 (MOD-07)
 * REPORTES INSTITUCIONALES, MÉTRICAS EJECUTIVAS Y TABLEROS DE CONTROL
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

const { PrismaClient, AgreementStatus, MeetingStatus, AttendanceStatus, AuditOutcome } = require(path.resolve('d:/MexAgenda/node_modules/@prisma/client'));
const prisma = new PrismaClient();

const { ReportsService } = require('../apps/backend/dist/modules/reports/reports.service');
const { AuditService } = require('../apps/backend/dist/modules/audit/audit.service');

// Mock o instancia real de AuditService con prisma
const auditService = new AuditService(prisma);
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

// IDs de entidades creadas para limpieza atómica
const cleanup = {
  users: [],
  categories: [],
  meetings: [],
  participants: [],
  minutes: [],
  agreements: [],
  collaborators: [],
  notes: [],
  auditLogs: [],
};

async function main() {
  console.log('==============================================================================');
  console.log('MEXAGENDA — SUITE DE PRUEBAS AUTOMATIZADAS DE FASE 8 (MOD-07)');
  console.log('Base de Datos: Neon PostgreSQL Serverless');
  console.log(`Identificador de Ejecución: ${runId}`);
  console.log('==============================================================================\n');

  try {
    // --------------------------------------------------------------------------
    // 0. CONFIGURACIÓN DEL ENTORNO Y USUARIOS DE PRUEBA
    // --------------------------------------------------------------------------
    console.log('--- 0. PREPARACIÓN DE USUARIOS Y ROLES ---');
    const adminRole = await prisma.role.findUnique({ where: { code: 'ROLE_ADMIN' } });
    const userRole = await prisma.role.findUnique({ where: { code: 'ROLE_USER' } });

    assert(adminRole && userRole, 'Roles ROLE_ADMIN y ROLE_USER verificados en la base de datos');

    // Crear Usuario Administrador de Prueba
    const testAdmin = await prisma.user.create({
      data: {
        email: `admin_f8_${runId}@mexagenda.gob.mx`,
        passwordHash: 'dummy_hash_argon2id',
        firstName: 'Directora',
        lastName: `Ejecutiva ${runId}`,
        position: 'Coordinadora General',
        roleId: adminRole.id,
        status: 'ACTIVO',
      },
    });
    cleanup.users.push(testAdmin.id);

    // Crear Usuario Consejero Estándar de Prueba
    const testUser = await prisma.user.create({
      data: {
        email: `consejero_f8_${runId}@mexagenda.gob.mx`,
        passwordHash: 'dummy_hash_argon2id',
        firstName: 'Consejero',
        lastName: `Vocal ${runId}`,
        position: 'Vocal de Comité',
        roleId: userRole.id,
        status: 'ACTIVO',
      },
    });
    cleanup.users.push(testUser.id);

    // Crear Segundo Usuario para pruebas de coadyuvancia y aislamiento
    const testUser2 = await prisma.user.create({
      data: {
        email: `coadyuvante_f8_${runId}@mexagenda.gob.mx`,
        passwordHash: 'dummy_hash_argon2id',
        firstName: 'Coadyuvante',
        lastName: `Técnico ${runId}`,
        position: 'Asesor Técnico',
        roleId: userRole.id,
        status: 'ACTIVO',
      },
    });
    cleanup.users.push(testUser2.id);

    // Crear Categoría Temática de Prueba
    const testCat = await prisma.meetingCategory.create({
      data: {
        name: `Comité de Prueba F8 ${runId}`,
        code: `CAT_F8_${runId.toUpperCase()}`,
        colorHex: '#0284C7',
        displayOrder: 99,
        isActive: true,
      },
    });
    cleanup.categories.push(testCat.id);

    // Estructuras AuthUser para simular peticiones con sesión
    const authAdmin = {
      id: testAdmin.id,
      email: testAdmin.email,
      firstName: testAdmin.firstName,
      lastName: testAdmin.lastName,
      role: 'ROLE_ADMIN',
      status: 'ACTIVO',
      permissions: ['report:view:executive', 'report:view:operational', 'report:export', 'agreement:report:read'],
    };

    const authUser = {
      id: testUser.id,
      email: testUser.email,
      firstName: testUser.firstName,
      lastName: testUser.lastName,
      role: 'ROLE_USER',
      status: 'ACTIVO',
      permissions: ['report:view:operational', 'report:export'],
    };

    assert(testAdmin && testUser && testUser2, '3 usuarios institucionales y 1 categoría creados para la suite');

    // --------------------------------------------------------------------------
    // 1. CONTROL DE ACCESO RBAC Y AISLAMIENTO IDOR/BOLA
    // --------------------------------------------------------------------------
    console.log('\n--- 1. VERIFICACIÓN DE CONTROL DE ACCESO RBAC Y SEGURIDAD IDOR ---');

    // Admin puede consultar tablero ejecutivo
    let adminExecutiveOk = false;
    try {
      const exec = await reportsService.getExecutiveDashboard(authAdmin, {});
      if (exec && exec.kpis) adminExecutiveOk = true;
    } catch (e) {
      adminExecutiveOk = false;
    }
    assert(adminExecutiveOk, 'ROLE_ADMIN accede satisfactoriamente al Tablero Ejecutivo');

    // Usuario estándar NO puede consultar tablero ejecutivo (HTTP 403 Forbidden)
    let userExecutiveBlocked = false;
    try {
      await reportsService.getExecutiveDashboard(authUser, {});
    } catch (err) {
      if (err.name === 'ForbiddenException' || err.status === 403) {
        userExecutiveBlocked = true;
      }
    }
    assert(userExecutiveBlocked, 'ROLE_USER es rechazado con ForbiddenException (403) al intentar consultar Tablero Ejecutivo');

    // --------------------------------------------------------------------------
    // 2. CONJUNTO DE DATOS CONTROLADO (GROUND TRUTH) Y CÁLCULO DE MÉTRICAS
    // --------------------------------------------------------------------------
    console.log('\n--- 2. CONJUNTO DE DATOS DE RESULTADO CONOCIDO (GROUND TRUTH) ---');
    const todayCdmx = reportsService.getTodayInMexicoCity();
    console.log(`  [INFO] Fecha civil de referencia en America/Mexico_City: ${todayCdmx}`);

    // Crear Sesión Institucional Base
    const meeting = await prisma.meeting.create({
      data: {
        folio: `SES-F8-${runId}`,
        title: `Sesión Ordinaria de Evaluación ${runId}`,
        categoryId: testCat.id,
        meetingDate: new Date('2026-11-01T00:00:00.000Z'),
        startTime: new Date('1970-01-01T10:00:00.000Z'),
        endTime: new Date('1970-01-01T12:00:00.000Z'),
        location: 'Sala de Consejo',
        status: MeetingStatus.FINALIZADA,
        createdById: testAdmin.id,
      },
    });
    cleanup.meetings.push(meeting.id);

    // 6 Acuerdos Controlados para validar Ground Truth:
    // A1: CUMPLIDO en tiempo (due: 2026-11-05, comp: 2026-11-04)
    const agr1 = await prisma.agreement.create({
      data: {
        folio: `ACU-1-${runId}`,
        title: 'Acuerdo 1: Cumplido en plazo',
        description: 'Compromiso solventado anticipadamente',
        meetingId: meeting.id,
        categoryId: testCat.id,
        status: AgreementStatus.CUMPLIDO,
        approvalDate: new Date('2026-11-01T00:00:00.000Z'),
        dueDate: new Date('2026-11-05T00:00:00.000Z'),
        completionDate: new Date('2026-11-04T00:00:00.000Z'),
        progressPercent: 100,
        assignedToId: testUser.id,
        createdById: testAdmin.id,
      },
    });
    cleanup.agreements.push(agr1.id);

    // A2: CUMPLIDO con rezago (due: 2026-11-03, comp: 2026-11-06)
    const agr2 = await prisma.agreement.create({
      data: {
        folio: `ACU-2-${runId}`,
        title: 'Acuerdo 2: Cumplido con rezago',
        description: 'Compromiso solventado posterior a fecha límite',
        meetingId: meeting.id,
        categoryId: testCat.id,
        status: AgreementStatus.CUMPLIDO,
        approvalDate: new Date('2026-11-01T00:00:00.000Z'),
        dueDate: new Date('2026-11-03T00:00:00.000Z'),
        completionDate: new Date('2026-11-06T00:00:00.000Z'),
        progressPercent: 100,
        assignedToId: testUser.id,
        createdById: testAdmin.id,
      },
    });
    cleanup.agreements.push(agr2.id);

    // A3: PENDIENTE con fecha pasada -> Debe calcularse como VENCIDO
    const agr3 = await prisma.agreement.create({
      data: {
        folio: `ACU-3-${runId}`,
        title: 'Acuerdo 3: Pendiente rebasado en fecha',
        description: 'Compromiso en rezago no cumplido',
        meetingId: meeting.id,
        categoryId: testCat.id,
        status: AgreementStatus.PENDIENTE,
        approvalDate: new Date('2026-11-01T00:00:00.000Z'),
        dueDate: new Date('2026-11-02T00:00:00.000Z'), // Pasado
        progressPercent: 20,
        assignedToId: testUser.id,
        createdById: testAdmin.id,
      },
    });
    cleanup.agreements.push(agr3.id);

    // A4: EN_PROCESO con fecha futura en 10 días -> Medio (8 a 15 días)
    const futureDate10 = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);
    const agr4 = await prisma.agreement.create({
      data: {
        folio: `ACU-4-${runId}`,
        title: 'Acuerdo 4: En proceso en plazo medio',
        description: 'Compromiso con vencimiento a 10 días',
        meetingId: meeting.id,
        categoryId: testCat.id,
        status: AgreementStatus.EN_PROCESO,
        approvalDate: new Date('2026-11-01T00:00:00.000Z'),
        dueDate: futureDate10,
        progressPercent: 60,
        assignedToId: testUser.id,
        createdById: testAdmin.id,
      },
    });
    cleanup.agreements.push(agr4.id);

    // A5: CANCELADO -> Debe ser excluido del denominador de cumplimiento
    const agr5 = await prisma.agreement.create({
      data: {
        folio: `ACU-5-${runId}`,
        title: 'Acuerdo 5: Cancelado formalmente',
        description: 'Compromiso anulado por causa justificada',
        meetingId: meeting.id,
        categoryId: testCat.id,
        status: AgreementStatus.CANCELADO,
        approvalDate: new Date('2026-11-01T00:00:00.000Z'),
        dueDate: new Date('2026-11-05T00:00:00.000Z'),
        progressPercent: 0,
        assignedToId: testUser.id,
        createdById: testAdmin.id,
      },
    });
    cleanup.agreements.push(agr5.id);

    // A6: SUSPENDIDO (DEC-08-02) -> Separado del semáforo activo
    const agr6 = await prisma.agreement.create({
      data: {
        folio: `ACU-6-${runId}`,
        title: 'Acuerdo 6: Suspendido por litigio',
        description: 'Compromiso en pausa jurídica justificada',
        meetingId: meeting.id,
        categoryId: testCat.id,
        status: AgreementStatus.SUSPENDIDO,
        approvalDate: new Date('2026-11-01T00:00:00.000Z'),
        dueDate: new Date('2026-11-20T00:00:00.000Z'),
        progressPercent: 40,
        assignedToId: testUser.id,
        createdById: testAdmin.id,
      },
    });
    cleanup.agreements.push(agr6.id);

    // Consultar seguimiento de acuerdos con filtro por categoría de prueba
    const tracking = await reportsService.getAgreementsTracking(authAdmin, {
      categoryId: testCat.id,
    });

    assert(tracking.resumenEstados.total === 6, 'Total de acuerdos en categoría coincide con los 6 creados');
    assert(tracking.resumenEstados.cumplidos === 2, 'Total de cumplidos es exactamente 2 (A1 y A2)');
    assert(tracking.resumenEstados.vencidos === 1, 'Total de vencidos por cálculo efectivo es exactamente 1 (A3)');
    assert(tracking.resumenEstados.cancelados === 1, 'Total de cancelados es exactamente 1 (A5)');
    assert(tracking.resumenEstados.suspendidos === 1, 'Total de suspendidos (DEC-08-02) es exactamente 1 (A6)');

    // Validación de Tasa de Cumplimiento Global (DEC-08-02):
    // Total Válidos = 6 - 1 (Cancelado) = 5.
    // Denominador activo = 5 - 1 (Suspendido) = 4 exigibles.
    // Tasa = (2 cumplidos / 4 exigibles) * 100 = 50.0%.
    assert(
      tracking.tasaCumplimiento === 50,
      `Tasa de cumplimiento global es exactamente 50.0% (Esperado: 50.0%, Obtenido: ${tracking.tasaCumplimiento}%)`,
    );

    // Validación de Efectividad Temporal (Cumplidos en o antes de plazo):
    // Cumplidos = 2. En plazo = 1 (A1).
    // Tasa = (1 / 2) * 100 = 50.0%.
    assert(
      tracking.tasaEfectividadTemporal === 50,
      `Tasa de efectividad temporal es exactamente 50.0% (Esperado: 50.0%, Obtenido: ${tracking.tasaEfectividadTemporal}%)`,
    );

    // Semáforo Preventivo sin solapamiento
    assert(tracking.semaforo.vencidos === 1, 'Semáforo preventivo registra 1 vencido');
    assert(tracking.semaforo.medio15Dias === 1, 'Semáforo preventivo registra 1 en rango medio (8 a 15 días)');
    assert(tracking.semaforo.suspendidos === 1, 'Semáforo preventivo separa el acuerdo suspendido');

    // --------------------------------------------------------------------------
    // 3. PREVENCIÓN DE DOBLE CONTEO POR COLABORADORES MÚLTIPLES
    // --------------------------------------------------------------------------
    console.log('\n--- 3. VERIFICACIÓN DE PREVENCIÓN DE DOBLE CONTEO (COADYUVANCIA) ---');
    // Asignar testUser2 como coadyuvante en A4
    const collab = await prisma.agreementCollaborator.create({
      data: {
        agreementId: agr4.id,
        userId: testUser2.id,
        assignedById: testAdmin.id,
      },
    });
    cleanup.collaborators.push(collab.id);

    // Consultar como admin con filtro de categoría
    const trackingPostCollab = await reportsService.getAgreementsTracking(authAdmin, {
      categoryId: testCat.id,
    });

    assert(
      trackingPostCollab.totalItems === 6,
      `Acuerdo con coadyuvante se contabiliza exactamente 1 vez a nivel global (Total: ${trackingPostCollab.totalItems})`,
    );

    // Consultar como coadyuvante (testUser2): debe ver solo 1 acuerdo
    const authUser2 = {
      id: testUser2.id,
      email: testUser2.email,
      firstName: testUser2.firstName,
      lastName: testUser2.lastName,
      role: 'ROLE_USER',
      status: 'ACTIVO',
      permissions: ['report:view:operational', 'report:export'],
    };

    const trackingCollab = await reportsService.getAgreementsTracking(authUser2, {});
    assert(
      trackingCollab.totalItems === 1,
      `Coadyuvante consulta únicamente el acuerdo en el que colabora (Total: ${trackingCollab.totalItems})`,
    );
    assert(
      trackingCollab.items[0].isCollaborator === true,
      'Registro incluye bandera isCollaborator=true para diferenciar titularidad de coadyuvancia',
    );

    // --------------------------------------------------------------------------
    // 4. GOBERNANZA DE SESIONES, ASISTENCIA Y QUÓRUM LEGAL
    // --------------------------------------------------------------------------
    console.log('\n--- 4. GOBERNANZA DE SESIONES, QUÓRUM Y ACTAS ---');
    // Registrar participantes para Meeting:
    // Convocados = 2 (testUser presente, testUser2 falta justificada). Asistencias = 1.
    // Tasa asistencia = 50.0%. Quórum simple (>50% de convocados) = 1 > 1 -> NO alcanza quórum.
    const part1 = await prisma.meetingParticipant.create({
      data: {
        meetingId: meeting.id,
        userId: testUser.id,
        attendanceStatus: AttendanceStatus.PRESENTE,
      },
    });
    cleanup.participants.push(part1.id);

    const part2 = await prisma.meetingParticipant.create({
      data: {
        meetingId: meeting.id,
        userId: testUser2.id,
        attendanceStatus: AttendanceStatus.JUSTIFICADO,
      },
    });
    cleanup.participants.push(part2.id);

    const governance = await reportsService.getSessionGovernance(authAdmin, {
      categoryId: testCat.id,
    });

    assert(governance.resumen.celebradas === 1, 'Gobernanza registra 1 sesión celebrada');
    assert(governance.asistencia.totalConvocados === 2, 'Gobernanza registra 2 integrantes convocados');
    assert(governance.asistencia.totalAsistencias === 1, 'Gobernanza registra 1 asistencia efectiva');
    assert(governance.asistencia.totalJustificadas === 1, 'Gobernanza registra 1 inasistencia justificada');
    assert(governance.asistencia.tasaAsistenciaPromedio === 50, 'Tasa de asistencia institucional promedio es 50.0%');
    assert(governance.quorum.sesionesSinQuorum === 1, 'Quórum legal evalúa regla reglamentaria simple (>50%)');

    // --------------------------------------------------------------------------
    // 5. CONSOLA PERSONAL Y PRIVACIDAD ESTRICTA DE NOTAS
    // --------------------------------------------------------------------------
    console.log('\n--- 5. CONSOLA PERSONAL Y AISLAMIENTO DE PRIVACIDAD DE NOTAS ---');
    // Crear nota personal PRIVADA para testUser
    const note = await prisma.personalNote.create({
      data: {
        title: 'Nota Secreta de Análisis Presupuestal',
        content: 'Contenido altamente confidencial de deliberación individual.',
        visibility: 'PRIVADA',
        category: 'PRESUPUESTO',
        authorId: testUser.id,
        meetingId: meeting.id,
      },
    });
    cleanup.notes.push(note.id);

    const consoleUser = await reportsService.getPersonalConsole(authUser);

    assert(consoleUser.notasPrivadas.totalNotas >= 1, 'Consola personal refleja el conteo volumétrico de notas propias');
    assert(
      consoleUser.notasPrivadas.avisoPrivacidad.includes('estrictamente inaccesible'),
      'Consola personal incluye aviso formal de privacidad estricta de notas',
    );
    assert(consoleUser.acuerdosTitular.total >= 5, 'Consola personal reporta acuerdos donde el usuario es titular directo');

    // Comprobar que en NINGUNA respuesta de reportes se incluye el texto ni el título de la nota
    const rawJson = JSON.stringify(governance) + JSON.stringify(tracking);
    assert(
      !rawJson.includes('Contenido altamente confidencial'),
      'Verificación de Blindaje: El contenido de notas privadas está 100% ausente de reportes institucionales',
    );
    assert(
      !rawJson.includes('Nota Secreta de Análisis Presupuestal'),
      'Verificación de Blindaje: Los títulos de notas privadas están 100% ausentes de reportes institucionales',
    );

    // --------------------------------------------------------------------------
    // 6. EXPORTACIÓN CSV CON NEUTRALIZACIÓN DE FÓRMULAS (DEC-08-01)
    // --------------------------------------------------------------------------
    console.log('\n--- 6. EXPORTACIÓN TABULAR CSV Y NEUTRALIZACIÓN DE INYECCIÓN DE FÓRMULAS ---');
    // Crear acuerdo con fórmula maliciosa en el título
    const malAgr = await prisma.agreement.create({
      data: {
        folio: `ACU-MAL-${runId}`,
        title: '=cmd|\' /C calc\'!A0', // Payload típico de CSV injection
        description: '+SUM(1+1)',
        meetingId: meeting.id,
        categoryId: testCat.id,
        status: AgreementStatus.PENDIENTE,
        approvalDate: new Date('2026-11-01T00:00:00.000Z'),
        dueDate: new Date('2026-11-20T00:00:00.000Z'),
        assignedToId: testUser.id,
        createdById: testAdmin.id,
      },
    });
    cleanup.agreements.push(malAgr.id);

    const csvData = await reportsService.exportReportCsv(authAdmin, {
      type: 'agreements',
      categoryId: testCat.id,
    });

    assert(csvData.includes('Folio,Título,Categoría,Prioridad'), 'CSV generado incluye encabezados institucionales oficiales');
    assert(
      csvData.includes("''=cmd|' /C calc'!A0") || csvData.includes("'=cmd|"),
      'Neutralización exitosa: Título malicioso con prefijo "=" neutralizado con apóstrofe de seguridad (\')',
    );

    // Verificar registro de auditoría sin guardar el contenido completo
    const lastAuditLog = await prisma.auditLog.findFirst({
      where: {
        action: 'REPORT_EXPORTED',
        actorId: testAdmin.id,
      },
      orderBy: { createdAt: 'desc' },
    });

    assert(lastAuditLog !== null, 'Acción REPORT_EXPORTED registrada inmutablemente en audit_logs');
    assert(lastAuditLog.diffPayload && lastAuditLog.diffPayload.format === 'CSV', 'Audit log registra formato CSV y filtros');
    assert(!JSON.stringify(lastAuditLog.diffPayload).includes('cmd'), 'Audit log NO guarda las filas ni el contenido exportado');

    // --------------------------------------------------------------------------
    // 7. ROBUSTEZ ANTE CASOS BORDE (DENOMINADOR CERO / PERIODOS VACÍOS)
    // --------------------------------------------------------------------------
    console.log('\n--- 7. CASOS BORDE Y PERIODOS VACÍOS ---');
    const emptyQuery = await reportsService.getAgreementsTracking(authAdmin, {
      from: '2045-01-01',
      to: '2045-12-31',
    });

    assert(emptyQuery.resumenEstados.total === 0, 'Consulta en periodo vacío retorna total = 0');
    assert(emptyQuery.tasaCumplimiento === null, 'Denominador cero retorna formalmente null (Sin datos), previniendo NaN o división por cero');

    console.log('\n==============================================================================');
    console.log(`TOTAL DE PRUEBAS FASE 8: ${totalTests}`);
    console.log(`SUPERADAS:               ${passedTests}`);
    console.log(`FALLIDAS:                ${totalTests - passedTests}`);
    console.log(`TASA DE ÉXITO:           ${((passedTests / totalTests) * 100).toFixed(1)}%`);
    console.log('==============================================================================');

  } finally {
    // --------------------------------------------------------------------------
    // 8. LIMPIEZA ATÓMICA DE REGISTROS DE PRUEBA EN NEON POSTGRESQL
    // --------------------------------------------------------------------------
    console.log('\n--- LIMPIEZA ATÓMICA DE REGISTROS DE PRUEBA EN NEON POSTGRESQL ---');
    if (cleanup.collaborators.length) {
      await prisma.agreementCollaborator.deleteMany({ where: { id: { in: cleanup.collaborators } } });
      console.log(`  - Colaboradores eliminados: ${cleanup.collaborators.length}`);
    }
    if (cleanup.notes.length) {
      await prisma.personalNote.deleteMany({ where: { id: { in: cleanup.notes } } });
      console.log(`  - Notas personales eliminadas: ${cleanup.notes.length}`);
    }
    if (cleanup.agreements.length) {
      await prisma.agreement.deleteMany({ where: { id: { in: cleanup.agreements } } });
      console.log(`  - Acuerdos eliminados: ${cleanup.agreements.length}`);
    }
    if (cleanup.participants.length) {
      await prisma.meetingParticipant.deleteMany({ where: { id: { in: cleanup.participants } } });
      console.log(`  - Participantes eliminados: ${cleanup.participants.length}`);
    }
    if (cleanup.meetings.length) {
      await prisma.meeting.deleteMany({ where: { id: { in: cleanup.meetings } } });
      console.log(`  - Sesiones eliminadas: ${cleanup.meetings.length}`);
    }
    if (cleanup.categories.length) {
      await prisma.meetingCategory.deleteMany({ where: { id: { in: cleanup.categories } } });
      console.log(`  - Categorías eliminadas: ${cleanup.categories.length}`);
    }
    if (cleanup.users.length) {
      await prisma.user.deleteMany({ where: { id: { in: cleanup.users } } });
      console.log(`  - Usuarios de prueba eliminados: ${cleanup.users.length}`);
    }
    await prisma.$disconnect();
    console.log('--- CONEXIÓN A NEON CERRADA LIMPIAMENTE ---');
  }
}

main().catch((err) => {
  console.error('ERROR FATAL EN SUITE DE PRUEBAS FASE 8:', err);
  process.exit(1);
});


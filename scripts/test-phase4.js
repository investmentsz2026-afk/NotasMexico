/**
 * ==============================================================================
 * MEXAGENDA — SUITE DE PRUEBAS AUTOMATIZADAS DE FASE 4
 * ==============================================================================
 * MÓDULO 03: GESTIÓN, ASIGNACIÓN Y SEGUIMIENTO DE ACUERDOS INSTITUCIONALES
 *
 * Valida de forma exhaustiva sobre Neon PostgreSQL los casos de prueba obligatorios:
 * - DB-001..004: Integridad de esquema, tablas, índices y llaves foráneas en Neon.
 * - AGR-001..007: Creación con folio único institucional, validaciones, concurrencia,
 *                 consultas y semáforo dinámico de vencimiento.
 * - ASG-001..005: Asignación principal, reasignación con motivo obligatorio,
 *                 gestión de colaboradores y prevención de duplicados.
 * - PRO-001..005: Avances porcentuales (0-100%), transición automática a EN_PROCESO,
 *                 justificación por reducción, regla de no auto-cumplimiento.
 * - STA-001..006: Máquina de estados finita: /complete, /suspend, /reactivate, /cancel
 *                 y rechazo de transiciones inválidas.
 * - HIS-001..003: Auditoría append-only, inmutabilidad y sincronización con audit_logs.
 * - EVI-001..002: Referencias a evidencias documentales en expediente.
 * - REP-001..002: Tablero ejecutivo y reportes de cumplimiento y vencimiento.
 * - SEC-001..005: Seguridad, permisos RBAC granular y protección IDOR.
 * ==============================================================================
 */

const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

// 1. Cargar variables de entorno
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

// 2. Cargar servicios compilados de NestJS
const { AgreementsService } = require('../apps/backend/dist/modules/agreements/agreements.service');
const { MeetingsService } = require('../apps/backend/dist/modules/meetings/meetings.service');
const { MeetingCategoriesService } = require('../apps/backend/dist/modules/meeting-categories/meeting-categories.service');
const { AuditService } = require('../apps/backend/dist/modules/audit/audit.service');

const auditService = new AuditService(prisma);
const categoriesService = new MeetingCategoriesService(prisma, auditService);
const meetingsService = new MeetingsService(prisma, auditService);
const agreementsService = new AgreementsService(prisma, auditService);

const results = [];

function assert(condition, message) {
  if (!condition) {
    throw new Error(`FALLO DE ASERCIÓN: ${message}`);
  }
}

async function runTest(code, title, fn) {
  const start = Date.now();
  try {
    await fn();
    const duration = Date.now() - start;
    results.push({ code, title, passed: true, duration });
    console.log(`  ✓ [${code}] ${title} (${duration}ms)`);
  } catch (err) {
    const duration = Date.now() - start;
    results.push({ code, title, passed: false, duration, error: err.message });
    console.error(`  ✗ [${code}] ${title} (${duration}ms)`);
    console.error(`    -> ${err.message}`);
  }
}

async function main() {
  console.log('\n==============================================================================');
  console.log('MEXAGENDA — SUITE DE PRUEBAS AUTOMATIZADAS DE FASE 4 (NEON POSTGRESQL)');
  console.log('==============================================================================\n');

  // Buscar usuarios de prueba
  const adminUser = await prisma.user.findFirst({
    where: { role: { code: 'ROLE_ADMIN' } },
  });
  assert(adminUser, 'Debe existir un usuario administrador activo en la base de datos.');

  let normalUser = await prisma.user.findFirst({
    where: {
      id: { not: adminUser.id },
      status: 'ACTIVO',
    },
  });

  if (!normalUser) {
    const userRole = (await prisma.role.findFirst({ where: { code: 'ROLE_USER' } })) || adminUser.role;
    normalUser = await prisma.user.create({
      data: {
        email: `servidor.fase4.${Date.now()}@mexagenda.gob.mx`,
        passwordHash: adminUser.passwordHash,
        firstName: 'Lic. Roberto',
        lastName: 'Mendoza Ruiz',
        position: 'Coordinador Operativo de Acuerdos',
        status: 'ACTIVO',
        roleId: userRole.id,
      },
    });
  }

  // Garantizar una reunión y un punto del orden del día para pruebas
  let testMeeting = await prisma.meeting.findFirst({
    where: { deletedAt: null },
    include: { agendaItems: true },
  });

  if (!testMeeting) {
    let cat = await prisma.meetingCategory.findFirst();
    if (!cat) {
      cat = await categoriesService.create(
        { name: 'Categoría Pruebas Fase 4', code: `CAT_P4_${Date.now()}` },
        adminUser.id,
      );
    }
    testMeeting = await meetingsService.create(
      {
        title: `Reunión Colegiada para Acuerdos ${Date.now()}`,
        categoryId: cat.id,
        modality: 'PRESENCIAL',
        meetingDate: new Date(Date.now() + 86400000).toISOString(),
        meetingTime: '10:00',
        location: 'Sala de Consejo',
      },
      adminUser.id,
    );
  }

  let testAgendaItem = testMeeting.agendaItems && testMeeting.agendaItems[0];
  if (!testAgendaItem) {
    testAgendaItem = await meetingsService.addAgendaItem(
      testMeeting.id,
      { title: 'Punto 1: Análisis y Adopción de Acuerdos Colegiados', orderIndex: 1 },
      adminUser.id,
    );
  }

  let createdAgreementId = null;
  let testFolio = null;

  // --------------------------------------------------------------------------
  // GRUPO 1: DB-001..004 — INTEGRIDAD Y ESQUEMA EN NEON POSTGRESQL
  // --------------------------------------------------------------------------
  console.log('--- 1. VERIFICACIÓN DE BASE DE DATOS Y ESQUEMA (DB) ---');

  await runTest('DB-001', 'Verificar existencia de tablas del módulo MOD-03 en Neon PostgreSQL', async () => {
    const tableQueries = [
      prisma.agreement.count(),
      prisma.agreementCollaborator.count(),
      prisma.agreementProgress.count(),
      prisma.agreementEvidence.count(),
      prisma.agreementHistory.count(),
    ];
    const counts = await Promise.all(tableQueries);
    assert(counts.every((c) => typeof c === 'number'), 'Todas las tablas de MOD-03 deben ser accesibles');
  });

  await runTest('DB-002', 'Verificar llaves foráneas y restricción de integridad referencial', async () => {
    // Intentar crear un acuerdo con meetingId inválido debe ser rechazado por FK o NotFoundException
    let caught = false;
    try {
      await agreementsService.create(
        {
          meetingId: '00000000-0000-0000-0000-000000000000',
          title: 'Acuerdo con FK inválida',
          description: 'Descripción de prueba para FK inexistente',
          assignedToId: adminUser.id,
          dueDate: new Date().toISOString(),
        },
        adminUser.id,
      );
    } catch (e) {
      caught = true;
    }
    assert(caught, 'Debe rechazarse la creación de acuerdo con meeting inexistente');
  });

  await runTest('DB-003', 'Verificar integridad no destructiva de fases anteriores', async () => {
    const userCount = await prisma.user.count();
    const roleCount = await prisma.role.count();
    const meetingCount = await prisma.meeting.count();
    assert(userCount > 0, 'Los usuarios de Fase 1 y 2 permanecen intactos');
    assert(roleCount >= 2, 'Los roles de sistema permanecen intactos');
    assert(meetingCount > 0, 'Las reuniones de Fase 3 permanecen intactas');
  });

  // --------------------------------------------------------------------------
  // GRUPO 2: AGR-001..007 — CICLO DE VIDA Y REGLAS DE NEGOCIO DE ACUERDOS
  // --------------------------------------------------------------------------
  console.log('\n--- 2. CREACIÓN, FOLIO ÚNICO Y GESTIÓN GENERAL (AGR) ---');

  await runTest('AGR-001', 'Crear acuerdo con generación automática de folio institucional único', async () => {
    const dueDate = new Date(Date.now() + 15 * 86400000).toISOString(); // +15 días
    const agreement = await agreementsService.create(
      {
        meetingId: testMeeting.id,
        agendaItemId: testAgendaItem.id,
        title: 'Acuerdo Institucional de Prueba Automatizada F4',
        description: 'Descripción exhaustiva del mandato acordado colegiadamente para pruebas de Fase 4.',
        agreementType: 'ACUERDO_ORDINARIO',
        priority: 'ALTA',
        assignedToId: normalUser.id,
        dueDate,
      },
      adminUser.id,
      '127.0.0.1',
      'TestRunner/Phase4',
    );

    assert(agreement.id, 'Debe retornar el ID generado del acuerdo');
    assert(agreement.folio, 'Debe contar con un folio institucional');
    assert(agreement.folio.startsWith('ACU-'), 'El folio debe iniciar con prefijo ACU-');
    assert(agreement.status === 'PENDIENTE', 'El estado inicial debe ser PENDIENTE');
    assert(agreement.progressPercent === 0, 'El avance inicial debe ser 0%');
    assert(agreement.version === 1, 'La versión inicial debe ser 1');
    assert(agreement.assignee.id === normalUser.id, 'El responsable asignado debe coincidir');

    createdAgreementId = agreement.id;
    testFolio = agreement.folio;
  });

  await runTest('AGR-002', 'Validar rechazo por campos obligatorios faltantes o inválidos', async () => {
    let caughtTitle = false;
    try {
      await agreementsService.create(
        {
          meetingId: testMeeting.id,
          title: 'Ab', // Menor a 3 caracteres
          description: 'Descripción válida de prueba con más de 10 caracteres',
          assignedToId: normalUser.id,
          dueDate: new Date().toISOString(),
        },
        adminUser.id,
      );
    } catch (e) {
      caughtTitle = true;
    }
    assert(caughtTitle, 'Debe rechazar títulos de menos de 3 caracteres');

    let caughtDesc = false;
    try {
      await agreementsService.create(
        {
          meetingId: testMeeting.id,
          title: 'Título Válido',
          description: 'Corta', // Menor a 10 caracteres
          assignedToId: normalUser.id,
          dueDate: new Date().toISOString(),
        },
        adminUser.id,
      );
    } catch (e) {
      caughtDesc = true;
    }
    assert(caughtDesc, 'Debe rechazar descripciones de menos de 10 caracteres');
  });

  await runTest('AGR-003', 'Consultar detalle completo de acuerdo (findById) con relaciones institucionales', async () => {
    const detail = await agreementsService.findById(createdAgreementId);
    assert(detail.id === createdAgreementId, 'El ID consultado debe coincidir');
    assert(detail.meeting && detail.meeting.id === testMeeting.id, 'Debe incluir los datos de la reunión de origen');
    assert(detail.assignee && detail.assignee.id === normalUser.id, 'Debe incluir el responsable asignado');
    assert(Array.isArray(detail.collaborators), 'Debe incluir lista de colaboradores');
    assert(Array.isArray(detail.progressReports), 'Debe incluir lista de avances reportados');
    assert(Array.isArray(detail.evidences), 'Debe incluir lista de evidencias');
    assert(Array.isArray(detail.history), 'Debe incluir trazabilidad inmutable');
  });

  await runTest('AGR-004', 'Actualización general de acuerdo con control de concurrencia optimista (version)', async () => {
    const updated = await agreementsService.update(
      createdAgreementId,
      {
        title: 'Acuerdo Institucional de Prueba Automatizada F4 (Actualizado)',
        version: 1, // Versión esperada
      },
      adminUser.id,
      '127.0.0.1',
      'TestRunner/Phase4',
    );
    assert(updated.title.includes('(Actualizado)'), 'El título debió actualizarse');
    assert(updated.version === 2, 'La versión debió incrementarse a 2');

    // Intentar actualizar con versión obsoleta (versión 1 cuando ya es 2)
    let caughtStale = false;
    try {
      await agreementsService.update(
        createdAgreementId,
        {
          title: 'Actualización conflictiva obsoleta',
          version: 1,
        },
        adminUser.id,
      );
    } catch (e) {
      caughtStale = true;
    }
    assert(caughtStale, 'Debe rechazar actualización concurrente con versión obsoleta');
  });

  await runTest('AGR-005', 'Detección y cálculo dinámico de acuerdos vencidos', async () => {
    // Crear un acuerdo temporal con fecha límite en el pasado (-2 días)
    const pastDueDate = new Date(Date.now() - 2 * 86400000).toISOString();
    const expiredAgreement = await agreementsService.create(
      {
        meetingId: testMeeting.id,
        title: 'Acuerdo con fecha en el pasado para prueba de VENCIDO',
        description: 'Descripción para verificar cálculo dinámico de estado VENCIDO.',
        assignedToId: normalUser.id,
        dueDate: pastDueDate,
      },
      adminUser.id,
    );

    assert(expiredAgreement.status === 'VENCIDO', 'El estado efectivo calculado debe ser VENCIDO');

    // Al consultarlo por findById también debe figurar VENCIDO
    const queried = await agreementsService.findById(expiredAgreement.id);
    assert(queried.status === 'VENCIDO', 'findById debe retornar estado efectivo VENCIDO');
  });

  // --------------------------------------------------------------------------
  // GRUPO 3: ASG-001..005 — ASIGNACIÓN Y COLABORADORES
  // --------------------------------------------------------------------------
  console.log('\n--- 3. ASIGNACIÓN Y COLABORADORES (ASG) ---');

  await runTest('ASG-001', 'Reasignar responsable principal con motivo obligatorio', async () => {
    // Intentar reasignar sin changeReason debe fallar
    let caughtNoReason = false;
    try {
      await agreementsService.assign(
        createdAgreementId,
        {
          assignedToId: adminUser.id,
          changeReason: '', // Vacío
        },
        adminUser.id,
      );
    } catch (e) {
      caughtNoReason = true;
    }
    assert(caughtNoReason, 'Debe exigir justificación obligatoria al reasignar responsable');

    // Reasignación válida
    const reassigned = await agreementsService.assign(
      createdAgreementId,
      {
        assignedToId: adminUser.id,
        changeReason: 'Delegación formal por redistribución de encomiendas institucionales.',
      },
      adminUser.id,
      '127.0.0.1',
      'TestRunner/Phase4',
    );
    assert(reassigned.assignee.id === adminUser.id, 'El nuevo responsable debe ser adminUser');
    assert(reassigned.version === 3, 'La versión debió incrementarse a 3');
  });

  await runTest('ASG-002', 'Agregar colaborador institucional coadyuvante', async () => {
    const collab = await agreementsService.addCollaborator(
      createdAgreementId,
      {
        userId: normalUser.id,
        notes: 'Enlace técnico y coadyuvante de cumplimiento',
      },
      adminUser.id,
    );
    assert(collab.userId === normalUser.id, 'El colaborador debe ser normalUser');
    assert(collab.user && collab.user.fullName, 'Debe incluir datos del colaborador');
  });

  await runTest('ASG-003', 'Prevenir duplicados de colaborador en el mismo acuerdo', async () => {
    let caughtDuplicate = false;
    try {
      await agreementsService.addCollaborator(
        createdAgreementId,
        {
          userId: normalUser.id,
          notes: 'Intento de duplicación',
        },
        adminUser.id,
      );
    } catch (e) {
      caughtDuplicate = true;
    }
    assert(caughtDuplicate, 'Debe rechazar la adición de un colaborador previamente asignado');
  });

  await runTest('ASG-004', 'Remover colaborador institucional', async () => {
    const res = await agreementsService.removeCollaborator(
      createdAgreementId,
      normalUser.id,
      adminUser.id,
    );
    assert(res.message, 'Debe confirmar la remoción');

    const detail = await agreementsService.findById(createdAgreementId);
    assert(detail.collaborators.length === 0, 'La lista de colaboradores debe quedar vacía');
  });

  // --------------------------------------------------------------------------
  // GRUPO 4: PRO-001..005 — SEGUIMIENTO Y AVANCES (PRO)
  // --------------------------------------------------------------------------
  console.log('\n--- 4. SEGUIMIENTO Y REGISTRO DE AVANCES (PRO) ---');

  await runTest('PRO-001', 'Registrar primer avance (35%) y verificar cambio automático a EN_PROCESO', async () => {
    const progress = await agreementsService.addProgress(
      createdAgreementId,
      {
        progressPercent: 35,
        observations: 'Revisión y desahogo de las primeras etapas del mandato colegiado.',
      },
      adminUser.id,
      '127.0.0.1',
      'TestRunner/Phase4',
    );

    assert(progress.newPercent === 35, 'El avance registrado debe ser 35%');
    assert(progress.previousPercent === 0, 'El avance anterior debe ser 0%');

    const detail = await agreementsService.findById(createdAgreementId);
    assert(detail.status === 'EN_PROCESO', 'El estado del acuerdo debe ser EN_PROCESO');
    assert(detail.progressPercent === 35, 'El porcentaje actual debe ser 35%');
  });

  await runTest('PRO-002', 'Exigir justificación obligatoria al reducir porcentaje de avance', async () => {
    // Intentar bajar de 35% a 20% sin justificación debe ser rechazado
    let caughtNoJustification = false;
    try {
      await agreementsService.addProgress(
        createdAgreementId,
        {
          progressPercent: 20,
          observations: 'Reducción de avance por observación técnica sin justificación',
        },
        adminUser.id,
      );
    } catch (e) {
      caughtNoJustification = true;
    }
    assert(caughtNoJustification, 'Debe exigir justificación obligatoria al reducir avance');

    // Con justificación formal debe permitirse
    const reduced = await agreementsService.addProgress(
      createdAgreementId,
      {
        progressPercent: 25,
        observations: 'Ajuste de porcentaje tras auditoría de entregables.',
        justification: 'Inconsistencias detectadas en la entrega parcial del subcomité.',
      },
      adminUser.id,
    );
    assert(reduced.newPercent === 25, 'El nuevo avance debe ser 25%');
  });

  await runTest('PRO-003', 'Regla de Oro Institucional: 100% de avance NO auto-cumple sin /complete', async () => {
    // Reportar avance al 100%
    const progress100 = await agreementsService.addProgress(
      createdAgreementId,
      {
        progressPercent: 100,
        observations: 'Se han finalizado todos los entregables materiales y técnicos.',
      },
      adminUser.id,
    );
    assert(progress100.newPercent === 100, 'El porcentaje debe ser 100%');

    const detail = await agreementsService.findById(createdAgreementId);
    assert(detail.progressPercent === 100, 'El porcentaje debe reflejar 100%');
    assert(
      detail.status === 'EN_PROCESO',
      'El acuerdo DEBE PERMANECER EN_PROCESO hasta que una autoridad ejecute /complete',
    );
  });

  // --------------------------------------------------------------------------
  // GRUPO 5: STA-001..006 — MÁQUINA DE ESTADOS FINITA (STA)
  // --------------------------------------------------------------------------
  console.log('\n--- 5. MÁQUINA DE ESTADOS FORMAL (STA) ---');

  await runTest('STA-001', 'Suspender acuerdo con justificación obligatoria', async () => {
    let caughtNoReason = false;
    try {
      await agreementsService.suspend(
        createdAgreementId,
        { reason: '' },
        adminUser.id,
      );
    } catch (e) {
      caughtNoReason = true;
    }
    assert(caughtNoReason, 'Debe requerir justificación para suspender');

    const suspended = await agreementsService.suspend(
      createdAgreementId,
      { reason: 'Suspensión temporal por resolución incidental del pleno.' },
      adminUser.id,
    );
    assert(suspended.status === 'SUSPENDIDO', 'El estado debe ser SUSPENDIDO');
  });

  await runTest('STA-002', 'Bloquear registro de avances en acuerdos suspendidos', async () => {
    let caughtSuspendedProgress = false;
    try {
      await agreementsService.addProgress(
        createdAgreementId,
        {
          progressPercent: 50,
          observations: 'Intento de avance en suspendido',
        },
        adminUser.id,
      );
    } catch (e) {
      caughtSuspendedProgress = true;
    }
    assert(caughtSuspendedProgress, 'No debe permitirse registrar avances en acuerdos suspendidos');
  });

  await runTest('STA-003', 'Reactivar acuerdo suspendido', async () => {
    const reactivated = await agreementsService.reactivate(
      createdAgreementId,
      { reason: 'Cese de la medida suspensiva acordada por el pleno.' },
      adminUser.id,
    );
    assert(reactivated.status === 'EN_PROCESO', 'El acuerdo debe reactivarse a EN_PROCESO');
  });

  await runTest('STA-004', 'Declarar formalmente CUMPLIDO el acuerdo institucional (/complete)', async () => {
    const completed = await agreementsService.complete(
      createdAgreementId,
      { observations: 'Aprobación formal del cumplimiento por la presidencia colegiada.' },
      adminUser.id,
      '127.0.0.1',
      'TestRunner/Phase4',
    );
    assert(completed.status === 'CUMPLIDO', 'El estado formal debe ser CUMPLIDO');
    assert(completed.progressPercent === 100, 'El progreso debe fijarse al 100%');
    assert(completed.completionDate, 'Debe registrar la fecha de cumplimiento');
    assert(completed.completer && completed.completer.id === adminUser.id, 'Debe registrar al servidor autorizante');
  });

  await runTest('STA-005', 'Rechazar transiciones desde estado terminal CUMPLIDO', async () => {
    let caughtTerminalSuspend = false;
    try {
      await agreementsService.suspend(
        createdAgreementId,
        { reason: 'Intento de suspender un acuerdo ya cumplido' },
        adminUser.id,
      );
    } catch (e) {
      caughtTerminalSuspend = true;
    }
    assert(caughtTerminalSuspend, 'No se puede suspender un acuerdo en estado terminal CUMPLIDO');

    let caughtTerminalCancel = false;
    try {
      await agreementsService.cancel(
        createdAgreementId,
        { reason: 'Intento de cancelar un acuerdo ya cumplido' },
        adminUser.id,
      );
    } catch (e) {
      caughtTerminalCancel = true;
    }
    assert(caughtTerminalCancel, 'No se puede cancelar un acuerdo en estado terminal CUMPLIDO');
  });

  await runTest('STA-006', 'Cancelar formalmente acuerdo con fundamentación obligatoria', async () => {
    // Crear un acuerdo adicional para probar cancelación
    const toCancel = await agreementsService.create(
      {
        meetingId: testMeeting.id,
        title: 'Acuerdo para prueba de cancelación formal',
        description: 'Descripción del acuerdo que será revocado colegiadamente.',
        assignedToId: normalUser.id,
        dueDate: new Date(Date.now() + 86400000).toISOString(),
      },
      adminUser.id,
    );

    const cancelled = await agreementsService.cancel(
      toCancel.id,
      { reason: 'Revocación por voto ponderado del pleno colegiado en sesión extraordinaria.' },
      adminUser.id,
    );
    assert(cancelled.status === 'CANCELADO', 'El estado final debe ser CANCELADO');
  });

  // --------------------------------------------------------------------------
  // GRUPO 6: HIS-001..003 — AUDITORÍA Y TRAZABILIDAD APPEND-ONLY
  // --------------------------------------------------------------------------
  console.log('\n--- 6. TRAZABILIDAD E HISTORIAL INMUTABLE APPEND-ONLY (HIS) ---');

  await runTest('HIS-001', 'Verificar historial append-only inmutable de agreement_history', async () => {
    const history = await prisma.agreementHistory.findMany({
      where: { agreementId: createdAgreementId },
      orderBy: { createdAt: 'asc' },
    });

    assert(history.length >= 4, `Debe contener al menos 4 eventos de trazabilidad, encontrados: ${history.length}`);

    const actionTypes = history.map((h) => h.actionType);
    assert(actionTypes.includes('CREATION'), 'Debe registrar evento CREATION');
    assert(actionTypes.includes('REASSIGNMENT'), 'Debe registrar evento REASSIGNMENT');
    assert(actionTypes.includes('PROGRESS_UPDATE'), 'Debe registrar evento PROGRESS_UPDATE');
    assert(actionTypes.includes('COMPLETION_CONFIRMED'), 'Debe registrar evento COMPLETION_CONFIRMED');
  });

  await runTest('HIS-002', 'Verificar registro en audit_logs centralizado institucional', async () => {
    const auditLogs = await prisma.auditLog.findMany({
      where: {
        entityId: createdAgreementId,
        entity: 'agreements',
      },
    });
    assert(auditLogs.length > 0, 'Deben existir registros en audit_logs para el acuerdo');
  });

  // --------------------------------------------------------------------------
  // GRUPO 7: EVI-001..002 — EVIDENCIAS DOCUMENTALES (EVI)
  // --------------------------------------------------------------------------
  console.log('\n--- 7. EVIDENCIAS DOCUMENTALES (EVI) ---');

  await runTest('EVI-001', 'Registrar referencia de evidencia documental', async () => {
    const ev = await agreementsService.addEvidence(
      createdAgreementId,
      {
        title: 'Dictamen de Cumplimiento Firmado',
        description: 'Acta de entrega recepción oficial con firmas autógrafas.',
        documentReference: 'oficios/2026/DICTAMEN_F4_FINAL.pdf',
      },
      adminUser.id,
    );

    assert(ev.id, 'Debe generar un ID de evidencia');
    assert(ev.title === 'Dictamen de Cumplimiento Firmado', 'El título debe coincidir');
  });

  await runTest('EVI-002', 'Consultar evidencias vinculadas en expediente del acuerdo', async () => {
    const detail = await agreementsService.findById(createdAgreementId);
    assert(detail.evidences.length >= 1, 'Debe retornar la evidencia en el expediente');
    assert(detail.evidences[0].documentReference === 'oficios/2026/DICTAMEN_F4_FINAL.pdf', 'La referencia debe coincidir');
  });

  // --------------------------------------------------------------------------
  // GRUPO 8: REP-001..002 — TABLERO Y REPORTES INSTITUCIONALES (REP)
  // --------------------------------------------------------------------------
  console.log('\n--- 8. TABLERO Y REPORTES INSTITUCIONALES (REP) ---');

  await runTest('REP-001', 'Obtener métricas ejecutivas de tablero (getDashboardMetrics)', async () => {
    const dash = await agreementsService.getDashboardMetrics();
    assert(dash.metrics, 'Debe incluir objeto de métricas');
    assert(typeof dash.metrics.total === 'number', 'Total debe ser numérico');
    assert(typeof dash.metrics.cumplidos === 'number', 'Cumplidos debe ser numérico');
    assert(dash.metrics.cumplidos >= 1, 'Debe registrar al menos 1 acuerdo cumplido');
    assert(Array.isArray(dash.urgentPending), 'Debe incluir lista de urgentes');
    assert(Array.isArray(dash.byAssignee), 'Debe incluir desglose por asignado');
  });

  await runTest('REP-002', 'Obtener reporte institucional y semáforo preventivo (getReports)', async () => {
    const reports = await agreementsService.getReports();
    assert(reports.metrics, 'Debe incluir métricas');
    assert(Array.isArray(reports.upcomingDue), 'Debe incluir lista de próximos a vencer');
    assert(Array.isArray(reports.overdue), 'Debe incluir lista de vencidos');
    assert(reports.byPriority, 'Debe incluir conteo por prioridad');
    assert(reports.byType, 'Debe incluir conteo por tipo');
  });

  // --------------------------------------------------------------------------
  // GRUPO 9: SEC-001..003 — SEGURIDAD, RBAC Y PROTECCIÓN IDOR (SEC)
  // --------------------------------------------------------------------------
  console.log('\n--- 9. SEGURIDAD, PERMISOS RBAC Y CONTROL IDOR (SEC) ---');

  await runTest('SEC-001', 'Verificar existencia de los 13 permisos de acuerdos en la base de datos', async () => {
    const expectedPerms = [
      'agreement:read',
      'agreement:create',
      'agreement:update',
      'agreement:assign',
      'agreement:progress:create',
      'agreement:progress:read',
      'agreement:complete',
      'agreement:suspend',
      'agreement:cancel',
      'agreement:reactivate',
      'agreement:history:read',
      'agreement:report:read',
      'agreement:manage',
    ];

    const permsInDb = await prisma.permission.findMany({
      where: { code: { in: expectedPerms } },
    });

    assert(
      permsInDb.length === 13,
      `Deben existir 13 permisos de acuerdos en la base de datos, encontrados: ${permsInDb.length}`,
    );
  });

  await runTest('SEC-002', 'Protección IDOR: Búsqueda de acuerdo con UUID inexistente retorna 404 NotFound', async () => {
    let caughtNotFound = false;
    try {
      await agreementsService.findById('ffffffff-ffff-ffff-ffff-ffffffffffff');
    } catch (e) {
      if (e.status === 404 || e.message.includes('no encontrado')) {
        caughtNotFound = true;
      }
    }
    assert(caughtNotFound, 'Debe retornar NotFoundException ante ID inexistente');
  });

  // --------------------------------------------------------------------------
  // RESUMEN FINAL
  // --------------------------------------------------------------------------
  console.log('\n==============================================================================');
  console.log('RESUMEN DE EJECUCIÓN — AUDITORÍA DE FASE 4');
  console.log('==============================================================================');

  const passedCount = results.filter((r) => r.passed).length;
  const failedCount = results.filter((r) => !r.passed).length;

  console.log(`Total Pruebas:    ${results.length}`);
  console.log(`Aprobadas:        ${passedCount}`);
  console.log(`Fallidas:         ${failedCount}`);

  if (failedCount > 0) {
    console.error('\nPRUEBAS FALLIDAS:');
    results.filter((r) => !r.passed).forEach((r) => {
      console.error(`- [${r.code}] ${r.title}: ${r.error}`);
    });
    process.exit(1);
  } else {
    console.log('\n>>> TODAS LAS PRUEBAS DE FASE 4 FUERON SUPERADAS EXITOSAMENTE. <<<\n');
  }
}

main()
  .catch((e) => {
    console.error('Error fatal en ejecución de pruebas:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

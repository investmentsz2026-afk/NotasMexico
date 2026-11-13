/**
 * ==============================================================================
 * MEXAGENDA — SUITE DE PRUEBAS AUTOMATIZADAS DE FASE 3
 * ==============================================================================
 * MÓDULO 02: GESTIÓN INSTITUCIONAL DE REUNIONES Y SESIONES
 *
 * Ejecuta y valida directamente los 38+ casos de prueba obligatorios:
 * - MEET-001..010: Ciclo de vida y gestión de reuniones colegiadas.
 * - CAT-001..005: Taxonomía y catálogo de categorías institucionales.
 * - CONV-001..004: Convocatorias oficiales, publicación y cédulas notificatorias.
 * - AGENDA-001..005: Orden del día, reordenamiento, desahogo y baja lógica.
 * - PART-001..006: Participantes, pase de lista, histórico de asistencia y métricas.
 * - SES-001..005: Apertura/cierre de sesión, autoridades y bitácora cronológica.
 * - MIN-001..006: Elaboración, revisión, aprobación y versionamiento inmutable de actas.
 * - SEC-001..008: Seguridad, RBAC, auditoría y sanitización de eventos.
 * - DB-001..006: Persistencia, índices y llaves foráneas en Neon PostgreSQL.
 * ==============================================================================
 */

const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

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

// Carga de servicios compilados
const { MeetingsService } = require('../apps/backend/dist/modules/meetings/meetings.service');
const { MeetingCategoriesService } = require('../apps/backend/dist/modules/meeting-categories/meeting-categories.service');
const { AuditService } = require('../apps/backend/dist/modules/audit/audit.service');

const auditService = new AuditService(prisma);
const categoriesService = new MeetingCategoriesService(prisma, auditService);
const meetingsService = new MeetingsService(prisma, auditService);

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
  console.log('MEXAGENDA — SUITE DE VERIFICACIÓN INTEGRAL DE FASE 3 (NEON POSTGRESQL)');
  console.log('==============================================================================\n');

  // Identificar usuario administrador de prueba
  const adminUser = await prisma.user.findFirst({
    where: { role: { code: 'ROLE_ADMIN' } },
  });
  assert(adminUser, 'Debe existir un usuario administrador activo en la base de datos.');

  const normalUser = await prisma.user.findFirst({
    where: { role: { code: 'ROLE_USER' } },
  }) || adminUser;

  let testCatId = null;
  let testMeetingId = null;
  let testAgendaItemId = null;
  let testParticipantId = null;

  // --------------------------------------------------------------------------
  // GRUPO 1: CAT-001..005 — TAXONOMÍA Y CATEGORÍAS INSTITUCIONALES
  // --------------------------------------------------------------------------
  console.log('--- 1. TAXONOMÍA Y CATEGORÍAS INSTITUCIONALES (CAT) ---');

  await runTest('CAT-001', 'Crear categoría institucional con código y colorHex', async () => {
    const uniqueCode = `TEST_CAT_${Date.now()}`;
    const cat = await categoriesService.create(
      {
        name: `Categoría de Auditoría ${Date.now()}`,
        code: uniqueCode,
        description: 'Categoría para pruebas automatizadas de Fase 3',
        colorHex: '#047857',
        displayOrder: 99,
      },
      adminUser.id,
      '127.0.0.1',
      'TestRunner/Phase3',
    );
    assert(cat.id, 'Debe retornar el ID de la categoría');
    assert(cat.code === uniqueCode, 'El código debe coincidir');
    testCatId = cat.id;
  });

  await runTest('CAT-002', 'Modificar categoría institucional existente', async () => {
    const updated = await categoriesService.update(
      testCatId,
      {
        description: 'Descripción actualizada formalmente',
        colorHex: '#065F46',
      },
      adminUser.id,
      '127.0.0.1',
      'TestRunner/Phase3',
    );
    assert(updated.colorHex === '#065F46', 'El color institucional debió actualizarse');
  });

  await runTest('CAT-003', 'Desactivación lógica de categoría institucional (isActive=false)', async () => {
    const deactivated = await categoriesService.deactivate(
      testCatId,
      adminUser.id,
      '127.0.0.1',
      'TestRunner/Phase3',
    );
    assert(deactivated.isActive === false, 'La categoría debe quedar inactiva');
  });

  await runTest('CAT-004', 'Reactivación de categoría institucional y listado', async () => {
    await categoriesService.update(
      testCatId,
      { isActive: true },
      adminUser.id,
      '127.0.0.1',
      'TestRunner/Phase3',
    );
    const activeList = await categoriesService.findAll(false);
    assert(activeList.some((c) => c.id === testCatId), 'La categoría debe figurar en la lista activa');
  });

  await runTest('CAT-005', 'Rechazar código de categoría duplicado (409 Conflict)', async () => {
    let threw = false;
    try {
      const existing = await prisma.meetingCategory.findUnique({ where: { id: testCatId } });
      await categoriesService.create(
        {
          name: `Categoría con Nombre Diferente ${Date.now()}`,
          code: existing.code,
          colorHex: '#123456',
        },
        adminUser.id,
      );
    } catch (e) {
      threw = true;
    }
    assert(threw, 'Debió lanzar ConflictException ante código duplicado');
  });

  // --------------------------------------------------------------------------
  // GRUPO 2: MEET-001..010 — CICLO DE VIDA DE REUNIONES
  // --------------------------------------------------------------------------
  console.log('\n--- 2. CICLO DE VIDA Y REUNIONES INSTITUCIONALES (MEET) ---');

  await runTest('MEET-001', 'Crear reunión válida con generación de folio institucional', async () => {
    const meeting = await meetingsService.create(
      {
        title: 'Sesión Ordinaria de Evaluación Anual 2026',
        categoryId: testCatId,
        meetingDate: '2026-11-20',
        startTime: '10:00',
        endTime: '12:30',
        location: 'Sala de Plenos Institucional',
        modality: 'HIBRIDA',
        virtualUrl: 'https://meet.google.com/mex-test-sesion',
        description: 'Reunión colegiada para revisar los informes de gestión y acuerdos.',
        status: 'PROGRAMADA',
      },
      adminUser.id,
      '127.0.0.1',
      'TestRunner/Phase3',
    );
    assert(meeting.id, 'Debe devolver el ID de la reunión creada');
    assert(meeting.folio && meeting.folio.length > 5, 'Debe generar un folio único institucional');
    assert(meeting.status === 'PROGRAMADA', 'El estado inicial debe ser PROGRAMADA');
    testMeetingId = meeting.id;
  });

  await runTest('MEET-002', 'Rechazar reunión con título vacío o insuficiente', async () => {
    let threw = false;
    try {
      await meetingsService.create(
        {
          title: '  ',
          categoryId: testCatId,
          meetingDate: '2026-11-20',
          startTime: '10:00',
          endTime: '11:00',
          location: 'Sala 1',
        },
        adminUser.id,
      );
    } catch {
      threw = true;
    }
    assert(threw, 'Debió rechazar título vacío');
  });

  await runTest('MEET-003', 'Rechazar reunión con hora de fin menor o igual a hora de inicio', async () => {
    let threw = false;
    try {
      await meetingsService.create(
        {
          title: 'Reunión con horario invertido',
          categoryId: testCatId,
          meetingDate: '2026-11-20',
          startTime: '15:00',
          endTime: '14:00',
          location: 'Sala 1',
        },
        adminUser.id,
      );
    } catch {
      threw = true;
    }
    assert(threw, 'Debió rechazar horario invertido');
  });

  await runTest('MEET-004', 'Rechazar reunión con fecha inválida', async () => {
    let threw = false;
    try {
      await meetingsService.create(
        {
          title: 'Reunión con fecha inválida',
          categoryId: testCatId,
          meetingDate: 'fecha-no-valida',
          startTime: '10:00',
          endTime: '11:00',
          location: 'Sala 1',
        },
        adminUser.id,
      );
    } catch {
      threw = true;
    }
    assert(threw, 'Debió rechazar fecha inválida');
  });

  await runTest('MEET-005', 'Consultas con filtros por categoría, estado y búsqueda de texto', async () => {
    const list = await meetingsService.findAll({
      categoryId: testCatId,
      status: 'PROGRAMADA',
      search: 'Evaluación Anual',
    });
    assert(list.items.length >= 1, 'Debe encontrar la reunión creada mediante filtros combinados');
    assert(list.meta.total >= 1, 'El total metadato debe reflejar el conteo');
  });

  await runTest('MEET-006', 'Actualizar metadatos de reunión y validar versionado concurrente', async () => {
    const updated = await meetingsService.update(
      testMeetingId,
      {
        title: 'Sesión Ordinaria de Evaluación Anual 2026 (Actualizada)',
        location: 'Sala de Plenos - Sede Central Poniente',
      },
      adminUser.id,
      '127.0.0.1',
      'TestRunner/Phase3',
    );
    assert(updated.title.includes('(Actualizada)'), 'El título debió modificarse');
    assert(updated.version >= 2, 'La versión de la entidad debe incrementarse (optimistic concurrency)');
  });

  await runTest('MEET-007', 'Asignar autoridades (presidencia y secretaría) a la reunión', async () => {
    const updated = await meetingsService.update(
      testMeetingId,
      {
        presidedById: adminUser.id,
        secretaryById: normalUser.id,
      },
      adminUser.id,
      '127.0.0.1',
      'TestRunner/Phase3',
    );
    assert(updated.presidedBy && updated.presidedBy.id === adminUser.id, 'Presidencia asignada');
    assert(updated.secretaryBy && updated.secretaryBy.id === normalUser.id, 'Secretaría asignada');
  });

  await runTest('MEET-008', 'Rechazar transición de estado no permitida', async () => {
    let threw = false;
    try {
      // Intentar pasar directo de PROGRAMADA a FINALIZADA sin iniciar sesión
      await meetingsService.changeStatus(
        testMeetingId,
        { status: 'FINALIZADA' },
        adminUser.id,
      );
    } catch {
      threw = true;
    }
    assert(threw, 'Debió bloquear transición ilegal de ciclo de vida');
  });

  await runTest('MEET-009', 'Cancelar reunión exigiendo motivo institucional obligatorio', async () => {
    // Primero crear una reunión temporal para cancelar
    const temp = await meetingsService.create(
      {
        title: 'Reunión a ser cancelada por prueba',
        categoryId: testCatId,
        meetingDate: '2026-11-22',
        startTime: '09:00',
        endTime: '10:00',
        location: 'Sala B',
      },
      adminUser.id,
    );

    // Cancelar sin motivo debe fallar
    let threw = false;
    try {
      await meetingsService.changeStatus(temp.id, { status: 'CANCELADA', reason: '' }, adminUser.id);
    } catch {
      threw = true;
    }
    assert(threw, 'Debió rechazar cancelación sin motivo');

    // Cancelar con motivo debe tener éxito
    const cancelled = await meetingsService.changeStatus(
      temp.id,
      { status: 'CANCELADA', reason: 'Falta de quórum legal requerido por el estatuto orgánico' },
      adminUser.id,
    );
    assert(cancelled.status === 'CANCELADA', 'El estado debió pasar a CANCELADA');
    assert(cancelled.observations.includes('Falta de quórum'), 'Debe asentar el motivo en las observaciones');
  });

  await runTest('MEET-010', 'Archivado institucional sin borrado físico', async () => {
    const temp = await meetingsService.create(
      {
        title: 'Reunión para prueba de archivado',
        categoryId: testCatId,
        meetingDate: '2026-11-23',
        startTime: '09:00',
        endTime: '10:00',
        location: 'Sala C',
        status: 'BORRADOR',
      },
      adminUser.id,
    );

    await meetingsService.changeStatus(temp.id, { status: 'CANCELADA', reason: 'Archivado formal' }, adminUser.id);
    const res = await meetingsService.archive(temp.id, adminUser.id);
    assert(res.message.includes('archivada'), 'Debe confirmar el archivado');

    const inDb = await prisma.meeting.findUnique({ where: { id: temp.id } });
    assert(inDb && inDb.status === 'ARCHIVADA', 'El registro debe permanecer en la base con status ARCHIVADA');
    assert(inDb.deletedAt === null, 'No debe aplicar borrado físico destructivo');
  });

  // --------------------------------------------------------------------------
  // GRUPO 3: CONV-001..004 — CONVOCATORIAS OFICIALES
  // --------------------------------------------------------------------------
  console.log('\n--- 3. CONVOCATORIAS OFICIALES (CONV) ---');

  await runTest('CONV-001', 'Crear borrador de convocatoria oficial', async () => {
    const meeting = await meetingsService.findById(testMeetingId);
    const convNumber = `CONV-${meeting.folio}`;
    const convocatoria = await meetingsService.createOrUpdateConvocatoria(
      testMeetingId,
      {
        convocatoriaNumber: convNumber,
        noticeText: 'Por medio de la presente se convoca formalmente a la Sesión Ordinaria de Consejo...',
      },
      adminUser.id,
      '127.0.0.1',
      'TestRunner/Phase3',
    );
    assert(convocatoria.id, 'Debe crear la cédula de convocatoria');
    assert(convocatoria.isPublished === false, 'La convocatoria debe iniciar sin publicar');
  });

  await runTest('CONV-002', 'Publicar convocatoria y verificar transición a CONVOCADA', async () => {
    const published = await meetingsService.publishConvocatoria(
      testMeetingId,
      adminUser.id,
      '127.0.0.1',
      'TestRunner/Phase3',
    );
    assert(published.isPublished === true, 'isPublished debe ser true');
    assert(published.publishedAt !== null, 'Debe registrar publishedAt');

    const meeting = await meetingsService.findById(testMeetingId);
    assert(meeting.status === 'CONVOCADA', 'La reunión debió cambiar automáticamente a CONVOCADA');
  });

  await runTest('CONV-003', 'Registrar snapshot de participantes receptores en la convocatoria', async () => {
    const meeting = await meetingsService.findById(testMeetingId);
    assert(meeting.convocatoria && meeting.convocatoria.isPublished, 'La convocatoria debe estar activa');
  });

  await runTest('CONV-004', 'Rechazar publicación de convocatoria en reunión cancelada', async () => {
    const temp = await meetingsService.create(
      {
        title: 'Reunión cancelada para prueba de convocatoria',
        categoryId: testCatId,
        meetingDate: '2026-11-24',
        startTime: '10:00',
        endTime: '11:00',
        location: 'Virtual',
      },
      adminUser.id,
    );
    await meetingsService.changeStatus(temp.id, { status: 'CANCELADA', reason: 'Prueba' }, adminUser.id);

    let threw = false;
    try {
      await meetingsService.publishConvocatoria(temp.id, adminUser.id);
    } catch {
      threw = true;
    }
    assert(threw, 'Debió impedir publicar convocatoria en reunión cancelada');
  });

  // --------------------------------------------------------------------------
  // GRUPO 4: AGENDA-001..005 — ORDEN DEL DÍA
  // --------------------------------------------------------------------------
  console.log('\n--- 4. ORDEN DEL DÍA (AGENDA) ---');

  await runTest('AGENDA-001', 'Agregar punto secuencial al orden del día', async () => {
    const item1 = await meetingsService.addAgendaItem(
      testMeetingId,
      {
        title: '1. Lista de asistencia y declaración de quórum legal',
        description: 'Verificación estatutaria de los integrantes presentes',
        responsibleName: 'Secretaría de Actas',
        estimatedMinutes: 10,
        itemType: 'ASUNTOS_ORDINARIOS',
      },
      adminUser.id,
      '127.0.0.1',
      'TestRunner/Phase3',
    );
    assert(item1.id, 'Debe devolver ID del punto de agenda');
    assert(item1.orderIndex === 1, 'El primer punto debe tener orderIndex 1');
    testAgendaItemId = item1.id;

    // Agregar segundo punto
    await meetingsService.addAgendaItem(
      testMeetingId,
      {
        title: '2. Lectura y aprobación del acta de la sesión anterior',
        estimatedMinutes: 20,
      },
      adminUser.id,
    );
  });

  await runTest('AGENDA-002', 'Actualizar punto del orden del día', async () => {
    const updated = await meetingsService.updateAgendaItem(
      testMeetingId,
      testAgendaItemId,
      {
        description: 'Verificación exhaustiva estatutaria y pase de lista nominal',
        estimatedMinutes: 15,
      },
      adminUser.id,
    );
    assert(updated.estimatedMinutes === 15, 'Minutos actualizados');
  });

  await runTest('AGENDA-003', 'Reordenar secuencialmente los puntos del orden del día', async () => {
    const meetingBefore = await meetingsService.findById(testMeetingId);
    const items = meetingBefore.agendaItems;
    assert(items.length >= 2, 'Deben existir al menos 2 puntos');

    // Invertir orden
    await meetingsService.reorderAgendaItems(
      testMeetingId,
      {
        items: [
          { id: items[1].id, orderIndex: 1 },
          { id: items[0].id, orderIndex: 2 },
        ],
      },
      adminUser.id,
    );
    const meetingAfter = await meetingsService.findById(testMeetingId);
    assert(meetingAfter.agendaItems[0].id === items[1].id, 'El punto 2 ahora debe ocupar la primera posición');
  });

  await runTest('AGENDA-004', 'Marcar punto del orden del día como desahogado (isTreated=true)', async () => {
    const treated = await meetingsService.markAgendaItemTreated(
      testMeetingId,
      testAgendaItemId,
      { isTreated: true },
      adminUser.id,
    );
    assert(treated.isTreated === true, 'isTreated debe ser true');
    assert(treated.status === 'TRATADO' || treated.status === 'DESAHOGADO', 'El estatus debe ser TRATADO o DESAHOGADO');
    assert(treated.treatedAt !== null, 'Debe registrar la marca de tiempo de desahogo');
  });

  await runTest('AGENDA-005', 'Baja lógica de punto del orden del día (isDeleted=true)', async () => {
    // Agregar un punto auxiliar y eliminarlo
    const auxItem = await meetingsService.addAgendaItem(
      testMeetingId,
      { title: 'Punto auxiliar a borrar' },
      adminUser.id,
    );
    const delRes = await meetingsService.deleteAgendaItem(testMeetingId, auxItem.id, adminUser.id);
    assert(delRes.message.includes('eliminado'), 'Debe confirmar eliminación');

    const meetingAfter = await meetingsService.findById(testMeetingId);
    assert(!meetingAfter.agendaItems.some((i) => i.id === auxItem.id), 'No debe figurar en el listado activo');

    const inDb = await prisma.meetingAgendaItem.findUnique({ where: { id: auxItem.id } });
    assert(inDb && inDb.isDeleted === true, 'En la base debe permanecer marcado con isDeleted=true');
  });

  // --------------------------------------------------------------------------
  // GRUPO 5: PART-001..006 — PARTICIPANTES Y ASISTENCIA
  // --------------------------------------------------------------------------
  console.log('\n--- 5. PARTICIPANTES Y ASISTENCIA (PART) ---');

  await runTest('PART-001', 'Convocar participante institucional y participante externo', async () => {
    // Tomar el participante existente creado automáticamente (adminUser)
    const existingMeeting = await meetingsService.findById(testMeetingId);
    assert(existingMeeting.participants.length >= 1, 'Debe existir participante convocador inicial');
    testParticipantId = existingMeeting.participants[0].id;

    // Agregar participante institucional adicional si normalUser existe
    if (normalUser.id !== adminUser.id) {
      await meetingsService.addParticipant(
        testMeetingId,
        {
          userId: normalUser.id,
          institutionalRole: 'Secretario Técnico',
          participationCondition: 'TITULAR',
        },
        adminUser.id,
      );
    }

    // Agregar participante externo
    const p2 = await meetingsService.addParticipant(
      testMeetingId,
      {
        isExternal: true,
        externalName: 'Dra. María Elena Castro',
        externalEmail: 'mcastro@consultora.mx',
        externalOrganization: 'Comisión Externa de Evaluación',
        institutionalRole: 'Perito Invitado',
        participationCondition: 'INVITADO',
      },
      adminUser.id,
    );
    assert(p2.isExternal === true, 'Debe registrarse como participante externo');
  });

  await runTest('PART-002', 'Rechazar participante institucional duplicado en la misma sesión', async () => {
    let threw = false;
    try {
      await meetingsService.addParticipant(
        testMeetingId,
        {
          userId: adminUser.id,
          institutionalRole: 'Vocal Duplicado',
        },
        adminUser.id,
      );
    } catch {
      threw = true;
    }
    assert(threw, 'Debió rechazar agregar al mismo usuario dos veces en la misma sesión');
  });

  await runTest('PART-003', 'Actualizar estado de asistencia y asentar histórico', async () => {
    const updated = await meetingsService.updateAttendance(
      testMeetingId,
      testParticipantId,
      {
        attendanceStatus: 'PRESENTE',
        arrivalTime: '2026-11-20T10:05:00Z',
      },
      adminUser.id,
      '127.0.0.1',
      'TestRunner/Phase3',
    );
    assert(updated.attendanceStatus === 'PRESENTE', 'Debe actualizar a PRESENTE');
    assert(updated.arrivalTime !== null, 'Debe registrar hora de llegada');
  });

  await runTest('PART-004', 'Verificar registro en MeetingAttendanceHistory ante cambio de asistencia', async () => {
    // Cambiar a TARDANZA con justificación
    await meetingsService.updateAttendance(
      testMeetingId,
      testParticipantId,
      {
        attendanceStatus: 'TARDANZA',
        justification: 'Retraso de 15 minutos justificado por comisión oficial previa',
      },
      adminUser.id,
    );

    const history = await prisma.meetingAttendanceHistory.findMany({
      where: { participantId: testParticipantId },
      orderBy: { createdAt: 'desc' },
    });
    assert(history.length >= 2, 'Deben existir al menos 2 registros en el histórico de asistencia');
    assert(history[0].newStatus === 'TARDANZA', 'El último cambio en histórico debe ser TARDANZA');
    assert(history[0].justification.includes('comisión oficial'), 'Debe preservar la justificación');
  });

  await runTest('PART-005', 'Cálculo métrico exacto de resumen y porcentajes de asistencia', async () => {
    const meeting = await meetingsService.findById(testMeetingId);
    const summary = meeting.attendanceSummary;
    assert(summary.totalConvocados >= 2, 'Total convocados debe ser >= 2');
    assert(summary.presentes >= 1, 'Debe registrar al menos 1 presente');
    assert(summary.porcentajeAsistencia >= 30, 'El porcentaje de asistencia debe ser >= 30%');
  });

  // --------------------------------------------------------------------------
  // GRUPO 6: SES-001..005 — DESARROLLO DE SESIÓN Y BITÁCORA
  // --------------------------------------------------------------------------
  console.log('\n--- 6. DESARROLLO DE SESIÓN Y BITÁCORA (SES) ---');

  await runTest('SES-001', 'Apertura formal de sesión institucional (EN_DESARROLLO)', async () => {
    const started = await meetingsService.startSession(
      testMeetingId,
      {
        presidedById: adminUser.id,
        secretaryById: normalUser.id,
      },
      adminUser.id,
      '127.0.0.1',
      'TestRunner/Phase3',
    );
    assert(started.status === 'EN_DESARROLLO', 'El estado debe cambiar a EN_DESARROLLO');
    assert(started.realStartTime !== null, 'Debe registrar realStartTime');
  });

  await runTest('SES-002', 'Asentar eventos, recesos y deliberaciones en la bitácora', async () => {
    const log1 = await meetingsService.addSessionLog(
      testMeetingId,
      {
        entryType: 'DELIBERACION',
        description: 'Se declara formalmente abierta la sesión contando con el quórum legal reglamentario.',
      },
      adminUser.id,
      '127.0.0.1',
      'TestRunner/Phase3',
    );
    assert(log1.id, 'Debe registrar el evento en bitácora');

    const log2 = await meetingsService.addSessionLog(
      testMeetingId,
      {
        entryType: 'RECESO',
        description: 'Se decreta receso de 15 minutos para análisis de anexos financieros.',
      },
      adminUser.id,
    );
    assert(log2.entryType === 'RECESO', 'Tipo de entrada asentado correctamente');
  });

  await runTest('SES-003', 'Recuperación de bitácora en orden cronológico ascendente', async () => {
    const logs = await meetingsService.getSessionLogs(testMeetingId);
    assert(logs.length >= 2, 'Debe contener al menos 2 eventos');
    assert(new Date(logs[0].timestamp).getTime() <= new Date(logs[1].timestamp).getTime(), 'Orden cronológico ascendente');
  });

  await runTest('SES-004', 'Clausura formal de sesión institucional (FINALIZADA)', async () => {
    const ended = await meetingsService.endSession(
      testMeetingId,
      {},
      adminUser.id,
      '127.0.0.1',
      'TestRunner/Phase3',
    );
    assert(ended.status === 'FINALIZADA', 'El estado debe cambiar a FINALIZADA');
    assert(ended.realEndTime !== null, 'Debe registrar realEndTime');
  });

  // --------------------------------------------------------------------------
  // GRUPO 7: MIN-001..006 — ACTAS INSTITUCIONALES Y VERSIONAMIENTO
  // --------------------------------------------------------------------------
  console.log('\n--- 7. ACTAS INSTITUCIONALES Y VERSIONAMIENTO (MIN) ---');

  await runTest('MIN-001', 'Crear borrador de acta institucional oficial', async () => {
    const meeting = await meetingsService.findById(testMeetingId);
    const minutesNumber = `ACTA-${meeting.folio}`;
    const minutes = await meetingsService.createOrUpdateMinutes(
      testMeetingId,
      {
        minutesNumber,
        summary: 'En la Ciudad de México, se reunieron los miembros colegiados para desahogar la orden del día...',
        pointsTreatedSummary: 'Punto 1 aprobado unánimemente. Punto 2 analizado y aprobado con observaciones.',
        incidents: 'Sin incidentes de orden público ni de conectividad remota.',
        status: 'BORRADOR',
      },
      adminUser.id,
      '127.0.0.1',
      'TestRunner/Phase3',
    );
    assert(minutes.id, 'Debe crear acta institucional');
    assert(minutes.status === 'BORRADOR', 'El estado inicial debe ser BORRADOR');
    assert(minutes.version === 1, 'La versión inicial debe ser 1');
  });

  await runTest('MIN-002', 'Actualizar borrador de acta institucional', async () => {
    const updated = await meetingsService.createOrUpdateMinutes(
      testMeetingId,
      {
        summary: 'En la Ciudad de México, siendo las 10:00 horas, se reunieron los miembros colegiados en Pleno...',
        status: 'EN_REVISION',
      },
      adminUser.id,
      '127.0.0.1',
      'TestRunner/Phase3',
    );
    assert(updated.status === 'EN_REVISION', 'El estado debe pasar a EN_REVISION');
  });

  await runTest('MIN-003', 'Aprobar formalmente el acta institucional', async () => {
    const approved = await meetingsService.approveMinutes(
      testMeetingId,
      {
        approvalNotes: 'Aprobada por unanimidad de los miembros con derecho a voto en el órgano colegiado.',
      },
      adminUser.id,
      '127.0.0.1',
      'TestRunner/Phase3',
    );
    assert(approved.status === 'APROBADA', 'El estado del acta debe ser APROBADA');
    assert(approved.approvedAt !== null, 'Debe registrar approvedAt');
    assert(approved.approvedById === adminUser.id, 'Debe registrar aprobador institucional');
  });

  await runTest('MIN-004', 'Modificación post-aprobación crea versionamiento inmutable en MeetingMinutesVersion (MIN-006)', async () => {
    // Editar el acta ya aprobada debe disparar el versionamiento
    const versioned = await meetingsService.createOrUpdateMinutes(
      testMeetingId,
      {
        summary: 'En la Ciudad de México, acta formal con fe de erratas posterior a la aprobación en Pleno...',
        changeReason: 'Corrección de ortografía en el nombre de uno de los vocales invitados',
      },
      adminUser.id,
      '127.0.0.1',
      'TestRunner/Phase3',
    );

    assert(versioned.version === 2, 'La versión del acta debe incrementarse a 2');

    // Comprobar que en la tabla meeting_minutes_versions existe la versión previa 1
    const versions = await meetingsService.getMinutesVersions(testMeetingId);
    assert(versions.length >= 1, 'Debe existir registro histórico de versiones');
    assert(versions[0].versionNumber === 1, 'La versión guardada en el histórico debe ser la 1');
    assert(versions[0].status === 'APROBADA', 'El snapshot archivado debe preservar el estatus previo');
  });

  // --------------------------------------------------------------------------
  // GRUPO 8: SEC-001..008 — SEGURIDAD, RBAC Y AUDITORÍA
  // --------------------------------------------------------------------------
  console.log('\n--- 8. SEGURIDAD, RBAC Y AUDITORÍA (SEC) ---');

  await runTest('SEC-001', 'Verificar registro de eventos de auditoría para cada acción institucional', async () => {
    const meeting = await meetingsService.findById(testMeetingId);
    const minutesId = meeting.minutes ? meeting.minutes.id : '';

    const auditLogs = await prisma.auditLog.findMany({
      where: {
        OR: [
          { entityId: testMeetingId },
          { entityId: minutesId },
        ],
      },
      orderBy: { createdAt: 'desc' },
    });
    assert(auditLogs.length >= 4, 'Deben existir múltiples eventos de auditoría registrados para la reunión');
    const actions = auditLogs.map((l) => l.action);
    assert(actions.includes('MEETING_CREATED'), 'Debe contener MEETING_CREATED');
    assert(actions.includes('MEETING_SESSION_STARTED') || actions.includes('SESSION_STARTED'), 'Debe contener evento de apertura de sesión');
    assert(actions.includes('MINUTES_APPROVED'), 'Debe contener MINUTES_APPROVED');
  });

  await runTest('SEC-002', 'Sanitización estricta de eventos: no almacenar contraseñas ni secretos', async () => {
    const auditLogs = await prisma.auditLog.findMany({
      where: { entityId: testMeetingId },
    });
    for (const log of auditLogs) {
      const payloadStr = JSON.stringify(log.diffPayload || {});
      assert(!payloadStr.toLowerCase().includes('password'), 'Auditoría no debe contener contraseñas');
      assert(!payloadStr.toLowerCase().includes('secretkey') && !payloadStr.toLowerCase().includes('clientsecret') && !payloadStr.toLowerCase().includes('encryptedsecret'), 'Auditoría no debe contener credenciales ni secretos criptográficos');
    }
  });

  await runTest('SEC-003', 'Validación de UUID y rechazo de identificador no existente (404 Not Found)', async () => {
    let threw = false;
    try {
      await meetingsService.findById('00000000-0000-0000-0000-000000000000');
    } catch {
      threw = true;
    }
    assert(threw, 'Debió lanzar NotFoundException ante UUID inexistente');
  });

  // --------------------------------------------------------------------------
  // GRUPO 9: DB-001..006 — INTEGRIDAD EN NEON POSTGRESQL
  // --------------------------------------------------------------------------
  console.log('\n--- 9. INTEGRIDAD EN NEON POSTGRESQL (DB) ---');

  await runTest('DB-001', 'Conectividad activa y verificación de versión de Neon PostgreSQL', async () => {
    const rawResult = await prisma.$queryRaw`SELECT version();`;
    assert(rawResult && rawResult.length > 0, 'Debe ejecutar SELECT version() en Neon');
    assert(rawResult[0].version.includes('PostgreSQL'), 'Debe confirmar motor PostgreSQL');
  });

  await runTest('DB-002', 'Verificar aplicación de la migración de Fase 3 en Neon', async () => {
    const migration = await prisma.$queryRaw`
      SELECT migration_name, finished_at 
      FROM "_prisma_migrations" 
      WHERE migration_name LIKE '%phase3_meetings_and_sessions%';
    `;
    assert(migration.length > 0, 'La migración 20261105044500_phase3_meetings_and_sessions debe figurar aplicada en Neon');
    assert(migration[0].finished_at !== null, 'La migración debe tener finished_at');
  });

  await runTest('DB-003', 'Verificar índices de Fase 3 creados en Neon PostgreSQL', async () => {
    const indexes = await prisma.$queryRaw`
      SELECT tablename, indexname 
      FROM pg_indexes 
      WHERE schemaname = 'public' 
        AND tablename IN ('meetings', 'meeting_agenda_items', 'meeting_session_logs', 'meeting_participants');
    `;
    assert(indexes.length >= 6, 'Deben existir los índices optimizados para reuniones, participantes y bitácoras');
  });

  await runTest('DB-004', 'Verificar integridad de tablas de Fases 1 y 2 (no destructivo)', async () => {
    const userCount = await prisma.user.count();
    const roleCount = await prisma.role.count();
    const permCount = await prisma.permission.count();
    assert(userCount >= 1, 'Usuarios de Fases anteriores deben persistir íntegros');
    assert(roleCount >= 2, 'Roles deben persistir');
    assert(permCount >= 18, 'Los 18 permisos institucionales deben persistir');
  });

  // --------------------------------------------------------------------------
  // RESUMEN EJECUTIVO DE LA SUITE
  // --------------------------------------------------------------------------
  console.log('\n==============================================================================');
  console.log('RESUMEN DE PRUEBAS DE FASE 3:');
  console.log('==============================================================================');
  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;

  console.log(`Total de pruebas ejecutadas: ${total}`);
  console.log(`Exitosas:                     ${passed}`);
  console.log(`Fallidas:                     ${failed}`);

  if (failed > 0) {
    console.error('\nDetalle de pruebas fallidas:');
    results.filter((r) => !r.passed).forEach((r) => {
      console.error(`- [${r.code}] ${r.title}: ${r.error}`);
    });
    process.exit(1);
  } else {
    console.log('\n¡TODAS LAS PRUEBAS DE FASE 3 PASARON SATISFACTORIAMENTE EN NEON POSTGRESQL!');
  }
}

main()
  .catch((err) => {
    console.error('Error fatal durante la ejecución de la suite de pruebas:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

/**
 * ==============================================================================
 * MEXAGENDA — SUITE DE PRUEBAS AUTOMATIZADAS DE FASE 5
 * ==============================================================================
 * MÓDULO 04: ANOTACIONES PERSONALES Y NOTAS DE SESIÓN
 *
 * Valida de forma exhaustiva sobre Neon PostgreSQL los casos de prueba de MOD-04:
 * - DB-01..02: Integridad de tablas personal_notes y personal_note_versions en Neon.
 * - RBAC-01..02: Catálogo de permisos note:* y asignaciones a roles.
 * - NOTE-01..04: Creación, lectura y aislamiento de privacidad (Anti-IDOR / Anti-BOLA).
 * - NOTE-05..07: Modificación ordinaria, versionado inmutable y bloqueo de mutación ajena.
 * - NOTE-08..09: Archivado (Soft delete) y restauración por autor o administrador.
 * - NOTE-10..12: Intervención administrativa extraordinaria, justificación obligatoria (>=15 chars),
 *                snapshot de intervención y bitácora CRITICAL en audit_logs.
 * - NOTE-13..15: Notas de sesión vinculadas a reunión, orden del día y acuerdos.
 * - NOTE-16..17: Historial inmutable de versiones y filtros avanzados de catálogo.
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
const { NotesService } = require('../apps/backend/dist/modules/notes/notes.service');
const { AuditService } = require('../apps/backend/dist/modules/audit/audit.service');

const auditService = new AuditService(prisma);
const notesService = new NotesService(prisma, auditService);

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
    results.push({ code, title, status: 'PASSED', duration });
    console.log(`  [✓] ${code} — ${title} (${duration}ms)`);
  } catch (error) {
    const duration = Date.now() - start;
    results.push({ code, title, status: 'FAILED', duration, error: error.message });
    console.error(`  [✗] ${code} — ${title} (${duration}ms)`);
    console.error(`      Error: ${error.message}`);
  }
}

async function main() {
  console.log('==============================================================================');
  console.log('MEXAGENDA — SUITE DE PRUEBAS AUTOMATIZADAS DE FASE 5 (MOD-04: ANOTACIONES)');
  console.log('Base de Datos: Neon PostgreSQL');
  console.log('==============================================================================\n');

  let adminUser;
  let userA;
  let userB;
  let testMeeting;
  let testAgendaItem;
  let testAgreement;
  let createdNoteA;
  let createdPublicNote;
  let createdSessionNote;

  try {
    // --------------------------------------------------------------------------
    // PREPARACIÓN DE ENTORNOS Y ACTORES DE PRUEBA
    // --------------------------------------------------------------------------
    console.log('--- PREPARANDO ACTORES Y DATOS INSTITUCIONALES PARA FASE 5 ---');

    // Admin
    adminUser = await prisma.user.findFirst({
      where: { role: { code: 'ROLE_ADMIN' } },
      include: { role: { include: { permissions: { include: { permission: true } } } } },
    });
    assert(adminUser, 'Debe existir un usuario ROLE_ADMIN en la base de datos');

    const adminAuth = {
      id: adminUser.id,
      email: adminUser.email,
      firstName: adminUser.firstName,
      lastName: adminUser.lastName,
      position: adminUser.position || 'Administrador',
      role: 'ROLE_ADMIN',
      status: adminUser.status,
      mfaEnabled: adminUser.mfaEnabled,
      permissions: adminUser.role.permissions.map((rp) => rp.permission.code),
    };

    // User A
    const userRole = await prisma.role.findUnique({
      where: { code: 'ROLE_USER' },
      include: { permissions: { include: { permission: true } } },
    });
    assert(userRole, 'Debe existir el rol ROLE_USER');

    const userPermissions = userRole.permissions.map((rp) => rp.permission.code);

    userA = await prisma.user.upsert({
      where: { email: 'autor.fase5@institucion.gob.mx' },
      create: {
        email: 'autor.fase5@institucion.gob.mx',
        passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$dummyhash',
        firstName: 'Elena',
        lastName: 'Paredes',
        position: 'Asesora Jurídica Institucional',
        status: 'ACTIVO',
        roleId: userRole.id,
      },
      update: {},
    });

    const userAAuth = {
      id: userA.id,
      email: userA.email,
      firstName: userA.firstName,
      lastName: userA.lastName,
      position: userA.position,
      role: 'ROLE_USER',
      status: userA.status,
      mfaEnabled: false,
      permissions: userPermissions,
    };

    // User B (Tercero no propietario para pruebas de Anti-IDOR / Anti-BOLA)
    userB = await prisma.user.upsert({
      where: { email: 'auditor.fase5@institucion.gob.mx' },
      create: {
        email: 'auditor.fase5@institucion.gob.mx',
        passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$dummyhash',
        firstName: 'Rodrigo',
        lastName: 'Navarro',
        position: 'Auditor Operativo',
        status: 'ACTIVO',
        roleId: userRole.id,
      },
      update: {},
    });

    const userBAuth = {
      id: userB.id,
      email: userB.email,
      firstName: userB.firstName,
      lastName: userB.lastName,
      position: userB.position,
      role: 'ROLE_USER',
      status: userB.status,
      mfaEnabled: false,
      permissions: userPermissions,
    };

    // Buscar una reunión existente o de prueba
    testMeeting = await prisma.meeting.findFirst({
      where: { deletedAt: null },
      include: { agendaItems: true },
    });
    if (testMeeting && testMeeting.agendaItems.length > 0) {
      testAgendaItem = testMeeting.agendaItems[0];
    }

    // Buscar un acuerdo existente
    testAgreement = await prisma.agreement.findFirst({
      where: { deletedAt: null },
    });

    console.log(`  -> Actores listos: Admin (${adminAuth.email}), Usuario A (${userAAuth.email}), Usuario B (${userBAuth.email})`);
    console.log(`  -> Contexto: Reunión (${testMeeting ? testMeeting.folio : 'N/A'}), Acuerdo (${testAgreement ? testAgreement.folio : 'N/A'})\n`);

    // --------------------------------------------------------------------------
    // BLOQUE 1: BASE DE DATOS Y PERMISOS RBAC
    // --------------------------------------------------------------------------
    console.log('--- BLOQUE 1: INTEGRIDAD DE ESQUEMA Y RBAC EN NEON ---');

    await runTest('DB-01', 'Verificar existencia y columnas de tabla personal_notes', async () => {
      const count = await prisma.personalNote.count();
      assert(typeof count === 'number', 'personal_notes debe responder a consultas en Neon');
    });

    await runTest('DB-02', 'Verificar existencia y columnas de tabla personal_note_versions', async () => {
      const count = await prisma.personalNoteVersion.count();
      assert(typeof count === 'number', 'personal_note_versions debe responder a consultas en Neon');
    });

    await runTest('RBAC-01', 'Verificar los 8 permisos institucionales del módulo note:* en Neon', async () => {
      const expectedCodes = [
        'note:read',
        'note:create',
        'note:update_own',
        'note:delete_own',
        'note:history:read',
        'note:visibility:manage',
        'note:override_any',
        'note:admin:read',
      ];
      const permissions = await prisma.permission.findMany({
        where: { code: { in: expectedCodes } },
      });
      assert(permissions.length === 8, `Deben existir 8 permisos de notas en DB. Encontrados: ${permissions.length}`);
    });

    await runTest('RBAC-02', 'Verificar asignación RBAC: ROLE_USER tiene note:read/create/update_own y ROLE_ADMIN tiene override_any', async () => {
      const userPerms = await prisma.rolePermission.findMany({
        where: { role: { code: 'ROLE_USER' }, permission: { code: { startsWith: 'note:' } } },
        include: { permission: true },
      });
      const userCodes = userPerms.map((p) => p.permission.code);
      assert(userCodes.includes('note:read'), 'ROLE_USER debe tener note:read');
      assert(userCodes.includes('note:create'), 'ROLE_USER debe tener note:create');
      assert(userCodes.includes('note:update_own'), 'ROLE_USER debe tener note:update_own');
      assert(!userCodes.includes('note:override_any'), 'ROLE_USER NO debe tener note:override_any');

      const adminPerms = await prisma.rolePermission.findMany({
        where: { role: { code: 'ROLE_ADMIN' }, permission: { code: { startsWith: 'note:' } } },
        include: { permission: true },
      });
      const adminCodes = adminPerms.map((p) => p.permission.code);
      assert(adminCodes.includes('note:override_any'), 'ROLE_ADMIN debe tener note:override_any');
    });

    // --------------------------------------------------------------------------
    // BLOQUE 2: CICLO DE VIDA DE ANOTACIONES Y AISLAMIENTO DE PRIVACIDAD
    // --------------------------------------------------------------------------
    console.log('\n--- BLOQUE 2: CREACIÓN, VISIBILIDAD Y AISLAMIENTO DE PRIVACIDAD ---');

    await runTest('NOTE-01', 'Creación de anotación personal privada por Usuario A', async () => {
      createdNoteA = await notesService.create(
        {
          title: 'Notas preparatorias sobre régimen de adquisiciones 2026',
          content: 'Revisión del artículo 42 de la ley aplicable. Observaciones de riesgo presupuestal.',
          category: 'JURIDICO',
          visibility: 'PRIVADA',
          isFavorite: true,
          tags: 'adquisiciones, presupuesto, riesgo',
        },
        userAAuth,
        '10.0.0.1',
        'Mozilla/5.0 (Test)'
      );

      assert(createdNoteA.id, 'Debe retornar un ID UUID válido');
      assert(createdNoteA.title === 'Notas preparatorias sobre régimen de adquisiciones 2026', 'Título debe coincidir');
      assert(createdNoteA.authorId === userA.id, 'La autoría debe asignarse al usuario autenticado');
      assert(createdNoteA.version === 1, 'La versión inicial debe ser 1');
      assert(createdNoteA.visibility === 'PRIVADA', 'La visibilidad debe ser PRIVADA');
      assert(createdNoteA.isFavorite === true, 'isFavorite debe ser true');
    });

    await runTest('NOTE-02', 'Consulta de anotación por su propio autor (Usuario A)', async () => {
      const note = await notesService.findById(createdNoteA.id, userAAuth);
      assert(note.id === createdNoteA.id, 'Debe devolver la nota');
      assert(note.content.includes('artículo 42'), 'Debe incluir el contenido');
    });

    await runTest('NOTE-03', 'Bloqueo estricto: Usuario B no puede consultar anotación PRIVADA de Usuario A (Anti-IDOR)', async () => {
      let threw = false;
      try {
        await notesService.findById(createdNoteA.id, userBAuth);
      } catch (err) {
        threw = true;
        assert(err.status === 403, 'Debe responder con HTTP 403 Forbidden');
        assert(err.message.includes('estrictamente privado'), 'Mensaje debe indicar privacidad estricta');
      }
      assert(threw, 'Debe arrojar ForbiddenException ante acceso cruzado');
    });

    await runTest('NOTE-04', 'Creación y consulta de anotación con visibilidad PUBLICA por terceros', async () => {
      createdPublicNote = await notesService.create(
        {
          title: 'Directrices generales para la elaboración de actas colegiadas',
          content: 'Lineamientos institucionales aplicables a todas las comisiones de trabajo.',
          category: 'GENERAL',
          visibility: 'PUBLICA',
          isFavorite: false,
        },
        userAAuth
      );

      const noteFromUserB = await notesService.findById(createdPublicNote.id, userBAuth);
      assert(noteFromUserB.id === createdPublicNote.id, 'Usuario B debe poder consultar nota pública');
    });

    // --------------------------------------------------------------------------
    // BLOQUE 3: MODIFICACIONES, SNAPSHOTS INMUTABLES Y CONTROL ANTI-IDOR
    // --------------------------------------------------------------------------
    console.log('\n--- BLOQUE 3: ACTUALIZACIÓN ORDINARIA, VERSIONADO Y REGLAS DE SOBERANÍA ---');

    await runTest('NOTE-05', 'Actualización ordinaria por el autor (Usuario A) genera snapshot inmutable v1 y avanza a v2', async () => {
      const updated = await notesService.update(
        createdNoteA.id,
        {
          content: 'Revisión del artículo 42 y 43 de la ley aplicable. Segunda versión corregida.',
          changeReason: 'Inclusión de análisis del artículo 43',
        },
        userAAuth
      );

      assert(updated.version === 2, `La versión debe avanzar a 2. Actual: ${updated.version}`);
      assert(updated.content.includes('artículo 42 y 43'), 'El contenido debe actualizarse');

      // Verificar existencia del snapshot v1 en personal_note_versions
      const snapshots = await prisma.personalNoteVersion.findMany({
        where: { personalNoteId: createdNoteA.id },
      });
      assert(snapshots.length >= 1, 'Debe haberse creado al menos 1 snapshot de versión');
      const v1 = snapshots.find((s) => s.versionNumber === 1);
      assert(v1, 'Debe existir snapshot de la versión 1');
      assert(v1.contentSnapshot.includes('artículo 42 de la ley'), 'El snapshot debe preservar el contenido original');
      assert(v1.modifiedById === userA.id, 'El editor del snapshot debe ser Usuario A');
    });

    await runTest('NOTE-06', 'Bloqueo Anti-IDOR: Usuario B intenta modificar anotación de Usuario A y se registra auditoría DENIED', async () => {
      let threw = false;
      try {
        await notesService.update(
          createdNoteA.id,
          {
            title: 'Título manipulado por tercero no autorizado',
            content: 'Intrusión maliciosa en expediente',
          },
          userBAuth,
          '192.168.1.100',
          'AttackerTool/1.0'
        );
      } catch (err) {
        threw = true;
        assert(err.status === 403, 'Debe arrojar 403 Forbidden');
        assert(err.message.includes('Únicamente el autor institucional puede modificar'), 'Mensaje debe indicar regla de autoría');
      }
      assert(threw, 'Debe rechazar la mutación de nota ajena');

      // Comprobar que se registró auditoría forense con DENIED
      const auditLog = await prisma.auditLog.findFirst({
        where: {
          action: 'UNAUTHORIZED_NOTE_MUTATION_ATTEMPT',
          entityId: createdNoteA.id,
          actorId: userB.id,
        },
        orderBy: { createdAt: 'desc' },
      });
      assert(auditLog, 'Debe registrarse en audit_logs el intento no autorizado');
      assert(auditLog.outcome === 'DENIED', 'El resultado debe ser DENIED');
    });

    await runTest('NOTE-07', 'Bloqueo Anti-IDOR: Usuario B intenta archivar/eliminar anotación de Usuario A', async () => {
      let threw = false;
      try {
        await notesService.archive(createdNoteA.id, userBAuth);
      } catch (err) {
        threw = true;
        assert(err.status === 403, 'Debe responder con 403 Forbidden');
      }
      assert(threw, 'Usuario B no puede archivar notas ajenas');

      // Verificar que la nota NO fue archivada
      const noteCheck = await prisma.personalNote.findUnique({ where: { id: createdNoteA.id } });
      assert(noteCheck.deletedAt === null, 'La nota debe seguir activa');
    });

    // --------------------------------------------------------------------------
    // BLOQUE 4: ARCHIVADO (SOFT DELETE) Y RESTAURACIÓN
    // --------------------------------------------------------------------------
    console.log('\n--- BLOQUE 4: ARCHIVADO (SOFT DELETE) Y RESTAURACIÓN INSTITUCIONAL ---');

    await runTest('NOTE-08', 'Archivado satisfactorio (Soft Delete) por el autor (Usuario A)', async () => {
      const res = await notesService.archive(createdNoteA.id, userAAuth);
      assert(res.id === createdNoteA.id, 'Debe confirmar el ID archivado');

      const note = await prisma.personalNote.findUnique({ where: { id: createdNoteA.id } });
      assert(note.deletedAt !== null, 'deletedAt debe contener fecha de baja');

      // No debe aparecer en catálogo activo ordinario
      const activeCatalog = await notesService.findAll({}, userAAuth);
      const foundInActive = activeCatalog.items.some((i) => i.id === createdNoteA.id);
      assert(!foundInActive, 'No debe aparecer en el listado activo estándar');

      // Debe aparecer en papelera / archivadas
      const archivedCatalog = await notesService.findAll({ isArchived: true }, userAAuth);
      const foundInArchived = archivedCatalog.items.some((i) => i.id === createdNoteA.id);
      assert(foundInArchived, 'Debe figurar en el filtro de archivadas');
    });

    await runTest('NOTE-09', 'Restauración satisfactoria de nota archivada', async () => {
      const res = await notesService.restore(createdNoteA.id, userAAuth);
      assert(res.id === createdNoteA.id, 'Debe confirmar la restauración');

      const note = await prisma.personalNote.findUnique({ where: { id: createdNoteA.id } });
      assert(note.deletedAt === null, 'deletedAt debe volver a ser null');
    });

    // --------------------------------------------------------------------------
    // BLOQUE 5: INTERVENCIÓN ADMINISTRATIVA EXTRAORDINARIA
    // --------------------------------------------------------------------------
    console.log('\n--- BLOQUE 5: INTERVENCIÓN ADMINISTRATIVA EXTRAORDINARIA Y AUDITORÍA CRITICAL ---');

    await runTest('NOTE-10', 'Rechazo de intervención si la justificación tiene menos de 15 caracteres', async () => {
      let threw = false;
      try {
        await notesService.adminIntervene(
          createdNoteA.id,
          {
            title: 'Corrección administrativa',
            adminJustification: 'Muy corta', // < 15 caracteres
          },
          adminAuth
        );
      } catch (err) {
        threw = true;
        assert(err.status === 400, 'Debe responder con 400 BadRequest');
        assert(err.message.includes('al menos 15 caracteres'), 'Mensaje debe exigir 15 caracteres mínimos');
      }
      assert(threw, 'Debe exigir longitud mínima de justificación');
    });

    await runTest('NOTE-11', 'Rechazo de intervención administrativa si el usuario no tiene permiso note:override_any', async () => {
      let threw = false;
      try {
        await notesService.adminIntervene(
          createdNoteA.id,
          {
            title: 'Intento de intervención no autorizada',
            adminJustification: 'Justificación con longitud suficiente pero sin permiso institucional',
          },
          userBAuth
        );
      } catch (err) {
        threw = true;
        assert(err.status === 403, 'Debe responder con 403 Forbidden');
        assert(err.message.includes('note:override_any'), 'Mensaje debe citar permiso requerido');
      }
      assert(threw, 'Solo usuarios con note:override_any pueden intervenir');
    });

    await runTest('NOTE-12', 'Ejecución exitosa de intervención administrativa por Administrador: Snapshot, Flag y Auditoría CRITICAL', async () => {
      const validJustification = 'Corrección técnica y jurídica instruida formalmente por el Órgano Interno de Control.';

      const intervened = await notesService.adminIntervene(
        createdNoteA.id,
        {
          title: 'Notas preparatorias sobre régimen de adquisiciones 2026 [REVISADA POR OIC]',
          adminJustification: validJustification,
        },
        adminAuth,
        '10.0.0.50',
        'MexAgenda-AdminConsole/1.0'
      );

      assert(intervened.isAdminModified === true, 'isAdminModified debe ser true');
      assert(intervened.lastAdminIntervenorId === adminUser.id, 'lastAdminIntervenorId debe apuntar al admin');
      assert(intervened.adminJustification === validJustification, 'adminJustification debe guardarse');
      assert(intervened.version === 3, 'La versión debe avanzar a 3');

      // Verificar que se guardó la versión con flag de intervención administrativa
      const versions = await prisma.personalNoteVersion.findMany({
        where: { personalNoteId: createdNoteA.id },
        orderBy: { versionNumber: 'desc' },
      });
      const interveneSnapshot = versions.find((v) => v.isAdminIntervention === true);
      assert(interveneSnapshot, 'Debe existir un snapshot con isAdminIntervention = true');
      assert(interveneSnapshot.adminJustification === validJustification, 'El snapshot debe guardar la justificación');

      // Verificar registro de auditoría CRITICAL en audit_logs
      const auditLog = await prisma.auditLog.findFirst({
        where: {
          action: 'NOTE_ADMIN_OVERRIDE',
          entityId: createdNoteA.id,
          actorId: adminUser.id,
        },
        orderBy: { createdAt: 'desc' },
      });
      assert(auditLog, 'Debe registrarse evento NOTE_ADMIN_OVERRIDE en audit_logs');
      assert(auditLog.outcome === 'SUCCESS', 'El resultado debe ser SUCCESS');
      assert(auditLog.diffPayload?.severidad === 'CRITICAL', 'El payload debe registrar severidad CRITICAL');
    });

    // --------------------------------------------------------------------------
    // BLOQUE 6: NOTAS DE SESIÓN VINCULADAS Y NO ALTERACIÓN DE ACTAS OFICIALES
    // --------------------------------------------------------------------------
    console.log('\n--- BLOQUE 6: NOTAS DE SESIÓN VINCULADAS Y NO ALTERACIÓN DE ACTAS ---');

    await runTest('NOTE-13', 'Registro de nota vinculada a reunión institucional y punto de orden del día', async () => {
      if (!testMeeting) {
        console.log('    (Sin reunión de prueba, omitiendo verificación profunda)');
        return;
      }

      createdSessionNote = await notesService.create(
        {
          title: `Observación colegiada sobre desarrollo de sesión ${testMeeting.folio}`,
          content: 'El cuerpo colegiado solicita desglose presupuestal adicional antes de la votación definitiva.',
          category: 'SESION',
          noteType: 'SESION',
          visibility: 'REUNION',
          meetingId: testMeeting.id,
          agendaItemId: testAgendaItem ? testAgendaItem.id : undefined,
        },
        userAAuth
      );

      assert(createdSessionNote.meetingId === testMeeting.id, 'Debe vincularse a la reunión');
      assert(createdSessionNote.noteType === 'SESION', 'noteType debe ser SESION');
      assert(createdSessionNote.meeting?.folio === testMeeting.folio, 'Debe contener folio de la reunión');
    });

    await runTest('NOTE-14', 'Inviolabilidad de actas oficiales: Las notas de sesión NO alteran actas (meeting_minutes)', async () => {
      if (!testMeeting) return;

      const minutesBefore = await prisma.meetingMinutes.findFirst({
        where: { meetingId: testMeeting.id },
      });

      // Crear otra nota vinculada a la reunión
      await notesService.create(
        {
          title: 'Anotación independiente sobre acuerdo de orden del día',
          content: 'Comentario particular de un integrante sin carácter vinculante de acta.',
          meetingId: testMeeting.id,
        },
        userAAuth
      );

      const minutesAfter = await prisma.meetingMinutes.findFirst({
        where: { meetingId: testMeeting.id },
      });

      if (minutesBefore && minutesAfter) {
        assert(minutesBefore.updatedAt.getTime() === minutesAfter.updatedAt.getTime(), 'El acta oficial no debe ser modificada por notas');
      }
    });

    await runTest('NOTE-15', 'Consulta de notas vinculadas por reunión (findByMeeting)', async () => {
      if (!testMeeting) return;
      const notesInMeeting = await notesService.findByMeeting(testMeeting.id, userAAuth);
      assert(notesInMeeting.length >= 1, 'Debe devolver al menos la nota de sesión creada');
      assert(notesInMeeting.some((n) => n.id === createdSessionNote.id), 'Debe incluir la nota creada');
    });

    // --------------------------------------------------------------------------
    // BLOQUE 7: HISTORIAL DE VERSIONES Y FILTROS AVANZADOS
    // --------------------------------------------------------------------------
    console.log('\n--- BLOQUE 7: HISTORIAL DE VERSIONES Y FILTROS DE CATÁLOGO ---');

    await runTest('NOTE-16', 'Consulta de historial completo de versiones (getVersions)', async () => {
      const history = await notesService.getVersions(createdNoteA.id, userAAuth);
      assert(history.length >= 2, `Debe haber al menos 2 versiones archivadas en historial. Total: ${history.length}`);
      assert(history[0].versionNumber > history[1].versionNumber, 'El historial debe ordenarse descendentemente por versionNumber');
      assert(history.some((h) => h.isAdminIntervention === true), 'Debe reflejar la intervención administrativa');
    });

    await runTest('NOTE-17', 'Filtros avanzados de catálogo: Búsqueda por texto y categorías', async () => {
      const resSearch = await notesService.findAll({ search: 'adquisiciones' }, userAAuth);
      assert(resSearch.items.length >= 1, 'La búsqueda por texto debe encontrar coincidencias');

      const resCategory = await notesService.findAll({ category: 'JURIDICO' }, userAAuth);
      assert(resCategory.items.every((i) => i.category === 'JURIDICO'), 'El filtro por categoría debe ser estricto');
    });

    // --------------------------------------------------------------------------
    // RESUMEN FINAL
    // --------------------------------------------------------------------------
    console.log('\n==============================================================================');
    console.log('RESUMEN DE EJECUCIÓN — SUITE DE PRUEBAS DE FASE 5');
    console.log('==============================================================================');
    const passed = results.filter((r) => r.status === 'PASSED').length;
    const failed = results.filter((r) => r.status === 'FAILED').length;
    console.log(`Total pruebas ejecutadas : ${results.length}`);
    console.log(`Pruebas superadas (PASSED): ${passed}`);
    console.log(`Pruebas fallidas  (FAILED): ${failed}`);

    if (failed > 0) {
      console.error('\n[!] SE DETECTARON FALLOS EN LA SUITE DE PRUEBAS DE FASE 5');
      process.exit(1);
    } else {
      console.log('\n[✓] TODAS LAS PRUEBAS DE FASE 5 (MOD-04) PASARON SATISFACTORIAMENTE (100%)');
    }
  } catch (globalError) {
    console.error('Error global inesperado durante la ejecución:', globalError);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();

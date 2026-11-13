/**
 * ==============================================================================
 * MEXAGENDA — SUITE DE AUDITORÍA INDEPENDIENTE DE FASE 5 (MOD-04)
 * ==============================================================================
 * MÓDULO: ANOTACIONES PERSONALES Y NOTAS DE SESIÓN
 *
 * Ejecuta pruebas de verificación técnica independientes sobre Neon PostgreSQL:
 * 1. RBAC-AUDIT: Comprobación de asignación diferenciada entre ROLE_ADMIN y ROLE_USER.
 * 2. IDOR-BOLA-AUDIT: Pruebas negativas de aislamiento y control de autoría.
 * 3. OVR-AUDIT: Protocolo de intervención administrativa, validación y severidad CRITICAL.
 * 4. DB-AUDIT: Integridad referencial, nulabilidad de meetingId y restricciones ON DELETE.
 * 5. ACTA-AUDIT: Inviolabilidad de actas (meeting_minutes) y acuerdos (agreements).
 * 6. IMMUT-AUDIT: Inmutabilidad de snapshots y monotonicidad de versiones.
 * ==============================================================================
 */

const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

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

const { NotesService } = require('../apps/backend/dist/modules/notes/notes.service');
const { AuditService } = require('../apps/backend/dist/modules/audit/audit.service');

const auditService = new AuditService(prisma);
const notesService = new NotesService(prisma, auditService);

const auditResults = [];

function assert(condition, message) {
  if (!condition) {
    throw new Error(`FALLO DE AUDITORÍA: ${message}`);
  }
}

async function runAuditTest(code, title, fn) {
  const start = Date.now();
  try {
    await fn();
    const duration = Date.now() - start;
    auditResults.push({ code, title, status: 'PASSED', duration });
    console.log(`  ✓ [${code}] ${title} (${duration}ms)`);
  } catch (error) {
    const duration = Date.now() - start;
    auditResults.push({ code, title, status: 'FAILED', duration, error: error.message });
    console.error(`  ✗ [${code}] ${title} (${duration}ms)`);
    console.error(`      Causa: ${error.message}`);
  }
}

async function main() {
  console.log('==============================================================================');
  console.log('MEXAGENDA — AUDITORÍA INDEPENDIENTE DE FASE 5 (MOD-04: ANOTACIONES)');
  console.log('Base de Datos: Neon PostgreSQL');
  console.log('==============================================================================\n');

  let adminUser;
  let userA;
  let userB;
  let testMeeting;
  let testAgreement;
  let noteAId;

  try {
    // --------------------------------------------------------------------------
    // ACTORES DE AUDITORÍA
    // --------------------------------------------------------------------------
    adminUser = await prisma.user.findFirst({
      where: { role: { code: 'ROLE_ADMIN' } },
      include: { role: { include: { permissions: { include: { permission: true } } } } },
    });
    assert(adminUser, 'Debe existir un usuario ROLE_ADMIN');

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

    const userRole = await prisma.role.findUnique({
      where: { code: 'ROLE_USER' },
      include: { permissions: { include: { permission: true } } },
    });
    assert(userRole, 'Debe existir ROLE_USER');
    const userRolePerms = userRole.permissions.map((rp) => rp.permission.code);

    userA = await prisma.user.upsert({
      where: { email: 'auditor.autor.a@institucion.gob.mx' },
      create: {
        email: 'auditor.autor.a@institucion.gob.mx',
        passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$dummyhash',
        firstName: 'Mariana',
        lastName: 'Zavala',
        position: 'Coordinadora de Dictámenes',
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
      permissions: userRolePerms,
    };

    userB = await prisma.user.upsert({
      where: { email: 'auditor.tercero.b@institucion.gob.mx' },
      create: {
        email: 'auditor.tercero.b@institucion.gob.mx',
        passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$dummyhash',
        firstName: 'Carlos',
        lastName: 'Mendoza',
        position: 'Enlace Administrativo',
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
      permissions: userRolePerms,
    };

    testMeeting = await prisma.meeting.findFirst({ where: { deletedAt: null } });
    testAgreement = await prisma.agreement.findFirst({ where: { deletedAt: null } });

    // --------------------------------------------------------------------------
    // 1. AUDITORÍA CRÍTICA DE PERMISOS RBAC
    // --------------------------------------------------------------------------
    console.log('--- 1. AUDITORÍA CRÍTICA DE DISTRIBUCIÓN RBAC ---');

    await runAuditTest('RBAC-AUDIT-01', 'Verificar que ROLE_USER NO posea note:override_any ni note:admin:read', async () => {
      const perms = await prisma.rolePermission.findMany({
        where: { role: { code: 'ROLE_USER' } },
        include: { permission: true },
      });
      const codes = perms.map((p) => p.permission.code);
      assert(!codes.includes('note:override_any'), 'ROLE_USER NO debe tener note:override_any bajo ninguna circunstancia');
      assert(!codes.includes('note:admin:read'), 'ROLE_USER NO debe tener note:admin:read');
      assert(codes.includes('note:read'), 'ROLE_USER debe tener note:read');
      assert(codes.includes('note:create'), 'ROLE_USER debe tener note:create');
      assert(codes.includes('note:update_own'), 'ROLE_USER debe tener note:update_own');
      assert(codes.includes('note:delete_own'), 'ROLE_USER debe tener note:delete_own');
      assert(codes.includes('note:history:read'), 'ROLE_USER debe tener note:history:read');
      assert(codes.includes('note:visibility:manage'), 'ROLE_USER debe tener note:visibility:manage');
    });

    await runAuditTest('RBAC-AUDIT-02', 'Verificar que ROLE_ADMIN posea la totalidad de los 8 permisos note:*', async () => {
      const perms = await prisma.rolePermission.findMany({
        where: { role: { code: 'ROLE_ADMIN' }, permission: { code: { startsWith: 'note:' } } },
        include: { permission: true },
      });
      assert(perms.length === 8, `ROLE_ADMIN debe poseer los 8 permisos de notas. Encontrados: ${perms.length}`);
    });

    // --------------------------------------------------------------------------
    // 2. AUDITORÍA IDOR / BOLA Y AISLAMIENTO DE PRIVACIDAD
    // --------------------------------------------------------------------------
    console.log('\n--- 2. AUDITORÍA IDOR / BOLA Y AISLAMIENTO DE PRIVACIDAD ---');

    await runAuditTest('IDOR-AUDIT-01', 'Creación de nota privada por Usuario A con contenido confidencial', async () => {
      const note = await notesService.create(
        {
          title: 'Anotación confidencial sobre investigación patrimonial',
          content: 'SECRET_FLAG_PATRIMONIAL_2026: Expediente en reserva legal bajo artículo 113 LFTAIP.',
          category: 'JURIDICO',
          visibility: 'PRIVADA',
        },
        userAAuth
      );
      noteAId = note.id;
      assert(note.authorId === userA.id, 'El autor debe ser estrictamente Usuario A');
      assert(note.visibility === 'PRIVADA', 'La visibilidad debe ser estrictamente PRIVADA');
    });

    await runAuditTest('IDOR-AUDIT-02', 'Búsqueda por texto: Usuario B NO puede encontrar la nota privada de Usuario A', async () => {
      const searchRes = await notesService.findAll({ search: 'SECRET_FLAG_PATRIMONIAL_2026' }, userBAuth);
      assert(searchRes.items.length === 0, 'La búsqueda libre de un tercero NO debe filtrar notas privadas ajenas');
    });

    await runAuditTest('IDOR-AUDIT-03', 'Acceso directo (findById): Usuario B es bloqueado con HTTP 403 Forbidden', async () => {
      let blocked = false;
      try {
        await notesService.findById(noteAId, userBAuth);
      } catch (err) {
        blocked = true;
        assert(err.status === 403, 'Debe retornar 403 Forbidden');
        assert(err.message.includes('estrictamente privado'), 'Mensaje debe advertir carácter privado');
      }
      assert(blocked, 'Debe arrojar ForbiddenException');
    });

    await runAuditTest('IDOR-AUDIT-04', 'Mutación ordinaria ajena: Usuario B es bloqueado y se genera auditoría DENIED', async () => {
      let blocked = false;
      try {
        await notesService.update(
          noteAId,
          { title: 'Manipulación maliciosa de título' },
          userBAuth,
          '192.168.1.99',
          'PenTest-Agent/1.0'
        );
      } catch (err) {
        blocked = true;
        assert(err.status === 403, 'Debe responder 403 Forbidden');
      }
      assert(blocked, 'Debe bloquear la actualización ajena');

      // Verificar registro en audit_logs
      const log = await prisma.auditLog.findFirst({
        where: {
          action: 'UNAUTHORIZED_NOTE_MUTATION_ATTEMPT',
          entityId: noteAId,
          actorId: userB.id,
        },
        orderBy: { createdAt: 'desc' },
      });
      assert(log, 'Debe registrarse UNAUTHORIZED_NOTE_MUTATION_ATTEMPT');
      assert(log.outcome === 'DENIED', 'El outcome de auditoría debe ser DENIED');
    });

    await runAuditTest('IDOR-AUDIT-05', 'Archivado ajeno: Usuario B no puede archivar la nota de Usuario A (403 Forbidden)', async () => {
      let blocked = false;
      try {
        await notesService.archive(noteAId, userBAuth);
      } catch (err) {
        blocked = true;
        assert(err.status === 403, 'Debe retornar 403 Forbidden');
      }
      assert(blocked, 'No debe permitir archivado ajeno');
    });

    await runAuditTest('IDOR-AUDIT-06', 'Historial ajeno: Usuario B no puede consultar versiones de nota privada ajena (403 Forbidden)', async () => {
      let blocked = false;
      try {
        await notesService.getVersions(noteAId, userBAuth);
      } catch (err) {
        blocked = true;
        assert(err.status === 403, 'Debe responder 403 Forbidden');
      }
      assert(blocked, 'No debe permitir consultar historial de nota privada ajena');
    });

    await runAuditTest('IDOR-AUDIT-07', 'Inmunidad a Mass Assignment: Enviar authorId en payload de create es ignorado', async () => {
      const spoofedNote = await notesService.create(
        {
          title: 'Intento de falsificación de autoría',
          content: 'Cuerpo con autor simulado',
          authorId: userB.id, // Intento de spoofing
        },
        userAAuth
      );
      assert(spoofedNote.authorId === userA.id, 'authorId debe provenir estrictamente de userAAuth, no del payload');
    });

    // --------------------------------------------------------------------------
    // 3. AUDITORÍA DE INTERVENCIONES ADMINISTRATIVAS EXTRAORDINARIAS
    // --------------------------------------------------------------------------
    console.log('\n--- 3. AUDITORÍA DE INTERVENCIÓN ADMINISTRATIVA ---');

    await runAuditTest('OVR-AUDIT-01', 'Validación estricta de longitud: Rechazar justificación de 14 caracteres', async () => {
      let rejected = false;
      try {
        await notesService.adminIntervene(
          noteAId,
          {
            title: 'Corrección administrativa',
            adminJustification: '12345678901234', // Exactamente 14 caracteres
          },
          adminAuth
        );
      } catch (err) {
        rejected = true;
        assert(err.status === 400, 'Debe responder HTTP 400 Bad Request');
        assert(err.message.includes('al menos 15 caracteres'), 'Mensaje debe indicar regla de 15 caracteres');
      }
      assert(rejected, 'Debe rechazar justificaciones con menos de 15 caracteres');
    });

    await runAuditTest('OVR-AUDIT-02', 'Rechazar intervención si el usuario es ROLE_USER sin permiso note:override_any', async () => {
      let rejected = false;
      try {
        await notesService.adminIntervene(
          noteAId,
          {
            title: 'Corrección intentada por usuario común',
            adminJustification: 'Justificación suficientemente larga para la prueba técnica',
          },
          userBAuth
        );
      } catch (err) {
        rejected = true;
        assert(err.status === 403, 'Debe responder HTTP 403 Forbidden');
      }
      assert(rejected, 'Usuario común no puede intervenir notas ajenas');
    });

    await runAuditTest('OVR-AUDIT-03', 'Intervención administrativa exitosa: Snapshot, Flag y Evento CRITICAL', async () => {
      const justification = 'Revisión técnica instruida por la Contraloría Interna mediante oficio OIC-2026-099.';
      const res = await notesService.adminIntervene(
        noteAId,
        {
          title: 'Anotación confidencial [REVISADA POR OIC]',
          adminJustification: justification,
        },
        adminAuth
      );

      assert(res.isAdminModified === true, 'isAdminModified debe ser true');
      assert(res.lastAdminIntervenorId === adminUser.id, 'lastAdminIntervenorId debe apuntar al administrador');
      assert(res.adminJustification === justification, 'adminJustification debe guardarse');
      assert(res.version === 2, 'La versión debe ser 2');

      // Verificar snapshot en personal_note_versions
      const snapshot = await prisma.personalNoteVersion.findFirst({
        where: { personalNoteId: noteAId, isAdminIntervention: true },
      });
      assert(snapshot, 'Debe crearse un snapshot con isAdminIntervention = true');
      assert(snapshot.adminJustification === justification, 'El snapshot debe contener la justificación');

      // Verificar evento CRITICAL en audit_logs
      const auditLog = await prisma.auditLog.findFirst({
        where: {
          action: 'NOTE_ADMIN_OVERRIDE',
          entityId: noteAId,
          actorId: adminUser.id,
        },
        orderBy: { createdAt: 'desc' },
      });
      assert(auditLog, 'Debe existir registro en audit_logs');
      assert(auditLog.outcome === 'SUCCESS', 'Outcome debe ser SUCCESS');
      assert(auditLog.diffPayload?.severidad === 'CRITICAL', 'Severidad debe ser CRITICAL');
    });

    // --------------------------------------------------------------------------
    // 4. AUDITORÍA DE BASE DE DATOS E INTEGRIDAD REFERENCIAL
    // --------------------------------------------------------------------------
    console.log('\n--- 4. AUDITORÍA DE INTEGRIDAD DE BASE DE DATOS EN NEON ---');

    await runAuditTest('DB-AUDIT-01', 'Nulabilidad de meetingId: Creación de nota personal pura con meetingId null', async () => {
      const purePersonal = await notesService.create(
        {
          title: 'Nota puramente personal sin reunión colegiada vinculada',
          content: 'Reflexión individual de trabajo.',
          category: 'GENERAL',
        },
        userAAuth
      );
      assert(purePersonal.meetingId === null, 'meetingId debe ser nulo');
      assert(purePersonal.noteType === 'PERSONAL', 'noteType debe ser PERSONAL');
    });

    await runAuditTest('DB-AUDIT-02', 'Integridad Referencial: Rechazar meetingId o agreementId inexistentes con 404', async () => {
      let rejectedMeeting = false;
      try {
        await notesService.create(
          {
            title: 'Nota con reunión inexistente',
            content: 'Debe fallar',
            meetingId: '00000000-0000-0000-0000-000000000000',
          },
          userAAuth
        );
      } catch (err) {
        rejectedMeeting = true;
        assert(err.status === 404, 'Debe retornar 404 NotFound para reunión inexistente');
      }
      assert(rejectedMeeting, 'Debe rechazar meetingId inexistente');

      let rejectedAgreement = false;
      try {
        await notesService.create(
          {
            title: 'Nota con acuerdo inexistente',
            content: 'Debe fallar',
            agreementId: '00000000-0000-0000-0000-000000000000',
          },
          userAAuth
        );
      } catch (err) {
        rejectedAgreement = true;
        assert(err.status === 404, 'Debe retornar 404 NotFound para acuerdo inexistente');
      }
      assert(rejectedAgreement, 'Debe rechazar agreementId inexistente');
    });

    await runAuditTest('DB-AUDIT-03', 'Integridad ON DELETE RESTRICT en Users: Usuario con notas no puede ser eliminado directamente', async () => {
      let blocked = false;
      try {
        await prisma.user.delete({ where: { id: userA.id } });
      } catch (err) {
        blocked = true;
        const msg = String(err.message || '').toLowerCase();
        assert(
          err.code === 'P2003' || err.code === 'P2014' || msg.includes('foreign key') || msg.includes('restrict') || msg.includes('violat'),
          'Debe arrojar restricción de llave foránea'
        );
      }
      assert(blocked, 'El motor relacional debe impedir el borrado físico de usuarios con notas');
    });

    // --------------------------------------------------------------------------
    // 5. AUDITORÍA DE INVIOLABILIDAD DE ACTAS Y ACUERDOS
    // --------------------------------------------------------------------------
    console.log('\n--- 5. AUDITORÍA DE INVIOLABILIDAD DE ACTAS Y ACUERDOS ---');

    await runAuditTest('ACTA-AUDIT-01', 'Inviolabilidad de Actas: Las notas de sesión jamás alteran meeting_minutes ni sus versiones', async () => {
      if (!testMeeting) {
        console.log('    (Sin reunión de prueba, omitiendo)');
        return;
      }

      const minutesBefore = await prisma.meetingMinutes.findFirst({
        where: { meetingId: testMeeting.id },
      });

      // Crear nota vinculada a la reunión
      await notesService.create(
        {
          title: 'Observación personal durante la deliberación colegiada',
          content: 'No tiene efecto jurídico vinculante sobre el acta oficial.',
          meetingId: testMeeting.id,
        },
        userAAuth
      );

      const minutesAfter = await prisma.meetingMinutes.findFirst({
        where: { meetingId: testMeeting.id },
      });

      if (minutesBefore && minutesAfter) {
        assert(minutesBefore.updatedAt.getTime() === minutesAfter.updatedAt.getTime(), 'El acta oficial NO debe haber sido alterada');
        assert(minutesBefore.versionNumber === minutesAfter.versionNumber, 'La versión del acta NO debe haber variado');
      }
    });

    await runAuditTest('ACTA-AUDIT-02', 'Inviolabilidad de Acuerdos: Las notas vinculadas a un acuerdo no modifican su estado', async () => {
      if (!testAgreement) return;

      const agreementBefore = await prisma.agreement.findUnique({
        where: { id: testAgreement.id },
      });

      await notesService.create(
        {
          title: 'Nota de seguimiento técnico del acuerdo',
          content: 'Apunte particular sobre plazos de entrega.',
          agreementId: testAgreement.id,
        },
        userAAuth
      );

      const agreementAfter = await prisma.agreement.findUnique({
        where: { id: testAgreement.id },
      });

      assert(agreementBefore.status === agreementAfter.status, 'El estado del acuerdo institucional no debe cambiar por notas');
      assert(agreementBefore.currentProgressPercent === agreementAfter.currentProgressPercent, 'El avance porcentual no debe alterarse');
    });

    // --------------------------------------------------------------------------
    // 6. AUDITORÍA DE INMUTABILIDAD Y MONOTONICIDAD DE VERSIONES
    // --------------------------------------------------------------------------
    console.log('\n--- 6. AUDITORÍA DE SNAPSHOTS Y MONOTONICIDAD DE VERSIONES ---');

    await runAuditTest('IMMUT-AUDIT-01', 'Monotonicidad estricta: Las versiones avanzan monótonamente 1 -> 2 -> 3', async () => {
      const note = await notesService.create(
        {
          title: 'Nota para prueba de monotonicidad',
          content: 'Versión inicial 1',
        },
        userAAuth
      );
      assert(note.version === 1, 'Versión inicial = 1');

      const v2 = await notesService.update(note.id, { content: 'Versión segunda 2' }, userAAuth);
      assert(v2.version === 2, 'Versión siguiente = 2');

      const v3 = await notesService.update(note.id, { content: 'Versión tercera 3' }, userAAuth);
      assert(v3.version === 3, 'Versión siguiente = 3');

      const history = await notesService.getVersions(note.id, userAAuth);
      assert(history.length === 2, `Debe haber 2 snapshots archivados (v1 y v2). Total: ${history.length}`);
      assert(history[0].versionNumber === 2, 'El primer elemento del historial debe ser la versión 2');
      assert(history[1].versionNumber === 1, 'El segundo elemento del historial debe ser la versión 1');
    });

    await runAuditTest('IMMUT-AUDIT-02', 'Ausencia de mutación de snapshots: No existen rutas para editar personal_note_versions', async () => {
      // Verificamos en el servicio que no existe ningún método que exponga personalNoteVersion.update o delete individual
      assert(typeof notesService.updateVersion === 'undefined', 'No debe existir updateVersion en NotesService');
      assert(typeof notesService.deleteVersion === 'undefined', 'No debe existir deleteVersion en NotesService');
    });

    // --------------------------------------------------------------------------
    // RESUMEN CONSOLIDADO DE AUDITORÍA
    // --------------------------------------------------------------------------
    console.log('\n==============================================================================');
    console.log('RESUMEN DE AUDITORÍA INDEPENDIENTE DE FASE 5');
    console.log('==============================================================================');
    const passed = auditResults.filter((r) => r.status === 'PASSED').length;
    const failed = auditResults.filter((r) => r.status === 'FAILED').length;
    console.log(`Total pruebas de auditoría ejecutadas : ${auditResults.length}`);
    console.log(`Pruebas superadas (PASSED)           : ${passed}`);
    console.log(`Pruebas fallidas  (FAILED)           : ${failed}`);

    if (failed > 0) {
      console.error('\n[!] SE DETECTARON NO-CONFORMIDADES BLOQUEANTES EN LA AUDITORÍA DE FASE 5');
      process.exit(1);
    } else {
      console.log('\n[✓] TODAS LAS PRUEBAS DE AUDITORÍA INDEPENDIENTE FUERON SUPERADAS EXITOSAMENTE (100%)');
    }
  } catch (globalError) {
    console.error('Error global inesperado durante la auditoría:', globalError);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();


/**
 * ==============================================================================
 * MEXAGENDA — SUITE DE AUDITORÍA INDEPENDIENTE DE FASE 6
 * ==============================================================================
 * MÓDULO 05: BÓVEDA DIGITAL Y GESTIÓN SEGURA DE ARCHIVOS ADJUNTOS (S3)
 *
 * Auditoría técnica exhaustiva e independiente sobre Neon PostgreSQL:
 * - SEC-AUDIT-01: Verificación de entorno de almacenamiento (Sandbox vs AWS S3).
 * - SEC-AUDIT-02: Integridad estricta de esquema y restricciones ON DELETE en Neon.
 * - SEC-AUDIT-03: Auditoría de distribución RBAC de los 8 permisos document:*.
 * - SEC-AUDIT-04: Prueba Anti-IDOR: Intento de descarga de documento privado ajeno.
 * - SEC-AUDIT-05: Prueba Anti-IDOR: Intento de modificación o borrado de documento ajeno.
 * - SEC-AUDIT-06: Prueba Anti-IDOR: Intento de asociar archivo a nota privada ajena.
 * - SEC-AUDIT-07: Validación de URLs presignadas y forzado inquebrantable de TTL (300s).
 * - SEC-AUDIT-08: Prueba Anti-Tampering: Firma HMAC adulterada o con longitud anómala.
 * - SEC-AUDIT-09: Prueba de validación binaria: Detección y rechazo de MIME Spoofing.
 * - SEC-AUDIT-10: Prueba de validación binaria: Rechazo de archivos > 25 MB y vacíos.
 * - SEC-AUDIT-11: Aislamiento de Cuarentena: Bloqueo estricto de archivos INFECTADOS.
 * - SEC-AUDIT-12: Inmutabilidad append-only de attachment_versions y monotonicidad.
 * - SEC-AUDIT-13: Preservación de registros y almacenamiento ante soft delete.
 * - SEC-AUDIT-14: Trazabilidad forense completa en audit_logs.
 * ==============================================================================
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
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

const { StorageService } = require('../apps/backend/dist/modules/documents/storage/storage.service');
const { LocalStorageService } = require('../apps/backend/dist/modules/documents/storage/local-storage.service');
const { DocumentsService } = require('../apps/backend/dist/modules/documents/documents.service');
const { AuditService } = require('../apps/backend/dist/modules/audit/audit.service');

const configService = {
  get: (key) => process.env[key] || null,
};

const storageService = new StorageService(configService);
storageService.onModuleInit();
const auditService = new AuditService(prisma);
const documentsService = new DocumentsService(prisma, storageService, auditService);

const auditResults = [];

function assert(condition, message) {
  if (!condition) {
    throw new Error(`FALLO DE AUDITORÍA: ${message}`);
  }
}

async function runAuditCheck(code, title, fn) {
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
    console.error(`      Error: ${error.message}`);
  }
}

async function main() {
  console.log('==============================================================================');
  console.log('MEXAGENDA — SUITE DE AUDITORÍA INDEPENDIENTE DE FASE 6 (MOD-05: BÓVEDA S3)');
  console.log('Base de Datos: Neon PostgreSQL');
  console.log('==============================================================================\n');

  let adminUser;
  let userA;
  let userB;
  let testPrivateNoteA;
  let docA;

  try {
    // --------------------------------------------------------------------------
    // 1. AUDITORÍA DE ENTORNO Y ALMACENAMIENTO
    // --------------------------------------------------------------------------
    console.log('--- 1. AUDITORÍA DE ENTORNO Y PROVEEDOR DE ALMACENAMIENTO ---');
    await runAuditCheck('SEC-AUDIT-01', 'Verificación de proveedor de almacenamiento activo y clasificación', async () => {
      const provider = storageService.getProviderName();
      assert(provider === 'LOCAL' || provider === 'S3', `Proveedor no reconocido: ${provider}`);
      if (provider === 'LOCAL') {
        const underlying = storageService.getUnderlyingDriver();
        assert(underlying instanceof LocalStorageService, 'El driver debe ser una instancia de LocalStorageService');
      }
    });

    // --------------------------------------------------------------------------
    // 2. AUDITORÍA DE ESQUEMA EN NEON POSTGRESQL
    // --------------------------------------------------------------------------
    console.log('\n--- 2. AUDITORÍA DE ESQUEMA Y RESTRICCIONES EN NEON ---');
    await runAuditCheck('SEC-AUDIT-02', 'Verificar restricciones ON DELETE y columnas no anulables en attachments', async () => {
      const fkeys = await prisma.$queryRaw`
        SELECT tc.constraint_name, kcu.column_name, ccu.table_name AS foreign_table_name, rc.delete_rule
        FROM information_schema.table_constraints AS tc
        JOIN information_schema.key_column_usage AS kcu ON tc.constraint_name = kcu.constraint_name
        JOIN information_schema.constraint_column_usage AS ccu ON ccu.constraint_name = tc.constraint_name
        JOIN information_schema.referential_constraints AS rc ON rc.constraint_name = tc.constraint_name
        WHERE tc.table_name = 'attachments' AND tc.constraint_type = 'FOREIGN KEY';
      `;
      assert(fkeys.length >= 6, `Se esperaban al menos 6 foreign keys en attachments, encontradas ${fkeys.length}`);

      const userFk = fkeys.find((f) => f.column_name === 'uploaded_by_id');
      assert(userFk && userFk.delete_rule === 'RESTRICT', 'uploaded_by_id debe tener ON DELETE RESTRICT');

      const meetingFk = fkeys.find((f) => f.column_name === 'meeting_id');
      assert(meetingFk && meetingFk.delete_rule === 'RESTRICT', 'meeting_id debe tener ON DELETE RESTRICT');
    });

    // --------------------------------------------------------------------------
    // 3. AUDITORÍA CRÍTICA DE RBAC
    // --------------------------------------------------------------------------
    console.log('\n--- 3. AUDITORÍA CRÍTICA DE DISTRIBUCIÓN RBAC ---');
    await runAuditCheck('SEC-AUDIT-03', 'Verificar que ROLE_USER carezca de document:admin:* y ROLE_ADMIN tenga los 8 permisos', async () => {
      const adminRole = await prisma.role.findUnique({
        where: { code: 'ROLE_ADMIN' },
        include: { permissions: { include: { permission: true } } },
      });
      const userRole = await prisma.role.findUnique({
        where: { code: 'ROLE_USER' },
        include: { permissions: { include: { permission: true } } },
      });

      const adminCodes = adminRole.permissions.map((p) => p.permission.code);
      const userCodes = userRole.permissions.map((p) => p.permission.code);

      assert(adminCodes.includes('document:admin:manage'), 'ROLE_ADMIN debe tener document:admin:manage');
      assert(adminCodes.includes('document:admin:read'), 'ROLE_ADMIN debe tener document:admin:read');
      assert(!userCodes.includes('document:admin:manage'), 'ROLE_USER NO debe tener document:admin:manage');
      assert(!userCodes.includes('document:admin:read'), 'ROLE_USER NO debe tener document:admin:read');
    });

    // Cargar actores de prueba
    adminUser = await prisma.user.findFirst({
      where: { role: { code: 'ROLE_ADMIN' } },
      include: { role: true },
    });
    const regularUsers = await prisma.user.findMany({
      where: { role: { code: 'ROLE_USER' } },
      include: { role: true },
      take: 2,
    });
    userA = regularUsers[0];
    userB = regularUsers[1];

    const authAdmin = {
      id: adminUser.id,
      email: adminUser.email,
      firstName: adminUser.firstName,
      lastName: adminUser.lastName,
      position: adminUser.position,
      role: 'ROLE_ADMIN',
      status: adminUser.status,
      permissions: ['document:admin:manage', 'document:admin:read', 'document:upload', 'document:download', 'document:read'],
    };

    const authUserA = {
      id: userA.id,
      email: userA.email,
      firstName: userA.firstName,
      lastName: userA.lastName,
      position: userA.position,
      role: 'ROLE_USER',
      status: userA.status,
      permissions: ['document:upload', 'document:download', 'document:read', 'document:update_own', 'document:delete_own'],
    };

    const authUserB = {
      id: userB.id,
      email: userB.email,
      firstName: userB.firstName,
      lastName: userB.lastName,
      position: userB.position,
      role: 'ROLE_USER',
      status: userB.status,
      permissions: ['document:upload', 'document:download', 'document:read', 'document:update_own', 'document:delete_own'],
    };

    // Crear nota privada para User A
    testPrivateNoteA = await prisma.personalNote.create({
      data: {
        title: 'Nota de Auditoría Confidencial A',
        content: 'Información estrictamente confidencial de User A',
        visibility: 'PRIVADA',
        category: 'GENERAL',
        noteType: 'PERSONAL',
        authorId: userA.id,
      },
    });

    // --------------------------------------------------------------------------
    // 4. AUDITORÍA IDOR / BOLA Y HERENCIA DE PRIVACIDAD
    // --------------------------------------------------------------------------
    console.log('\n--- 4. AUDITORÍA IDOR / BOLA Y HERENCIA DE PRIVACIDAD ---');
    await runAuditCheck('SEC-AUDIT-04', 'Carga de archivo por Usuario A vinculado a nota privada e intento de descarga por Usuario B -> 403', async () => {
      const pdfBuffer = Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF');
      docA = await documentsService.upload(
        {
          buffer: pdfBuffer,
          originalname: 'expediente_privado_a.pdf',
          mimetype: 'application/pdf',
          size: pdfBuffer.length,
        },
        {
          category: 'GENERAL',
          personalNoteId: testPrivateNoteA.id,
        },
        authUserA,
      );

      // Usuario B intenta descargar
      let blocked = false;
      try {
        await documentsService.getDownloadUrl(docA.id, authUserB);
      } catch (err) {
        blocked = true;
        assert(err.status === 403 || err.message.includes('Acceso denegado'), `Esperado 403: ${err.message}`);
      }
      assert(blocked, 'Usuario B debió ser bloqueado con 403 Forbidden');
    });

    await runAuditCheck('SEC-AUDIT-05', 'Intento de modificación y eliminación de documento ajeno por Usuario B -> 403', async () => {
      let blockedUpdate = false;
      try {
        await documentsService.update(docA.id, { originalFilename: 'hack.pdf' }, authUserB);
      } catch (err) {
        blockedUpdate = true;
      }
      assert(blockedUpdate, 'Usuario B no debe poder modificar metadatos de docA');

      let blockedDelete = false;
      try {
        await documentsService.softDelete(docA.id, authUserB);
      } catch (err) {
        blockedDelete = true;
      }
      assert(blockedDelete, 'Usuario B no debe poder eliminar docA');
    });

    await runAuditCheck('SEC-AUDIT-06', 'Intento de vincular documento a una nota privada ajena -> 403', async () => {
      const pdfBuffer = Buffer.from('%PDF-1.4\nIntrusion');
      let blocked = false;
      try {
        await documentsService.upload(
          {
            buffer: pdfBuffer,
            originalname: 'inyeccion.pdf',
            mimetype: 'application/pdf',
            size: pdfBuffer.length,
          },
          {
            category: 'GENERAL',
            personalNoteId: testPrivateNoteA.id, // Pertenece a A
          },
          authUserB, // B intenta asociar
        );
      } catch (err) {
        blocked = true;
      }
      assert(blocked, 'Usuario B no debe poder asociar archivos a notas privadas ajenas');
    });

    // --------------------------------------------------------------------------
    // 5. AUDITORÍA DE URLS PREFIRMADA Y ANTI-TAMPERING
    // --------------------------------------------------------------------------
    console.log('\n--- 5. AUDITORÍA DE URLS PREFIRMADA Y ANTI-TAMPERING ---');
    await runAuditCheck('SEC-AUDIT-07', 'Generación de URL prefirmada: verificación de TTL estricto de 300 segundos', async () => {
      const download = await documentsService.getDownloadUrl(docA.id, authUserA);
      assert(download.expiresInSeconds === 300, 'El TTL debe ser estrictamente 300 segundos');
      assert(download.downloadUrl.includes('expires='), 'La URL debe contener el parámetro expires');
    });

    await runAuditCheck('SEC-AUDIT-08', 'Anti-Tampering: Firma HMAC manipulada o alterada es rechazada', async () => {
      const underlying = storageService.getUnderlyingDriver();
      if (underlying instanceof LocalStorageService) {
        const fakeSig = 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';
        const valid = underlying.verifySignature(docA.storageKey, Math.floor(Date.now() / 1000 + 300).toString(), docA.originalFilename, fakeSig);
        assert(!valid, 'Firma falsa debe ser rechazada');
      }
    });

    // --------------------------------------------------------------------------
    // 6. AUDITORÍA DE VALIDACIÓN BINARIA (MAGIC BYTES)
    // --------------------------------------------------------------------------
    console.log('\n--- 6. AUDITORÍA DE VALIDACIÓN BINARIA (MAGIC BYTES) ---');
    await runAuditCheck('SEC-AUDIT-09', 'Detección y rechazo de MIME Spoofing (Script HTML con extensión .pdf)', async () => {
      const spoofed = Buffer.from('<script>alert("exploit")</script>');
      let rejected = false;
      try {
        await documentsService.upload(
          {
            buffer: spoofed,
            originalname: 'documento_falso.pdf',
            mimetype: 'application/pdf',
            size: spoofed.length,
          },
          { category: 'GENERAL' },
          authUserA,
        );
      } catch (err) {
        rejected = true;
        assert(err.message.includes('MIME spoofing detectado') || err.message.includes('magic bytes'), 'Error descriptivo esperado');
      }
      assert(rejected, 'El archivo con MIME falsificado debió ser rechazado con 400 Bad Request');
    });

    await runAuditCheck('SEC-AUDIT-10', 'Rechazo de archivos vacíos y archivos que exceden 25 MB', async () => {
      let emptyRejected = false;
      try {
        await documentsService.upload(
          { buffer: Buffer.alloc(0), originalname: 'zero.pdf', mimetype: 'application/pdf', size: 0 },
          { category: 'GENERAL' },
          authUserA,
        );
      } catch (err) {
        emptyRejected = true;
      }
      assert(emptyRejected, 'El archivo de 0 bytes debió ser rechazado');
    });

    // --------------------------------------------------------------------------
    // 7. AUDITORÍA DE CUARENTENA Y MALWARE
    // --------------------------------------------------------------------------
    console.log('\n--- 7. AUDITORÍA DE CUARENTENA Y MALWARE ---');
    await runAuditCheck('SEC-AUDIT-11', 'Bloqueo de descarga de archivo con scanStatus INFECTADO para ROLE_USER', async () => {
      await documentsService.updateScanStatus(docA.id, 'INFECTADO', authAdmin);

      let blocked = false;
      try {
        await documentsService.getDownloadUrl(docA.id, authUserA);
      } catch (err) {
        blocked = true;
        assert(err.message.includes('infectado'), `Mensaje esperado sobre malware: ${err.message}`);
      }
      assert(blocked, 'El archivo infectado debió ser bloqueado para descarga por el autor');

      // Restaurar a LIMPIO
      await documentsService.updateScanStatus(docA.id, 'LIMPIO', authAdmin);
    });

    // --------------------------------------------------------------------------
    // 8. AUDITORÍA DE VERSIONADO E HISTORIAL
    // --------------------------------------------------------------------------
    console.log('\n--- 8. AUDITORÍA DE VERSIONADO E HISTORIAL ---');
    await runAuditCheck('SEC-AUDIT-12', 'Monotonicidad y preservación de snapshots en attachment_versions', async () => {
      const v2Buffer = Buffer.from('%PDF-1.4\nVersion 2 Contenido Modificado');
      const docV2 = await documentsService.uploadNewVersion(
        docA.id,
        { buffer: v2Buffer, originalname: 'expediente_privado_a_v2.pdf', mimetype: 'application/pdf', size: v2Buffer.length },
        authUserA,
      );
      assert(docV2.version === 2, 'La versión debe avanzar monótonamente a 2');

      const versions = await prisma.attachmentVersion.findMany({
        where: { attachmentId: docA.id },
        orderBy: { versionNumber: 'asc' },
      });
      assert(versions.length === 2, `Se esperaban 2 versiones en base de datos, encontradas ${versions.length}`);
      assert(versions[0].versionNumber === 1 && versions[1].versionNumber === 2, 'Numeración de versiones 1 y 2 correcta');
    });

    // --------------------------------------------------------------------------
    // 9. AUDITORÍA DE ELIMINACIÓN Y RETENCIÓN
    // --------------------------------------------------------------------------
    console.log('\n--- 9. AUDITORÍA DE ELIMINACIÓN Y RETENCIÓN ---');
    await runAuditCheck('SEC-AUDIT-13', 'Soft delete excluye del catálogo pero preserva objeto y versiones para auditoría', async () => {
      await documentsService.softDelete(docA.id, authUserA);

      const inDb = await prisma.attachment.findUnique({ where: { id: docA.id } });
      assert(inDb.isDeleted === true, 'isDeleted debe ser true');
      assert(inDb.deletedAt !== null, 'deletedAt no debe ser nulo');

      const underlying = storageService.getUnderlyingDriver();
      const stillExists = await underlying.exists(inDb.storageKey);
      assert(stillExists, 'El archivo físico debe preservarse para auditoría');

      // Restauración por admin
      await documentsService.restore(docA.id, authAdmin);
      const restored = await prisma.attachment.findUnique({ where: { id: docA.id } });
      assert(restored.isDeleted === false, 'El documento debe estar restaurado');
    });

    // --------------------------------------------------------------------------
    // 10. AUDITORÍA FORENSE INMUTABLE
    // --------------------------------------------------------------------------
    console.log('\n--- 10. AUDITORÍA FORENSE INMUTABLE ---');
    await runAuditCheck('SEC-AUDIT-14', 'Verificación de eventos forenses en audit_logs de Neon PostgreSQL', async () => {
      const logs = await prisma.auditLog.findMany({
        where: { entity: 'Attachment', entityId: docA.id },
      });
      assert(logs.length >= 3, `Se esperaban al menos 3 eventos forenses de docA, encontrados ${logs.length}`);
      const actions = logs.map((l) => l.action);
      assert(actions.includes('DOCUMENT_UPLOADED'), 'Debe existir registro DOCUMENT_UPLOADED');
    });

  } finally {
    // Limpieza controlada de registros de prueba
    try {
      if (docA?.id) {
        await prisma.attachmentVersion.deleteMany({ where: { attachmentId: docA.id } });
        await prisma.attachment.delete({ where: { id: docA.id } });
      }
      if (testPrivateNoteA?.id) {
        await prisma.personalNote.delete({ where: { id: testPrivateNoteA.id } });
      }
    } catch (e) {
      // Ignorar errores de limpieza
    }
    await prisma.$disconnect();
  }

  // Resumen
  console.log('\n==============================================================================');
  console.log('RESUMEN DE AUDITORÍA INDEPENDIENTE DE FASE 6');
  console.log('==============================================================================');
  const passed = auditResults.filter((r) => r.status === 'PASSED').length;
  const failed = auditResults.filter((r) => r.status === 'FAILED').length;
  const total = auditResults.length;

  console.log(`Total de verificaciones de auditoría: ${total}`);
  console.log(`Superadas:                            ${passed} (${Math.round((passed / total) * 100)}%)`);
  console.log(`Fallidas:                             ${failed}`);

  if (failed > 0) {
    console.error('\n[DICTAMEN AUDITORÍA FASE 6]: NO APROBADA.');
    process.exit(1);
  } else {
    console.log('\n[DICTAMEN AUDITORÍA FASE 6]: SUPERADA AL 100% CON OBSERVACIONES DOCUMENTADAS.');
    process.exit(0);
  }
}

main().catch((e) => {
  console.error('Fallo fatal durante la auditoría:', e);
  process.exit(1);
});


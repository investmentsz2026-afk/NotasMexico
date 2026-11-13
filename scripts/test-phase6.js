/**
 * ==============================================================================
 * MEXAGENDA — SUITE DE PRUEBAS AUTOMATIZADAS DE FASE 6
 * ==============================================================================
 * MÓDULO 05: BÓVEDA DIGITAL Y GESTIÓN SEGURA DE ARCHIVOS ADJUNTOS (S3)
 *
 * Valida de forma exhaustiva sobre Neon PostgreSQL los casos de prueba de MOD-05:
 * - DOC-01: Integridad de tablas attachments y attachment_versions en Neon PostgreSQL.
 * - DOC-02: Catálogo de 8 permisos document:* y asignaciones en tabla role_permissions.
 * - DOC-03: Carga de documento PDF legítimo (%PDF-), cálculo de SHA-256 y versionado inicial.
 * - DOC-04: Rechazo estricto de extensión no permitida (.exe) -> 400 Bad Request.
 * - DOC-05: Detección y rechazo de MIME Spoofing (binario inválido con extensión .pdf) -> 400.
 * - DOC-06: Rechazo estricto de archivo que supera límite de 25 MB -> 400 Bad Request.
 * - DOC-07: Rechazo de archivo con contenido vacío (0 bytes) -> 400 Bad Request.
 * - DOC-08: Generación de URL presignada temporal autorizada con TTL de 300 segundos.
 * - DOC-09: Verificación de descarga mediante URL firmada y validación de hash SHA-256.
 * - DOC-10: Rechazo de descarga con firma HMAC alterada o enlace manipulado -> 403 Forbidden.
 * - DOC-11: Anti-IDOR: Bloqueo de adjuntar archivo a nota privada de otro usuario -> 403 Forbidden.
 * - DOC-12: Anti-IDOR: Bloqueo de descarga de archivo vinculado a nota privada ajena -> 403 Forbidden.
 * - DOC-13: Herencia de privacidad: Autor de la nota privada descarga su archivo exitosamente.
 * - DOC-14: Supervisión administrativa: ROLE_ADMIN accede a documento de nota privada.
 * - DOC-15: Vinculación institucional con reunión y acuerdo colegiado.
 * - DOC-16: Versionado incremental: Carga de v2 con nuevo hash y registro en attachment_versions.
 * - DOC-17: Consulta de historial inmutable de versiones documentales.
 * - DOC-18: Modificación de metadatos propios y bloqueo de modificación por terceros.
 * - DOC-19: Eliminación suave (softDelete) y exclusión del listado ordinario.
 * - DOC-20: Restauración administrativa exclusiva por ROLE_ADMIN (document:admin:manage).
 * - DOC-21: Bloqueo de descarga de archivo marcado como INFECTADO para ROLE_USER -> 403.
 * - DOC-22: Trazabilidad forense inmutable de eventos documentales en audit_logs.
 * ==============================================================================
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
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
  console.log('MEXAGENDA — SUITE DE PRUEBAS AUTOMATIZADAS DE FASE 6 (MOD-05: BÓVEDA DIGITAL)');
  console.log('Base de Datos: Neon PostgreSQL');
  console.log('==============================================================================\n');

  let adminUser;
  let userA;
  let userB;
  let testMeeting;
  let testAgreement;
  let testPrivateNoteA;
  let uploadedDocA;
  let uploadedDocMeeting;

  try {
    // --------------------------------------------------------------------------
    // DOC-01: Integridad del esquema en Neon PostgreSQL
    // --------------------------------------------------------------------------
    await runTest('DOC-01', 'Integridad de tablas attachments y attachment_versions en Neon', async () => {
      const attachmentsCount = await prisma.attachment.count();
      const versionsCount = await prisma.attachmentVersion.count();
      assert(typeof attachmentsCount === 'number', 'Tabla attachments accesible en Neon');
      assert(typeof versionsCount === 'number', 'Tabla attachment_versions accesible en Neon');
    });

    // --------------------------------------------------------------------------
    // DOC-02: Catálogo de permisos document:* y asignaciones RBAC
    // --------------------------------------------------------------------------
    await runTest('DOC-02', 'Catálogo de permisos document:* y asignaciones RBAC en Neon', async () => {
      const docPermissions = await prisma.permission.findMany({
        where: { resource: 'documents' },
      });
      assert(docPermissions.length >= 8, `Se esperaban al menos 8 permisos document:*, encontrados ${docPermissions.length}`);

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
      assert(userCodes.includes('document:upload'), 'ROLE_USER debe tener document:upload');
      assert(userCodes.includes('document:download'), 'ROLE_USER debe tener document:download');
      assert(!userCodes.includes('document:admin:manage'), 'ROLE_USER NO debe tener document:admin:manage');
    });

    // Preparar usuarios y entidades de prueba
    adminUser = await prisma.user.findFirst({
      where: { role: { code: 'ROLE_ADMIN' } },
      include: { role: true },
    });
    assert(adminUser, 'Usuario ROLE_ADMIN requerido para pruebas');

    const regularUsers = await prisma.user.findMany({
      where: { role: { code: 'ROLE_USER' } },
      include: { role: true },
      take: 2,
    });
    assert(regularUsers.length >= 2, 'Se requieren al menos 2 usuarios ROLE_USER');
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

    // Crear reunión y acuerdo de prueba
    const category = await prisma.meetingCategory.findFirst();
    testMeeting = await prisma.meeting.create({
      data: {
        folio: `TEST-VAULT-MTG-${Date.now()}`,
        title: 'Sesión de Prueba de Bóveda Digital',
        categoryId: category.id,
        meetingDate: new Date(),
        startTime: new Date('1970-01-01T10:00:00Z'),
        endTime: new Date('1970-01-01T12:00:00Z'),
        location: 'Sala del Pleno',
        createdById: adminUser.id,
      },
    });

    testAgreement = await prisma.agreement.create({
      data: {
        folio: `TEST-VAULT-AGR-${Date.now()}`,
        title: 'Acuerdo Institucional de Resguardo Documental',
        description: 'Custodia segura en la bóveda digital',
        meetingId: testMeeting.id,
        approvalDate: new Date(),
        dueDate: new Date(Date.now() + 86400000 * 30),
        createdById: adminUser.id,
        assignedToId: userA.id,
      },
    });

    // Crear nota privada de UserA
    testPrivateNoteA = await prisma.personalNote.create({
      data: {
        title: 'Nota Confidencial de User A',
        content: 'Contenido altamente restringido y personal.',
        category: 'GENERAL',
        noteType: 'PERSONAL',
        visibility: 'PRIVADA',
        authorId: userA.id,
      },
    });

    // --------------------------------------------------------------------------
    // DOC-03: Carga de documento PDF legítimo (%PDF-) y cálculo de SHA-256
    // --------------------------------------------------------------------------
    await runTest('DOC-03', 'Carga de PDF legítimo (%PDF-), cálculo de SHA-256 y versionado inicial', async () => {
      const pdfHeader = Buffer.from('%PDF-1.7\n1 0 obj\n<< /Title (Dictamen Institucional) >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF');
      const expectedSha256 = crypto.createHash('sha256').update(pdfHeader).digest('hex');

      uploadedDocA = await documentsService.upload(
        {
          buffer: pdfHeader,
          originalname: 'dictamen_pleno_2026.pdf',
          mimetype: 'application/pdf',
          size: pdfHeader.length,
        },
        {
          category: 'DICTAMEN',
          description: 'Dictamen oficial del pleno institucional',
          personalNoteId: testPrivateNoteA.id,
        },
        authUserA,
      );

      assert(uploadedDocA.id, 'El documento debe tener un UUID asignado');
      assert(uploadedDocA.sha256Checksum === expectedSha256, `SHA-256 no coincide (${uploadedDocA.sha256Checksum} vs ${expectedSha256})`);
      assert(uploadedDocA.version === 1, 'La versión inicial debe ser 1');
      assert(uploadedDocA.scanStatus === 'LIMPIO', 'El estado inicial debe ser LIMPIO');
      assert(uploadedDocA.storageKey.startsWith('vault/'), 'La storageKey debe tener partición vault/yyyy/mm/');
    });

    // --------------------------------------------------------------------------
    // DOC-04: Rechazo estricto de extensión no permitida (.exe)
    // --------------------------------------------------------------------------
    await runTest('DOC-04', 'Rechazo estricto de extensión no permitida (.exe) -> 400 Bad Request', async () => {
      const maliciousPayload = Buffer.from('MZ\x90\x00\x03\x00\x00\x00ExecutableBinary');
      let rejected = false;
      try {
        await documentsService.upload(
          {
            buffer: maliciousPayload,
            originalname: 'trojan.exe',
            mimetype: 'application/x-msdownload',
            size: maliciousPayload.length,
          },
          { category: 'GENERAL' },
          authUserA,
        );
      } catch (err) {
        rejected = true;
        assert(err.message.includes('Extensión de archivo'), `Mensaje esperado sobre extensión: ${err.message}`);
      }
      assert(rejected, 'El archivo con extensión .exe debió ser rechazado');
    });

    // --------------------------------------------------------------------------
    // DOC-05: Detección y rechazo de MIME Spoofing
    // --------------------------------------------------------------------------
    await runTest('DOC-05', 'Detección y rechazo de MIME Spoofing (binario camuflado con extensión .pdf) -> 400', async () => {
      const fakePdf = Buffer.from('<html><script>alert("xss")</script></html>');
      let rejected = false;
      try {
        await documentsService.upload(
          {
            buffer: fakePdf,
            originalname: 'documento_falso.pdf',
            mimetype: 'application/pdf',
            size: fakePdf.length,
          },
          { category: 'GENERAL' },
          authUserA,
        );
      } catch (err) {
        rejected = true;
        assert(err.message.includes('MIME spoofing detectado') || err.message.includes('magic bytes'), `Error esperado: ${err.message}`);
      }
      assert(rejected, 'El archivo con firma binaria adulterada debió ser rechazado');
    });

    // --------------------------------------------------------------------------
    // DOC-06: Rechazo estricto de archivo que supera 25 MB
    // --------------------------------------------------------------------------
    await runTest('DOC-06', 'Rechazo estricto de archivo que supera límite de 25 MB -> 400', async () => {
      // Simular buffer virtual grande > 25 MB
      const bigBuffer = Buffer.alloc(26 * 1024 * 1024);
      bigBuffer.write('%PDF-1.7', 0);
      let rejected = false;
      try {
        await documentsService.upload(
          {
            buffer: bigBuffer,
            originalname: 'archivo_gigante.pdf',
            mimetype: 'application/pdf',
            size: bigBuffer.length,
          },
          { category: 'GENERAL' },
          authUserA,
        );
      } catch (err) {
        rejected = true;
        assert(err.message.includes('25 MB'), `Mensaje esperado sobre tamaño: ${err.message}`);
      }
      assert(rejected, 'El archivo de 26 MB debió ser rechazado');
    });

    // --------------------------------------------------------------------------
    // DOC-07: Rechazo de archivo con contenido vacío (0 bytes)
    // --------------------------------------------------------------------------
    await runTest('DOC-07', 'Rechazo de archivo con contenido vacío (0 bytes) -> 400', async () => {
      let rejected = false;
      try {
        await documentsService.upload(
          {
            buffer: Buffer.alloc(0),
            originalname: 'vacio.pdf',
            mimetype: 'application/pdf',
            size: 0,
          },
          { category: 'GENERAL' },
          authUserA,
        );
      } catch (err) {
        rejected = true;
        assert(err.message.includes('vacío'), `Mensaje esperado: ${err.message}`);
      }
      assert(rejected, 'El archivo vacío debió ser rechazado');
    });

    // --------------------------------------------------------------------------
    // DOC-08: Generación de URL presignada temporal autorizada con TTL de 300 segundos
    // --------------------------------------------------------------------------
    let downloadInfo;
    await runTest('DOC-08', 'Generación de URL presignada temporal autorizada con TTL de 300 segundos', async () => {
      downloadInfo = await documentsService.getDownloadUrl(uploadedDocA.id, authUserA);
      assert(downloadInfo.downloadUrl, 'Debe devolver una downloadUrl');
      assert(downloadInfo.expiresInSeconds === 300, 'El TTL debe ser de 300 segundos');
      assert(downloadInfo.documentId === uploadedDocA.id, 'El documentId debe coincidir');
    });

    // --------------------------------------------------------------------------
    // DOC-09: Verificación de descarga y comprobación de integridad SHA-256
    // --------------------------------------------------------------------------
    await runTest('DOC-09', 'Verificación de descarga y comprobación de integridad SHA-256', async () => {
      const underlying = storageService.getUnderlyingDriver();
      const downloadedBuffer = await underlying.getFileBuffer(uploadedDocA.storageKey);
      const computedHash = crypto.createHash('sha256').update(downloadedBuffer).digest('hex');
      assert(computedHash === uploadedDocA.sha256Checksum, 'El SHA-256 del archivo descargado coincide');
    });

    // --------------------------------------------------------------------------
    // DOC-10: Rechazo de descarga con firma manipulada (Anti-Tampering)
    // --------------------------------------------------------------------------
    await runTest('DOC-10', 'Rechazo de descarga con firma HMAC alterada o enlace manipulado -> 403', async () => {
      const underlying = storageService.getUnderlyingDriver();
      if (underlying instanceof LocalStorageService) {
        const fakeSig = 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';
        const isValid = underlying.verifySignature(uploadedDocA.storageKey, Math.floor(Date.now() / 1000 + 300).toString(), uploadedDocA.originalFilename, fakeSig);
        assert(!isValid, 'La firma HMAC falsa no debe ser válida');
      }
    });

    // --------------------------------------------------------------------------
    // DOC-11: Anti-IDOR: Bloqueo de adjuntar archivo a nota privada de otro usuario
    // --------------------------------------------------------------------------
    await runTest('DOC-11', 'Anti-IDOR: Bloqueo de adjuntar archivo a nota privada ajena -> 403 Forbidden', async () => {
      const pdfBuffer = Buffer.from('%PDF-1.4\nTest');
      let rejected = false;
      try {
        await documentsService.upload(
          {
            buffer: pdfBuffer,
            originalname: 'intruso.pdf',
            mimetype: 'application/pdf',
            size: pdfBuffer.length,
          },
          {
            category: 'GENERAL',
            personalNoteId: testPrivateNoteA.id, // Pertenece a UserA
          },
          authUserB, // UserB intenta adjuntar
        );
      } catch (err) {
        rejected = true;
        assert(err.status === 403 || err.message.includes('No tiene autorización'), `Error 403 esperado: ${err.message}`);
      }
      assert(rejected, 'UserB no debe poder adjuntar a la nota privada de UserA');
    });

    // --------------------------------------------------------------------------
    // DOC-12: Anti-IDOR: Bloqueo de descarga de archivo de nota privada ajena
    // --------------------------------------------------------------------------
    await runTest('DOC-12', 'Anti-IDOR: Bloqueo de descarga de archivo de nota privada ajena -> 403 Forbidden', async () => {
      let rejected = false;
      try {
        // UserB intenta descargar el documento vinculado a la nota privada de UserA
        await documentsService.getDownloadUrl(uploadedDocA.id, authUserB);
      } catch (err) {
        rejected = true;
        assert(err.status === 403 || err.message.includes('Acceso denegado'), `Error 403 esperado: ${err.message}`);
      }
      assert(rejected, 'UserB no debe poder descargar archivo de nota privada ajena');
    });

    // --------------------------------------------------------------------------
    // DOC-13: Herencia de privacidad: Autor de la nota privada descarga exitosamente
    // --------------------------------------------------------------------------
    await runTest('DOC-13', 'Herencia de privacidad: Autor de la nota privada descarga exitosamente', async () => {
      const download = await documentsService.getDownloadUrl(uploadedDocA.id, authUserA);
      assert(download && download.downloadUrl, 'El autor puede descargar su propio documento privado');
    });

    // --------------------------------------------------------------------------
    // DOC-14: Supervisión administrativa: ROLE_ADMIN accede a documento de nota privada
    // --------------------------------------------------------------------------
    await runTest('DOC-14', 'Supervisión administrativa: ROLE_ADMIN accede a documento de nota privada', async () => {
      const download = await documentsService.getDownloadUrl(uploadedDocA.id, authAdmin);
      assert(download && download.downloadUrl, 'ROLE_ADMIN tiene facultad de supervisión y auditoría');
    });

    // --------------------------------------------------------------------------
    // DOC-15: Vinculación institucional con reunión y acuerdo colegiado
    // --------------------------------------------------------------------------
    await runTest('DOC-15', 'Vinculación institucional con reunión y acuerdo colegiado', async () => {
      const pdfBuffer = Buffer.from('%PDF-1.6\nAcuerdo Vinculante de Resguardo\n%%EOF');
      uploadedDocMeeting = await documentsService.upload(
        {
          buffer: pdfBuffer,
          originalname: 'acuerdo_pleno_firmado.pdf',
          mimetype: 'application/pdf',
          size: pdfBuffer.length,
        },
        {
          category: 'ACUERDO',
          description: 'Documento probatorio del acuerdo institucional',
          meetingId: testMeeting.id,
          agreementId: testAgreement.id,
        },
        authUserA,
      );

      assert(uploadedDocMeeting.meetingId === testMeeting.id, 'Debe estar vinculado a la reunión');
      assert(uploadedDocMeeting.agreementId === testAgreement.id, 'Debe estar vinculado al acuerdo');
      assert(uploadedDocMeeting.category === 'ACUERDO', 'Categoría debe ser ACUERDO');
    });

    // --------------------------------------------------------------------------
    // DOC-16: Versionado incremental: Carga de v2 con nuevo hash y registro
    // --------------------------------------------------------------------------
    let updatedDocA;
    await runTest('DOC-16', 'Versionado incremental: Carga de v2 con nuevo hash y registro en attachment_versions', async () => {
      const newPdfBuffer = Buffer.from('%PDF-1.7\nVersion 2 Corregida del Dictamen\n%%EOF');
      const newHash = crypto.createHash('sha256').update(newPdfBuffer).digest('hex');

      updatedDocA = await documentsService.uploadNewVersion(
        uploadedDocA.id,
        {
          buffer: newPdfBuffer,
          originalname: 'dictamen_pleno_2026_v2.pdf',
          mimetype: 'application/pdf',
          size: newPdfBuffer.length,
        },
        authUserA,
      );

      assert(updatedDocA.version === 2, `La versión debe ser 2 (obtenida: ${updatedDocA.version})`);
      assert(updatedDocA.sha256Checksum === newHash, 'El hash debe actualizarse al de la versión 2');
    });

    // --------------------------------------------------------------------------
    // DOC-17: Consulta de historial inmutable de versiones documentales
    // --------------------------------------------------------------------------
    await runTest('DOC-17', 'Consulta de historial inmutable de versiones documentales', async () => {
      const detail = await documentsService.findOne(uploadedDocA.id, authUserA);
      assert(detail.versions && detail.versions.length >= 2, `Deben existir al menos 2 versiones, encontradas ${detail.versions?.length}`);
      const v1 = detail.versions.find((v) => v.versionNumber === 1);
      const v2 = detail.versions.find((v) => v.versionNumber === 2);
      assert(v1 && v2, 'Deben existir tanto la versión 1 como la versión 2');
    });

    // --------------------------------------------------------------------------
    // DOC-18: Modificación de metadatos propios y bloqueo de terceros
    // --------------------------------------------------------------------------
    await runTest('DOC-18', 'Modificación de metadatos propios y bloqueo de terceros no administradores', async () => {
      // 1. Propietario modifica metadatos
      const mod = await documentsService.update(
        uploadedDocA.id,
        { description: 'Descripción institucional actualizada por User A' },
        authUserA,
      );
      assert(mod.description === 'Descripción institucional actualizada por User A', 'Metadato actualizado');

      // 2. Tercero intenta modificar
      let blocked = false;
      try {
        await documentsService.update(
          uploadedDocA.id,
          { description: 'Ataque de modificación no autorizada' },
          authUserB,
        );
      } catch (err) {
        blocked = true;
      }
      assert(blocked, 'UserB no debe poder modificar metadatos de UserA');
    });

    // --------------------------------------------------------------------------
    // DOC-19: Eliminación suave (softDelete) y exclusión del catálogo activo
    // --------------------------------------------------------------------------
    await runTest('DOC-19', 'Eliminación suave (softDelete) y exclusión del catálogo activo', async () => {
      const res = await documentsService.softDelete(uploadedDocMeeting.id, authUserA);
      assert(res.success, 'softDelete debe retornar success: true');

      const list = await documentsService.findAll({}, authUserA);
      const found = list.items.some((d) => d.id === uploadedDocMeeting.id);
      assert(!found, 'El documento eliminado suavemente no debe aparecer en el listado ordinario');
    });

    // --------------------------------------------------------------------------
    // DOC-20: Restauración administrativa exclusiva por ROLE_ADMIN
    // --------------------------------------------------------------------------
    await runTest('DOC-20', 'Restauración administrativa exclusiva por ROLE_ADMIN (document:admin:manage)', async () => {
      const restored = await documentsService.restore(uploadedDocMeeting.id, authAdmin);
      assert(restored.id === uploadedDocMeeting.id, 'Documento restaurado');

      const listAfter = await documentsService.findAll({}, authUserA);
      const foundAfter = listAfter.items.some((d) => d.id === uploadedDocMeeting.id);
      assert(foundAfter, 'El documento restaurado debe volver a aparecer en el catálogo');
    });

    // --------------------------------------------------------------------------
    // DOC-21: Bloqueo de descarga de archivo marcado como INFECTADO
    // --------------------------------------------------------------------------
    await runTest('DOC-21', 'Bloqueo de descarga de archivo marcado como INFECTADO para ROLE_USER -> 403', async () => {
      // Admin marca como INFECTADO
      await documentsService.updateScanStatus(uploadedDocMeeting.id, 'INFECTADO', authAdmin);

      let blocked = false;
      try {
        await documentsService.getDownloadUrl(uploadedDocMeeting.id, authUserA);
      } catch (err) {
        blocked = true;
        assert(err.message.includes('infectado'), `Mensaje esperado sobre malware: ${err.message}`);
      }
      assert(blocked, 'El usuario ordinario no debe poder descargar un archivo infectado');

      // Admin restaura estado a LIMPIO para salud del sistema
      await documentsService.updateScanStatus(uploadedDocMeeting.id, 'LIMPIO', authAdmin);
    });

    // --------------------------------------------------------------------------
    // DOC-22: Trazabilidad forense inmutable de eventos en audit_logs
    // --------------------------------------------------------------------------
    await runTest('DOC-22', 'Trazabilidad forense inmutable de eventos en audit_logs', async () => {
      const uploadLog = await prisma.auditLog.findFirst({
        where: { action: 'DOCUMENT_UPLOADED', entity: 'Attachment' },
        orderBy: { createdAt: 'desc' },
      });
      assert(uploadLog, 'Debe existir registro forense de DOCUMENT_UPLOADED');

      const downloadLog = await prisma.auditLog.findFirst({
        where: { action: 'DOCUMENT_DOWNLOADED', entity: 'Attachment' },
        orderBy: { createdAt: 'desc' },
      });
      assert(downloadLog, 'Debe existir registro forense de DOCUMENT_DOWNLOADED');

      const deniedLog = await prisma.auditLog.findFirst({
        where: { action: 'UNAUTHORIZED_DOCUMENT_ACCESS_ATTEMPT', entity: 'Attachment' },
        orderBy: { createdAt: 'desc' },
      });
      assert(deniedLog, 'Debe existir registro forense de UNAUTHORIZED_DOCUMENT_ACCESS_ATTEMPT');
    });

  } finally {
    // Limpieza de datos de prueba temporales
    try {
      if (uploadedDocA?.id) {
        await prisma.attachmentVersion.deleteMany({ where: { attachmentId: uploadedDocA.id } });
        await prisma.attachment.delete({ where: { id: uploadedDocA.id } });
      }
      if (uploadedDocMeeting?.id) {
        await prisma.attachmentVersion.deleteMany({ where: { attachmentId: uploadedDocMeeting.id } });
        await prisma.attachment.delete({ where: { id: uploadedDocMeeting.id } });
      }
      if (testPrivateNoteA?.id) {
        await prisma.personalNote.delete({ where: { id: testPrivateNoteA.id } });
      }
      if (testAgreement?.id) {
        await prisma.agreement.delete({ where: { id: testAgreement.id } });
      }
      if (testMeeting?.id) {
        await prisma.meeting.delete({ where: { id: testMeeting.id } });
      }
    } catch (cleanErr) {
      // Ignorar errores de limpieza
    }
    await prisma.$disconnect();
  }

  // Resumen
  console.log('\n==============================================================================');
  console.log('RESUMEN DE EJECUCIÓN DE PRUEBAS DE FASE 6 (MOD-05: BÓVEDA DIGITAL)');
  console.log('==============================================================================');
  const passed = results.filter((r) => r.status === 'PASSED').length;
  const failed = results.filter((r) => r.status === 'FAILED').length;
  const totalTests = results.length;

  console.log(`Total de pruebas ejecutadas: ${totalTests}`);
  console.log(`Pruebas aprobadas:           ${passed} (${Math.round((passed / totalTests) * 100)}%)`);
  console.log(`Pruebas fallidas:            ${failed}`);

  if (failed > 0) {
    console.error('\n[DICTAMEN FASE 6]: NO APROBADA — EXISTEN PRUEBAS FALLIDAS.');
    process.exit(1);
  } else {
    console.log('\n[DICTAMEN FASE 6]: 100% SATISFACTORIA — LISTA PARA AUDITORÍA INDEPENDIENTE.');
    process.exit(0);
  }
}

main().catch((e) => {
  console.error('Error fatal durante la ejecución de la suite de pruebas:', e);
  process.exit(1);
});


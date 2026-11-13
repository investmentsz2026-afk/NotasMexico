/**
 * ==============================================================================
 * MEXAGENDA — SCRIPT DE INICIALIZACIÓN ADMINISTRATIVA Y RBAC
 * ==============================================================================
 * Este script inicializa de manera idempotente:
 * 1. Los roles del sistema (ROLE_ADMIN, ROLE_USER).
 * 2. El catálogo de permisos de control de acceso granular (RBAC).
 * 3. Las asignaciones de permisos a roles (role_permissions).
 * 4. El catálogo inicial de categorías de reuniones institucionales.
 * 5. El usuario Administrador Institucional inicial (si no existe aún).
 * ==============================================================================
 */

const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const argon2 = require('../apps/backend/node_modules/@node-rs/argon2');

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

const PERMISSIONS = [
  { code: 'user:read', resource: 'users', action: 'read', description: 'Consultar directorio de usuarios institucionales' },
  { code: 'user:create', resource: 'users', action: 'create', description: 'Crear nuevos usuarios institucionales' },
  { code: 'user:update', resource: 'users', action: 'update', description: 'Modificar datos o estados de usuarios' },
  { code: 'user:delete', resource: 'users', action: 'delete', description: 'Desactivar o suspender usuarios' },
  { code: 'meeting:read', resource: 'meetings', action: 'read', description: 'Consultar agenda y sesiones convocadas' },
  { code: 'meeting:create', resource: 'meetings', action: 'create', description: 'Convocar nuevas reuniones institucionales' },
  { code: 'meeting:update', resource: 'meetings', action: 'update', description: 'Modificar datos generales y agenda' },
  { code: 'meeting:delete', resource: 'meetings', action: 'delete', description: 'Cancelar o archivar reuniones' },
  { code: 'meeting:attendance', resource: 'meetings', action: 'attendance', description: 'Registrar y certificar asistencia de integrantes' },
  { code: 'meeting:minutes:approve', resource: 'meetings', action: 'minutes_approve', description: 'Aprobar formalmente actas institucionales' },
  { code: 'meeting:category:manage', resource: 'meeting_categories', action: 'admin', description: 'Crear y configurar categorías de reuniones' },
  { code: 'agreement:read', resource: 'agreements', action: 'read', description: 'Consultar acuerdos institucionales' },
  { code: 'agreement:create', resource: 'agreements', action: 'create', description: 'Registrar nuevos acuerdos institucionales' },
  { code: 'agreement:update', resource: 'agreements', action: 'update', description: 'Actualizar datos generales de acuerdos' },
  { code: 'agreement:assign', resource: 'agreements', action: 'assign', description: 'Asignar y reasignar responsables y colaboradores' },
  { code: 'agreement:progress:create', resource: 'agreements', action: 'progress_create', description: 'Registrar avances e hitos de cumplimiento' },
  { code: 'agreement:progress:read', resource: 'agreements', action: 'progress_read', description: 'Consultar bitácora de avances de acuerdos' },
  { code: 'agreement:complete', resource: 'agreements', action: 'complete', description: 'Declarar y certificar cumplimiento del acuerdo' },
  { code: 'agreement:suspend', resource: 'agreements', action: 'suspend', description: 'Suspender temporalmente ejecución con justificación' },
  { code: 'agreement:cancel', resource: 'agreements', action: 'cancel', description: 'Cancelar formalmente el acuerdo con justificación' },
  { code: 'agreement:reactivate', resource: 'agreements', action: 'reactivate', description: 'Reactivar acuerdos suspendidos o cancelados' },
  { code: 'agreement:history:read', resource: 'agreements', action: 'history_read', description: 'Consultar historial de auditoría y trazabilidad' },
  { code: 'agreement:report:read', resource: 'agreements', action: 'report_read', description: 'Consultar tableros y reportes ejecutivos de acuerdos' },
  { code: 'agreement:manage', resource: 'agreements', action: 'manage', description: 'Administración integral de acuerdos institucionales' },
  { code: 'note:read', resource: 'personal_notes', action: 'read', description: 'Consultar catálogo de anotaciones y notas institucionales' },
  { code: 'note:create', resource: 'personal_notes', action: 'create', description: 'Redactar y registrar anotaciones personales o notas de sesión' },
  { code: 'note:update_own', resource: 'personal_notes', action: 'update_own', description: 'Modificar exclusivamente anotaciones propias' },
  { code: 'note:delete_own', resource: 'personal_notes', action: 'delete_own', description: 'Archivar o eliminar anotaciones propias' },
  { code: 'note:history:read', resource: 'personal_notes', action: 'history_read', description: 'Consultar historial de versiones de anotaciones' },
  { code: 'note:visibility:manage', resource: 'personal_notes', action: 'visibility_manage', description: 'Configurar visibilidad de notas institucionales' },
  { code: 'note:override_any', resource: 'personal_notes', action: 'override_any', description: 'Intervención administrativa extraordinaria justificada en notas' },
  { code: 'note:admin:read', resource: 'personal_notes', action: 'admin_read', description: 'Auditoría administrativa de notas institucionales' },
  { code: 'document:read', resource: 'documents', action: 'read', description: 'Consultar y listar documentos institucionales autorizados' },
  { code: 'document:upload', resource: 'documents', action: 'upload', description: 'Cargar archivos adjuntos a entidades autorizadas' },
  { code: 'document:download', resource: 'documents', action: 'download', description: 'Descargar archivos mediante URL presignada autorizada' },
  { code: 'document:update_own', resource: 'documents', action: 'update_own', description: 'Modificar metadatos de documentos propios' },
  { code: 'document:delete_own', resource: 'documents', action: 'delete_own', description: 'Eliminar o archivar documentos propios' },
  { code: 'document:history:read', resource: 'documents', action: 'history_read', description: 'Consultar versiones e historial de documentos' },
  { code: 'document:admin:read', resource: 'documents', action: 'admin_read', description: 'Auditoría y visualización de todos los documentos institucionales' },
  { code: 'document:admin:manage', resource: 'documents', action: 'admin_manage', description: 'Gestión administrativa total de la bóveda documental' },
  { code: 'notification:read', resource: 'notifications', action: 'read', description: 'Consultar notificaciones institucionales propias' },
  { code: 'notification:update', resource: 'notifications', action: 'update', description: 'Marcar notificaciones como leídas y configurar preferencias' },
  { code: 'notification:delete', resource: 'notifications', action: 'delete', description: 'Descartar o eliminar notificaciones propias' },
  { code: 'notification:admin:manage', resource: 'notifications', action: 'admin_manage', description: 'Gestión y auditoría administrativa de notificaciones y entregas' },
  { code: 'attachment:read', resource: 'attachments', action: 'read', description: 'Descargar anexos y actas' },
  { code: 'attachment:upload', resource: 'attachments', action: 'upload', description: 'Subir documentos a la bóveda' },
  { code: 'audit:read', resource: 'audit_logs', action: 'read', description: 'Consultar bitácora de auditoría forense' },
  { code: 'system:settings', resource: 'system_settings', action: 'admin', description: 'Configuraciones globales de la institución' },
  { code: 'report:view:executive', resource: 'reports', action: 'view_executive', description: 'Consultar métricas y tablero ejecutivo institucional' },
  { code: 'report:view:operational', resource: 'reports', action: 'view_operational', description: 'Consultar seguimiento operacional de acuerdos y gobernanza' },
  { code: 'report:export', resource: 'reports', action: 'export', description: 'Exportar reportes institucionales en formatos tabulares' },
];

const DEFAULT_CATEGORIES = [
  { name: 'Sesión Ordinaria', code: 'ORDINARIA', description: 'Sesiones de calendario regular del cuerpo colegiado', colorHex: '#1E3A8A', displayOrder: 1 },
  { name: 'Sesión Extraordinaria', code: 'EXTRAORDINARIA', description: 'Sesiones convocadas con carácter urgente o imprevisto', colorHex: '#B45309', displayOrder: 2 },
  { name: 'Sesión Solemne', code: 'SOLEMNE', description: 'Sesiones conmemorativas, de toma de protesta o actos protocolares', colorHex: '#701A75', displayOrder: 3 },
  { name: 'Reunión de Trabajo', code: 'TRABAJO', description: 'Mesas técnicas de análisis y preparación de dictámenes', colorHex: '#0F766E', displayOrder: 4 },
  { name: 'Comité Especial', code: 'COMITE', description: 'Reuniones de subcomisiones temáticas y grupos de seguimiento', colorHex: '#334155', displayOrder: 5 },
];

async function main() {
  console.log('--- MEXAGENDA: BOOTSTRAP ADMINISTRATIVO Y RBAC (FASE 3) ---');
  console.log('Conectando a Neon PostgreSQL...');

  try {
    // 1. Roles del Sistema
    console.log('[1/5] Verificando roles del sistema...');
    const adminRole = await prisma.role.upsert({
      where: { code: 'ROLE_ADMIN' },
      create: {
        name: 'Administrador Institucional',
        code: 'ROLE_ADMIN',
        description: 'Control administrativo total, gestión de identidades y auditoría',
        isSystem: true,
      },
      update: {},
    });

    const userRole = await prisma.role.upsert({
      where: { code: 'ROLE_USER' },
      create: {
        name: 'Usuario Institucional',
        code: 'ROLE_USER',
        description: 'Participación en reuniones, acuerdos y gestión de anotaciones personales',
        isSystem: true,
      },
      update: {},
    });
    console.log('  -> Roles ROLE_ADMIN y ROLE_USER verificados.');

    // 2. Permisos del Sistema
    console.log('[2/5] Verificando catálogo de permisos institucionales...');
    const createdPermissions = [];
    for (const perm of PERMISSIONS) {
      const p = await prisma.permission.upsert({
        where: { code: perm.code },
        create: perm,
        update: { description: perm.description },
      });
      createdPermissions.push(p);
    }
    console.log(`  -> ${createdPermissions.length} permisos verificados.`);

    // 3. Asignación de Permisos a Roles (RBAC)
    console.log('[3/5] Asignando permisos a roles...');
    for (const p of createdPermissions) {
      // ROLE_ADMIN tiene todos los permisos
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: adminRole.id,
            permissionId: p.id,
          },
        },
        create: {
          roleId: adminRole.id,
          permissionId: p.id,
        },
        update: {},
      });

      // ROLE_USER tiene permisos operativos estándar
      if ([
        'meeting:read', 'meeting:attendance',
        'agreement:read', 'agreement:progress:read', 'agreement:progress:create', 'agreement:history:read',
        'note:read', 'note:create', 'note:update_own', 'note:delete_own', 'note:history:read', 'note:visibility:manage',
        'document:read', 'document:upload', 'document:download', 'document:update_own', 'document:delete_own', 'document:history:read',
        'notification:read', 'notification:update', 'notification:delete',
        'attachment:read',
        'report:view:operational', 'report:export'
      ].includes(p.code)) {
        await prisma.rolePermission.upsert({
          where: {
            roleId_permissionId: {
              roleId: userRole.id,
              permissionId: p.id,
            },
          },
          create: {
            roleId: userRole.id,
            permissionId: p.id,
          },
          update: {},
        });
      }
    }
    console.log('  -> Permisos asignados correctamente a ROLE_ADMIN y ROLE_USER.');

    // 4. Categorías de Reuniones
    console.log('[4/5] Verificando catálogo de categorías institucionales...');
    for (const cat of DEFAULT_CATEGORIES) {
      await prisma.meetingCategory.upsert({
        where: { code: cat.code },
        create: {
          name: cat.name,
          code: cat.code,
          description: cat.description,
          colorHex: cat.colorHex,
          displayOrder: cat.displayOrder,
          isActive: true,
        },
        update: {
          name: cat.name,
          description: cat.description,
          colorHex: cat.colorHex,
          displayOrder: cat.displayOrder,
        },
      });
    }
    console.log(`  -> ${DEFAULT_CATEGORIES.length} categorías iniciales verificadas.`);

    // 5. Verificación y Creación del Usuario Administrador Inicial
    console.log('[5/5] Verificando existencia de usuario Administrador...');
    const adminEmail = (process.env.ADMIN_INITIAL_EMAIL || 'admin@institucion.gob.mx').toLowerCase().trim();
    const adminPassword = process.env.ADMIN_INITIAL_PASSWORD || 'ChangeMe#2026!MexAgenda';

    const existingAdmin = await prisma.user.findFirst({
      where: {
        OR: [
          { roleId: adminRole.id },
          { email: adminEmail },
        ],
      },
      include: { role: true },
    });

    if (existingAdmin) {
      console.log(`  -> Usuario Administrador ya configurado: ${existingAdmin.email} (Rol: ${existingAdmin.role.code})`);
    } else {
      console.log(`  -> Creando nuevo Administrador Inicial [${adminEmail}]...`);

      const passwordHash = await argon2.hash(adminPassword, {
        memoryCost: 65536,
        timeCost: 3,
        parallelism: 4,
        algorithm: argon2.Algorithm.Argon2id,
      });

      const newAdmin = await prisma.user.create({
        data: {
          email: adminEmail,
          passwordHash,
          firstName: 'Administrador',
          lastName: 'Institucional',
          position: 'Coordinador General de Tecnologías',
          status: 'ACTIVO',
          roleId: adminRole.id,
        },
      });

      console.log(`  -> Administrador creado exitosamente con ID: ${newAdmin.id}`);
    }

    console.log('\n======================================================');
    console.log('✓ BOOTSTRAP ADMINISTRATIVO Y RBAC COMPLETADO SATISFACTORIAMENTE');
    console.log('======================================================');
  } catch (error) {
    console.error('Error durante el bootstrap administrativo:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();

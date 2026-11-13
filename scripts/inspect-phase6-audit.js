const fs = require('fs');
const path = require('path');

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

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('=== MEXAGENDA: AUDITORÍA TÉCNICA INDEPENDIENTE FASE 6 ===\n');

  // 1. Entorno de Base de Datos y Almacenamiento
  console.log('--- 1. CONFIGURACIÓN DEL ENTORNO ---');
  const dbUrl = process.env.DATABASE_URL || '';
  const directUrl = process.env.DIRECT_URL || '';
  const nodeEnv = process.env.NODE_ENV || 'development';

  const sanitizeUrl = (url) => {
    try {
      const parsed = new URL(url);
      return `${parsed.protocol}//${parsed.username}:***@${parsed.host}${parsed.pathname}?${parsed.searchParams.toString()}`;
    } catch {
      return 'URL no válida o ausente';
    }
  };

  console.log(`NODE_ENV: ${nodeEnv}`);
  console.log(`DATABASE_URL (Sanitizada): ${sanitizeUrl(dbUrl)}`);
  console.log(`DIRECT_URL (Sanitizada):   ${sanitizeUrl(directUrl)}`);

  const s3Endpoint = process.env.S3_ENDPOINT || '(no configurado)';
  const s3Bucket = process.env.S3_BUCKET_NAME || '(no configurado)';
  const s3Region = process.env.S3_REGION || '(no configurado)';
  const hasAccessKey = !!process.env.S3_ACCESS_KEY_ID;
  const isAccessKeyPlaceholder = process.env.S3_ACCESS_KEY_ID?.includes('placeholder');
  const hasSecretKey = !!process.env.S3_SECRET_ACCESS_KEY;
  const isSecretKeyPlaceholder = process.env.S3_SECRET_ACCESS_KEY?.includes('placeholder');

  console.log(`\nConfiguración S3 detectada:`);
  console.log(`  S3_ENDPOINT:           ${s3Endpoint}`);
  console.log(`  S3_BUCKET_NAME:        ${s3Bucket}`);
  console.log(`  S3_REGION:             ${s3Region}`);
  console.log(`  S3_ACCESS_KEY_ID:      ${hasAccessKey ? (isAccessKeyPlaceholder ? 'PRESENTE (PLACEHOLDER)' : 'PRESENTE (REAL)') : 'AUSENTE'}`);
  console.log(`  S3_SECRET_ACCESS_KEY:  ${hasSecretKey ? (isSecretKeyPlaceholder ? 'PRESENTE (PLACEHOLDER)' : 'PRESENTE (REAL)') : 'AUSENTE'}`);

  // 2. Migraciones aplicadas en Neon PostgreSQL
  console.log('\n--- 2. MIGRACIONES REGISTRADAS EN NEON POSTGRESQL ---');
  try {
    const migrations = await prisma.$queryRaw`
      SELECT migration_name, finished_at, applied_steps_count
      FROM _prisma_migrations
      ORDER BY finished_at ASC;
    `;
    for (const m of migrations) {
      console.log(`  ✓ ${m.migration_name} | Aplicada: ${m.finished_at} | Pasos: ${m.applied_steps_count}`);
    }
  } catch (err) {
    console.error('Error al consultar _prisma_migrations:', err.message);
  }

  // 3. Permisos RBAC en Neon PostgreSQL
  console.log('\n--- 3. AUDITORÍA CRÍTICA DE PERMISOS RBAC EN NEON ---');
  const roles = await prisma.role.findMany({
    include: {
      permissions: {
        include: { permission: true },
      },
    },
  });

  for (const r of roles) {
    console.log(`\nROL: ${r.code} (${r.name})`);
    const allPerms = r.permissions.map((rp) => rp.permission.code).sort();
    const docPerms = allPerms.filter((c) => c.startsWith('document:'));
    console.log(`  Total permisos asignados: ${allPerms.length}`);
    console.log(`  Permisos document:* (${docPerms.length}):`, docPerms);
  }

  // 4. Tablas y Esquema Documental en Neon
  console.log('\n--- 4. AUDITORÍA DE REGISTROS DOCUMENTALES EN NEON ---');
  const attachmentsCount = await prisma.attachment.count();
  const versionsCount = await prisma.attachmentVersion.count();
  console.log(`Total registros en attachments: ${attachmentsCount}`);
  console.log(`Total registros en attachment_versions: ${versionsCount}`);

  // Verificar columnas en PostgreSQL mediante information_schema
  console.log('\n--- 5. COLUMNAS DE LA TABLA ATTACHMENTS (INFORMATION_SCHEMA) ---');
  const columns = await prisma.$queryRaw`
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_name = 'attachments'
    ORDER BY ordinal_position;
  `;
  for (const col of columns) {
    console.log(`  - ${col.column_name} (${col.data_type}, nullable: ${col.is_nullable}, default: ${col.column_default})`);
  }

  // Verificar foreign keys de attachments
  console.log('\n--- 6. RESTRICCIONES DE CLAVE FORÁNEA (ATTACHMENTS) ---');
  const fkeys = await prisma.$queryRaw`
    SELECT
      tc.constraint_name,
      kcu.column_name,
      ccu.table_name AS foreign_table_name,
      ccu.column_name AS foreign_column_name,
      rc.delete_rule
    FROM information_schema.table_constraints AS tc
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
    JOIN information_schema.referential_constraints AS rc
      ON rc.constraint_name = tc.constraint_name
    WHERE tc.table_name = 'attachments' AND tc.constraint_type = 'FOREIGN KEY';
  `;
  for (const fk of fkeys) {
    console.log(`  - ${fk.constraint_name}: ${fk.column_name} -> ${fk.foreign_table_name}(${fk.foreign_column_name}) [ON DELETE ${fk.delete_rule}]`);
  }

  // Verificar si hay registros residuales o huérfanos
  console.log('\n--- 7. INTEGRIDAD REFERENCIAL Y DATOS EXISTENTES ---');
  const orphanVersions = await prisma.$queryRaw`
    SELECT av.id, av.attachment_id
    FROM attachment_versions av
    LEFT JOIN attachments a ON av.attachment_id = a.id
    WHERE a.id IS NULL;
  `;
  console.log(`Versiones huérfanas detectadas: ${orphanVersions.length}`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error('Error durante la inspección:', e);
  process.exit(1);
});


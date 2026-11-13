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
  console.log('=== MEXAGENDA: AUDITORÍA TÉCNICA INDEPENDIENTE FASE 5 ===\n');

  // 1. RBAC Check
  console.log('--- 1. AUDITORÍA CRÍTICA DE PERMISOS RBAC EN NEON ---');
  const roles = await prisma.role.findMany({
    include: {
      permissions: {
        include: { permission: true },
      },
    },
  });

  for (const r of roles) {
    console.log(`\nROL: ${r.code} (${r.name})`);
    const allPerms = r.permissions.map((rp) => rp.permission.code);
    const notePerms = allPerms.filter((c) => c.startsWith('note:'));
    console.log(`Total permisos asignados: ${allPerms.length}`);
    console.log(`Permisos note:* (${notePerms.length}):`, notePerms);
  }

  // 2. Tablas y Esquema
  console.log('\n--- 2. AUDITORÍA DE TABLAS Y REGISTROS EN NEON ---');
  const notesCount = await prisma.personalNote.count();
  const versionsCount = await prisma.personalNoteVersion.count();
  console.log(`Total registros en personal_notes: ${notesCount}`);
  console.log(`Total registros en personal_note_versions: ${versionsCount}`);

  // 3. Inspección de columnas y nulos en personal_notes
  const sampleNote = await prisma.personalNote.findFirst({
    include: {
      author: { select: { id: true, email: true, role: { select: { code: true } } } },
      meeting: { select: { id: true, folio: true } },
      agendaItem: { select: { id: true, title: true } },
      agreement: { select: { id: true, folio: true } },
      versions: true,
    },
  });

  if (sampleNote) {
    console.log('\nEjemplo de Anotación en DB:');
    console.log({
      id: sampleNote.id,
      title: sampleNote.title,
      category: sampleNote.category,
      noteType: sampleNote.noteType,
      visibility: sampleNote.visibility,
      isFavorite: sampleNote.isFavorite,
      meetingId: sampleNote.meetingId,
      agendaItemId: sampleNote.agendaItemId,
      agreementId: sampleNote.agreementId,
      authorId: sampleNote.authorId,
      version: sampleNote.version,
      isAdminModified: sampleNote.isAdminModified,
      lastAdminIntervenorId: sampleNote.lastAdminIntervenorId,
      adminJustification: sampleNote.adminJustification,
      deletedAt: sampleNote.deletedAt,
      versionCount: sampleNote.versions.length,
    });
  }

  // 4. Inspección de Audit Logs para eventos NOTE_*
  console.log('\n--- 3. AUDITORÍA DE EVENTOS NOTE_* EN AUDIT_LOGS ---');
  const auditLogs = await prisma.auditLog.findMany({
    where: {
      action: { startsWith: 'NOTE_' },
    },
    take: 10,
    orderBy: { createdAt: 'desc' },
  });
  console.log(`Total eventos NOTE_* encontrados (muestra de 10): ${auditLogs.length}`);
  for (const log of auditLogs) {
    console.log(` - [${log.action}] entityId=${log.entityId} actor=${log.actorId} outcome=${log.outcome}`);
  }

  const deniedLogs = await prisma.auditLog.findMany({
    where: {
      action: 'UNAUTHORIZED_NOTE_MUTATION_ATTEMPT',
    },
  });
  console.log(`Total eventos UNAUTHORIZED_NOTE_MUTATION_ATTEMPT (DENIED): ${deniedLogs.length}`);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('Error durante la inspección:', err);
  process.exit(1);
});


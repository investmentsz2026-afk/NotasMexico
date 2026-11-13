const { PrismaClient } = require('@prisma/client');
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

const prisma = new PrismaClient();

async function check() {
  const perms = await prisma.permission.findMany({ orderBy: { code: 'asc' } });
  console.log('Permissions count:', perms.length);
  console.log('Permissions:', perms.map((p) => p.code));

  const roles = await prisma.role.findMany();
  console.log('Roles:', roles.map((r) => r.code));

  const meetings = await prisma.meeting.count();
  console.log('Existing meetings:', meetings);

  const cats = await prisma.meetingCategory.findMany();
  console.log('Existing categories count:', cats.length);
  console.log('Categories:', cats.map((c) => ({ name: c.name, code: c.code })));

  const users = await prisma.user.findMany({ select: { id: true, email: true, role: { select: { code: true } } } });
  console.log('Users in DB:', users);

  const agreements = await prisma.agreement.count();
  console.log('Agreements count:', agreements);

  const history = await prisma.agreementHistory.count();
  console.log('AgreementHistory count:', history);

  const personalNotes = await prisma.personalNote.count();
  console.log('PersonalNotes count:', personalNotes);

  const noteVersions = await prisma.personalNoteVersion.count();
  console.log('PersonalNoteVersions count:', noteVersions);

  await prisma.$disconnect();
}

check().catch((err) => {
  console.error(err);
  process.exit(1);
});


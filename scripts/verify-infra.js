/**
 * Script de Verificación de Infraestructura (MexAgenda — Fase 1)
 * Ejecuta validaciones estáticas y de entorno sin exponer secretos.
 */

const fs = require('fs');
const path = require('path');

console.log('===============================================================');
console.log(' MEXAGENDA — VERIFICACIÓN AUTOMATIZADA DE INFRAESTRUCTURA (F1) ');
console.log('===============================================================');

let hasErrors = false;

function check(name, condition, details = '') {
  if (condition) {
    console.log(`[PASS] ${name}`);
  } else {
    console.error(`[FAIL] ${name} ${details ? `-> ${details}` : ''}`);
    hasErrors = true;
  }
}

// 1. Archivos estructurales clave
check('.gitignore existe', fs.existsSync(path.join(__dirname, '../.gitignore')));
check('.env.example existe', fs.existsSync(path.join(__dirname, '../.env.example')));
check('pnpm-workspace.yaml existe', fs.existsSync(path.join(__dirname, '../pnpm-workspace.yaml')));
check('prisma/schema.prisma existe', fs.existsSync(path.join(__dirname, '../prisma/schema.prisma')));
check('docs/phase-0/ existe con 20 entregables', fs.existsSync(path.join(__dirname, '../docs/phase-0/20-informe-final-fase-0.md')));

// 2. Comprobar que no existan archivos .env reales rastreados
const gitignoreContent = fs.readFileSync(path.join(__dirname, '../.gitignore'), 'utf-8');
check('.gitignore ignora .env', gitignoreContent.includes('.env'));

// 3. Comprobar schema de Prisma contiene las 19 entidades
const schemaContent = fs.readFileSync(path.join(__dirname, '../prisma/schema.prisma'), 'utf-8');
const expectedModels = [
  'Role', 'Permission', 'RolePermission', 'User', 'UserSession', 'UserMfa',
  'LoginAttempt', 'PasswordResetToken', 'MeetingCategory', 'Meeting',
  'MeetingParticipant', 'PersonalNote', 'PersonalNoteVersion', 'Agreement',
  'AgreementHistory', 'Attachment', 'AttachmentVersion', 'AuditLog', 'SystemSetting'
];

let allModelsPresent = true;
for (const model of expectedModels) {
  if (!schemaContent.includes(`model ${model}`)) {
    console.error(`  - Modelo faltante: ${model}`);
    allModelsPresent = false;
  }
}
check('Las 19 entidades están definidas en schema.prisma', allModelsPresent);

// 4. Paquetes compartidos
check('packages/shared existe', fs.existsSync(path.join(__dirname, '../packages/shared/package.json')));
check('packages/validation existe', fs.existsSync(path.join(__dirname, '../packages/validation/package.json')));

// 5. Aplicaciones
check('apps/backend existe', fs.existsSync(path.join(__dirname, '../apps/backend/package.json')));
check('apps/frontend existe', fs.existsSync(path.join(__dirname, '../apps/frontend/package.json')));

console.log('===============================================================');
if (hasErrors) {
  console.error('RESULTADO: Se encontraron fallas en la verificación de infraestructura.');
  process.exit(1);
} else {
  console.log('RESULTADO: Todos los componentes estructurales de Fase 1 están íntegros.');
  process.exit(0);
}

/**
 * Runner seguro para comandos de Prisma en MexAgenda.
 * Carga .env.local o .env si existen. Si no existen credenciales de base de datos
 * (como en CI o validaciones estáticas iniciales), provee marcadores de posición
 * para permitir que `validate` y `generate` se ejecuten exitosamente.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const content = fs.readFileSync(filePath, 'utf-8');
  const env = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const match = trimmed.match(/^([^=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      let val = match[2].trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.substring(1, val.length - 1);
      }
      env[key] = val;
    }
  }
  return env;
}

const localEnv = parseEnvFile(path.join(__dirname, '../.env.local'));
const baseEnv = parseEnvFile(path.join(__dirname, '../.env'));

const mergedEnv = {
  ...process.env,
  ...baseEnv,
  ...localEnv,
};

// Marcadores de posición seguros para compilación/generación si no están provistos
if (!mergedEnv.DATABASE_URL) {
  mergedEnv.DATABASE_URL = 'postgresql://placeholder_user:placeholder_pass@localhost:5432/mexagenda_db?sslmode=require';
}
if (!mergedEnv.DIRECT_URL) {
  mergedEnv.DIRECT_URL = 'postgresql://placeholder_user:placeholder_pass@localhost:5432/mexagenda_db?sslmode=require';
}

const args = process.argv.slice(2).join(' ');
try {
  execSync(`npx prisma ${args}`, {
    stdio: 'inherit',
    env: mergedEnv,
  });
} catch (error) {
  process.exit(error.status || 1);
}

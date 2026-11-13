import * as fs from 'fs';
import * as path from 'path';
import { validateEnvironment, ValidatedEnvironment } from '@mexagenda/validation';

export function preloadDotEnvFiles(): void {
  const candidateDirs = [
    process.cwd(),
    path.resolve(process.cwd(), '..'),
    path.resolve(process.cwd(), '../..'),
    path.resolve(__dirname, '../../..'),
    path.resolve(__dirname, '../../../..'),
  ];
  const envFiles = ['.env.local', '.env'];

  for (const dir of candidateDirs) {
    for (const file of envFiles) {
      const fullPath = path.resolve(dir, file);
      if (fs.existsSync(fullPath)) {
        const content = fs.readFileSync(fullPath, 'utf8');
        for (const line of content.split('\n')) {
          const trimmed = line.trim();
          if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
            const idx = trimmed.indexOf('=');
            const key = trimmed.slice(0, idx).trim();
            let val = trimmed.slice(idx + 1).trim();
            if (
              (val.startsWith('"') && val.endsWith('"')) ||
              (val.startsWith("'") && val.endsWith("'"))
            ) {
              val = val.slice(1, -1);
            }
            if (process.env[key] === undefined) {
              process.env[key] = val;
            }
          }
        }
      }
    }
  }
}

export function loadAndValidateEnv(): ValidatedEnvironment {
  preloadDotEnvFiles();
  const result = validateEnvironment(process.env);

  if (!result.isValid || !result.config) {
    const errorDetails = result.errors.join(' | ');
    // Lanzar error explícito sobre las variables faltantes SIN exponer valores
    throw new Error(
      `[ConfigError] Falla de validación en variables de entorno de MexAgenda: ${errorDetails}. ` +
      `Por favor verifique la configuración o consulte el archivo .env.example.`
    );
  }

  return result.config;
}

import * as fs from 'fs';
import * as path from 'path';
import { Logger } from '@nestjs/common';
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

export function sanitizeDatabaseUrl(rawUrl?: string): string | undefined {
  if (!rawUrl) return undefined;
  let cleaned = rawUrl.trim();
  if (
    (cleaned.startsWith('"') && cleaned.endsWith('"')) ||
    (cleaned.startsWith("'") && cleaned.endsWith("'"))
  ) {
    cleaned = cleaned.slice(1, -1).trim();
  }
  cleaned = cleaned
    .replace(/[?&]channel_binding=require/gi, '')
    .replace(/\?&/, '?')
    .replace(/[?&]$/, '');

  if (cleaned.includes('neon.tech') && !cleaned.includes('sslmode=')) {
    cleaned += (cleaned.includes('?') ? '&' : '?') + 'sslmode=require';
  }
  return cleaned;
}

export function loadAndValidateEnv(): ValidatedEnvironment {
  preloadDotEnvFiles();

  if (process.env.DATABASE_URL) {
    process.env.DATABASE_URL = sanitizeDatabaseUrl(process.env.DATABASE_URL);
  }
  if (process.env.DIRECT_URL) {
    process.env.DIRECT_URL = sanitizeDatabaseUrl(process.env.DIRECT_URL);
  }

  const result = validateEnvironment(process.env);

  if (!result.isValid || !result.config) {
    const errorDetails = result.errors.join(' | ');
    const logger = new Logger('EnvConfig');
    logger.warn(
      `[ConfigWarning] Advertencia en variables de entorno: ${errorDetails}. Verifique las variables en el panel de Vercel.`,
    );
  }

  return (
    result.config || {
      NODE_ENV: (process.env.NODE_ENV as any) || 'production',
      PORT: parseInt(process.env.PORT || '4000', 10),
      FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:3000',
      BACKEND_URL: process.env.BACKEND_URL || 'http://localhost:4000',
      DATABASE_URL: process.env.DATABASE_URL,
      DIRECT_URL: process.env.DIRECT_URL,
      MFA_ENCRYPTION_KEY: process.env.MFA_ENCRYPTION_KEY,
      SESSION_SECRET: process.env.SESSION_SECRET,
    }
  );
}

export interface ValidatedEnvironment {
  NODE_ENV: 'development' | 'staging' | 'production' | 'test';
  PORT: number;
  FRONTEND_URL: string;
  BACKEND_URL: string;
  DATABASE_URL?: string;
  DIRECT_URL?: string;
  MFA_ENCRYPTION_KEY?: string;
  SESSION_SECRET?: string;
  S3_ENDPOINT?: string;
  S3_REGION?: string;
  S3_BUCKET_NAME?: string;
  S3_ACCESS_KEY_ID?: string;
  S3_SECRET_ACCESS_KEY?: string;
}

export interface EnvValidationResult {
  isValid: boolean;
  errors: string[];
  config?: ValidatedEnvironment;
}

/**
 * Validador estricto de variables de entorno para MexAgenda.
 * Garantiza que las variables requeridas existan y tengan el formato adecuado,
 * reportando nombres de variables faltantes sin exponer jamás su contenido en logs.
 */
export function validateEnvironment(env: Record<string, string | undefined>): EnvValidationResult {
  const errors: string[] = [];

  // 1. NODE_ENV
  const rawNodeEnv = env.NODE_ENV || 'development';
  if (!['development', 'staging', 'production', 'test'].includes(rawNodeEnv)) {
    errors.push(`NODE_ENV debe ser 'development', 'staging', 'production' o 'test'. Recibido: ${rawNodeEnv}`);
  }
  const nodeEnv = rawNodeEnv as 'development' | 'staging' | 'production' | 'test';

  // 2. PORT
  const rawPort = env.PORT || '4000';
  const port = parseInt(rawPort, 10);
  if (isNaN(port) || port <= 0 || port > 65535) {
    errors.push(`PORT debe ser un número de puerto TCP válido entre 1 y 65535. Recibido: ${rawPort}`);
  }

  // 3. FRONTEND_URL
  const frontendUrl = env.FRONTEND_URL || 'http://localhost:3000';
  try {
    new URL(frontendUrl);
  } catch {
    errors.push(`FRONTEND_URL no es una URL válida: ${frontendUrl}`);
  }

  // 4. BACKEND_URL
  const backendUrl = env.BACKEND_URL || `http://localhost:${port}`;
  try {
    new URL(backendUrl);
  } catch {
    errors.push(`BACKEND_URL no es una URL válida: ${backendUrl}`);
  }

  // 5. DATABASE_URL (en producción es estrictamente obligatoria)
  const databaseUrl = env.DATABASE_URL;
  if (nodeEnv === 'production' && !databaseUrl) {
    errors.push('La variable de entorno DATABASE_URL es obligatoria en entorno de producción.');
  }

  // 6. MFA_ENCRYPTION_KEY (en producción es estrictamente obligatoria y debe ser 64 hex chars = 32 bytes)
  const mfaKey = env.MFA_ENCRYPTION_KEY;
  if (nodeEnv === 'production' && !mfaKey) {
    errors.push('La variable de entorno MFA_ENCRYPTION_KEY es obligatoria en entorno de producción.');
  } else if (mfaKey && !/^[0-9a-fA-F]{64}$/.test(mfaKey)) {
    errors.push('MFA_ENCRYPTION_KEY debe ser una cadena hexadecimal de 64 caracteres (256 bits).');
  }

  if (errors.length > 0) {
    return {
      isValid: false,
      errors,
    };
  }

  return {
    isValid: true,
    errors: [],
    config: {
      NODE_ENV: nodeEnv,
      PORT: port,
      FRONTEND_URL: frontendUrl,
      BACKEND_URL: backendUrl,
      DATABASE_URL: databaseUrl,
      DIRECT_URL: env.DIRECT_URL,
      MFA_ENCRYPTION_KEY: mfaKey,
      SESSION_SECRET: env.SESSION_SECRET,
      S3_ENDPOINT: env.S3_ENDPOINT,
      S3_REGION: env.S3_REGION,
      S3_BUCKET_NAME: env.S3_BUCKET_NAME,
      S3_ACCESS_KEY_ID: env.S3_ACCESS_KEY_ID,
      S3_SECRET_ACCESS_KEY: env.S3_SECRET_ACCESS_KEY,
    },
  };
}

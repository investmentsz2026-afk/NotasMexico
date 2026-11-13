import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { sanitizeDatabaseUrl } from '../config/env.config';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    const cleanUrl = sanitizeDatabaseUrl(process.env.DATABASE_URL);
    if (cleanUrl) {
      process.env.DATABASE_URL = cleanUrl;
    }

    super({
      ...(cleanUrl ? { datasources: { db: { url: cleanUrl } } } : {}),
      log:
        process.env.NODE_ENV === 'development'
          ? [
              { emit: 'event', level: 'query' },
              { emit: 'stdout', level: 'error' },
              { emit: 'stdout', level: 'warn' },
            ]
          : [{ emit: 'stdout', level: 'error' }],
    });
  }

  async onModuleInit() {
    if (!process.env.DATABASE_URL) {
      this.logger.warn(
        'DATABASE_URL no está configurada en las variables de entorno. Prisma no iniciará conexión automática.',
      );
      return;
    }

    try {
      await this.$connect();
      this.logger.log('Conexión establecida exitosamente con Neon PostgreSQL.');
    } catch (error) {
      this.logger.warn(
        `No fue posible conectar inmediatamente con PostgreSQL: ${(error as Error).message}. ` +
        'El backend continuará operando en modo degradado para diagnósticos.',
      );
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.log('Conexión con PostgreSQL cerrada correctamente.');
  }

  /**
   * Diagnóstico seguro de conectividad a la base de datos sin exponer secretos.
   */
  async checkConnection(): Promise<'connected' | 'disconnected' | 'not_configured'> {
    if (!process.env.DATABASE_URL) {
      return 'not_configured';
    }

    try {
      // Timeout de 2.5 segundos para evitar bloqueos del health check
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('DB Timeout')), 2500),
      );
      const queryPromise = this.$queryRaw`SELECT 1`;

      await Promise.race([queryPromise, timeoutPromise]);
      return 'connected';
    } catch {
      return 'disconnected';
    }
  }
}

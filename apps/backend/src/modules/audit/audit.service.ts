import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AuditOutcome } from '@prisma/client';

export interface LogAuditParams {
  actorId?: string | null;
  action: string;
  entity: string;
  entityId: string;
  ipAddress?: string;
  userAgent?: string;
  outcome?: AuditOutcome;
  diffPayload?: Record<string, any> | null;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  // Palabras clave sensibles para sanitización obligatoria de datos
  private readonly sensitiveKeys = [
    'password',
    'pass',
    'contrasena',
    'secret',
    'secreto',
    'token',
    'totp',
    'mfatoken',
    'code',
    'backup',
    'backupcode',
    'cookie',
    'authorization',
    'key',
    'apikey',
  ];

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Registra un evento de auditoría forense inmutable en la base de datos Neon.
   * Aplica sanitización automática para evitar cualquier fuga de credenciales o secretos.
   */
  async logEvent(params: LogAuditParams): Promise<void> {
    try {
      const sanitizedPayload = params.diffPayload
        ? this.sanitize(params.diffPayload)
        : null;

      await this.prisma.auditLog.create({
        data: {
          actorId: params.actorId || null,
          action: params.action,
          entity: params.entity,
          entityId: String(params.entityId),
          ipAddress: params.ipAddress || '127.0.0.1',
          userAgent: (params.userAgent || 'unknown').substring(0, 300),
          outcome: params.outcome || AuditOutcome.SUCCESS,
          diffPayload: sanitizedPayload,
        },
      });
    } catch (error) {
      // La bitácora no debe interrumpir el flujo del usuario si la base de datos sufre un timeout transitorio,
      // pero debe alertarse en el registro de la aplicación.
      this.logger.error(
        `Fallo al registrar evento de auditoría [${params.action}]:`,
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  /**
   * Sanitizador recursivo para redactar campos sensibles en objetos arbitrarios.
   */
  sanitize(obj: any): any {
    if (obj === null || obj === undefined) {
      return obj;
    }

    if (typeof obj !== 'object') {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map((item) => this.sanitize(item));
    }

    const result: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      const lowerKey = key.toLowerCase();
      const isSensitive = this.sensitiveKeys.some((s) => lowerKey.includes(s));

      if (isSensitive) {
        result[key] = '[REDACTADO_POR_SEGURIDAD]';
      } else if (typeof value === 'object' && value !== null) {
        result[key] = this.sanitize(value);
      } else {
        result[key] = value;
      }
    }

    return result;
  }
}


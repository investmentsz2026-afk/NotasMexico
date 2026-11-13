import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';

export interface EphemeralMfaPayload {
  userId: string;
  email: string;
  exp: number;
}

@Injectable()
export class TokenService {
  private readonly ephemeralSecret: Buffer;

  constructor() {
    const rawSecret = process.env.SESSION_SECRET || 'mexagenda_ephemeral_mfa_signing_secret';
    this.ephemeralSecret = crypto.createHash('sha256').update(rawSecret).digest();
  }

  /**
   * Genera un token de sesión criptográficamente aleatorio de 256 bits (64 caracteres hex).
   */
  generateSessionToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Calcula el hash SHA-256 de un token de sesión para su persistencia en la base de datos.
   */
  hashSessionToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /**
   * Genera 8 códigos de respaldo únicos para recuperación de MFA.
   * Formato legible: XXXX-XXXX (alfanumérico en mayúsculas).
   */
  generate8BackupCodes(): { rawCodes: string[]; hashedCodes: string[] } {
    const rawCodes: string[] = [];
    const hashedCodes: string[] = [];
    const charset = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // Excluye caracteres ambiguos 0, O, 1, I

    for (let i = 0; i < 8; i++) {
      let code = '';
      const bytes = crypto.randomBytes(8);
      for (let b = 0; b < 8; b++) {
        code += charset[bytes[b] % charset.length];
        if (b === 3) {
          code += '-';
        }
      }
      rawCodes.push(code);
      hashedCodes.push(this.hashBackupCode(code));
    }

    return { rawCodes, hashedCodes };
  }

  /**
   * Calcula el hash SHA-256 de un código de respaldo para comparación segura en reposo.
   */
  hashBackupCode(code: string): string {
    // Normaliza eliminando guiones y espacios en blanco
    const normalized = code.replace(/[\s-]/g, '').toUpperCase();
    return crypto.createHash('sha256').update(normalized).digest('hex');
  }

  /**
   * Genera un token efímero de desafío MFA firmado con HMAC-SHA256 y TTL de 5 minutos.
   */
  generateEphemeralMfaToken(userId: string, email: string): string {
    const exp = Date.now() + 5 * 60 * 1000; // 5 minutos de vigencia
    const payload: EphemeralMfaPayload = { userId, email, exp };
    const payloadBase64 = Buffer.from(JSON.stringify(payload)).toString('base64url');

    const signature = crypto
      .createHmac('sha256', this.ephemeralSecret)
      .update(payloadBase64)
      .digest('base64url');

    return `${payloadBase64}.${signature}`;
  }

  /**
   * Verifica un token efímero de desafío MFA y retorna su carga útil si es legítimo y vigente.
   */
  verifyEphemeralMfaToken(token: string): EphemeralMfaPayload | null {
    try {
      const parts = token.split('.');
      if (parts.length !== 2) {
        return null;
      }

      const [payloadBase64, signature] = parts;
      const expectedSignature = crypto
        .createHmac('sha256', this.ephemeralSecret)
        .update(payloadBase64)
        .digest('base64url');

      if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
        return null;
      }

      const payload: EphemeralMfaPayload = JSON.parse(
        Buffer.from(payloadBase64, 'base64url').toString('utf8'),
      );

      if (Date.now() > payload.exp) {
        return null; // Expirado
      }

      return payload;
    } catch {
      return null;
    }
  }

  /**
   * Genera un token de restablecimiento de contraseña de 256 bits.
   */
  generatePasswordResetToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }
}


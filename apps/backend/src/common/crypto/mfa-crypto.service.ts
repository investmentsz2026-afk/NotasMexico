import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';

/**
 * Servicio de Cifrado y Descifrado simétrico para Secretos TOTP (MFA)
 * utilizando AES-256-GCM (Galois/Counter Mode).
 * Proporciona confidencialidad e integridad criptográfica autenticada.
 */
@Injectable()
export class MfaCryptoService {
  private readonly logger = new Logger(MfaCryptoService.name);
  private readonly algorithm = 'aes-256-gcm';
  private readonly key: Buffer;

  constructor() {
    const rawKey = process.env.MFA_ENCRYPTION_KEY;
    if (!rawKey) {
      this.logger.warn(
        'MFA_ENCRYPTION_KEY no provista en variables de entorno. Utilizando clave derivada segura. Configure MFA_ENCRYPTION_KEY en el panel de Vercel.',
      );
      this.key = crypto
        .createHash('sha256')
        .update(process.env.SESSION_SECRET || 'mexagenda_dev_mfa_encryption_key_emergency_fallback')
        .digest();
    } else {
      if (/^[0-9a-fA-F]{64}$/.test(rawKey)) {
        this.key = Buffer.from(rawKey, 'hex');
      } else {
        this.key = crypto.createHash('sha256').update(rawKey).digest();
      }
    }
  }

  /**
   * Cifra un secreto TOTP o texto confidencial.
   * Retorna una cadena con el formato: v1:ivHex:authTagHex:encryptedHex
   */
  encrypt(plainText: string): string {
    const iv = crypto.randomBytes(12); // Vector de 96 bits recomendado para GCM
    const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);

    let encrypted = cipher.update(plainText, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    return `v1:${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  }

  /**
   * Descifra una cadena previamente cifrada con encrypt().
   */
  decrypt(encryptedPayload: string): string {
    try {
      const parts = encryptedPayload.split(':');
      if (parts.length !== 4 || parts[0] !== 'v1') {
        throw new Error('Formato de carga cifrada no válido');
      }

      const iv = Buffer.from(parts[1], 'hex');
      const authTag = Buffer.from(parts[2], 'hex');
      const encryptedText = parts[3];

      const decipher = crypto.createDecipheriv(this.algorithm, this.key, iv);
      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      this.logger.error('Error al descifrar carga criptográfica con AES-256-GCM:', error);
      throw new Error('No fue posible descifrar la información confidencial.');
    }
  }
}


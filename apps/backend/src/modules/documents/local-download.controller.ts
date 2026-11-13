import {
  Controller,
  Get,
  Query,
  Res,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import type { Response } from 'express';
import { StorageService } from './storage/storage.service';
import { LocalStorageService } from './storage/local-storage.service';

@ApiTags('MOD-05 — Descarga Local Sandbox')
@Controller('documents/local-download')
export class LocalDownloadController {
  constructor(private readonly storageService: StorageService) {}

  @Get()
  @ApiOperation({ summary: 'Descarga de archivo mediante enlace temporal firmado en modo sandbox' })
  async downloadFile(
    @Query('key') key: string,
    @Query('expires') expires: string,
    @Query('filename') filename: string,
    @Query('sig') sig: string,
    @Res() res: Response,
  ) {
    if (!key || !expires || !filename || !sig) {
      throw new ForbiddenException('Parámetros de enlace de descarga incompletos.');
    }

    const underlying = this.storageService.getUnderlyingDriver();
    if (!(underlying instanceof LocalStorageService)) {
      throw new NotFoundException('El modo de descarga local no está activo en esta instancia.');
    }

    const isValid = underlying.verifySignature(key, expires, filename, sig);
    if (!isValid) {
      throw new ForbiddenException('El enlace de descarga es inválido o ha expirado.');
    }

    try {
      const buffer = await underlying.getFileBuffer(key);
      const safeFilename = filename.replace(/["\r\n]/g, '_');

      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${encodeURIComponent(safeFilename)}"`,
      );
      res.setHeader('Content-Length', buffer.length.toString());
      return res.end(buffer);
    } catch {
      throw new NotFoundException('El archivo físico no fue localizado en el almacenamiento local.');
    }
  }
}


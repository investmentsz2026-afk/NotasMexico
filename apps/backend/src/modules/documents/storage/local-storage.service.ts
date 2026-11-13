import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { StorageDriver, UploadFileOptions } from './storage.interface';

@Injectable()
export class LocalStorageService implements StorageDriver {
  private readonly logger = new Logger(LocalStorageService.name);
  private readonly basePath: string;
  private readonly secretKey: string;
  private readonly backendUrl: string;

  constructor(options?: { basePath?: string; secretKey?: string; backendUrl?: string }) {
    this.basePath = options?.basePath || path.resolve(process.cwd(), 'storage', 'vault');
    this.secretKey = options?.secretKey || 'mexagenda_local_vault_secret_key_2026';
    this.backendUrl = options?.backendUrl || process.env.BACKEND_URL || 'http://localhost:4000';

    if (!fs.existsSync(this.basePath)) {
      fs.mkdirSync(this.basePath, { recursive: true });
    }
    this.logger.log(`LocalStorageService inicializado en sandbox: ${this.basePath}`);
  }

  private resolveSafePath(key: string): string {
    const safeKey = key.replace(/\.\./g, '').replace(/^[/\\]+/, '');
    const fullPath = path.resolve(this.basePath, safeKey);
    if (!fullPath.startsWith(this.basePath)) {
      throw new Error('Path traversal attempt detected in storage key');
    }
    return fullPath;
  }

  async upload(options: UploadFileOptions): Promise<{ storageKey: string; locationUrl?: string }> {
    const fullPath = this.resolveSafePath(options.key);
    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(fullPath, options.buffer);
    return {
      storageKey: options.key,
      locationUrl: fullPath,
    };
  }

  async getDownloadPresignedUrl(
    key: string,
    originalFilename: string,
    expiresInSeconds = 300,
  ): Promise<string> {
    const expiresAt = Math.floor(Date.now() / 1000) + expiresInSeconds;
    const dataToSign = `${key}:${expiresAt}:${originalFilename}`;
    const signature = crypto
      .createHmac('sha256', this.secretKey)
      .update(dataToSign)
      .digest('hex');

    const params = new URLSearchParams({
      key,
      expires: expiresAt.toString(),
      filename: originalFilename,
      sig: signature,
    });

    return `${this.backendUrl}/api/v1/documents/local-download?${params.toString()}`;
  }

  verifySignature(key: string, expiresStr: string, filename: string, signature: string): boolean {
    const expiresAt = parseInt(expiresStr, 10);
    if (isNaN(expiresAt) || Math.floor(Date.now() / 1000) > expiresAt) {
      return false;
    }
    const dataToSign = `${key}:${expiresAt}:${filename}`;
    const expectedSig = crypto
      .createHmac('sha256', this.secretKey)
      .update(dataToSign)
      .digest('hex');

    if (!signature || typeof signature !== 'string' || signature.length % 2 !== 0 || !/^[0-9a-fA-F]+$/.test(signature)) {
      return false;
    }
    const sigBuf = Buffer.from(signature, 'hex');
    const expBuf = Buffer.from(expectedSig, 'hex');
    if (sigBuf.length !== expBuf.length) {
      return false;
    }
    return crypto.timingSafeEqual(sigBuf, expBuf);
  }

  async delete(key: string): Promise<void> {
    const fullPath = this.resolveSafePath(key);
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
    }
  }

  async exists(key: string): Promise<boolean> {
    const fullPath = this.resolveSafePath(key);
    return fs.existsSync(fullPath);
  }

  async getFileBuffer(key: string): Promise<Buffer> {
    const fullPath = this.resolveSafePath(key);
    if (!fs.existsSync(fullPath)) {
      throw new Error('Archivo no encontrado en el almacenamiento local');
    }
    return fs.readFileSync(fullPath);
  }
}


import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StorageDriver, UploadFileOptions } from './storage.interface';
import { S3StorageService, S3SseMode } from './s3-storage.service';
import { LocalStorageService } from './local-storage.service';

@Injectable()
export class StorageService implements StorageDriver, OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private driver!: StorageDriver;
  private providerName = 'LOCAL';
  private bucketName?: string;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    const bucketName = this.configService.get<string>('S3_BUCKET_NAME');
    const accessKeyId = this.configService.get<string>('S3_ACCESS_KEY_ID');
    const secretAccessKey = this.configService.get<string>('S3_SECRET_ACCESS_KEY');
    const endpoint = this.configService.get<string>('S3_ENDPOINT');
    const region = this.configService.get<string>('S3_REGION') || 'auto';
    const rawSseMode = this.configService.get<string>('S3_SSE_MODE');
    const kmsKeyId = this.configService.get<string>('S3_KMS_KEY_ID');
    const sseMode: S3SseMode | undefined =
      rawSseMode === 'aws:kms' || rawSseMode === 'AES256' || rawSseMode === 'NONE'
        ? rawSseMode
        : undefined;

    const isS3Configured =
      bucketName &&
      accessKeyId &&
      secretAccessKey &&
      !accessKeyId.includes('placeholder') &&
      !secretAccessKey.includes('placeholder');

    if (isS3Configured) {
      this.providerName = 'S3';
      this.bucketName = bucketName;
      this.driver = new S3StorageService({
        bucketName,
        accessKeyId,
        secretAccessKey,
        endpoint,
        region,
        sseMode,
        kmsKeyId,
      });
      this.logger.log(`[StorageService] Driver configurado: S3 (Bucket: ${bucketName}, Region: ${region})`);
    } else {
      this.providerName = 'LOCAL';
      this.bucketName = 'local-vault';
      this.driver = new LocalStorageService({
        secretKey: this.configService.get<string>('SESSION_SECRET') || 'mexagenda_vault_session_secret_2026',
        backendUrl: this.configService.get<string>('BACKEND_URL') || 'http://localhost:4000',
      });
      this.logger.log('[StorageService] Driver configurado: LOCAL (Sandbox en disco con HMAC)');
    }
  }

  getProviderName(): string {
    return this.providerName;
  }

  getBucketName(): string | undefined {
    return this.bucketName;
  }

  getUnderlyingDriver(): StorageDriver {
    return this.driver;
  }

  async upload(options: UploadFileOptions): Promise<{ storageKey: string; locationUrl?: string }> {
    return this.driver.upload(options);
  }

  async getDownloadPresignedUrl(
    key: string,
    originalFilename: string,
    expiresInSeconds = 300,
  ): Promise<string> {
    return this.driver.getDownloadPresignedUrl(key, originalFilename, expiresInSeconds);
  }

  async delete(key: string): Promise<void> {
    return this.driver.delete(key);
  }

  async exists(key: string): Promise<boolean> {
    return this.driver.exists(key);
  }

  async getFileBuffer(key: string): Promise<Buffer> {
    return this.driver.getFileBuffer(key);
  }
}


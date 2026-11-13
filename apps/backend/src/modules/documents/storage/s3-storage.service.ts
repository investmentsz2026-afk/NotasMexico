import { Injectable, Logger } from '@nestjs/common';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { StorageDriver, UploadFileOptions } from './storage.interface';
import { Readable } from 'stream';

export type S3SseMode = 'AES256' | 'aws:kms' | 'NONE';

@Injectable()
export class S3StorageService implements StorageDriver {
  private readonly logger = new Logger(S3StorageService.name);
  private readonly s3Client: S3Client;
  private readonly bucketName: string;
  private readonly sseMode: S3SseMode;
  private readonly kmsKeyId?: string;

  constructor(options: {
    endpoint?: string;
    region?: string;
    bucketName: string;
    accessKeyId: string;
    secretAccessKey: string;
    sseMode?: S3SseMode;
    kmsKeyId?: string;
  }) {
    this.bucketName = options.bucketName;
    this.kmsKeyId = options.kmsKeyId?.trim() || undefined;
    this.sseMode = options.sseMode || (this.kmsKeyId ? 'aws:kms' : 'AES256');
    const clientConfig: any = {
      region: options.region || 'auto',
      credentials: {
        accessKeyId: options.accessKeyId,
        secretAccessKey: options.secretAccessKey,
      },
      forcePathStyle: true,
    };

    if (options.endpoint) {
      clientConfig.endpoint = options.endpoint;
    }

    this.s3Client = new S3Client(clientConfig);
    this.logger.log(
      `S3StorageService inicializado para el bucket: ${this.bucketName} (SSE: ${this.sseMode}${this.kmsKeyId ? ', KMS Key configurada' : ''})`,
    );
  }

  getSseConfig(): { sseMode: S3SseMode; hasKmsKeyId: boolean } {
    return {
      sseMode: this.sseMode,
      hasKmsKeyId: Boolean(this.kmsKeyId),
    };
  }

  async upload(options: UploadFileOptions): Promise<{ storageKey: string; locationUrl?: string }> {
    const putParams: any = {
      Bucket: this.bucketName,
      Key: options.key,
      Body: options.buffer,
      ContentType: options.mimeType,
      Metadata: options.metadata,
    };

    if (this.sseMode === 'aws:kms') {
      putParams.ServerSideEncryption = 'aws:kms';
      if (this.kmsKeyId) {
        putParams.SSEKMSKeyId = this.kmsKeyId;
      }
    } else if (this.sseMode === 'AES256') {
      putParams.ServerSideEncryption = 'AES256';
    }

    const command = new PutObjectCommand(putParams);

    await this.s3Client.send(command);
    return {
      storageKey: options.key,
    };
  }

  async getDownloadPresignedUrl(
    key: string,
    originalFilename: string,
    expiresInSeconds = 300,
  ): Promise<string> {
    const sanitizedFilename = originalFilename.replace(/["\r\n]/g, '_');
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      ResponseContentDisposition: `attachment; filename="${encodeURIComponent(sanitizedFilename)}"`,
    });

    return await getSignedUrl(this.s3Client, command, {
      expiresIn: expiresInSeconds,
    });
  }

  async delete(key: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    });
    await this.s3Client.send(command);
  }

  async exists(key: string): Promise<boolean> {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });
      await this.s3Client.send(command);
      return true;
    } catch {
      return false;
    }
  }

  async getFileBuffer(key: string): Promise<Buffer> {
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    });
    const response = await this.s3Client.send(command);
    const stream = response.Body as Readable;

    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }
}


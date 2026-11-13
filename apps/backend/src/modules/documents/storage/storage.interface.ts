export interface UploadFileOptions {
  key: string;
  buffer: Buffer;
  mimeType: string;
  originalFilename: string;
  metadata?: Record<string, string>;
}

export interface StorageDriver {
  upload(options: UploadFileOptions): Promise<{ storageKey: string; locationUrl?: string }>;
  getDownloadPresignedUrl(key: string, originalFilename: string, expiresInSeconds: number): Promise<string>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  getFileBuffer(key: string): Promise<Buffer>;
}


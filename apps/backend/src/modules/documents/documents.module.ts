import { Module } from '@nestjs/common';
import { DocumentsController } from './documents.controller';
import { LocalDownloadController } from './local-download.controller';
import { DocumentsService } from './documents.service';
import { StorageService } from './storage/storage.service';
import { DatabaseModule } from '../../database/database.module';
import { AuditModule } from '../audit/audit.module';
import { SessionsModule } from '../sessions/sessions.module';

@Module({
  imports: [DatabaseModule, AuditModule, SessionsModule],
  controllers: [DocumentsController, LocalDownloadController],
  providers: [DocumentsService, StorageService],
  exports: [DocumentsService, StorageService],
})
export class DocumentsModule {}


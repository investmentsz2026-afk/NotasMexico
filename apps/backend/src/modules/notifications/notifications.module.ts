import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { AuditModule } from '../audit/audit.module';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { SmtpService } from './smtp/smtp.service';
import { OutboxWorkerService } from './queue/outbox-worker.service';

@Module({
  imports: [DatabaseModule, AuditModule],
  controllers: [NotificationsController],
  providers: [NotificationsService, SmtpService, OutboxWorkerService],
  exports: [NotificationsService, SmtpService],
})
export class NotificationsModule {}


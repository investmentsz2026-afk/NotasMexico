import { Module } from '@nestjs/common';
import { MeetingCategoriesController } from './meeting-categories.controller';
import { MeetingCategoriesService } from './meeting-categories.service';
import { DatabaseModule } from '../../database/database.module';
import { AuditModule } from '../audit/audit.module';
import { SessionsModule } from '../sessions/sessions.module';

@Module({
  imports: [DatabaseModule, AuditModule, SessionsModule],
  controllers: [MeetingCategoriesController],
  providers: [MeetingCategoriesService],
  exports: [MeetingCategoriesService],
})
export class MeetingCategoriesModule {}


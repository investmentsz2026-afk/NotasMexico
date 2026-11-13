import * as path from 'path';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './database/database.module';
import { CryptoModule } from './common/crypto/crypto.module';
import { AuditModule } from './modules/audit/audit.module';
import { SessionsModule } from './modules/sessions/sessions.module';
import { MfaModule } from './modules/mfa/mfa.module';
import { AuthModule } from './modules/auth/auth.module';
import { HealthModule } from './modules/health/health.module';
import { MeetingCategoriesModule } from './modules/meeting-categories/meeting-categories.module';
import { MeetingsModule } from './modules/meetings/meetings.module';
import { AgreementsModule } from './modules/agreements/agreements.module';
import { NotesModule } from './modules/notes/notes.module';
import { DocumentsModule } from './modules/documents/documents.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { ReportsModule } from './modules/reports/reports.module';
import { UsersModule } from './modules/users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [
        '.env.local',
        '.env',
        path.resolve(process.cwd(), '../../.env.local'),
        path.resolve(process.cwd(), '../../.env'),
      ],
    }),
    DatabaseModule,
    CryptoModule,
    AuditModule,
    SessionsModule,
    MfaModule,
    AuthModule,
    HealthModule,
    MeetingCategoriesModule,
    MeetingsModule,
    AgreementsModule,
    NotesModule,
    DocumentsModule,
    NotificationsModule,
    ReportsModule,
    UsersModule,
  ],
})
export class AppModule {}

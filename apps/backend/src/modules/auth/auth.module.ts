import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { DatabaseModule } from '../../database/database.module';
import { CryptoModule } from '../../common/crypto/crypto.module';
import { SessionsModule } from '../sessions/sessions.module';
import { MfaModule } from '../mfa/mfa.module';
import { AuditModule } from '../audit/audit.module';
import { SessionAuthGuard } from '../../common/guards/session-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';

@Module({
  imports: [
    DatabaseModule,
    CryptoModule,
    SessionsModule,
    MfaModule,
    AuditModule,
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    SessionAuthGuard,
    RolesGuard,
    PermissionsGuard,
  ],
  exports: [
    AuthService,
    SessionAuthGuard,
    RolesGuard,
    PermissionsGuard,
  ],
})
export class AuthModule {}


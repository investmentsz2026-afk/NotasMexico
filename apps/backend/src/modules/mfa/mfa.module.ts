import { Module, Global } from '@nestjs/common';
import { MfaService } from './mfa.service';
import { DatabaseModule } from '../../database/database.module';
import { CryptoModule } from '../../common/crypto/crypto.module';

@Global()
@Module({
  imports: [DatabaseModule, CryptoModule],
  providers: [MfaService],
  exports: [MfaService],
})
export class MfaModule {}


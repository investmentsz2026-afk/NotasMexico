import { Module, Global } from '@nestjs/common';
import { SessionsService } from './sessions.service';
import { DatabaseModule } from '../../database/database.module';
import { CryptoModule } from '../../common/crypto/crypto.module';

@Global()
@Module({
  imports: [DatabaseModule, CryptoModule],
  providers: [SessionsService],
  exports: [SessionsService],
})
export class SessionsModule {}


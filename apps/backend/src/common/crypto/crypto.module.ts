import { Module, Global } from '@nestjs/common';
import { Argon2Service } from './argon2.service';
import { MfaCryptoService } from './mfa-crypto.service';
import { TokenService } from './token.service';

@Global()
@Module({
  providers: [Argon2Service, MfaCryptoService, TokenService],
  exports: [Argon2Service, MfaCryptoService, TokenService],
})
export class CryptoModule {}


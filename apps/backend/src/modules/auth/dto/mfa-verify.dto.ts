import { IsNotEmpty, IsString, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class MfaVerifyDto {
  @ApiProperty({
    description: 'Token efímero de desafío MFA emitido durante el inicio de sesión',
  })
  @IsString()
  @IsNotEmpty({ message: 'El token de desafío MFA es requerido.' })
  mfaToken!: string;

  @ApiProperty({
    description: 'Código TOTP de 6 dígitos o Código de respaldo de 8-10 caracteres',
    example: '123456',
  })
  @IsString()
  @IsNotEmpty({ message: 'El código de autenticación es requerido.' })
  @Length(6, 12, {
    message: 'El código debe ser de 6 dígitos o un código de respaldo de 8 a 10 caracteres.',
  })
  code!: string;
}


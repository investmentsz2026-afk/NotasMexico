import { IsNotEmpty, IsString, Length, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class MfaConfirmDto {
  @ApiProperty({
    description: 'Código TOTP de 6 dígitos numéricos generado por la aplicación autenticadora',
    example: '123456',
  })
  @IsString()
  @IsNotEmpty({ message: 'El código TOTP es requerido.' })
  @Length(6, 6, { message: 'El código TOTP debe tener exactamente 6 dígitos.' })
  @Matches(/^[0-9]{6}$/, { message: 'El código TOTP debe contener únicamente números.' })
  code!: string;
}


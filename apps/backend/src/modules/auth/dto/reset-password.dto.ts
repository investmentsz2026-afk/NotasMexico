import { IsEmail, IsNotEmpty, IsString, MinLength, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class PasswordResetRequestDto {
  @ApiProperty({
    description: 'Correo electrónico de la cuenta a restablecer',
    example: 'usuario@institucion.gob.mx',
  })
  @IsEmail({}, { message: 'El formato del correo electrónico no es válido.' })
  @IsNotEmpty({ message: 'El correo electrónico es obligatorio.' })
  email!: string;
}

export class PasswordResetConfirmDto {
  @ApiProperty({
    description: 'Token de restablecimiento recibido',
  })
  @IsString()
  @IsNotEmpty({ message: 'El token de restablecimiento es requerido.' })
  token!: string;

  @ApiProperty({
    description: 'Nueva contraseña que cumpla con las políticas de seguridad institucional',
    example: 'NuevaClaveSegura#2026!',
  })
  @IsString()
  @IsNotEmpty({ message: 'La nueva contraseña es requerida.' })
  @MinLength(12, { message: 'La nueva contraseña debe tener al menos 12 caracteres.' })
  @MaxLength(128, { message: 'La nueva contraseña no debe exceder los 128 caracteres.' })
  newPassword!: string;
}


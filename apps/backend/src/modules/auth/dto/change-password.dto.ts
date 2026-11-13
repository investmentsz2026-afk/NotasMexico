import { IsNotEmpty, IsString, MinLength, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ChangePasswordDto {
  @ApiProperty({
    description: 'Contraseña actual del usuario',
  })
  @IsString()
  @IsNotEmpty({ message: 'La contraseña actual es requerida.' })
  currentPassword!: string;

  @ApiProperty({
    description: 'Nueva contraseña que cumpla con las políticas de seguridad institucional (mínimo 12 caracteres, mayúscula, minúscula, dígito y carácter especial)',
    example: 'NuevaClaveSegura#2026!',
  })
  @IsString()
  @IsNotEmpty({ message: 'La nueva contraseña es requerida.' })
  @MinLength(12, { message: 'La nueva contraseña debe tener al menos 12 caracteres.' })
  @MaxLength(128, { message: 'La nueva contraseña no debe exceder los 128 caracteres.' })
  newPassword!: string;
}


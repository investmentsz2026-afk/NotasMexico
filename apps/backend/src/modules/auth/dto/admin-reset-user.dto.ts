import { IsNotEmpty, IsString, IsUUID, MinLength, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AdminResetUserDto {
  @ApiProperty({
    description: 'Identificador único UUID del usuario institucional a restablecer',
  })
  @IsUUID('4', { message: 'El userId debe ser un UUID v4 válido.' })
  @IsNotEmpty({ message: 'El identificador de usuario es requerido.' })
  userId!: string;

  @ApiProperty({
    description: 'Nueva contraseña temporal asignada por el Administrador',
    example: 'TemporalClave#2026!',
  })
  @IsString()
  @IsNotEmpty({ message: 'La contraseña temporal es requerida.' })
  @MinLength(12, { message: 'La contraseña temporal debe tener al menos 12 caracteres.' })
  @MaxLength(128, { message: 'La contraseña temporal no debe exceder los 128 caracteres.' })
  temporaryPassword!: string;
}


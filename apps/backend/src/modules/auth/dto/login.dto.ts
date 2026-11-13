import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({
    description: 'Correo electrónico institucional del usuario',
    example: 'admin@institucion.gob.mx',
  })
  @IsEmail({}, { message: 'El formato del correo electrónico institucional no es válido.' })
  @IsNotEmpty({ message: 'El correo electrónico es obligatorio.' })
  @MaxLength(255)
  email!: string;

  @ApiProperty({
    description: 'Contraseña del usuario',
    example: 'MiContraseñaSegura#2026',
  })
  @IsString({ message: 'La contraseña debe ser una cadena de texto.' })
  @IsNotEmpty({ message: 'La contraseña es obligatoria.' })
  password!: string;
}


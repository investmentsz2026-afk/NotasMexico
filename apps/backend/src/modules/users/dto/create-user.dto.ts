import { IsEmail, IsNotEmpty, IsOptional, IsString, IsUUID, MinLength, IsEnum } from 'class-validator';
import { UserStatus } from '@prisma/client';

export class CreateUserDto {
  @IsEmail({}, { message: 'El correo electrónico debe tener un formato válido.' })
  @IsNotEmpty({ message: 'El correo institucional es obligatorio.' })
  email!: string;

  @IsString({ message: 'La contraseña debe ser una cadena de texto.' })
  @MinLength(8, { message: 'La contraseña institucional debe contener al menos 8 caracteres.' })
  password!: string;

  @IsString({ message: 'El nombre institucional debe ser texto.' })
  @IsNotEmpty({ message: 'El nombre es obligatorio.' })
  firstName!: string;

  @IsString({ message: 'Los apellidos deben ser texto.' })
  @IsNotEmpty({ message: 'Los apellidos son obligatorios.' })
  lastName!: string;

  @IsString({ message: 'El cargo o posición debe ser texto.' })
  @IsNotEmpty({ message: 'El cargo o nombramiento institucional es obligatorio.' })
  position!: string;

  @IsString({ message: 'El teléfono debe ser texto.' })
  @IsOptional()
  phone?: string;

  @IsUUID('4', { message: 'El identificador del rol debe ser un UUID v4 válido.' })
  @IsNotEmpty({ message: 'El rol institucional es obligatorio.' })
  roleId!: string;

  @IsEnum(UserStatus, { message: 'El estado del usuario debe ser válido (ACTIVO, INACTIVO, etc.).' })
  @IsOptional()
  status?: UserStatus;
}

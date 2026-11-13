import { IsEmail, IsOptional, IsString, IsUUID, MinLength, IsEnum } from 'class-validator';
import { UserStatus } from '@prisma/client';

export class UpdateUserDto {
  @IsEmail({}, { message: 'El correo electrónico debe tener un formato válido.' })
  @IsOptional()
  email?: string;

  @IsString({ message: 'La contraseña debe ser una cadena de texto.' })
  @MinLength(8, { message: 'La contraseña debe contener al menos 8 caracteres.' })
  @IsOptional()
  password?: string;

  @IsString({ message: 'El nombre debe ser texto.' })
  @IsOptional()
  firstName?: string;

  @IsString({ message: 'Los apellidos deben ser texto.' })
  @IsOptional()
  lastName?: string;

  @IsString({ message: 'El cargo institucional debe ser texto.' })
  @IsOptional()
  position?: string;

  @IsString({ message: 'El teléfono debe ser texto.' })
  @IsOptional()
  phone?: string;

  @IsUUID('4', { message: 'El rol debe ser un UUID v4 válido.' })
  @IsOptional()
  roleId?: string;

  @IsEnum(UserStatus, { message: 'El estado del usuario debe ser válido.' })
  @IsOptional()
  status?: UserStatus;
}


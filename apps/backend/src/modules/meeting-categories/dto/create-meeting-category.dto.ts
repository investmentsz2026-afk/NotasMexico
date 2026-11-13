import { IsNotEmpty, IsString, IsOptional, MaxLength, Matches, IsInt, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateMeetingCategoryDto {
  @ApiProperty({
    description: 'Nombre descriptivo de la categoría de reunión',
    example: 'Sesión Extraordinaria de Consejo',
  })
  @IsString()
  @IsNotEmpty({ message: 'El nombre de la categoría es requerido.' })
  @MaxLength(100)
  name!: string;

  @ApiProperty({
    description: 'Código único identificador en mayúsculas (letras, números y guiones bajos)',
    example: 'EXTRAORDINARIA_CONSEJO',
  })
  @IsString()
  @IsNotEmpty({ message: 'El código identificador es requerido.' })
  @MaxLength(30)
  @Matches(/^[A-Z0-9_]+$/, {
    message: 'El código debe contener únicamente letras mayúsculas, números y guiones bajos.',
  })
  code!: string;

  @ApiProperty({
    description: 'Descripción del alcance y propósito institucional de la categoría',
    required: false,
  })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  description?: string;

  @ApiProperty({
    description: 'Color hexadecimal identificador para visualización en calendarios',
    example: '#B45309',
    default: '#0F172A',
  })
  @IsString()
  @IsOptional()
  @Matches(/^#[0-9A-Fa-f]{6}$/, {
    message: 'El color debe ser un código hexadecimal válido (ej. #0F172A).',
  })
  colorHex?: string;

  @ApiProperty({
    description: 'Orden numérico de presentación en listas y selectores',
    example: 1,
    default: 0,
  })
  @IsInt()
  @Min(0)
  @IsOptional()
  displayOrder?: number;
}


import { IsString, IsOptional, MaxLength, Matches, IsInt, Min, IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateMeetingCategoryDto {
  @ApiProperty({ description: 'Nombre descriptivo de la categoría', required: false })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  name?: string;

  @ApiProperty({ description: 'Descripción de la categoría', required: false })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  description?: string;

  @ApiProperty({ description: 'Color hexadecimal identificador', required: false })
  @IsString()
  @IsOptional()
  @Matches(/^#[0-9A-Fa-f]{6}$/, { message: 'El color debe ser un código hexadecimal válido (ej. #0F172A).' })
  colorHex?: string;

  @ApiProperty({ description: 'Orden de presentación', required: false })
  @IsInt()
  @Min(0)
  @IsOptional()
  displayOrder?: number;

  @ApiProperty({ description: 'Estado activo/inactivo', required: false })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}


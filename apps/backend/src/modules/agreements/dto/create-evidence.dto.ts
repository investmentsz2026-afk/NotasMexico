import {
  IsNotEmpty,
  IsString,
  IsUUID,
  IsOptional,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateEvidenceDto {
  @ApiProperty({
    description: 'Título o nombre de la evidencia documental o entregable institucional',
    example: 'Oficio No. DG-2026-145 de entrega del informe financiero',
  })
  @IsString()
  @IsNotEmpty({ message: 'El título de la evidencia es obligatorio.' })
  @MinLength(3, { message: 'El título debe tener al menos 3 caracteres.' })
  @MaxLength(250, { message: 'El título no puede exceder 250 caracteres.' })
  title!: string;

  @ApiProperty({
    description: 'Descripción o resumen del contenido y alcance probatorio de la evidencia',
    required: false,
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({
    description: 'Número de oficio, expediente institucional o referencia de archivo físico/digital',
    example: 'EXP-FIN-2026-089 / Bóveda Central Caja 4',
    required: false,
  })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  documentReference?: string;

  @ApiProperty({
    description: 'Identificador UUID del avance al cual se asocia la evidencia (opcional)',
    required: false,
  })
  @IsUUID('4')
  @IsOptional()
  progressId?: string;
}


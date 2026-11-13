import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { NoteCategory, NoteVisibility } from '../../../_shared';

export class AdminInterveneNoteDto {
  @ApiProperty({
    description: 'Justificación legal o administrativa obligatoria para intervenir la nota (mínimo 15 caracteres)',
    minLength: 15,
  })
  @IsString({ message: 'La justificación administrativa debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'La justificación administrativa es obligatoria para intervenciones administrativas' })
  @MinLength(15, { message: 'La justificación administrativa debe contener al menos 15 caracteres' })
  adminJustification!: string;

  @ApiPropertyOptional({ description: 'Título corregido institucionalmente', maxLength: 250 })
  @IsOptional()
  @IsString({ message: 'El título debe ser una cadena de texto' })
  @MaxLength(250, { message: 'El título no puede exceder 250 caracteres' })
  title?: string;

  @ApiPropertyOptional({ description: 'Contenido corregido institucionalmente' })
  @IsOptional()
  @IsString({ message: 'El contenido debe ser una cadena de texto' })
  content?: string;

  @ApiPropertyOptional({ enum: NoteCategory })
  @IsOptional()
  @IsEnum(NoteCategory, { message: 'Categoría institucional no válida' })
  category?: NoteCategory;

  @ApiPropertyOptional({ enum: NoteVisibility })
  @IsOptional()
  @IsEnum(NoteVisibility, { message: 'Nivel de visibilidad no válido' })
  visibility?: NoteVisibility;
}

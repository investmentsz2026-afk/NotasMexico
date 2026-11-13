import {
  IsString,
  IsOptional,
  IsEnum,
  IsBoolean,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { NoteCategory, NoteType, NoteVisibility } from '../../../_shared';

export class UpdateNoteDto {
  @ApiPropertyOptional({ description: 'Título institucional de la anotación', maxLength: 250 })
  @IsOptional()
  @IsString({ message: 'El título debe ser una cadena de texto' })
  @MaxLength(250, { message: 'El título no puede exceder 250 caracteres' })
  title?: string;

  @ApiPropertyOptional({ description: 'Contenido detallado de la anotación' })
  @IsOptional()
  @IsString({ message: 'El contenido debe ser una cadena de texto' })
  content?: string;

  @ApiPropertyOptional({ enum: NoteCategory })
  @IsOptional()
  @IsEnum(NoteCategory, { message: 'Categoría institucional no válida' })
  category?: NoteCategory;

  @ApiPropertyOptional({ enum: NoteType })
  @IsOptional()
  @IsEnum(NoteType, { message: 'Tipo de nota institucional no válido' })
  noteType?: NoteType;

  @ApiPropertyOptional({ enum: NoteVisibility })
  @IsOptional()
  @IsEnum(NoteVisibility, { message: 'Nivel de visibilidad no válido' })
  visibility?: NoteVisibility;

  @ApiPropertyOptional({ description: 'Indica si la nota está marcada como favorita' })
  @IsOptional()
  @IsBoolean({ message: 'isFavorite debe ser un valor booleano' })
  isFavorite?: boolean;

  @ApiPropertyOptional({ description: 'Etiquetas o tags separados por coma', maxLength: 255 })
  @IsOptional()
  @IsString({ message: 'Los tags deben ser una cadena de texto' })
  @MaxLength(255, { message: 'Los tags no pueden exceder 255 caracteres' })
  tags?: string;

  @ApiPropertyOptional({ description: 'ID de la reunión institucional vinculada (o null para desvincular)' })
  @IsOptional()
  meetingId?: string | null;

  @ApiPropertyOptional({ description: 'ID del punto de orden del día vinculado (o null para desvincular)' })
  @IsOptional()
  agendaItemId?: string | null;

  @ApiPropertyOptional({ description: 'ID del acuerdo institucional vinculado (o null para desvincular)' })
  @IsOptional()
  agreementId?: string | null;

  @ApiPropertyOptional({ description: 'Motivo o justificación del cambio realizado por el autor' })
  @IsOptional()
  @IsString({ message: 'El motivo del cambio debe ser una cadena de texto' })
  @MaxLength(500, { message: 'El motivo del cambio no puede exceder 500 caracteres' })
  changeReason?: string;
}


import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsBoolean,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { NoteCategory, NoteType, NoteVisibility } from '@mexagenda/shared';

export class CreateNoteDto {
  @ApiProperty({ description: 'Título institucional de la anotación', maxLength: 250 })
  @IsString({ message: 'El título debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'El título de la anotación es obligatorio' })
  @MaxLength(250, { message: 'El título no puede exceder 250 caracteres' })
  title!: string;

  @ApiProperty({ description: 'Contenido detallado de la anotación' })
  @IsString({ message: 'El contenido debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'El contenido de la anotación es obligatorio' })
  content!: string;

  @ApiPropertyOptional({ enum: NoteCategory, default: NoteCategory.GENERAL })
  @IsOptional()
  @IsEnum(NoteCategory, { message: 'Categoría institucional no válida' })
  category?: NoteCategory;

  @ApiPropertyOptional({ enum: NoteType, default: NoteType.PERSONAL })
  @IsOptional()
  @IsEnum(NoteType, { message: 'Tipo de nota institucional no válido' })
  noteType?: NoteType;

  @ApiPropertyOptional({ enum: NoteVisibility, default: NoteVisibility.PRIVADA })
  @IsOptional()
  @IsEnum(NoteVisibility, { message: 'Nivel de visibilidad no válido' })
  visibility?: NoteVisibility;

  @ApiPropertyOptional({ description: 'Indica si la nota está marcada como favorita', default: false })
  @IsOptional()
  @IsBoolean({ message: 'isFavorite debe ser un valor booleano' })
  isFavorite?: boolean;

  @ApiPropertyOptional({ description: 'Etiquetas o tags separados por coma', maxLength: 255 })
  @IsOptional()
  @IsString({ message: 'Los tags deben ser una cadena de texto' })
  @MaxLength(255, { message: 'Los tags no pueden exceder 255 caracteres' })
  tags?: string;

  @ApiPropertyOptional({ description: 'ID de la reunión institucional vinculada (UUID)' })
  @IsOptional()
  @IsUUID('4', { message: 'El ID de la reunión debe ser un UUID válido' })
  meetingId?: string;

  @ApiPropertyOptional({ description: 'ID del punto de orden del día vinculado (UUID)' })
  @IsOptional()
  @IsUUID('4', { message: 'El ID del punto de orden del día debe ser un UUID válido' })
  agendaItemId?: string;

  @ApiPropertyOptional({ description: 'ID del acuerdo institucional vinculado (UUID)' })
  @IsOptional()
  @IsUUID('4', { message: 'El ID del acuerdo debe ser un UUID válido' })
  agreementId?: string;
}

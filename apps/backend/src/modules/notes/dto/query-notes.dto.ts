import {
  IsOptional,
  IsString,
  IsUUID,
  IsEnum,
  IsInt,
  IsBoolean,
  Min,
  Max,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { NoteCategory, NoteType, NoteVisibility } from '@mexagenda/shared';

export class QueryNotesDto {
  @ApiPropertyOptional({ description: 'Número de página (base 1)', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Cantidad de elementos por página (máx. 100)', default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 10;

  @ApiPropertyOptional({ description: 'Término de búsqueda libre en título, contenido o tags' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: NoteCategory, description: 'Filtrar por categoría temática' })
  @IsOptional()
  @IsEnum(NoteCategory)
  category?: NoteCategory;

  @ApiPropertyOptional({ enum: NoteType, description: 'Filtrar por tipo de nota' })
  @IsOptional()
  @IsEnum(NoteType)
  noteType?: NoteType;

  @ApiPropertyOptional({ enum: NoteVisibility, description: 'Filtrar por nivel de visibilidad' })
  @IsOptional()
  @IsEnum(NoteVisibility)
  visibility?: NoteVisibility;

  @ApiPropertyOptional({ description: 'Filtrar por ID de reunión institucional vinculada' })
  @IsOptional()
  @IsUUID('4')
  meetingId?: string;

  @ApiPropertyOptional({ description: 'Filtrar por ID de punto del orden del día' })
  @IsOptional()
  @IsUUID('4')
  agendaItemId?: string;

  @ApiPropertyOptional({ description: 'Filtrar por ID de acuerdo institucional vinculado' })
  @IsOptional()
  @IsUUID('4')
  agreementId?: string;

  @ApiPropertyOptional({ description: 'Filtrar solo notas marcadas como favoritas' })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  isFavorite?: boolean;

  @ApiPropertyOptional({ description: 'Filtrar notas archivadas / papelera institucional' })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  isArchived?: boolean;

  @ApiPropertyOptional({ description: 'Filtrar por autor específico (solo para administradores)' })
  @IsOptional()
  @IsUUID('4')
  authorId?: string;
}


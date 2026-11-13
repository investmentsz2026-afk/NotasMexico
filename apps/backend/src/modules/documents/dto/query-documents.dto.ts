import { IsOptional, IsString, IsUUID, IsBoolean, IsInt, Min, Max } from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class QueryDocumentsDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 10, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 10;

  @ApiPropertyOptional({ description: 'Término de búsqueda en nombre original y descripción' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Filtrar por categoría (GENERAL, ACTA, ACUERDO, NOTA, etc.)' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ description: 'Filtrar por tipo MIME o extensión' })
  @IsOptional()
  @IsString()
  mimeType?: string;

  @ApiPropertyOptional({ description: 'Filtrar por estado de escaneo (PENDIENTE_REVISION, LIMPIO, INFECTADO, ERROR_ESCANEO)' })
  @IsOptional()
  @IsString()
  scanStatus?: string;

  @ApiPropertyOptional({ description: 'Filtrar por ID de reunión vinculada' })
  @IsOptional()
  @IsUUID()
  meetingId?: string;

  @ApiPropertyOptional({ description: 'Filtrar por ID de acuerdo vinculado' })
  @IsOptional()
  @IsUUID()
  agreementId?: string;

  @ApiPropertyOptional({ description: 'Filtrar por ID de anotación personal' })
  @IsOptional()
  @IsUUID()
  personalNoteId?: string;

  @ApiPropertyOptional({ description: 'Filtrar por ID de acta vinculada' })
  @IsOptional()
  @IsUUID()
  minutesId?: string;

  @ApiPropertyOptional({ description: 'Filtrar por ID del usuario que cargó el archivo' })
  @IsOptional()
  @IsUUID()
  uploaderId?: string;

  @ApiPropertyOptional({ description: 'Filtrar por estado de archivado' })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  isArchived?: boolean;
}


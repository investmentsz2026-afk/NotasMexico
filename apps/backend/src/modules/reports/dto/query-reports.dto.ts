import { IsOptional, IsString, IsUUID, IsDateString, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class QueryReportsDto {
  @ApiPropertyOptional({ description: 'Fecha de inicio del periodo (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString({}, { message: 'El parámetro "from" debe ser una fecha válida (YYYY-MM-DD).' })
  from?: string;

  @ApiPropertyOptional({ description: 'Fecha de término del periodo (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString({}, { message: 'El parámetro "to" debe ser una fecha válida (YYYY-MM-DD).' })
  to?: string;

  @ApiPropertyOptional({ description: 'Filtrar por ID de categoría temática' })
  @IsOptional()
  @IsUUID('4', { message: 'El parámetro "categoryId" debe ser un UUID v4 válido.' })
  categoryId?: string;

  @ApiPropertyOptional({ description: 'Filtrar por titular responsable (solo permitido a administradores)' })
  @IsOptional()
  @IsUUID('4', { message: 'El parámetro "assignedToId" debe ser un UUID v4 válido.' })
  assignedToId?: string;

  @ApiPropertyOptional({ description: 'Filtrar por estatus del acuerdo o sesión' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ description: 'Filtrar por prioridad del acuerdo (BAJA, MEDIA, ALTA, URGENTE)' })
  @IsOptional()
  @IsString()
  priority?: string;

  @ApiPropertyOptional({ description: 'Número de página para listados (default: 1)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Cantidad de elementos por página (default: 50, máx: 100)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 50;
}


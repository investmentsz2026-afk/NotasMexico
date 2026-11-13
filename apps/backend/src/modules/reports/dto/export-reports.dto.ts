import { IsOptional, IsString, IsUUID, IsDateString, IsIn } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ExportReportsDto {
  @ApiProperty({ enum: ['agreements', 'meetings'], description: 'Tipo de entidad a exportar' })
  @IsIn(['agreements', 'meetings'], { message: 'El parámetro "type" debe ser "agreements" o "meetings".' })
  type!: 'agreements' | 'meetings';

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

  @ApiPropertyOptional({ description: 'Filtrar por titular responsable' })
  @IsOptional()
  @IsUUID('4', { message: 'El parámetro "assignedToId" debe ser un UUID v4 válido.' })
  assignedToId?: string;

  @ApiPropertyOptional({ description: 'Filtrar por estatus' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ description: 'Filtrar por prioridad' })
  @IsOptional()
  @IsString()
  priority?: string;
}

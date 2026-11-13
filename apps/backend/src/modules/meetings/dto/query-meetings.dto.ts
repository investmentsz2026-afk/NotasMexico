import { IsOptional, IsString, IsUUID, IsEnum, IsInt, Min, Max, IsIn } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { MeetingStatus, MeetingModality } from '@mexagenda/shared';

export class QueryMeetingsDto {
  @ApiProperty({ description: 'Número de página (paginación base 1)', default: 1, required: false })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @ApiProperty({ description: 'Cantidad de elementos por página (máximo 100)', default: 10, required: false })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit?: number = 10;

  @ApiProperty({ description: 'Búsqueda por texto en título, folio, lugar o descripción', required: false })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiProperty({ description: 'Filtrar por identificador de categoría', required: false })
  @IsUUID('4')
  @IsOptional()
  categoryId?: string;

  @ApiProperty({ description: 'Filtrar por estado del ciclo de vida', enum: MeetingStatus, required: false })
  @IsEnum(MeetingStatus)
  @IsOptional()
  status?: MeetingStatus;

  @ApiProperty({ description: 'Filtrar por modalidad', enum: MeetingModality, required: false })
  @IsEnum(MeetingModality)
  @IsOptional()
  modality?: MeetingModality;

  @ApiProperty({ description: 'Fecha inicial para rango de búsqueda (YYYY-MM-DD)', required: false })
  @IsString()
  @IsOptional()
  startDate?: string;

  @ApiProperty({ description: 'Fecha final para rango de búsqueda (YYYY-MM-DD)', required: false })
  @IsString()
  @IsOptional()
  endDate?: string;

  @ApiProperty({ description: 'Campo de ordenamiento', default: 'meetingDate', required: false })
  @IsString()
  @IsOptional()
  @IsIn(['meetingDate', 'title', 'folio', 'createdAt', 'status'])
  sortBy?: string = 'meetingDate';

  @ApiProperty({ description: 'Sentido del ordenamiento', default: 'desc', required: false })
  @IsString()
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'desc';
}


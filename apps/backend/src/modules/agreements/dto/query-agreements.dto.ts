import {
  IsOptional,
  IsString,
  IsUUID,
  IsEnum,
  IsInt,
  Min,
  Max,
  IsDateString,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { AgreementStatus, AgreementPriority } from '@mexagenda/shared';

export class QueryAgreementsDto {
  @ApiProperty({ description: 'Número de página (base 1)', default: 1, required: false })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiProperty({ description: 'Cantidad de elementos por página (máx. 100)', default: 10, required: false })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 10;

  @ApiProperty({ description: 'Búsqueda por texto (folio, título o descripción)', required: false })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiProperty({ description: 'Filtrar por estado del acuerdo', enum: AgreementStatus, required: false })
  @IsOptional()
  @IsEnum(AgreementStatus)
  status?: AgreementStatus;

  @ApiProperty({ description: 'Filtrar por prioridad', enum: AgreementPriority, required: false })
  @IsOptional()
  @IsEnum(AgreementPriority)
  priority?: AgreementPriority;

  @ApiProperty({ description: 'Filtrar por tipo de acuerdo', required: false })
  @IsOptional()
  @IsString()
  agreementType?: string;

  @ApiProperty({ description: 'Filtrar por reunión de origen (UUID)', required: false })
  @IsOptional()
  @IsUUID('4')
  meetingId?: string;

  @ApiProperty({ description: 'Filtrar por categoría institucional (UUID)', required: false })
  @IsOptional()
  @IsUUID('4')
  categoryId?: string;

  @ApiProperty({ description: 'Filtrar por usuario responsable asignado (UUID)', required: false })
  @IsOptional()
  @IsUUID('4')
  assignedToId?: string;

  @ApiProperty({ description: 'Filtrar por usuario colaborador (UUID)', required: false })
  @IsOptional()
  @IsUUID('4')
  collaboratorId?: string;

  @ApiProperty({ description: 'Filtrar fecha límite anterior o igual a (YYYY-MM-DD)', required: false })
  @IsOptional()
  @IsDateString()
  dueBefore?: string;

  @ApiProperty({ description: 'Filtrar fecha límite posterior o igual a (YYYY-MM-DD)', required: false })
  @IsOptional()
  @IsDateString()
  dueAfter?: string;

  @ApiProperty({ description: 'Incluir archivados (true/false)', default: 'false', required: false })
  @IsOptional()
  @IsString()
  isArchived?: string;

  @ApiProperty({
    description: 'Campo para ordenar (dueDate, createdAt, title, status, progressPercent, folio)',
    default: 'dueDate',
    required: false,
  })
  @IsOptional()
  @IsString()
  sortBy?: string = 'dueDate';

  @ApiProperty({ description: 'Sentido del ordenamiento (asc, desc)', default: 'asc', required: false })
  @IsOptional()
  @IsString()
  sortOrder?: 'asc' | 'desc' = 'asc';
}


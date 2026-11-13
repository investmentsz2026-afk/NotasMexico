import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsInt,
  Min,
  MaxLength,
  IsArray,
  ValidateNested,
  IsUUID,
  IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class CreateAgendaItemDto {
  @ApiProperty({ description: 'Título del punto del orden del día', example: 'Aprobación del acta anterior' })
  @IsString()
  @IsNotEmpty({ message: 'El título del punto es obligatorio.' })
  @MaxLength(250)
  title!: string;

  @ApiProperty({ description: 'Descripción o consideraciones del punto', required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ description: 'Nombre de la persona o comisionado responsable', required: false })
  @IsString()
  @IsOptional()
  @MaxLength(150)
  responsibleName?: string;

  @ApiProperty({ description: 'UUID de usuario responsable si es integrante institucional', required: false })
  @IsUUID('4')
  @IsOptional()
  responsibleUserId?: string;

  @ApiProperty({ description: 'Tiempo estimado de desahogo en minutos', required: false, example: 20 })
  @IsInt()
  @Min(1)
  @IsOptional()
  estimatedMinutes?: number;

  @ApiProperty({
    description: 'Tipo de punto',
    default: 'ASUNTOS_ORDINARIOS',
    example: 'APROBACION_ACTA_ANTERIOR',
    required: false,
  })
  @IsString()
  @IsOptional()
  @MaxLength(50)
  itemType?: string;

  @ApiProperty({ description: 'Observaciones iniciales', required: false })
  @IsString()
  @IsOptional()
  observations?: string;

  @ApiProperty({ description: 'Posición u orden numérico (auto-asignado si se omite)', required: false })
  @IsInt()
  @Min(1)
  @IsOptional()
  orderIndex?: number;
}

export class UpdateAgendaItemDto {
  @ApiProperty({ description: 'Título del punto', required: false })
  @IsString()
  @IsOptional()
  @MaxLength(250)
  title?: string;

  @ApiProperty({ description: 'Descripción del punto', required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ description: 'Responsable', required: false })
  @IsString()
  @IsOptional()
  @MaxLength(150)
  responsibleName?: string;

  @ApiProperty({ description: 'UUID de usuario responsable', required: false })
  @IsUUID('4')
  @IsOptional()
  responsibleUserId?: string;

  @ApiProperty({ description: 'Tiempo estimado en minutos', required: false })
  @IsInt()
  @Min(1)
  @IsOptional()
  estimatedMinutes?: number;

  @ApiProperty({ description: 'Tipo de punto', required: false })
  @IsString()
  @IsOptional()
  @MaxLength(50)
  itemType?: string;

  @ApiProperty({ description: 'Observaciones', required: false })
  @IsString()
  @IsOptional()
  observations?: string;

  @ApiProperty({ description: 'Estado del punto (PENDIENTE, EN_DISCUSION, TRATADO, POSPUESTO)', required: false })
  @IsString()
  @IsOptional()
  @MaxLength(30)
  status?: string;
}

export class AgendaItemOrderDto {
  @ApiProperty({ description: 'Identificador UUID del punto' })
  @IsUUID('4')
  id!: string;

  @ApiProperty({ description: 'Nuevo orden numérico asignado', example: 1 })
  @IsInt()
  @Min(1)
  orderIndex!: number;
}

export class ReorderAgendaItemsDto {
  @ApiProperty({ description: 'Lista de identificadores y sus nuevos órdenes', type: [AgendaItemOrderDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AgendaItemOrderDto)
  items!: AgendaItemOrderDto[];
}

export class MarkItemTreatedDto {
  @ApiProperty({ description: 'Indica si el punto fue desahogado o tratado', example: true })
  @IsBoolean()
  isTreated!: boolean;

  @ApiProperty({ description: 'Observaciones o conclusiones del desahogo del punto', required: false })
  @IsString()
  @IsOptional()
  observations?: string;
}


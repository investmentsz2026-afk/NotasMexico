import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsInt,
  Min,
  Max,
  IsEnum,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { AgreementStatus } from '@mexagenda/shared';

export class CreateAgreementProgressDto {
  @ApiProperty({
    description: 'Nuevo porcentaje de avance acumulado (0 a 100)',
    example: 45,
  })
  @IsInt({ message: 'El porcentaje de avance debe ser un número entero.' })
  @Min(0, { message: 'El porcentaje de avance no puede ser menor a 0.' })
  @Max(100, { message: 'El porcentaje de avance no puede ser mayor a 100.' })
  newPercent!: number;

  @ApiProperty({
    description: 'Descripción detallada de las acciones y entregables alcanzados',
    example: 'Revisión y validación técnica del informe de metas con la Dirección General.',
  })
  @IsString()
  @IsNotEmpty({ message: 'La descripción del avance es obligatoria.' })
  description!: string;

  @ApiProperty({
    description: 'Observaciones complementarias del seguimiento',
    required: false,
  })
  @IsString()
  @IsOptional()
  observations?: string;

  @ApiProperty({
    description: 'Justificación (obligatoria en caso de reducción o ajuste correctivo de porcentaje)',
    required: false,
  })
  @IsString()
  @IsOptional()
  justification?: string;

  @ApiProperty({
    description: 'Estado sugerido como resultado del avance (opcional, ej. EN_PROCESO)',
    enum: AgreementStatus,
    required: false,
  })
  @IsEnum(AgreementStatus)
  @IsOptional()
  resultingStatus?: AgreementStatus;
}


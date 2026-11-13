import {
  IsString,
  IsUUID,
  IsOptional,
  MaxLength,
  IsEnum,
  IsDateString,
  IsInt,
  Min,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { AgreementPriority } from '../../../_shared';

export class UpdateAgreementDto {
  @ApiProperty({ description: 'Título del acuerdo', required: false })
  @IsString()
  @IsOptional()
  @MaxLength(250)
  title?: string;

  @ApiProperty({ description: 'Descripción o términos del acuerdo', required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ description: 'Tipo o clasificación de acuerdo', required: false })
  @IsString()
  @IsOptional()
  @MaxLength(50)
  agreementType?: string;

  @ApiProperty({ description: 'Identificador de la categoría institucional', required: false })
  @IsUUID('4')
  @IsOptional()
  categoryId?: string;

  @ApiProperty({ description: 'Fecha de inicio (YYYY-MM-DD)', required: false })
  @IsDateString()
  @IsOptional()
  startDate?: string;

  @ApiProperty({ description: 'Fecha límite de cumplimiento (YYYY-MM-DD)', required: false })
  @IsDateString()
  @IsOptional()
  dueDate?: string;

  @ApiProperty({ description: 'Prioridad institucional', enum: AgreementPriority, required: false })
  @IsEnum(AgreementPriority)
  @IsOptional()
  priority?: AgreementPriority;

  @ApiProperty({ description: 'Observaciones complementarias', required: false })
  @IsString()
  @IsOptional()
  observations?: string;

  @ApiProperty({
    description: 'Justificación institucional de la modificación (obligatoria si cambian plazos o condiciones sustantivas)',
    required: false,
  })
  @IsString()
  @IsOptional()
  changeReason?: string;

  @ApiProperty({ description: 'Versión esperada para control de concurrencia optimista', required: false })
  @IsInt()
  @Min(1)
  @IsOptional()
  expectedVersion?: number;
}


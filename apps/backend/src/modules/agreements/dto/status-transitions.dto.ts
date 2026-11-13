import {
  IsNotEmpty,
  IsString,
  IsOptional,
  MinLength,
  IsDateString,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CompleteAgreementDto {
  @ApiProperty({
    description: 'Notas o dictamen formal de cumplimiento del acuerdo',
    example: 'Cumplimiento verificado a cabalidad con entrega de informe oficial de auditoría.',
  })
  @IsString()
  @IsNotEmpty({ message: 'Las notas de confirmación de cumplimiento son obligatorias.' })
  @MinLength(10, { message: 'Las notas de cumplimiento deben tener al menos 10 caracteres.' })
  completionNotes!: string;

  @ApiProperty({
    description: 'Fecha efectiva de cumplimiento en formato YYYY-MM-DD (por defecto hoy)',
    example: '2026-11-25',
    required: false,
  })
  @IsDateString({}, { message: 'La fecha de cumplimiento debe tener formato YYYY-MM-DD válido.' })
  @IsOptional()
  completionDate?: string;
}

export class SuspendAgreementDto {
  @ApiProperty({
    description: 'Justificación institucional obligatoria de la suspensión temporal',
    example: 'Suspensión temporal por veda electoral instruida por la autoridad judicial.',
  })
  @IsString()
  @IsNotEmpty({ message: 'La justificación de suspensión es obligatoria.' })
  @MinLength(10, { message: 'La justificación debe tener al menos 10 caracteres.' })
  justification!: string;

  @ApiProperty({
    description: 'Fecha estimada de reanudación (YYYY-MM-DD)',
    required: false,
  })
  @IsDateString()
  @IsOptional()
  expectedResumeDate?: string;
}

export class ReactivateAgreementDto {
  @ApiProperty({
    description: 'Justificación institucional obligatoria de la reactivación',
    example: 'Reanudación de labores tras concluir la suspensión temporal acordada.',
  })
  @IsString()
  @IsNotEmpty({ message: 'La justificación de reactivación es obligatoria.' })
  @MinLength(10, { message: 'La justificación debe tener al menos 10 caracteres.' })
  justification!: string;

  @ApiProperty({
    description: 'Nueva fecha límite de cumplimiento ajustada (YYYY-MM-DD)',
    required: false,
  })
  @IsDateString()
  @IsOptional()
  newDueDate?: string;
}

export class CancelAgreementDto {
  @ApiProperty({
    description: 'Justificación institucional obligatoria de la cancelación del acuerdo',
    example: 'Cancelado formalmente en sesión extraordinaria por pérdida de materia o sustitución.',
  })
  @IsString()
  @IsNotEmpty({ message: 'La justificación de cancelación es obligatoria.' })
  @MinLength(10, { message: 'La justificación debe tener al menos 10 caracteres.' })
  justification!: string;
}


import {
  IsNotEmpty,
  IsString,
  IsUUID,
  IsOptional,
  MaxLength,
  IsEnum,
  IsDateString,
  IsArray,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { AgreementPriority } from '../../../_shared';

export class CreateAgreementDto {
  @ApiProperty({
    description: 'Título o mandato ejecutivo del acuerdo institucional',
    example: 'Aprobación del Presupuesto Operativo Anual 2027',
  })
  @IsString()
  @IsNotEmpty({ message: 'El título del acuerdo es obligatorio.' })
  @MaxLength(250, { message: 'El título no puede exceder 250 caracteres.' })
  title!: string;

  @ApiProperty({
    description: 'Descripción detallada, términos y alcances acordados',
    example: 'Se aprueba por unanimidad el anteproyecto presupuestal para el ejercicio 2027.',
  })
  @IsString()
  @IsNotEmpty({ message: 'La descripción del acuerdo es obligatoria.' })
  description!: string;

  @ApiProperty({
    description: 'Tipo o clasificación de acuerdo',
    example: 'PRESUPUESTAL',
    required: false,
    default: 'ORDINARIO',
  })
  @IsString()
  @IsOptional()
  @MaxLength(50)
  agreementType?: string;

  @ApiProperty({
    description: 'Identificador UUID de la reunión de origen',
    example: 'a0000000-0000-0000-0000-000000000001',
  })
  @IsUUID('4', { message: 'El meetingId debe ser un UUID v4 válido.' })
  @IsNotEmpty({ message: 'La reunión de origen es obligatoria.' })
  meetingId!: string;

  @ApiProperty({
    description: 'Identificador UUID de la categoría institucional (opcional, hereda de reunión)',
    required: false,
  })
  @IsUUID('4')
  @IsOptional()
  categoryId?: string;

  @ApiProperty({
    description: 'Identificador UUID del punto del orden del día de origen (opcional)',
    required: false,
  })
  @IsUUID('4')
  @IsOptional()
  agendaItemId?: string;

  @ApiProperty({
    description: 'Identificador UUID del acta de origen (opcional)',
    required: false,
  })
  @IsUUID('4')
  @IsOptional()
  minutesId?: string;

  @ApiProperty({
    description: 'Número de versión del acta que respalda el acuerdo en el momento del registro',
    required: false,
  })
  @IsOptional()
  minutesVersionNumber?: number;

  @ApiProperty({
    description: 'Fecha formal de aprobación en formato YYYY-MM-DD (por defecto hoy)',
    example: '2026-11-20',
    required: false,
  })
  @IsDateString({}, { message: 'La fecha de aprobación debe tener formato YYYY-MM-DD válido.' })
  @IsOptional()
  approvalDate?: string;

  @ApiProperty({
    description: 'Fecha programada de inicio de ejecución (YYYY-MM-DD)',
    example: '2026-11-21',
    required: false,
  })
  @IsDateString({}, { message: 'La fecha de inicio debe tener formato YYYY-MM-DD válido.' })
  @IsOptional()
  startDate?: string;

  @ApiProperty({
    description: 'Fecha límite de cumplimiento en formato YYYY-MM-DD',
    example: '2026-12-15',
  })
  @IsDateString({}, { message: 'La fecha límite de cumplimiento es obligatoria (YYYY-MM-DD).' })
  @IsNotEmpty({ message: 'La fecha límite de cumplimiento es obligatoria.' })
  dueDate!: string;

  @ApiProperty({
    description: 'Prioridad institucional del acuerdo',
    enum: AgreementPriority,
    default: AgreementPriority.MEDIA,
    required: false,
  })
  @IsEnum(AgreementPriority, { message: 'La prioridad debe ser BAJA, MEDIA, ALTA o URGENTE.' })
  @IsOptional()
  priority?: AgreementPriority;

  @ApiProperty({
    description: 'Identificador UUID del usuario responsable principal',
    example: 'b0000000-0000-0000-0000-000000000002',
  })
  @IsUUID('4', { message: 'El assignedToId debe ser un UUID v4 válido.' })
  @IsNotEmpty({ message: 'El responsable principal del acuerdo es obligatorio.' })
  assignedToId!: string;

  @ApiProperty({
    description: 'Lista de identificadores UUID de usuarios colaboradores (opcional)',
    type: [String],
    required: false,
  })
  @IsArray()
  @IsUUID('4', { each: true, message: 'Cada colaborador debe ser un UUID v4 válido.' })
  @IsOptional()
  collaboratorUserIds?: string[];

  @ApiProperty({
    description: 'Folio institucional formal (auto-generado si se omite, ej: ACU-ORD-2026-001)',
    required: false,
  })
  @IsString()
  @IsOptional()
  @MaxLength(60)
  folio?: string;

  @ApiProperty({
    description: 'Observaciones institucionales complementarias',
    required: false,
  })
  @IsString()
  @IsOptional()
  observations?: string;
}


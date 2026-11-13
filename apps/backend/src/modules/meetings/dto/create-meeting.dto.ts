import {
  IsNotEmpty,
  IsString,
  IsUUID,
  IsOptional,
  MaxLength,
  Matches,
  IsEnum,
  IsDateString,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { MeetingModality, MeetingStatus } from '@mexagenda/shared';

export class CreateMeetingDto {
  @ApiProperty({
    description: 'Título descriptivo institucional de la reunión',
    example: 'Tercera Sesión Ordinaria de Consejo Directivo',
  })
  @IsString()
  @IsNotEmpty({ message: 'El título de la reunión es obligatorio.' })
  @MaxLength(250)
  title!: string;

  @ApiProperty({
    description: 'Identificador UUID de la categoría institucional',
    example: 'e0b9685a-fb48-4cb9-b3a6-b09cf93c0bc5',
  })
  @IsUUID('4', { message: 'El categoryId debe ser un UUID v4 válido.' })
  @IsNotEmpty({ message: 'La categoría institucional es obligatoria.' })
  categoryId!: string;

  @ApiProperty({
    description: 'Fecha programada de celebración en formato YYYY-MM-DD',
    example: '2026-11-20',
  })
  @IsDateString({}, { message: 'La fecha de la reunión debe ser una fecha válida (YYYY-MM-DD).' })
  @IsNotEmpty({ message: 'La fecha de la reunión es obligatoria.' })
  meetingDate!: string;

  @ApiProperty({
    description: 'Hora programada de inicio en formato HH:mm (24 horas)',
    example: '10:00',
  })
  @IsString()
  @IsNotEmpty({ message: 'La hora de inicio es obligatoria.' })
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'La hora de inicio debe tener formato HH:mm válido (24 horas).',
  })
  startTime!: string;

  @ApiProperty({
    description: 'Hora programada de finalización en formato HH:mm (24 horas)',
    example: '12:30',
  })
  @IsString()
  @IsNotEmpty({ message: 'La hora de finalización es obligatoria.' })
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'La hora de finalización debe tener formato HH:mm válido (24 horas).',
  })
  endTime!: string;

  @ApiProperty({
    description: 'Lugar físico o sala institucional de la reunión',
    example: 'Sala de Plenos — Palacio Central, Piso 3',
  })
  @IsString()
  @IsNotEmpty({ message: 'El lugar o sede es obligatorio.' })
  @MaxLength(255)
  location!: string;

  @ApiProperty({
    description: 'Modalidad de la sesión',
    enum: MeetingModality,
    default: MeetingModality.PRESENCIAL,
  })
  @IsEnum(MeetingModality, { message: 'La modalidad debe ser PRESENCIAL, VIRTUAL o HIBRIDA.' })
  @IsOptional()
  modality?: MeetingModality;

  @ApiProperty({
    description: 'Enlace o URL de conexión para modalidades VIRTUAL o HIBRIDA',
    required: false,
    example: 'https://videoconferencia.institucion.gob.mx/j/123456789',
  })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  virtualUrl?: string;

  @ApiProperty({
    description: 'Zona horaria institucional (default: America/Mexico_City)',
    required: false,
    default: 'America/Mexico_City',
  })
  @IsString()
  @IsOptional()
  @MaxLength(60)
  timezone?: string;

  @ApiProperty({
    description: 'Descripción institucional, orden preliminar y contexto',
    required: false,
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({
    description: 'Observaciones generales iniciales',
    required: false,
  })
  @IsString()
  @IsOptional()
  observations?: string;

  @ApiProperty({
    description: 'Folio o código institucional único (auto-generado si se omite)',
    required: false,
    example: 'SES-2026-001',
  })
  @IsString()
  @IsOptional()
  @MaxLength(50)
  folio?: string;

  @ApiProperty({
    description: 'Estado inicial de la sesión colegiada (default: PROGRAMADA)',
    enum: MeetingStatus,
    required: false,
    default: MeetingStatus.PROGRAMADA,
  })
  @IsEnum(MeetingStatus, { message: 'El estado debe ser un estado válido (ej: BORRADOR o PROGRAMADA).' })
  @IsOptional()
  status?: MeetingStatus;
}


import {
  IsString,
  IsUUID,
  IsOptional,
  MaxLength,
  Matches,
  IsEnum,
  IsDateString,
  IsInt,
  Min,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { MeetingModality } from '../../../_shared';

export class UpdateMeetingDto {
  @ApiProperty({ description: 'Título de la reunión', required: false })
  @IsString()
  @IsOptional()
  @MaxLength(250)
  title?: string;

  @ApiProperty({ description: 'Identificador UUID de la categoría', required: false })
  @IsUUID('4')
  @IsOptional()
  categoryId?: string;

  @ApiProperty({ description: 'Fecha de celebración (YYYY-MM-DD)', required: false })
  @IsDateString()
  @IsOptional()
  meetingDate?: string;

  @ApiProperty({ description: 'Hora de inicio (HH:mm)', required: false })
  @IsString()
  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, { message: 'La hora de inicio debe tener formato HH:mm válido.' })
  startTime?: string;

  @ApiProperty({ description: 'Hora de finalización (HH:mm)', required: false })
  @IsString()
  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, { message: 'La hora de finalización debe tener formato HH:mm válido.' })
  endTime?: string;

  @ApiProperty({ description: 'Lugar o sede física', required: false })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  location?: string;

  @ApiProperty({ description: 'Modalidad de la reunión', enum: MeetingModality, required: false })
  @IsEnum(MeetingModality)
  @IsOptional()
  modality?: MeetingModality;

  @ApiProperty({ description: 'Enlace virtual de conexión', required: false })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  virtualUrl?: string;

  @ApiProperty({ description: 'Descripción o contexto institucional', required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ description: 'Observaciones generales', required: false })
  @IsString()
  @IsOptional()
  observations?: string;

  @ApiProperty({ description: 'Zona horaria institucional', required: false })
  @IsString()
  @IsOptional()
  @MaxLength(60)
  timezone?: string;

  @ApiProperty({ description: 'Identificador del usuario que preside', required: false })
  @IsUUID('4')
  @IsOptional()
  presidedById?: string;

  @ApiProperty({ description: 'Identificador del usuario que funge como secretario', required: false })
  @IsUUID('4')
  @IsOptional()
  secretaryById?: string;

  @ApiProperty({ description: 'Versión esperada del registro para control de concurrencia optimista', required: false })
  @IsInt()
  @Min(1)
  @IsOptional()
  expectedVersion?: number;
}

import { IsNotEmpty, IsEnum, IsString, IsOptional, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { MeetingStatus } from '../../../_shared';

export class ChangeMeetingStatusDto {
  @ApiProperty({
    description: 'Nuevo estado del ciclo de vida de la reunión',
    enum: MeetingStatus,
    example: MeetingStatus.CONVOCADA,
  })
  @IsEnum(MeetingStatus, {
    message: 'El estado debe ser uno de: BORRADOR, PROGRAMADA, CONVOCADA, EN_DESARROLLO, FINALIZADA, CANCELADA, ARCHIVADA.',
  })
  @IsNotEmpty({ message: 'El nuevo estado es requerido.' })
  status!: MeetingStatus;

  @ApiProperty({
    description: 'Motivo o justificación del cambio de estado (requerido si se cancela la reunión)',
    required: false,
    example: 'Por coincidencia de agenda oficial del Pleno.',
  })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  reason?: string;
}


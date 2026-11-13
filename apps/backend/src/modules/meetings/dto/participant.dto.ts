import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsUUID,
  IsEnum,
  IsBoolean,
  IsEmail,
  MaxLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { AttendanceStatus } from '../../../_shared';

export class AddParticipantDto {
  @ApiProperty({ description: 'UUID de usuario institucional registrado (omitir si es externo)', required: false })
  @IsUUID('4')
  @IsOptional()
  userId?: string;

  @ApiProperty({ description: 'Cargo institucional en la reunión', default: 'Vocal', example: 'Presidente de Comisión' })
  @IsString()
  @IsOptional()
  @MaxLength(80)
  institutionalRole?: string;

  @ApiProperty({ description: 'Condición de participación (TITULAR, SUPLENTE, INVITADO, ASESOR)', default: 'TITULAR' })
  @IsString()
  @IsOptional()
  @MaxLength(50)
  participationCondition?: string;

  @ApiProperty({ description: 'Indica si es un invitado o participante externo', default: false })
  @IsBoolean()
  @IsOptional()
  isExternal?: boolean;

  @ApiProperty({ description: 'Nombre completo si es participante externo', required: false })
  @IsString()
  @IsOptional()
  @MaxLength(150)
  externalName?: string;

  @ApiProperty({ description: 'Correo electrónico si es participante externo', required: false })
  @IsEmail()
  @IsOptional()
  @MaxLength(255)
  externalEmail?: string;

  @ApiProperty({ description: 'Organización o dependencia externa representada', required: false })
  @IsString()
  @IsOptional()
  @MaxLength(200)
  externalOrganization?: string;

  @ApiProperty({ description: 'Notas u observaciones de acreditación', required: false })
  @IsString()
  @IsOptional()
  notes?: string;
}

export class UpdateAttendanceDto {
  @ApiProperty({
    description: 'Estado de asistencia',
    enum: AttendanceStatus,
    example: AttendanceStatus.PRESENTE,
  })
  @IsEnum(AttendanceStatus, {
    message: 'El estado de asistencia debe ser uno de: PENDIENTE, PRESENTE, AUSENTE, JUSTIFICADO, TARDANZA, PARTICIPACION_REMOTA, CONVOCADO, ASISTIO, FALTA_JUSTIFICADA.',
  })
  @IsNotEmpty({ message: 'El estado de asistencia es requerido.' })
  attendanceStatus!: AttendanceStatus;

  @ApiProperty({ description: 'Hora de llegada o acreditación en formato HH:mm o ISO', required: false })
  @IsString()
  @IsOptional()
  arrivalTime?: string;

  @ApiProperty({ description: 'Justificación del cambio o de la inasistencia/tardanza', required: false })
  @IsString()
  @IsOptional()
  justification?: string;

  @ApiProperty({ description: 'Observaciones de asistencia', required: false })
  @IsString()
  @IsOptional()
  notes?: string;
}


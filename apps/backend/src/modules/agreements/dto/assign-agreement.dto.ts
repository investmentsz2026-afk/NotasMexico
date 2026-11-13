import {
  IsNotEmpty,
  IsString,
  IsUUID,
  IsOptional,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AssignAgreementDto {
  @ApiProperty({
    description: 'Identificador UUID del nuevo usuario responsable principal',
    example: 'c0000000-0000-0000-0000-000000000003',
  })
  @IsUUID('4', { message: 'El assignedToId debe ser un UUID v4 válido.' })
  @IsNotEmpty({ message: 'El nuevo usuario responsable es obligatorio.' })
  assignedToId!: string;

  @ApiProperty({
    description: 'Justificación institucional obligatoria de la reasignación',
    example: 'Reasignación por cambio de adscripción departamental del titular previo.',
  })
  @IsString()
  @IsNotEmpty({ message: 'La justificación de reasignación es obligatoria.' })
  @MinLength(10, { message: 'La justificación debe tener al menos 10 caracteres.' })
  justification!: string;

  @ApiProperty({
    description: 'Instrucciones o notas adicionales para el nuevo responsable',
    required: false,
  })
  @IsString()
  @IsOptional()
  notes?: string;
}

export class AddCollaboratorDto {
  @ApiProperty({
    description: 'Identificador UUID del usuario a incorporar como colaborador',
    example: 'd0000000-0000-0000-0000-000000000004',
  })
  @IsUUID('4', { message: 'El userId debe ser un UUID v4 válido.' })
  @IsNotEmpty({ message: 'El usuario colaborador es obligatorio.' })
  userId!: string;

  @ApiProperty({
    description: 'Rol o funciones asignadas al colaborador dentro del acuerdo',
    example: 'Coordinación del análisis técnico presupuestal',
    required: false,
  })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  notes?: string;
}


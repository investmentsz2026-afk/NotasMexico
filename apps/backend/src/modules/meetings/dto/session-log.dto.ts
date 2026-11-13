import { IsNotEmpty, IsString, IsOptional, IsUUID, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class StartSessionDto {
  @ApiProperty({ description: 'Hora o timestamp real de inicio (opcional, default ahora)', required: false })
  @IsString()
  @IsOptional()
  realStartTime?: string;

  @ApiProperty({ description: 'UUID del integrante institucional que preside la sesión', required: false })
  @IsUUID('4')
  @IsOptional()
  presidedById?: string;

  @ApiProperty({ description: 'UUID del secretario o relator de actas', required: false })
  @IsUUID('4')
  @IsOptional()
  secretaryById?: string;
}

export class EndSessionDto {
  @ApiProperty({ description: 'Hora o timestamp real de clausura o cierre de la sesión', required: false })
  @IsString()
  @IsOptional()
  realEndTime?: string;

  @ApiProperty({ description: 'Observaciones finales o balance de la sesión', required: false })
  @IsString()
  @IsOptional()
  observations?: string;
}

export class CreateSessionLogDto {
  @ApiProperty({
    description: 'Tipo de entrada en el desarrollo de la sesión',
    example: 'INCIDENCIA',
  })
  @IsString()
  @IsNotEmpty({ message: 'El tipo de entrada es requerido.' })
  @MaxLength(50)
  entryType!: string;

  @ApiProperty({
    description: 'Descripción detallada de la incidencia, acuerdo preliminar o deliberación',
    example: 'Se decretó un receso de 15 minutos para dictaminar el punto 3.',
  })
  @IsString()
  @IsNotEmpty({ message: 'La descripción de la entrada es requerida.' })
  description!: string;

  @ApiProperty({ description: 'UUID del punto del orden del día relacionado', required: false })
  @IsUUID('4')
  @IsOptional()
  agendaItemId?: string;
}


import { IsNotEmpty, IsString, IsOptional, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateOrUpdateMinutesDto {
  @ApiProperty({ description: 'Resumen ejecutivo de lo actuado y deliberado en la sesión' })
  @IsString()
  @IsNotEmpty({ message: 'El resumen o narrativa del acta es obligatorio.' })
  summary!: string;

  @ApiProperty({ description: 'Número de acta institucional formal (auto-generado si se omite)', required: false, example: 'ACTA-2026-003' })
  @IsString()
  @IsOptional()
  @MaxLength(60)
  minutesNumber?: string;

  @ApiProperty({ description: 'Resumen estructurado por puntos tratados', required: false })
  @IsString()
  @IsOptional()
  pointsTreatedSummary?: string;

  @ApiProperty({ description: 'Observaciones generales del acta', required: false })
  @IsString()
  @IsOptional()
  observations?: string;

  @ApiProperty({ description: 'Registro de incidencias o votos particulares', required: false })
  @IsString()
  @IsOptional()
  incidents?: string;

  @ApiProperty({ description: 'Sede, lugar o modalidad registrada', required: false })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  locationOrModality?: string;

  @ApiProperty({ description: 'Nombre de la autoridad que presidió la sesión', required: false })
  @IsString()
  @IsOptional()
  @MaxLength(200)
  presidedByName?: string;

  @ApiProperty({ description: 'Nombre del secretario o relator de actas', required: false })
  @IsString()
  @IsOptional()
  @MaxLength(200)
  secretaryByName?: string;

  @ApiProperty({ description: 'Justificación del cambio (requerido si se modifica tras aprobación)', required: false })
  @IsString()
  @IsOptional()
  changeReason?: string;

  @ApiProperty({ description: 'Estado del acta (BORRADOR, EN_REVISION, APROBADA)', required: false })
  @IsString()
  @IsOptional()
  status?: string;
}

export class ApproveMinutesDto {
  @ApiProperty({ description: 'Notas de aprobación colegiada o número de acuerdo de aprobación', required: false })
  @IsString()
  @IsOptional()
  approvalNotes?: string;
}

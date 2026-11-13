import { IsNotEmpty, IsString, IsOptional, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateOrUpdateConvocatoriaDto {
  @ApiProperty({ description: 'Texto formal de la convocatoria institucional', example: 'Por medio de la presente se convoca a los integrantes del Consejo...' })
  @IsString()
  @IsNotEmpty({ message: 'El texto de la convocatoria es requerido.' })
  noticeText!: string;

  @ApiProperty({ description: 'Número de oficio o folio formal de la convocatoria (auto-generado si se omite)', required: false, example: 'CONV-2026-003' })
  @IsString()
  @IsOptional()
  @MaxLength(60)
  convocatoriaNumber?: string;

  @ApiProperty({ description: 'Observaciones generales o instrucciones de acceso', required: false })
  @IsString()
  @IsOptional()
  observations?: string;
}

export class PublishConvocatoriaDto {
  @ApiProperty({ description: 'Observaciones o nota de publicación formal', required: false })
  @IsString()
  @IsOptional()
  observations?: string;
}


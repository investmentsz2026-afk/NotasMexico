import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UploadDocumentDto {
  @ApiPropertyOptional({ description: 'Categoría institucional del documento', default: 'GENERAL' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  category?: string;

  @ApiPropertyOptional({ description: 'Descripción o resumen del documento institucional' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'ID de la reunión institucional vinculada (UUID)' })
  @IsOptional()
  @IsUUID()
  meetingId?: string;

  @ApiPropertyOptional({ description: 'ID del acuerdo institucional vinculado (UUID)' })
  @IsOptional()
  @IsUUID()
  agreementId?: string;

  @ApiPropertyOptional({ description: 'ID de la anotación personal vinculada (UUID)' })
  @IsOptional()
  @IsUUID()
  personalNoteId?: string;

  @ApiPropertyOptional({ description: 'ID del acta institucional vinculada (UUID)' })
  @IsOptional()
  @IsUUID()
  minutesId?: string;
}


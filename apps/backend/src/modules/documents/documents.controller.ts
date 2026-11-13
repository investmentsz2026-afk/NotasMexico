import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse as SwaggerApiResponse, ApiCookieAuth, ApiConsumes } from '@nestjs/swagger';
import type { Request } from 'express';
import { DocumentsService } from './documents.service';
import { UploadDocumentDto } from './dto/upload-document.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';
import { QueryDocumentsDto } from './dto/query-documents.dto';
import { SessionAuthGuard } from '../../common/guards/session-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import {
  FileScanStatus,
  type ApiResponse,
  type DocumentListItemDto,
  type DocumentDetailDto,
  type DownloadUrlDto,
  type PaginatedResponse,
  type AuthUser,
} from '@mexagenda/shared';

@ApiTags('MOD-05 — Bóveda Digital y Gestión Documental')
@Controller('documents')
@UseGuards(SessionAuthGuard, PermissionsGuard)
@ApiCookieAuth()
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Post('upload')
  @RequirePermissions('document:upload')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Cargar un archivo adjunto seguro en la bóveda digital' })
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UploadDocumentDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ): Promise<ApiResponse<DocumentDetailDto>> {
    const ipAddress = req.ip || (req.headers['x-forwarded-for'] as string) || '127.0.0.1';
    const userAgent = req.headers['user-agent'] || 'MexAgenda-Client';

    const data = await this.documentsService.upload(file, dto, user, ipAddress, userAgent);
    return {
      success: true,
      statusCode: HttpStatus.CREATED,
      data,
      timestamp: new Date().toISOString(),
    };
  }

  @Get()
  @RequirePermissions('document:read')
  @ApiOperation({ summary: 'Consultar catálogo de documentos institucionales con filtros y paginación' })
  async findAll(
    @Query() query: QueryDocumentsDto,
    @CurrentUser() user: AuthUser,
  ): Promise<ApiResponse<PaginatedResponse<DocumentListItemDto>>> {
    const data = await this.documentsService.findAll(query, user);
    return {
      success: true,
      statusCode: HttpStatus.OK,
      data,
      timestamp: new Date().toISOString(),
    };
  }

  @Get(':id')
  @RequirePermissions('document:read')
  @ApiOperation({ summary: 'Obtener metadatos detallados y trazabilidad de un documento' })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ): Promise<ApiResponse<DocumentDetailDto>> {
    const ipAddress = req.ip || (req.headers['x-forwarded-for'] as string) || '127.0.0.1';
    const userAgent = req.headers['user-agent'] || 'MexAgenda-Client';

    const data = await this.documentsService.findOne(id, user, ipAddress, userAgent);
    return {
      success: true,
      statusCode: HttpStatus.OK,
      data,
      timestamp: new Date().toISOString(),
    };
  }

  @Get(':id/download')
  @RequirePermissions('document:download')
  @ApiOperation({ summary: 'Generar URL presignada autorizada para descarga temporal de un documento' })
  async getDownloadUrl(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ): Promise<ApiResponse<DownloadUrlDto>> {
    const ipAddress = req.ip || (req.headers['x-forwarded-for'] as string) || '127.0.0.1';
    const userAgent = req.headers['user-agent'] || 'MexAgenda-Client';

    const data = await this.documentsService.getDownloadUrl(id, user, ipAddress, userAgent);
    return {
      success: true,
      statusCode: HttpStatus.OK,
      data,
      timestamp: new Date().toISOString(),
    };
  }

  @Patch(':id')
  @RequirePermissions('document:update_own')
  @ApiOperation({ summary: 'Actualizar metadatos de un documento institucional propio' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDocumentDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ): Promise<ApiResponse<DocumentDetailDto>> {
    const ipAddress = req.ip || (req.headers['x-forwarded-for'] as string) || '127.0.0.1';
    const userAgent = req.headers['user-agent'] || 'MexAgenda-Client';

    const data = await this.documentsService.update(id, dto, user, ipAddress, userAgent);
    return {
      success: true,
      statusCode: HttpStatus.OK,
      data,
      timestamp: new Date().toISOString(),
    };
  }

  @Delete(':id')
  @RequirePermissions('document:delete_own')
  @ApiOperation({ summary: 'Eliminación suave de un documento propio de la bóveda' })
  async softDelete(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ): Promise<ApiResponse<{ success: boolean; message: string }>> {
    const ipAddress = req.ip || (req.headers['x-forwarded-for'] as string) || '127.0.0.1';
    const userAgent = req.headers['user-agent'] || 'MexAgenda-Client';

    const data = await this.documentsService.softDelete(id, user, ipAddress, userAgent);
    return {
      success: true,
      statusCode: HttpStatus.OK,
      data,
      timestamp: new Date().toISOString(),
    };
  }

  @Post(':id/version')
  @RequirePermissions('document:upload')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Cargar una nueva versión incremental de un documento existente' })
  async uploadNewVersion(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ): Promise<ApiResponse<DocumentDetailDto>> {
    const ipAddress = req.ip || (req.headers['x-forwarded-for'] as string) || '127.0.0.1';
    const userAgent = req.headers['user-agent'] || 'MexAgenda-Client';

    const data = await this.documentsService.uploadNewVersion(id, file, user, ipAddress, userAgent);
    return {
      success: true,
      statusCode: HttpStatus.CREATED,
      data,
      timestamp: new Date().toISOString(),
    };
  }

  @Post(':id/restore')
  @RequirePermissions('document:admin:manage')
  @ApiOperation({ summary: 'Restaurar documento previamente eliminado (Administración exclusiva)' })
  async restore(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ): Promise<ApiResponse<DocumentDetailDto>> {
    const ipAddress = req.ip || (req.headers['x-forwarded-for'] as string) || '127.0.0.1';
    const userAgent = req.headers['user-agent'] || 'MexAgenda-Client';

    const data = await this.documentsService.restore(id, user, ipAddress, userAgent);
    return {
      success: true,
      statusCode: HttpStatus.OK,
      data,
      timestamp: new Date().toISOString(),
    };
  }

  @Patch(':id/scan-status')
  @RequirePermissions('document:admin:manage')
  @ApiOperation({ summary: 'Actualizar estado de escaneo de malware (Administración exclusiva)' })
  async updateScanStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('scanStatus') scanStatus: FileScanStatus,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ): Promise<ApiResponse<DocumentDetailDto>> {
    const ipAddress = req.ip || (req.headers['x-forwarded-for'] as string) || '127.0.0.1';
    const userAgent = req.headers['user-agent'] || 'MexAgenda-Client';

    const data = await this.documentsService.updateScanStatus(id, scanStatus, user, ipAddress, userAgent);
    return {
      success: true,
      statusCode: HttpStatus.OK,
      data,
      timestamp: new Date().toISOString(),
    };
  }
}


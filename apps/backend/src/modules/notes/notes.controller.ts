import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse as SwaggerApiResponse, ApiCookieAuth } from '@nestjs/swagger';
import type { Request } from 'express';
import { NotesService } from './notes.service';
import { CreateNoteDto } from './dto/create-note.dto';
import { UpdateNoteDto } from './dto/update-note.dto';
import { AdminInterveneNoteDto } from './dto/admin-intervene-note.dto';
import { QueryNotesDto } from './dto/query-notes.dto';
import { SessionAuthGuard } from '../../common/guards/session-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type {
  ApiResponse,
  PersonalNoteListItem,
  PersonalNoteDetailDto,
  PersonalNoteVersionDto,
  PaginatedResponse,
  AuthUser,
} from '@mexagenda/shared';

@ApiTags('MOD-04 — Anotaciones Personales y Notas de Sesión')
@Controller('notes')
@UseGuards(SessionAuthGuard, PermissionsGuard)
@ApiCookieAuth()
export class NotesController {
  constructor(private readonly notesService: NotesService) {}

  // -------------------------------------------------------------
  // RUTAS ESTÁTICAS (DEBEN IR ANTES DE :id)
  // -------------------------------------------------------------

  @Get('meeting/:meetingId')
  @RequirePermissions('note:read')
  @ApiOperation({ summary: 'Consultar notas de sesión vinculadas a una reunión' })
  async findByMeeting(
    @Param('meetingId') meetingId: string,
    @CurrentUser() user: AuthUser,
  ): Promise<ApiResponse<PersonalNoteListItem[]>> {
    const data = await this.notesService.findByMeeting(meetingId, user);
    return {
      success: true,
      statusCode: HttpStatus.OK,
      data,
      timestamp: new Date().toISOString(),
    };
  }

  // -------------------------------------------------------------
  // LISTADO Y CREACIÓN DE ANOTACIONES
  // -------------------------------------------------------------

  @Get()
  @RequirePermissions('note:read')
  @ApiOperation({ summary: 'Listar anotaciones institucionales con filtros y paginación' })
  async findAll(
    @Query() query: QueryNotesDto,
    @CurrentUser() user: AuthUser,
  ): Promise<ApiResponse<PaginatedResponse<PersonalNoteListItem>>> {
    const result = await this.notesService.findAll(query, user);
    return {
      success: true,
      statusCode: HttpStatus.OK,
      data: result,
      timestamp: new Date().toISOString(),
    };
  }

  @Post()
  @RequirePermissions('note:create')
  @ApiOperation({ summary: 'Crear una nueva anotación institucional personal o de sesión' })
  async create(
    @Body() dto: CreateNoteDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ): Promise<ApiResponse<PersonalNoteDetailDto>> {
    const ip = req.ip || req.socket.remoteAddress || '127.0.0.1';
    const userAgent = (req.headers['user-agent'] as string) || 'unknown';

    const created = await this.notesService.create(dto, user, ip, userAgent);
    return {
      success: true,
      statusCode: HttpStatus.CREATED,
      data: created,
      timestamp: new Date().toISOString(),
    };
  }

  // -------------------------------------------------------------
  // DETALLE, ACTUALIZACIÓN ORDINARIA Y VERSIONES
  // -------------------------------------------------------------

  @Get(':id')
  @RequirePermissions('note:read')
  @ApiOperation({ summary: 'Obtener detalle completo de una anotación institucional' })
  async findById(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ): Promise<ApiResponse<PersonalNoteDetailDto>> {
    const note = await this.notesService.findById(id, user);
    return {
      success: true,
      statusCode: HttpStatus.OK,
      data: note,
      timestamp: new Date().toISOString(),
    };
  }

  @Put(':id')
  @RequirePermissions('note:update_own')
  @ApiOperation({ summary: 'Actualización ordinaria de la anotación (exclusiva del autor)' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateNoteDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ): Promise<ApiResponse<PersonalNoteDetailDto>> {
    const ip = req.ip || req.socket.remoteAddress || '127.0.0.1';
    const userAgent = (req.headers['user-agent'] as string) || 'unknown';

    const updated = await this.notesService.update(id, dto, user, ip, userAgent);
    return {
      success: true,
      statusCode: HttpStatus.OK,
      data: updated,
      timestamp: new Date().toISOString(),
    };
  }

  @Patch(':id')
  @RequirePermissions('note:update_own')
  @ApiOperation({ summary: 'Actualización parcial de la anotación (exclusiva del autor)' })
  async partialUpdate(
    @Param('id') id: string,
    @Body() dto: UpdateNoteDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ): Promise<ApiResponse<PersonalNoteDetailDto>> {
    const ip = req.ip || req.socket.remoteAddress || '127.0.0.1';
    const userAgent = (req.headers['user-agent'] as string) || 'unknown';

    const updated = await this.notesService.update(id, dto, user, ip, userAgent);
    return {
      success: true,
      statusCode: HttpStatus.OK,
      data: updated,
      timestamp: new Date().toISOString(),
    };
  }

  @Post(':id/intervene')
  @RequirePermissions('note:override_any')
  @ApiOperation({ summary: 'Intervención administrativa extraordinaria sobre anotaciones' })
  async adminIntervene(
    @Param('id') id: string,
    @Body() dto: AdminInterveneNoteDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ): Promise<ApiResponse<PersonalNoteDetailDto>> {
    const ip = req.ip || req.socket.remoteAddress || '127.0.0.1';
    const userAgent = (req.headers['user-agent'] as string) || 'unknown';

    const result = await this.notesService.adminIntervene(id, dto, user, ip, userAgent);
    return {
      success: true,
      statusCode: HttpStatus.OK,
      data: result,
      timestamp: new Date().toISOString(),
    };
  }

  @Get(':id/versions')
  @RequirePermissions('note:history:read')
  @ApiOperation({ summary: 'Consultar bitácora inmutable de versiones de la anotación' })
  async getVersions(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ): Promise<ApiResponse<PersonalNoteVersionDto[]>> {
    const versions = await this.notesService.getVersions(id, user);
    return {
      success: true,
      statusCode: HttpStatus.OK,
      data: versions,
      timestamp: new Date().toISOString(),
    };
  }

  // -------------------------------------------------------------
  // ARCHIVADO, RESTAURACIÓN Y ELIMINACIÓN PERMANENTE
  // -------------------------------------------------------------

  @Delete(':id')
  @RequirePermissions('note:delete_own')
  @ApiOperation({ summary: 'Archivar anotación institucional (Soft delete / Papelera)' })
  async archive(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ): Promise<ApiResponse<{ message: string; id: string }>> {
    const ip = req.ip || req.socket.remoteAddress || '127.0.0.1';
    const userAgent = (req.headers['user-agent'] as string) || 'unknown';

    const result = await this.notesService.archive(id, user, ip, userAgent);
    return {
      success: true,
      statusCode: HttpStatus.OK,
      data: result,
      timestamp: new Date().toISOString(),
    };
  }

  @Post(':id/restore')
  @RequirePermissions('note:delete_own')
  @ApiOperation({ summary: 'Restaurar anotación archivada' })
  async restore(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ): Promise<ApiResponse<{ message: string; id: string }>> {
    const ip = req.ip || req.socket.remoteAddress || '127.0.0.1';
    const userAgent = (req.headers['user-agent'] as string) || 'unknown';

    const result = await this.notesService.restore(id, user, ip, userAgent);
    return {
      success: true,
      statusCode: HttpStatus.OK,
      data: result,
      timestamp: new Date().toISOString(),
    };
  }

  @Delete(':id/permanent')
  @RequirePermissions('note:override_any')
  @ApiOperation({ summary: 'Eliminar definitivamente una anotación (Hard Delete administrativo)' })
  async deletePermanently(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ): Promise<ApiResponse<{ message: string; id: string }>> {
    const ip = req.ip || req.socket.remoteAddress || '127.0.0.1';
    const userAgent = (req.headers['user-agent'] as string) || 'unknown';

    const result = await this.notesService.deletePermanently(id, user, ip, userAgent);
    return {
      success: true,
      statusCode: HttpStatus.OK,
      data: result,
      timestamp: new Date().toISOString(),
    };
  }
}


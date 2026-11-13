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
import { MeetingsService } from './meetings.service';
import { CreateMeetingDto } from './dto/create-meeting.dto';
import { UpdateMeetingDto } from './dto/update-meeting.dto';
import { QueryMeetingsDto } from './dto/query-meetings.dto';
import { ChangeMeetingStatusDto } from './dto/change-meeting-status.dto';
import {
  CreateAgendaItemDto,
  UpdateAgendaItemDto,
  ReorderAgendaItemsDto,
  MarkItemTreatedDto,
} from './dto/agenda.dto';
import { AddParticipantDto, UpdateAttendanceDto } from './dto/participant.dto';
import {
  CreateOrUpdateConvocatoriaDto,
  PublishConvocatoriaDto,
} from './dto/convocatoria.dto';
import {
  StartSessionDto,
  EndSessionDto,
  CreateSessionLogDto,
} from './dto/session-log.dto';
import { CreateOrUpdateMinutesDto, ApproveMinutesDto } from './dto/minutes.dto';
import { SessionAuthGuard } from '../../common/guards/session-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type {
  ApiResponse,
  MeetingListItem,
  MeetingDetailDto,
  PaginatedResponse,
  AuthUser,
} from '../../_shared';

@ApiTags('Gestión Institucional de Reuniones y Sesiones')
@Controller('meetings')
@UseGuards(SessionAuthGuard, PermissionsGuard)
@ApiCookieAuth()
export class MeetingsController {
  constructor(private readonly meetingsService: MeetingsService) {}

  // -------------------------------------------------------------
  // REUNIONES CRUD
  // -------------------------------------------------------------

  @Get()
  @RequirePermissions('meeting:read')
  @ApiOperation({ summary: 'Listar reuniones con filtros y paginación en servidor' })
  async findAll(@Query() query: QueryMeetingsDto): Promise<ApiResponse<PaginatedResponse<MeetingListItem>>> {
    const result = await this.meetingsService.findAll(query);
    return {
      success: true,
      statusCode: HttpStatus.OK,
      data: result,
      timestamp: new Date().toISOString(),
    };
  }

  @Get(':id')
  @RequirePermissions('meeting:read')
  @ApiOperation({ summary: 'Obtener detalle completo de una reunión institucional' })
  async findById(@Param('id') id: string): Promise<ApiResponse<MeetingDetailDto>> {
    const meeting = await this.meetingsService.findById(id);
    return {
      success: true,
      statusCode: HttpStatus.OK,
      data: meeting,
      timestamp: new Date().toISOString(),
    };
  }

  @Post()
  @RequirePermissions('meeting:create')
  @ApiOperation({ summary: 'Crear una nueva reunión institucional' })
  async create(
    @Body() dto: CreateMeetingDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ): Promise<ApiResponse<MeetingDetailDto>> {
    const ip = req.ip || req.socket.remoteAddress || '127.0.0.1';
    const userAgent = req.headers['user-agent'] || 'unknown';

    const created = await this.meetingsService.create(dto, user.id, ip, userAgent);
    return {
      success: true,
      statusCode: HttpStatus.CREATED,
      data: created,
      timestamp: new Date().toISOString(),
    };
  }

  @Put(':id')
  @RequirePermissions('meeting:update')
  @ApiOperation({ summary: 'Actualizar información general de una reunión' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateMeetingDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ): Promise<ApiResponse<MeetingDetailDto>> {
    const ip = req.ip || req.socket.remoteAddress || '127.0.0.1';
    const userAgent = req.headers['user-agent'] || 'unknown';

    const updated = await this.meetingsService.update(id, dto, user.id, ip, userAgent);
    return {
      success: true,
      statusCode: HttpStatus.OK,
      data: updated,
      timestamp: new Date().toISOString(),
    };
  }

  @Patch(':id/status')
  @RequirePermissions('meeting:update')
  @ApiOperation({ summary: 'Cambiar estado del ciclo de vida de la reunión' })
  async changeStatus(
    @Param('id') id: string,
    @Body() dto: ChangeMeetingStatusDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ): Promise<ApiResponse<MeetingDetailDto>> {
    const ip = req.ip || req.socket.remoteAddress || '127.0.0.1';
    const userAgent = req.headers['user-agent'] || 'unknown';

    const updated = await this.meetingsService.changeStatus(id, dto, user.id, ip, userAgent);
    return {
      success: true,
      statusCode: HttpStatus.OK,
      data: updated,
      timestamp: new Date().toISOString(),
    };
  }

  @Delete(':id')
  @RequirePermissions('meeting:delete')
  @ApiOperation({ summary: 'Archivar reunión (eliminación lógica institucional)' })
  async archive(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ): Promise<ApiResponse<{ message: string }>> {
    const ip = req.ip || req.socket.remoteAddress || '127.0.0.1';
    const userAgent = req.headers['user-agent'] || 'unknown';

    const res = await this.meetingsService.archive(id, user.id, ip, userAgent);
    return {
      success: true,
      statusCode: HttpStatus.OK,
      data: res,
      timestamp: new Date().toISOString(),
    };
  }

  // -------------------------------------------------------------
  // ORDEN DEL DÍA
  // -------------------------------------------------------------

  @Post(':id/agenda')
  @RequirePermissions('meeting:update')
  @ApiOperation({ summary: 'Agregar un punto al orden del día' })
  async addAgendaItem(
    @Param('id') id: string,
    @Body() dto: CreateAgendaItemDto,
    @CurrentUser() user: AuthUser,
  ) {
    const item = await this.meetingsService.addAgendaItem(id, dto, user.id);
    return {
      success: true,
      statusCode: HttpStatus.CREATED,
      data: item,
      timestamp: new Date().toISOString(),
    };
  }

  @Put(':id/agenda/reorder')
  @RequirePermissions('meeting:update')
  @ApiOperation({ summary: 'Reordenar los puntos del orden del día' })
  async reorderAgendaItems(
    @Param('id') id: string,
    @Body() dto: ReorderAgendaItemsDto,
    @CurrentUser() user: AuthUser,
  ) {
    const res = await this.meetingsService.reorderAgendaItems(id, dto, user.id);
    return {
      success: true,
      statusCode: HttpStatus.OK,
      data: res,
      timestamp: new Date().toISOString(),
    };
  }

  @Put(':id/agenda/:itemId')
  @RequirePermissions('meeting:update')
  @ApiOperation({ summary: 'Modificar un punto del orden del día' })
  async updateAgendaItem(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body() dto: UpdateAgendaItemDto,
    @CurrentUser() user: AuthUser,
  ) {
    const updated = await this.meetingsService.updateAgendaItem(id, itemId, dto, user.id);
    return {
      success: true,
      statusCode: HttpStatus.OK,
      data: updated,
      timestamp: new Date().toISOString(),
    };
  }

  @Patch(':id/agenda/:itemId/treated')
  @RequirePermissions('meeting:update')
  @ApiOperation({ summary: 'Marcar punto del orden del día como tratado/desahogado' })
  async markItemTreated(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body() dto: MarkItemTreatedDto,
    @CurrentUser() user: AuthUser,
  ) {
    const updated = await this.meetingsService.markAgendaItemTreated(
      id,
      itemId,
      dto,
      user.id,
    );
    return {
      success: true,
      statusCode: HttpStatus.OK,
      data: updated,
      timestamp: new Date().toISOString(),
    };
  }

  @Delete(':id/agenda/:itemId')
  @RequirePermissions('meeting:update')
  @ApiOperation({ summary: 'Eliminar lógicamente un punto del orden del día' })
  async deleteAgendaItem(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @CurrentUser() user: AuthUser,
  ) {
    const res = await this.meetingsService.deleteAgendaItem(id, itemId, user.id);
    return {
      success: true,
      statusCode: HttpStatus.OK,
      data: res,
      timestamp: new Date().toISOString(),
    };
  }

  // -------------------------------------------------------------
  // PARTICIPANTES Y ASISTENCIA
  // -------------------------------------------------------------

  @Post(':id/participants')
  @RequirePermissions('meeting:update')
  @ApiOperation({ summary: 'Incorporar participante a la reunión' })
  async addParticipant(
    @Param('id') id: string,
    @Body() dto: AddParticipantDto,
    @CurrentUser() user: AuthUser,
  ) {
    const participant = await this.meetingsService.addParticipant(id, dto, user.id);
    return {
      success: true,
      statusCode: HttpStatus.CREATED,
      data: participant,
      timestamp: new Date().toISOString(),
    };
  }

  @Delete(':id/participants/:participantId')
  @RequirePermissions('meeting:update')
  @ApiOperation({ summary: 'Remover participante de la reunión' })
  async removeParticipant(
    @Param('id') id: string,
    @Param('participantId') participantId: string,
    @CurrentUser() user: AuthUser,
  ) {
    const res = await this.meetingsService.removeParticipant(id, participantId, user.id);
    return {
      success: true,
      statusCode: HttpStatus.OK,
      data: res,
      timestamp: new Date().toISOString(),
    };
  }

  @Post([':id/attendance/self', ':id/participants/self'])
  @ApiOperation({ summary: 'Registrar o actualizar asistencia propia del usuario autenticado' })
  async registerSelfAttendance(
    @Param('id') id: string,
    @Body() dto: UpdateAttendanceDto,
    @CurrentUser() user: AuthUser,
  ) {
    const updated = await this.meetingsService.registerSelfAttendance(
      id,
      dto,
      user,
    );
    return {
      success: true,
      statusCode: HttpStatus.OK,
      data: updated,
      timestamp: new Date().toISOString(),
    };
  }

  @Patch([':id/participants/:participantId/attendance', ':id/attendance/:participantId'])
  @ApiOperation({ summary: 'Registrar o modificar asistencia individual de un participante' })
  async updateAttendance(
    @Param('id') id: string,
    @Param('participantId') participantId: string,
    @Body() dto: UpdateAttendanceDto,
    @CurrentUser() user: AuthUser,
  ) {
    const updated = await this.meetingsService.updateAttendance(
      id,
      participantId,
      dto,
      user.id,
      user,
    );
    return {
      success: true,
      statusCode: HttpStatus.OK,
      data: updated,
      timestamp: new Date().toISOString(),
    };
  }

  // -------------------------------------------------------------
  // CONVOCATORIAS
  // -------------------------------------------------------------

  @Post(':id/convocatoria')
  @RequirePermissions('meeting:update')
  @ApiOperation({ summary: 'Crear o editar texto de la convocatoria' })
  async createOrUpdateConvocatoria(
    @Param('id') id: string,
    @Body() dto: CreateOrUpdateConvocatoriaDto,
    @CurrentUser() user: AuthUser,
  ) {
    const convocatoria = await this.meetingsService.createOrUpdateConvocatoria(
      id,
      dto,
      user.id,
    );
    return {
      success: true,
      statusCode: HttpStatus.OK,
      data: convocatoria,
      timestamp: new Date().toISOString(),
    };
  }

  @Post(':id/convocatoria/publish')
  @RequirePermissions('meeting:update')
  @ApiOperation({ summary: 'Publicar formalmente la convocatoria a los destinatarios' })
  async publishConvocatoria(
    @Param('id') id: string,
    @Body() dto: PublishConvocatoriaDto,
    @CurrentUser() user: AuthUser,
  ) {
    const published = await this.meetingsService.publishConvocatoria(
      id,
      dto,
      user.id,
    );
    return {
      success: true,
      statusCode: HttpStatus.OK,
      data: published,
      timestamp: new Date().toISOString(),
    };
  }

  // -------------------------------------------------------------
  // DESARROLLO DE SESIÓN
  // -------------------------------------------------------------

  @Post(':id/session/start')
  @RequirePermissions('meeting:update')
  @ApiOperation({ summary: 'Iniciar formalmente la sesión institucional' })
  async startSession(
    @Param('id') id: string,
    @Body() dto: StartSessionDto,
    @CurrentUser() user: AuthUser,
  ) {
    const meeting = await this.meetingsService.startSession(id, dto, user.id);
    return {
      success: true,
      statusCode: HttpStatus.OK,
      data: meeting,
      timestamp: new Date().toISOString(),
    };
  }

  @Post(':id/session/end')
  @RequirePermissions('meeting:update')
  @ApiOperation({ summary: 'Finalizar y clausurar la sesión institucional' })
  async endSession(
    @Param('id') id: string,
    @Body() dto: EndSessionDto,
    @CurrentUser() user: AuthUser,
  ) {
    const meeting = await this.meetingsService.endSession(id, dto, user.id);
    return {
      success: true,
      statusCode: HttpStatus.OK,
      data: meeting,
      timestamp: new Date().toISOString(),
    };
  }

  @Post(':id/session/logs')
  @RequirePermissions('meeting:update')
  @ApiOperation({ summary: 'Registrar incidencia, receso o deliberación en el desarrollo' })
  async addSessionLog(
    @Param('id') id: string,
    @Body() dto: CreateSessionLogDto,
    @CurrentUser() user: AuthUser,
  ) {
    const log = await this.meetingsService.addSessionLog(id, dto, user.id);
    return {
      success: true,
      statusCode: HttpStatus.CREATED,
      data: log,
      timestamp: new Date().toISOString(),
    };
  }

  // -------------------------------------------------------------
  // ACTAS INSTITUCIONALES (MINUTES)
  // -------------------------------------------------------------

  @Post(':id/minutes')
  @RequirePermissions('meeting:update')
  @ApiOperation({ summary: 'Crear o editar borrador del acta institucional' })
  async createOrUpdateMinutes(
    @Param('id') id: string,
    @Body() dto: CreateOrUpdateMinutesDto,
    @CurrentUser() user: AuthUser,
  ) {
    const minutes = await this.meetingsService.createOrUpdateMinutes(
      id,
      dto,
      user.id,
    );
    return {
      success: true,
      statusCode: HttpStatus.OK,
      data: minutes,
      timestamp: new Date().toISOString(),
    };
  }

  @Patch(':id/minutes/review')
  @RequirePermissions('meeting:update')
  @ApiOperation({ summary: 'Enviar acta a revisión colegiada' })
  async sendMinutesToRevision(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ) {
    const updated = await this.meetingsService.sendMinutesToRevision(id, user.id);
    return {
      success: true,
      statusCode: HttpStatus.OK,
      data: updated,
      timestamp: new Date().toISOString(),
    };
  }

  @Patch(':id/minutes/approve')
  @RequirePermissions('meeting:minutes:approve')
  @ApiOperation({ summary: 'Aprobar formalmente el acta institucional' })
  async approveMinutes(
    @Param('id') id: string,
    @Body() dto: ApproveMinutesDto,
    @CurrentUser() user: AuthUser,
  ) {
    const approved = await this.meetingsService.approveMinutes(id, dto, user.id);
    return {
      success: true,
      statusCode: HttpStatus.OK,
      data: approved,
      timestamp: new Date().toISOString(),
    };
  }

  @Get(':id/minutes/versions')
  @RequirePermissions('meeting:read')
  @ApiOperation({ summary: 'Consultar historial de versiones del acta' })
  async getMinutesVersions(@Param('id') id: string) {
    const versions = await this.meetingsService.getMinutesVersions(id);
    return {
      success: true,
      statusCode: HttpStatus.OK,
      data: versions,
      timestamp: new Date().toISOString(),
    };
  }
}


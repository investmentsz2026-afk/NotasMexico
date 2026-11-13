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
import { Request } from 'express';
import { AgreementsService } from './agreements.service';
import { CreateAgreementDto } from './dto/create-agreement.dto';
import { UpdateAgreementDto } from './dto/update-agreement.dto';
import { QueryAgreementsDto } from './dto/query-agreements.dto';
import { AssignAgreementDto, AddCollaboratorDto } from './dto/assign-agreement.dto';
import { CreateAgreementProgressDto } from './dto/create-progress.dto';
import {
  CompleteAgreementDto,
  SuspendAgreementDto,
  ReactivateAgreementDto,
  CancelAgreementDto,
} from './dto/status-transitions.dto';
import { CreateEvidenceDto } from './dto/create-evidence.dto';
import { SessionAuthGuard } from '../../common/guards/session-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import {
  ApiResponse,
  AgreementListItem,
  AgreementDetailDto,
  AgreementCollaboratorDto,
  AgreementProgressDto,
  AgreementEvidenceDto,
  AgreementHistoryDto,
  AgreementDashboardDto,
  AgreementReportsDto,
  PaginatedResponse,
  AuthUser,
} from '@mexagenda/shared';

@ApiTags('Gestión, Asignación y Seguimiento de Acuerdos Institucionales')
@Controller('agreements')
@UseGuards(SessionAuthGuard, PermissionsGuard)
@ApiCookieAuth()
export class AgreementsController {
  constructor(private readonly agreementsService: AgreementsService) {}

  // -------------------------------------------------------------
  // STATIC ROUTES (MUST BE DECLARED BEFORE :id)
  // -------------------------------------------------------------

  @Get('dashboard')
  @RequirePermissions('agreement:report:read')
  @ApiOperation({ summary: 'Obtener métricas ejecutivas del tablero de acuerdos' })
  async getDashboard(): Promise<ApiResponse<AgreementDashboardDto>> {
    const data = await this.agreementsService.getDashboardMetrics();
    return {
      success: true,
      statusCode: HttpStatus.OK,
      data,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('reports')
  @RequirePermissions('agreement:report:read')
  @ApiOperation({ summary: 'Obtener reporte detallado y análisis de cumplimiento' })
  async getReports(): Promise<ApiResponse<AgreementReportsDto>> {
    const data = await this.agreementsService.getReports();
    return {
      success: true,
      statusCode: HttpStatus.OK,
      data,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('users')
  @RequirePermissions('agreement:read')
  @ApiOperation({ summary: 'Obtener catálogo de usuarios institucionales activos' })
  async getAssignableUsers(): Promise<
    ApiResponse<Array<{ id: string; fullName: string; email: string; position?: string | null }>>
  > {
    const users = await this.agreementsService.getAssignableUsers();
    return {
      success: true,
      statusCode: HttpStatus.OK,
      data: users,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('assigned')
  @RequirePermissions('agreement:read')
  @ApiOperation({ summary: 'Listar acuerdos asignados o con colaboración del usuario autenticado' })
  async findAssigned(
    @Query() query: QueryAgreementsDto,
    @CurrentUser() user: AuthUser,
  ): Promise<ApiResponse<PaginatedResponse<AgreementListItem>>> {
    const assignedQuery: QueryAgreementsDto = {
      ...query,
      assignedToId: user.id,
    };
    const result = await this.agreementsService.findAll(assignedQuery);
    return {
      success: true,
      statusCode: HttpStatus.OK,
      data: result,
      timestamp: new Date().toISOString(),
    };
  }

  // -------------------------------------------------------------
  // LISTADO Y CREACIÓN DE ACUERDOS
  // -------------------------------------------------------------

  @Get()
  @RequirePermissions('agreement:read')
  @ApiOperation({ summary: 'Listar acuerdos con filtros avanzados y paginación en servidor' })
  async findAll(@Query() query: QueryAgreementsDto): Promise<ApiResponse<PaginatedResponse<AgreementListItem>>> {
    const result = await this.agreementsService.findAll(query);
    return {
      success: true,
      statusCode: HttpStatus.OK,
      data: result,
      timestamp: new Date().toISOString(),
    };
  }

  @Post()
  @RequirePermissions('agreement:create')
  @ApiOperation({ summary: 'Crear un nuevo acuerdo institucional con folio automático único' })
  async create(
    @Body() dto: CreateAgreementDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ): Promise<ApiResponse<AgreementDetailDto>> {
    const ip = req.ip || req.socket.remoteAddress || '127.0.0.1';
    const userAgent = (req.headers['user-agent'] as string) || 'unknown';

    const created = await this.agreementsService.create(dto, user.id, ip, userAgent);
    return {
      success: true,
      statusCode: HttpStatus.CREATED,
      data: created,
      timestamp: new Date().toISOString(),
    };
  }

  // -------------------------------------------------------------
  // DETALLE, ACTUALIZACIÓN Y ARCHIVADO
  // -------------------------------------------------------------

  @Get(':id')
  @RequirePermissions('agreement:read')
  @ApiOperation({ summary: 'Obtener expediente completo del acuerdo institucional' })
  async findById(@Param('id') id: string): Promise<ApiResponse<AgreementDetailDto>> {
    const agreement = await this.agreementsService.findById(id);
    return {
      success: true,
      statusCode: HttpStatus.OK,
      data: agreement,
      timestamp: new Date().toISOString(),
    };
  }

  @Put(':id')
  @RequirePermissions('agreement:update')
  @ApiOperation({ summary: 'Actualizar información general del acuerdo institucional' })
  async updatePut(
    @Param('id') id: string,
    @Body() dto: UpdateAgreementDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ): Promise<ApiResponse<AgreementDetailDto>> {
    const ip = req.ip || req.socket.remoteAddress || '127.0.0.1';
    const userAgent = (req.headers['user-agent'] as string) || 'unknown';

    const updated = await this.agreementsService.update(id, dto, user.id, ip, userAgent);
    return {
      success: true,
      statusCode: HttpStatus.OK,
      data: updated,
      timestamp: new Date().toISOString(),
    };
  }

  @Patch(':id')
  @RequirePermissions('agreement:update')
  @ApiOperation({ summary: 'Actualización parcial del acuerdo institucional' })
  async updatePatch(
    @Param('id') id: string,
    @Body() dto: UpdateAgreementDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ): Promise<ApiResponse<AgreementDetailDto>> {
    const ip = req.ip || req.socket.remoteAddress || '127.0.0.1';
    const userAgent = (req.headers['user-agent'] as string) || 'unknown';

    const updated = await this.agreementsService.update(id, dto, user.id, ip, userAgent);
    return {
      success: true,
      statusCode: HttpStatus.OK,
      data: updated,
      timestamp: new Date().toISOString(),
    };
  }

  @Delete(':id')
  @RequirePermissions('agreement:manage')
  @ApiOperation({ summary: 'Archivar / dar de baja institucionalmente un acuerdo' })
  async archive(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ): Promise<ApiResponse<{ message: string }>> {
    const ip = req.ip || req.socket.remoteAddress || '127.0.0.1';
    const userAgent = (req.headers['user-agent'] as string) || 'unknown';

    const result = await this.agreementsService.archive(id, user.id, ip, userAgent);
    return {
      success: true,
      statusCode: HttpStatus.OK,
      data: result,
      timestamp: new Date().toISOString(),
    };
  }

  // -------------------------------------------------------------
  // ASIGNACIÓN Y COLABORADORES
  // -------------------------------------------------------------

  @Post(':id/assign')
  @RequirePermissions('agreement:assign')
  @ApiOperation({ summary: 'Asignar o reasignar responsable principal del acuerdo' })
  async assign(
    @Param('id') id: string,
    @Body() dto: AssignAgreementDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ): Promise<ApiResponse<AgreementDetailDto>> {
    const ip = req.ip || req.socket.remoteAddress || '127.0.0.1';
    const userAgent = (req.headers['user-agent'] as string) || 'unknown';

    const updated = await this.agreementsService.assign(id, dto, user.id, ip, userAgent);
    return {
      success: true,
      statusCode: HttpStatus.OK,
      data: updated,
      timestamp: new Date().toISOString(),
    };
  }

  @Get(':id/collaborators')
  @RequirePermissions('agreement:read')
  @ApiOperation({ summary: 'Obtener colaboradores asignados al acuerdo' })
  async getCollaborators(@Param('id') id: string): Promise<ApiResponse<AgreementCollaboratorDto[]>> {
    const agreement = await this.agreementsService.findById(id);
    return {
      success: true,
      statusCode: HttpStatus.OK,
      data: agreement.collaborators,
      timestamp: new Date().toISOString(),
    };
  }

  @Post(':id/collaborators')
  @RequirePermissions('agreement:assign')
  @ApiOperation({ summary: 'Agregar un colaborador institucional al acuerdo' })
  async addCollaborator(
    @Param('id') id: string,
    @Body() dto: AddCollaboratorDto,
    @CurrentUser() user: AuthUser,
  ): Promise<ApiResponse<AgreementCollaboratorDto>> {
    const result = await this.agreementsService.addCollaborator(id, dto, user.id);
    return {
      success: true,
      statusCode: HttpStatus.CREATED,
      data: result,
      timestamp: new Date().toISOString(),
    };
  }

  @Delete(':id/collaborators/:userId')
  @RequirePermissions('agreement:assign')
  @ApiOperation({ summary: 'Remover un colaborador institucional del acuerdo' })
  async removeCollaborator(
    @Param('id') id: string,
    @Param('userId') targetUserId: string,
    @CurrentUser() user: AuthUser,
  ): Promise<ApiResponse<{ message: string }>> {
    const result = await this.agreementsService.removeCollaborator(id, targetUserId, user.id);
    return {
      success: true,
      statusCode: HttpStatus.OK,
      data: result,
      timestamp: new Date().toISOString(),
    };
  }

  // -------------------------------------------------------------
  // REGISTRO Y CONSULTA DE AVANCES
  // -------------------------------------------------------------

  @Get(':id/progress')
  @RequirePermissions('agreement:progress:read')
  @ApiOperation({ summary: 'Obtener historial cronológico de avances reportados' })
  async getProgressList(@Param('id') id: string): Promise<ApiResponse<AgreementProgressDto[]>> {
    const agreement = await this.agreementsService.findById(id);
    return {
      success: true,
      statusCode: HttpStatus.OK,
      data: agreement.progressReports || [],
      timestamp: new Date().toISOString(),
    };
  }

  @Post(':id/progress')
  @RequirePermissions('agreement:progress:create')
  @ApiOperation({ summary: 'Registrar un nuevo avance porcentual y cualitativo' })
  async addProgress(
    @Param('id') id: string,
    @Body() dto: CreateAgreementProgressDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ): Promise<ApiResponse<AgreementProgressDto>> {
    const ip = req.ip || req.socket.remoteAddress || '127.0.0.1';
    const userAgent = (req.headers['user-agent'] as string) || 'unknown';

    const result = await this.agreementsService.addProgress(id, dto, user.id, ip, userAgent);
    return {
      success: true,
      statusCode: HttpStatus.CREATED,
      data: result,
      timestamp: new Date().toISOString(),
    };
  }

  // -------------------------------------------------------------
  // TRANSICIONES DE ESTADO FORMAL
  // -------------------------------------------------------------

  @Post(':id/complete')
  @RequirePermissions('agreement:complete')
  @ApiOperation({ summary: 'Declarar formalmente cumplido un acuerdo institucional' })
  async complete(
    @Param('id') id: string,
    @Body() dto: CompleteAgreementDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ): Promise<ApiResponse<AgreementDetailDto>> {
    const ip = req.ip || req.socket.remoteAddress || '127.0.0.1';
    const userAgent = (req.headers['user-agent'] as string) || 'unknown';

    const updated = await this.agreementsService.complete(id, dto, user.id, ip, userAgent);
    return {
      success: true,
      statusCode: HttpStatus.OK,
      data: updated,
      timestamp: new Date().toISOString(),
    };
  }

  @Post(':id/suspend')
  @RequirePermissions('agreement:suspend')
  @ApiOperation({ summary: 'Suspender temporalmente un acuerdo con justificación obligatoria' })
  async suspend(
    @Param('id') id: string,
    @Body() dto: SuspendAgreementDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ): Promise<ApiResponse<AgreementDetailDto>> {
    const ip = req.ip || req.socket.remoteAddress || '127.0.0.1';
    const userAgent = (req.headers['user-agent'] as string) || 'unknown';

    const updated = await this.agreementsService.suspend(id, dto, user.id, ip, userAgent);
    return {
      success: true,
      statusCode: HttpStatus.OK,
      data: updated,
      timestamp: new Date().toISOString(),
    };
  }

  @Post(':id/reactivate')
  @RequirePermissions('agreement:reactivate')
  @ApiOperation({ summary: 'Reactivar un acuerdo suspendido' })
  async reactivate(
    @Param('id') id: string,
    @Body() dto: ReactivateAgreementDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ): Promise<ApiResponse<AgreementDetailDto>> {
    const ip = req.ip || req.socket.remoteAddress || '127.0.0.1';
    const userAgent = (req.headers['user-agent'] as string) || 'unknown';

    const updated = await this.agreementsService.reactivate(id, dto, user.id, ip, userAgent);
    return {
      success: true,
      statusCode: HttpStatus.OK,
      data: updated,
      timestamp: new Date().toISOString(),
    };
  }

  @Post(':id/cancel')
  @RequirePermissions('agreement:cancel')
  @ApiOperation({ summary: 'Cancelar formalmente un acuerdo institucional con fundamentación' })
  async cancel(
    @Param('id') id: string,
    @Body() dto: CancelAgreementDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ): Promise<ApiResponse<AgreementDetailDto>> {
    const ip = req.ip || req.socket.remoteAddress || '127.0.0.1';
    const userAgent = (req.headers['user-agent'] as string) || 'unknown';

    const updated = await this.agreementsService.cancel(id, dto, user.id, ip, userAgent);
    return {
      success: true,
      statusCode: HttpStatus.OK,
      data: updated,
      timestamp: new Date().toISOString(),
    };
  }

  // -------------------------------------------------------------
  // EVIDENCIAS DOCUMENTALES
  // -------------------------------------------------------------

  @Get(':id/evidences')
  @RequirePermissions('agreement:read')
  @ApiOperation({ summary: 'Obtener metadatos de evidencias documentales vinculadas' })
  async getEvidences(@Param('id') id: string): Promise<ApiResponse<AgreementEvidenceDto[]>> {
    const agreement = await this.agreementsService.findById(id);
    return {
      success: true,
      statusCode: HttpStatus.OK,
      data: agreement.evidences,
      timestamp: new Date().toISOString(),
    };
  }

  @Post(':id/evidences')
  @RequirePermissions('agreement:progress:create')
  @ApiOperation({ summary: 'Registrar referencia de evidencia documental' })
  async addEvidence(
    @Param('id') id: string,
    @Body() dto: CreateEvidenceDto,
    @CurrentUser() user: AuthUser,
  ): Promise<ApiResponse<AgreementEvidenceDto>> {
    const result = await this.agreementsService.addEvidence(id, dto, user.id);
    return {
      success: true,
      statusCode: HttpStatus.CREATED,
      data: result,
      timestamp: new Date().toISOString(),
    };
  }

  // -------------------------------------------------------------
  // HISTORIAL DE TRAZABILIDAD (AUDITORÍA APPEND-ONLY)
  // -------------------------------------------------------------

  @Get(':id/history')
  @RequirePermissions('agreement:history:read')
  @ApiOperation({ summary: 'Obtener trazabilidad e historial inmutable de cambios del acuerdo' })
  async getHistory(@Param('id') id: string): Promise<ApiResponse<AgreementHistoryDto[]>> {
    const agreement = await this.agreementsService.findById(id);
    return {
      success: true,
      statusCode: HttpStatus.OK,
      data: agreement.history || [],
      timestamp: new Date().toISOString(),
    };
  }
}

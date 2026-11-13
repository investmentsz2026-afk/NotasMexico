import {
  Controller,
  Get,
  Query,
  UseGuards,
  HttpStatus,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiOperation, ApiResponse as SwaggerResponse, ApiBearerAuth } from '@nestjs/swagger';
import { SessionAuthGuard } from '../../common/guards/session-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import {
  AuthUser,
  ApiResponse,
  ExecutiveDashboardDto,
  AgreementsTrackingDto,
  SessionGovernanceDto,
  PersonalConsoleDto,
} from '@mexagenda/shared';
import { ReportsService } from './reports.service';
import { QueryReportsDto } from './dto/query-reports.dto';
import { ExportReportsDto } from './dto/export-reports.dto';

@ApiTags('Reportes Institucionales y Analítica (MOD-07)')
@ApiBearerAuth()
@Controller('reports')
@UseGuards(SessionAuthGuard, PermissionsGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('executive')
  @RequirePermissions('report:view:executive')
  @ApiOperation({ summary: 'Obtener métricas ejecutivas consolidadas del tablero de dirección' })
  @SwaggerResponse({ status: 200, description: 'Métricas ejecutivas 360 calculadas en tiempo real' })
  async getExecutiveDashboard(
    @CurrentUser() user: AuthUser,
    @Query() query: QueryReportsDto,
  ): Promise<ApiResponse<ExecutiveDashboardDto>> {
    const data = await this.reportsService.getExecutiveDashboard(user, query);
    return {
      success: true,
      statusCode: HttpStatus.OK,
      data,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('agreements')
  @RequirePermissions('report:view:operational')
  @ApiOperation({ summary: 'Consultar seguimiento detallado de acuerdos y semáforo preventivo de plazos' })
  @SwaggerResponse({ status: 200, description: 'Analítica de compromisos y semáforo de vencimiento' })
  async getAgreementsTracking(
    @CurrentUser() user: AuthUser,
    @Query() query: QueryReportsDto,
  ): Promise<ApiResponse<AgreementsTrackingDto>> {
    const data = await this.reportsService.getAgreementsTracking(user, query);
    return {
      success: true,
      statusCode: HttpStatus.OK,
      data,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('sessions')
  @RequirePermissions('report:view:operational')
  @ApiOperation({ summary: 'Consultar gobernanza colegiada, quórum de asistencia y formalización de actas' })
  @SwaggerResponse({ status: 200, description: 'Métricas de sesiones, asistencia y tiempos de acta' })
  async getSessionGovernance(
    @CurrentUser() user: AuthUser,
    @Query() query: QueryReportsDto,
  ): Promise<ApiResponse<SessionGovernanceDto>> {
    const data = await this.reportsService.getSessionGovernance(user, query);
    return {
      success: true,
      statusCode: HttpStatus.OK,
      data,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('personal')
  @ApiOperation({ summary: 'Consultar consola operativa personalizada del integrante institucional' })
  @SwaggerResponse({ status: 200, description: 'Métricas acotadas al usuario autenticado' })
  async getPersonalConsole(
    @CurrentUser() user: AuthUser,
  ): Promise<ApiResponse<PersonalConsoleDto>> {
    const data = await this.reportsService.getPersonalConsole(user);
    return {
      success: true,
      statusCode: HttpStatus.OK,
      data,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('export')
  @RequirePermissions('report:export')
  @ApiOperation({ summary: 'Descargar exportación tabular en formato CSV delimitado por comas (RFC 4180)' })
  @SwaggerResponse({ status: 200, description: 'Archivo CSV descargable con cabeceras institucionales' })
  async exportReport(
    @CurrentUser() user: AuthUser,
    @Query() dto: ExportReportsDto,
    @Res() res: Response,
  ): Promise<void> {
    const csvContent = await this.reportsService.exportReportCsv(user, dto);
    const today = this.reportsService.getTodayInMexicoCity();

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="reporte_mexagenda_${dto.type}_${today}.csv"`,
    );
    // \uFEFF es el BOM de UTF-8 para garantizar que Excel y herramientas de hoja de cálculo abran los acentos correctamente
    res.send('\uFEFF' + csvContent);
  }
}


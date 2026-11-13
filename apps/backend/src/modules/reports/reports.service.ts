import {
  Injectable,
  Logger,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import {
  AuthUser,
  ExecutiveDashboardDto,
  AgreementsTrackingDto,
  SessionGovernanceDto,
  PersonalConsoleDto,
  ReportCategoryDistribution,
  ReportOverdueAlert,
  ReportExpirationTrafficLight,
} from '@mexagenda/shared';
import { AgreementStatus, MeetingStatus, AttendanceStatus } from '@prisma/client';
import { QueryReportsDto } from './dto/query-reports.dto';
import { ExportReportsDto } from './dto/export-reports.dto';

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Obtiene la fecha civil de hoy en formato YYYY-MM-DD en la zona horaria institucional de México.
   */
  public getTodayInMexicoCity(): string {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Mexico_City',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
  }

  /**
   * Calcula los días restantes (o de retraso si es negativo) hasta la fecha límite.
   */
  public calculateDaysRemaining(dueDateStr: string, todayStr: string): number {
    const dueTime = new Date(dueDateStr + 'T12:00:00Z').getTime();
    const todayTime = new Date(todayStr + 'T12:00:00Z').getTime();
    return Math.round((dueTime - todayTime) / (1000 * 60 * 60 * 24));
  }

  /**
   * Determina el estatus efectivo del acuerdo en función de la fecha límite y el corte civil en CDMX.
   */
  public calculateEffectiveStatus(
    storedStatus: string,
    dueDateStr: string,
    todayStr: string,
  ): string {
    if (
      storedStatus === AgreementStatus.CUMPLIDO ||
      storedStatus === AgreementStatus.COMPLETADO ||
      storedStatus === AgreementStatus.CANCELADO ||
      storedStatus === AgreementStatus.SUSPENDIDO
    ) {
      return storedStatus;
    }
    if (dueDateStr < todayStr) {
      return AgreementStatus.VENCIDO;
    }
    return storedStatus;
  }

  /**
   * Neutraliza inyecciones de fórmulas y caracteres especiales para exportaciones seguras CSV.
   */
  public sanitizeCsvField(val: any): string {
    if (val === null || val === undefined) return '';
    let str = String(val).trim();
    // Neutralizar inyección de fórmulas si el valor inicia con =, +, -, @, \t, \r
    if (/^[=+\-@\t\r]/.test(str)) {
      str = "'" + str;
    }
    // Si contiene comas, comillas dobles o saltos de línea, escapar y envolver
    if (/[",\n\r]/.test(str)) {
      str = `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }

  // ==============================================================================
  // VISTA 1: TABLERO EJECUTIVO INSTITUCIONAL (DIRECCIÓN / ROLE_ADMIN)
  // ==============================================================================
  async getExecutiveDashboard(
    user: AuthUser,
    query: QueryReportsDto,
  ): Promise<ExecutiveDashboardDto> {
    const isAdmin =
      user.role === 'ROLE_ADMIN' ||
      user.permissions.includes('report:view:executive') ||
      user.permissions.includes('agreement:report:read');

    if (!isAdmin) {
      throw new ForbiddenException(
        'Acceso denegado: Se requiere permiso ejecutivo (report:view:executive) para consultar este tablero.',
      );
    }

    const todayStr = this.getTodayInMexicoCity();

    // 1. Filtros de acuerdos
    const agreementWhere: any = {
      deletedAt: null,
      isArchived: false,
    };

    if (query.categoryId) {
      agreementWhere.categoryId = query.categoryId;
    }

    if (query.from || query.to) {
      agreementWhere.approvalDate = {};
      if (query.from) {
        agreementWhere.approvalDate.gte = new Date(query.from + 'T00:00:00.000Z');
      }
      if (query.to) {
        agreementWhere.approvalDate.lte = new Date(query.to + 'T23:59:59.999Z');
      }
    }

    // Consultar acuerdos en lote para cálculo en memoria optimizado
    const agreements = await this.prisma.agreement.findMany({
      where: agreementWhere,
      select: {
        id: true,
        folio: true,
        title: true,
        status: true,
        priority: true,
        dueDate: true,
        completionDate: true,
        approvalDate: true,
        categoryId: true,
        category: { select: { id: true, name: true, code: true, colorHex: true } },
        assignee: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    let totalAcuerdosValidos = 0;
    let cumplidos = 0;
    let enProceso = 0;
    let pendientes = 0;
    let vencidos = 0;
    let suspendidos = 0;
    let cancelados = 0;
    let cumplidosEnPlazo = 0;

    let critico7Dias = 0;
    let medio15Dias = 0;
    let lejano30Dias = 0;
    let enPlazoMas30 = 0;
    let sinPlazo = 0;

    const overdueAlerts: ReportOverdueAlert[] = [];
    const agreementCategoryMap = new Map<string, number>();

    for (const a of agreements) {
      const catId = a.categoryId || 'SIN_CATEGORIA';
      agreementCategoryMap.set(catId, (agreementCategoryMap.get(catId) || 0) + 1);

      if (a.status === AgreementStatus.CANCELADO) {
        cancelados++;
        continue; // Excluido del denominador de cumplimiento global
      }

      totalAcuerdosValidos++;

      const dueDateStr = a.dueDate ? a.dueDate.toISOString().split('T')[0] : '';
      const completionDateStr = a.completionDate
        ? a.completionDate.toISOString().split('T')[0]
        : null;

      const effStatus = this.calculateEffectiveStatus(a.status, dueDateStr, todayStr);

      if (effStatus === AgreementStatus.CUMPLIDO || effStatus === AgreementStatus.COMPLETADO) {
        cumplidos++;
        if (completionDateStr && dueDateStr && completionDateStr <= dueDateStr) {
          cumplidosEnPlazo++;
        }
      } else if (effStatus === AgreementStatus.SUSPENDIDO) {
        suspendidos++;
      } else if (effStatus === AgreementStatus.VENCIDO) {
        vencidos++;
        const diasVencido = Math.abs(this.calculateDaysRemaining(dueDateStr, todayStr));
        overdueAlerts.push({
          id: a.id,
          folio: a.folio,
          title: a.title,
          dueDate: dueDateStr,
          diasVencido,
          assigneeName: `${a.assignee.firstName} ${a.assignee.lastName}`.trim(),
          priority: a.priority,
        });
      } else if (effStatus === AgreementStatus.EN_PROCESO) {
        enProceso++;
      } else {
        pendientes++;
      }

      // Clasificación en semáforo preventivo (solo para acuerdos activos no concluidos)
      if (
        effStatus === AgreementStatus.PENDIENTE ||
        effStatus === AgreementStatus.EN_PROCESO ||
        effStatus === AgreementStatus.VENCIDO
      ) {
        if (!dueDateStr) {
          sinPlazo++;
        } else {
          const diff = this.calculateDaysRemaining(dueDateStr, todayStr);
          if (diff < 0) {
            // Ya vencido
          } else if (diff >= 0 && diff <= 7) {
            critico7Dias++;
          } else if (diff >= 8 && diff <= 15) {
            medio15Dias++;
          } else if (diff >= 16 && diff <= 30) {
            lejano30Dias++;
          } else {
            enPlazoMas30++;
          }
        }
      }
    }

    // Ordenar alertas de rezago por días de vencimiento descendente
    overdueAlerts.sort((a, b) => b.diasVencido - a.diasVencido);

    // Denominador de cumplimiento global: Total válidos menos suspendidos
    const denomCumplimiento = totalAcuerdosValidos - suspendidos;
    const tasaCumplimientoGlobal =
      denomCumplimiento > 0
        ? Math.round((cumplidos / denomCumplimiento) * 1000) / 10
        : null;

    const tasaEfectividadTemporal =
      cumplidos > 0 ? Math.round((cumplidosEnPlazo / cumplidos) * 1000) / 10 : null;

    // 2. Filtros de reuniones
    const meetingWhere: any = {
      deletedAt: null,
    };

    if (query.categoryId) {
      meetingWhere.categoryId = query.categoryId;
    }

    if (query.from || query.to) {
      meetingWhere.meetingDate = {};
      if (query.from) {
        meetingWhere.meetingDate.gte = new Date(query.from + 'T00:00:00.000Z');
      }
      if (query.to) {
        meetingWhere.meetingDate.lte = new Date(query.to + 'T23:59:59.999Z');
      }
    }

    const meetings = await this.prisma.meeting.findMany({
      where: meetingWhere,
      select: {
        id: true,
        status: true,
        categoryId: true,
        meetingDate: true,
        participants: {
          select: { attendanceStatus: true },
        },
      },
    });

    let totalReunionesPeriodo = meetings.length;
    let reunionesCelebradas = 0;
    let reunionesCanceladas = 0;
    let sumaTasaAsistencia = 0;
    let reunionesConAsistenciaContabilizada = 0;

    const meetingCategoryMap = new Map<string, number>();

    for (const m of meetings) {
      const catId = m.categoryId || 'SIN_CATEGORIA';
      meetingCategoryMap.set(catId, (meetingCategoryMap.get(catId) || 0) + 1);

      if (m.status === MeetingStatus.FINALIZADA || m.status === MeetingStatus.ARCHIVADA) {
        reunionesCelebradas++;
        const totalP = m.participants.length;
        if (totalP > 0) {
          const presentes = m.participants.filter(
            (p) =>
              p.attendanceStatus === AttendanceStatus.PRESENTE ||
              p.attendanceStatus === AttendanceStatus.ASISTIO ||
              p.attendanceStatus === AttendanceStatus.TARDANZA ||
              p.attendanceStatus === AttendanceStatus.PARTICIPACION_REMOTA,
          ).length;
          sumaTasaAsistencia += (presentes / totalP) * 100;
          reunionesConAsistenciaContabilizada++;
        }
      } else if (m.status === MeetingStatus.CANCELADA) {
        reunionesCanceladas++;
      }
    }

    const denomCalendario = reunionesCelebradas + reunionesCanceladas;
    const tasaEfectividadCalendario =
      denomCalendario > 0
        ? Math.round((reunionesCelebradas / denomCalendario) * 1000) / 10
        : null;

    const tasaAsistenciaPromedio =
      reunionesConAsistenciaContabilizada > 0
        ? Math.round((sumaTasaAsistencia / reunionesConAsistenciaContabilizada) * 10) / 10
        : null;

    // 3. Distribución por categorías
    const categories = await this.prisma.meetingCategory.findMany({
      where: { isActive: true },
      orderBy: { displayOrder: 'asc' },
    });

    const distribucionCategorias: ReportCategoryDistribution[] = categories.map((c) => ({
      categoryId: c.id,
      code: c.code,
      name: c.name,
      colorHex: c.colorHex,
      reuniones: meetingCategoryMap.get(c.id) || 0,
      acuerdos: agreementCategoryMap.get(c.id) || 0,
    }));

    return {
      kpis: {
        totalAcuerdosValidos,
        cumplidos,
        enProceso,
        pendientes,
        vencidos,
        suspendidos,
        cancelados,
        tasaCumplimientoGlobal,
        tasaEfectividadTemporal,
        totalReunionesPeriodo,
        reunionesCelebradas,
        reunionesCanceladas,
        tasaEfectividadCalendario,
        tasaAsistenciaPromedio,
      },
      semaforoVencimiento: {
        vencidos,
        critico7Dias,
        medio15Dias,
        lejano30Dias,
        enPlazoMas30,
        sinPlazo,
        suspendidos,
      },
      distribucionCategorias,
      alertasRezago: overdueAlerts.slice(0, 8),
    };
  }

  // ==============================================================================
  // VISTA 2: SEGUIMIENTO DE ACUERDOS (OPERATIVO / ESTRATÉGICO)
  // ==============================================================================
  async getAgreementsTracking(
    user: AuthUser,
    query: QueryReportsDto,
  ): Promise<AgreementsTrackingDto> {
    const isAdmin =
      user.role === 'ROLE_ADMIN' || user.permissions.includes('report:view:executive');
    const todayStr = this.getTodayInMexicoCity();

    const where: any = {
      deletedAt: null,
      isArchived: false,
    };

    // Aislamiento por rol estricto: ROLE_USER solo ve sus asignados o en los que colabora
    if (!isAdmin) {
      where.OR = [
        { assignedToId: user.id },
        { collaborators: { some: { userId: user.id } } },
      ];
    } else if (query.assignedToId) {
      where.assignedToId = query.assignedToId;
    }

    if (query.categoryId) {
      where.categoryId = query.categoryId;
    }

    if (query.status) {
      where.status = query.status;
    }

    if (query.priority) {
      where.priority = query.priority;
    }

    if (query.from || query.to) {
      where.approvalDate = {};
      if (query.from) where.approvalDate.gte = new Date(query.from + 'T00:00:00.000Z');
      if (query.to) where.approvalDate.lte = new Date(query.to + 'T23:59:59.999Z');
    }

    const agreements = await this.prisma.agreement.findMany({
      where,
      select: {
        id: true,
        folio: true,
        title: true,
        status: true,
        priority: true,
        agreementType: true,
        dueDate: true,
        completionDate: true,
        approvalDate: true,
        progressPercent: true,
        assignedToId: true,
        categoryId: true,
        category: { select: { id: true, name: true, colorHex: true } },
        assignee: { select: { id: true, firstName: true, lastName: true, email: true } },
        collaborators: { select: { userId: true } },
      },
      orderBy: { dueDate: 'asc' },
    });

    let pendientes = 0;
    let enProceso = 0;
    let cumplidos = 0;
    let vencidos = 0;
    let suspendidos = 0;
    let cancelados = 0;
    let cumplidosEnPlazo = 0;

    let critico7Dias = 0;
    let medio15Dias = 0;
    let lejano30Dias = 0;
    let enPlazoMas30 = 0;
    let sinPlazo = 0;

    let sumaDiasResolucion = 0;
    let countDiasResolucion = 0;

    const porPrioridad: Record<string, number> = {};
    const porTipo: Record<string, number> = {};
    const catMap = new Map<
      string,
      { categoryName: string; colorHex: string; total: number; cumplidos: number; vencidos: number; pendientes: number }
    >();
    const assigneeMap = new Map<
      string,
      { fullName: string; email: string; totalTitular: number; cumplidos: number; vencidos: number; pendientes: number }
    >();

    const items = [];

    for (const a of agreements) {
      const dueDateStr = a.dueDate ? a.dueDate.toISOString().split('T')[0] : '';
      const completionDateStr = a.completionDate
        ? a.completionDate.toISOString().split('T')[0]
        : null;
      const approvalDateStr = a.approvalDate
        ? a.approvalDate.toISOString().split('T')[0]
        : null;

      const effStatus = this.calculateEffectiveStatus(a.status, dueDateStr, todayStr);
      const daysRemaining = dueDateStr ? this.calculateDaysRemaining(dueDateStr, todayStr) : 0;

      // Agrupaciones por prioridad y tipo
      porPrioridad[a.priority] = (porPrioridad[a.priority] || 0) + 1;
      porTipo[a.agreementType] = (porTipo[a.agreementType] || 0) + 1;

      // Categoría
      const cId = a.categoryId || 'SIN_CATEGORIA';
      const cName = a.category?.name || 'Sin Categoría';
      const cColor = a.category?.colorHex || '#64748B';
      if (!catMap.has(cId)) {
        catMap.set(cId, { categoryName: cName, colorHex: cColor, total: 0, cumplidos: 0, vencidos: 0, pendientes: 0 });
      }
      const cEntry = catMap.get(cId)!;
      cEntry.total++;

      // Titular (solo agrupado por titular directo para evitar doble conteo)
      const uId = a.assignedToId;
      const uName = `${a.assignee.firstName} ${a.assignee.lastName}`.trim();
      const uEmail = a.assignee.email;
      if (!assigneeMap.has(uId)) {
        assigneeMap.set(uId, { fullName: uName, email: uEmail, totalTitular: 0, cumplidos: 0, vencidos: 0, pendientes: 0 });
      }
      const uEntry = assigneeMap.get(uId)!;
      uEntry.totalTitular++;

      if (a.status === AgreementStatus.CANCELADO) {
        cancelados++;
      } else if (effStatus === AgreementStatus.CUMPLIDO || effStatus === AgreementStatus.COMPLETADO) {
        cumplidos++;
        cEntry.cumplidos++;
        uEntry.cumplidos++;
        if (completionDateStr && dueDateStr && completionDateStr <= dueDateStr) {
          cumplidosEnPlazo++;
        }
        if (completionDateStr && approvalDateStr) {
          const compTime = new Date(completionDateStr + 'T12:00:00Z').getTime();
          const appTime = new Date(approvalDateStr + 'T12:00:00Z').getTime();
          const diffDays = Math.max(0, Math.round((compTime - appTime) / (1000 * 60 * 60 * 24)));
          sumaDiasResolucion += diffDays;
          countDiasResolucion++;
        }
      } else if (effStatus === AgreementStatus.SUSPENDIDO) {
        suspendidos++;
      } else if (effStatus === AgreementStatus.VENCIDO) {
        vencidos++;
        cEntry.vencidos++;
        uEntry.vencidos++;
      } else if (effStatus === AgreementStatus.EN_PROCESO) {
        enProceso++;
        cEntry.pendientes++;
        uEntry.pendientes++;
      } else {
        pendientes++;
        cEntry.pendientes++;
        uEntry.pendientes++;
      }

      // Semáforo preventivo
      if (
        effStatus === AgreementStatus.PENDIENTE ||
        effStatus === AgreementStatus.EN_PROCESO ||
        effStatus === AgreementStatus.VENCIDO
      ) {
        if (!dueDateStr) {
          sinPlazo++;
        } else if (daysRemaining < 0) {
          // Vencido
        } else if (daysRemaining >= 0 && daysRemaining <= 7) {
          critico7Dias++;
        } else if (daysRemaining >= 8 && daysRemaining <= 15) {
          medio15Dias++;
        } else if (daysRemaining >= 16 && daysRemaining <= 30) {
          lejano30Dias++;
        } else {
          enPlazoMas30++;
        }
      }

      const isCollab = !isAdmin && a.assignedToId !== user.id;

      items.push({
        id: a.id,
        folio: a.folio,
        title: a.title,
        categoryName: cName,
        categoryColorHex: cColor,
        priority: a.priority,
        status: a.status,
        effectiveStatus: effStatus,
        dueDate: dueDateStr,
        daysRemaining,
        progressPercent: a.progressPercent,
        assigneeId: a.assignedToId,
        assigneeName: uName,
        isCollaborator: isCollab,
      });
    }

    const totalValidos = agreements.length - cancelados;
    const denomCumplimiento = totalValidos - suspendidos;
    const tasaCumplimiento =
      denomCumplimiento > 0 ? Math.round((cumplidos / denomCumplimiento) * 1000) / 10 : null;

    const tasaEfectividadTemporal =
      cumplidos > 0 ? Math.round((cumplidosEnPlazo / cumplidos) * 1000) / 10 : null;

    const tiempoPromedioResolucionDias =
      countDiasResolucion > 0 ? Math.round((sumaDiasResolucion / countDiasResolucion) * 10) / 10 : null;

    const porCategoria = Array.from(catMap.entries()).map(([cId, val]) => ({
      categoryId: cId,
      categoryName: val.categoryName,
      colorHex: val.colorHex,
      total: val.total,
      cumplidos: val.cumplidos,
      vencidos: val.vencidos,
      pendientes: val.pendientes,
    }));

    // Carga por titular visible SOLO a administradores
    let cargaPorTitular: any = undefined;
    if (isAdmin) {
      cargaPorTitular = Array.from(assigneeMap.entries()).map(([uId, val]) => {
        const denom = val.totalTitular;
        return {
          userId: uId,
          fullName: val.fullName,
          email: val.email,
          totalTitular: val.totalTitular,
          cumplidos: val.cumplidos,
          vencidos: val.vencidos,
          pendientes: val.pendientes,
          tasaCumplimiento: denom > 0 ? Math.round((val.cumplidos / denom) * 1000) / 10 : null,
        };
      });
    }

    // Paginación en servidor
    const page = query.page || 1;
    const limit = query.limit || 50;
    const startIndex = (page - 1) * limit;
    const paginatedItems = items.slice(startIndex, startIndex + limit);

    return {
      resumenEstados: {
        total: agreements.length,
        pendientes,
        enProceso,
        cumplidos,
        vencidos,
        suspendidos,
        cancelados,
      },
      tasaCumplimiento,
      tasaEfectividadTemporal,
      tiempoPromedioResolucionDias,
      semaforo: {
        vencidos,
        critico7Dias,
        medio15Dias,
        lejano30Dias,
        enPlazoMas30,
        sinPlazo,
        suspendidos,
      },
      porPrioridad,
      porTipo,
      porCategoria,
      cargaPorTitular,
      items: paginatedItems,
      totalItems: items.length,
    };
  }

  // ==============================================================================
  // VISTA 3: GOBERNANZA DE SESIONES Y ACTAS (GOBERNANZA COLEGIAL)
  // ==============================================================================
  async getSessionGovernance(
    user: AuthUser,
    query: QueryReportsDto,
  ): Promise<SessionGovernanceDto> {
    const where: any = {
      deletedAt: null,
    };

    if (query.categoryId) {
      where.categoryId = query.categoryId;
    }

    if (query.status) {
      where.status = query.status;
    }

    if (query.from || query.to) {
      where.meetingDate = {};
      if (query.from) where.meetingDate.gte = new Date(query.from + 'T00:00:00.000Z');
      if (query.to) where.meetingDate.lte = new Date(query.to + 'T23:59:59.999Z');
    }

    const meetings = await this.prisma.meeting.findMany({
      where,
      select: {
        id: true,
        folio: true,
        title: true,
        meetingDate: true,
        status: true,
        modality: true,
        categoryId: true,
        category: { select: { id: true, name: true, colorHex: true } },
        participants: {
          select: { attendanceStatus: true },
        },
        minutes: {
          select: {
            id: true,
            status: true,
            approvedAt: true,
          },
        },
      },
      orderBy: { meetingDate: 'desc' },
    });

    let totalConvocadas = meetings.length;
    let celebradas = 0;
    let canceladas = 0;
    let programadas = 0;

    let totalConvocados = 0;
    let totalAsistencias = 0;
    let totalInasistencias = 0;
    let totalJustificadas = 0;
    let sumaTasaAsistencia = 0;
    let sesionesEvaluadasAsistencia = 0;

    let sesionesConQuorum = 0;
    let sesionesSinQuorum = 0;

    let totalActasAprobadas = 0;
    let totalActasBorrador = 0;
    let sumaDiasAprobacionActa = 0;
    let countActasAprobadas = 0;

    const porModalidad: Record<string, number> = {};
    const catMap = new Map<
      string,
      { categoryName: string; colorHex: string; total: number; celebradas: number; canceladas: number; sumaAsistencia: number; countAsistencia: number }
    >();

    const sesionesRecientes = [];

    for (const m of meetings) {
      porModalidad[m.modality] = (porModalidad[m.modality] || 0) + 1;

      const cId = m.categoryId || 'SIN_CATEGORIA';
      const cName = m.category?.name || 'General';
      const cColor = m.category?.colorHex || '#1E3A8A';
      if (!catMap.has(cId)) {
        catMap.set(cId, { categoryName: cName, colorHex: cColor, total: 0, celebradas: 0, canceladas: 0, sumaAsistencia: 0, countAsistencia: 0 });
      }
      const cEntry = catMap.get(cId)!;
      cEntry.total++;

      const numParticipants = m.participants.length;
      let presentes = 0;
      let justificados = 0;
      let ausentes = 0;

      for (const p of m.participants) {
        const st = p.attendanceStatus;
        if (
          st === AttendanceStatus.PRESENTE ||
          st === AttendanceStatus.ASISTIO ||
          st === AttendanceStatus.TARDANZA ||
          st === AttendanceStatus.PARTICIPACION_REMOTA
        ) {
          presentes++;
        } else if (st === AttendanceStatus.JUSTIFICADO || st === AttendanceStatus.FALTA_JUSTIFICADA) {
          justificados++;
        } else if (st === AttendanceStatus.AUSENTE || st === AttendanceStatus.FALTA_INJUSTIFICADA) {
          ausentes++;
        }
      }

      const tasaAsistenciaSesion =
        numParticipants > 0 ? Math.round((presentes / numParticipants) * 1000) / 10 : null;

      // Regla Reglamentaria de Quórum: Mayoría simple de integrantes convocados (> 50%)
      const tieneQuorum = numParticipants > 0 && presentes > numParticipants / 2;

      if (m.status === MeetingStatus.FINALIZADA || m.status === MeetingStatus.ARCHIVADA) {
        celebradas++;
        cEntry.celebradas++;

        totalConvocados += numParticipants;
        totalAsistencias += presentes;
        totalJustificadas += justificados;
        totalInasistencias += ausentes + justificados;

        if (tasaAsistenciaSesion !== null) {
          sumaTasaAsistencia += tasaAsistenciaSesion;
          sesionesEvaluadasAsistencia++;
          cEntry.sumaAsistencia += tasaAsistenciaSesion;
          cEntry.countAsistencia++;
        }

        if (numParticipants > 0) {
          if (tieneQuorum) sesionesConQuorum++;
          else sesionesSinQuorum++;
        }

        // Tiempos de formalización de actas
        if (m.minutes) {
          if (m.minutes.status === 'APROBADA') {
            totalActasAprobadas++;
            if (m.minutes.approvedAt && m.meetingDate) {
              const diffMs = m.minutes.approvedAt.getTime() - m.meetingDate.getTime();
              const diffDays = Math.max(0, Math.round(diffMs / (1000 * 60 * 60 * 24)));
              sumaDiasAprobacionActa += diffDays;
              countActasAprobadas++;
            }
          } else {
            totalActasBorrador++;
          }
        }
      } else if (m.status === MeetingStatus.CANCELADA) {
        canceladas++;
        cEntry.canceladas++;
      } else {
        programadas++;
      }

      sesionesRecientes.push({
        id: m.id,
        folio: m.folio,
        title: m.title,
        meetingDate: m.meetingDate.toISOString().split('T')[0],
        status: m.status,
        modality: m.modality,
        categoryName: cName,
        categoryColorHex: cColor,
        totalConvocados: numParticipants,
        totalPresentes: presentes,
        tasaAsistencia: tasaAsistenciaSesion,
        tieneQuorum,
        estadoActa: m.minutes ? m.minutes.status : 'PENDIENTE',
      });
    }

    const denomCal = celebradas + canceladas;
    const tasaEfectividadCalendario =
      denomCal > 0 ? Math.round((celebradas / denomCal) * 1000) / 10 : null;

    const tasaAsistenciaPromedio =
      sesionesEvaluadasAsistencia > 0
        ? Math.round((sumaTasaAsistencia / sesionesEvaluadasAsistencia) * 10) / 10
        : null;

    const tasaJustificacionInasistencias =
      totalInasistencias > 0
        ? Math.round((totalJustificadas / totalInasistencias) * 1000) / 10
        : null;

    const totalCelebradasConConvocados = sesionesConQuorum + sesionesSinQuorum;
    const tasaCumplimientoQuorum =
      totalCelebradasConConvocados > 0
        ? Math.round((sesionesConQuorum / totalCelebradasConConvocados) * 1000) / 10
        : null;

    const tiempoMedioAprobacionDias =
      countActasAprobadas > 0
        ? Math.round((sumaDiasAprobacionActa / countActasAprobadas) * 10) / 10
        : null;

    const porCategoria = Array.from(catMap.entries()).map(([cId, val]) => ({
      categoryId: cId,
      categoryName: val.categoryName,
      colorHex: val.colorHex,
      total: val.total,
      celebradas: val.celebradas,
      canceladas: val.canceladas,
      tasaAsistencia:
        val.countAsistencia > 0
          ? Math.round((val.sumaAsistencia / val.countAsistencia) * 10) / 10
          : null,
    }));

    return {
      resumen: {
        totalConvocadas,
        celebradas,
        canceladas,
        programadas,
        tasaEfectividadCalendario,
      },
      asistencia: {
        totalConvocados,
        totalAsistencias,
        totalInasistencias,
        totalJustificadas,
        tasaAsistenciaPromedio,
        tasaJustificacionInasistencias,
      },
      quorum: {
        sesionesConQuorum,
        sesionesSinQuorum,
        tasaCumplimientoQuorum,
        reglaQuorum: 'Mayoría simple (>50% de integrantes convocados presentes)',
      },
      actas: {
        totalActasAprobadas,
        totalActasBorrador,
        tiempoMedioAprobacionDias,
      },
      porModalidad,
      porCategoria,
      sesionesRecientes: sesionesRecientes.slice(0, 20),
    };
  }

  // ==============================================================================
  // VISTA 4: CONSOLA PERSONAL (INTEGRANTE / CONSEJERO)
  // ==============================================================================
  async getPersonalConsole(user: AuthUser): Promise<PersonalConsoleDto> {
    const todayStr = this.getTodayInMexicoCity();

    // 1. Acuerdos asignados directamente como Titular
    const acuerdosTitularRows = await this.prisma.agreement.findMany({
      where: {
        assignedToId: user.id,
        deletedAt: null,
        isArchived: false,
      },
      select: {
        id: true,
        folio: true,
        title: true,
        status: true,
        priority: true,
        dueDate: true,
        progressPercent: true,
      },
      orderBy: { dueDate: 'asc' },
    });

    let titularPendientes = 0;
    let titularEnProceso = 0;
    let titularCumplidos = 0;
    let titularVencidos = 0;
    let titularSuspendidos = 0;

    const misPrioritarios: any[] = [];

    for (const a of acuerdosTitularRows) {
      const dueDateStr = a.dueDate ? a.dueDate.toISOString().split('T')[0] : '';
      const effStatus = this.calculateEffectiveStatus(a.status, dueDateStr, todayStr);
      const daysRemaining = dueDateStr ? this.calculateDaysRemaining(dueDateStr, todayStr) : 0;

      if (effStatus === AgreementStatus.CUMPLIDO || effStatus === AgreementStatus.COMPLETADO) {
        titularCumplidos++;
      } else if (effStatus === AgreementStatus.SUSPENDIDO) {
        titularSuspendidos++;
      } else if (effStatus === AgreementStatus.VENCIDO) {
        titularVencidos++;
        misPrioritarios.push({
          id: a.id,
          folio: a.folio,
          title: a.title,
          dueDate: dueDateStr,
          daysRemaining,
          priority: a.priority,
          status: a.status,
          effectiveStatus: effStatus,
          progressPercent: a.progressPercent,
          rol: 'TITULAR',
        });
      } else if (effStatus === AgreementStatus.EN_PROCESO) {
        titularEnProceso++;
        misPrioritarios.push({
          id: a.id,
          folio: a.folio,
          title: a.title,
          dueDate: dueDateStr,
          daysRemaining,
          priority: a.priority,
          status: a.status,
          effectiveStatus: effStatus,
          progressPercent: a.progressPercent,
          rol: 'TITULAR',
        });
      } else {
        titularPendientes++;
        misPrioritarios.push({
          id: a.id,
          folio: a.folio,
          title: a.title,
          dueDate: dueDateStr,
          daysRemaining,
          priority: a.priority,
          status: a.status,
          effectiveStatus: effStatus,
          progressPercent: a.progressPercent,
          rol: 'TITULAR',
        });
      }
    }

    const totalTitularValidos = acuerdosTitularRows.length;
    const denomTitular = totalTitularValidos - titularSuspendidos;
    const tasaCumplimientoTitular =
      denomTitular > 0 ? Math.round((titularCumplidos / denomTitular) * 1000) / 10 : null;

    // 2. Acuerdos donde participa como Coadyuvante
    const colaboraciones = await this.prisma.agreementCollaborator.findMany({
      where: {
        userId: user.id,
        agreement: { deletedAt: null, isArchived: false },
      },
      select: {
        agreement: {
          select: {
            id: true,
            folio: true,
            title: true,
            status: true,
            priority: true,
            dueDate: true,
            progressPercent: true,
          },
        },
      },
    });

    let collabPendientes = 0;
    let collabEnProceso = 0;
    let collabCumplidos = 0;

    for (const c of colaboraciones) {
      const a = c.agreement;
      const dueDateStr = a.dueDate ? a.dueDate.toISOString().split('T')[0] : '';
      const effStatus = this.calculateEffectiveStatus(a.status, dueDateStr, todayStr);
      const daysRemaining = dueDateStr ? this.calculateDaysRemaining(dueDateStr, todayStr) : 0;

      if (effStatus === AgreementStatus.CUMPLIDO || effStatus === AgreementStatus.COMPLETADO) {
        collabCumplidos++;
      } else if (effStatus === AgreementStatus.EN_PROCESO) {
        collabEnProceso++;
        misPrioritarios.push({
          id: a.id,
          folio: a.folio,
          title: a.title,
          dueDate: dueDateStr,
          daysRemaining,
          priority: a.priority,
          status: a.status,
          effectiveStatus: effStatus,
          progressPercent: a.progressPercent,
          rol: 'COADYUVANTE',
        });
      } else {
        collabPendientes++;
        misPrioritarios.push({
          id: a.id,
          folio: a.folio,
          title: a.title,
          dueDate: dueDateStr,
          daysRemaining,
          priority: a.priority,
          status: a.status,
          effectiveStatus: effStatus,
          progressPercent: a.progressPercent,
          rol: 'COADYUVANTE',
        });
      }
    }

    // Ordenar prioritarios (vencidos primero, luego menor daysRemaining)
    misPrioritarios.sort((a, b) => a.daysRemaining - b.daysRemaining);

    // 3. Próximas sesiones convocadas para el usuario
    const proximasSesionesRows = await this.prisma.meeting.findMany({
      where: {
        deletedAt: null,
        meetingDate: { gte: new Date(todayStr + 'T00:00:00.000Z') },
        participants: { some: { userId: user.id } },
        status: { in: [MeetingStatus.PROGRAMADA, MeetingStatus.CONVOCADA] },
      },
      select: {
        id: true,
        folio: true,
        title: true,
        meetingDate: true,
        startTime: true,
        location: true,
        modality: true,
        category: { select: { name: true } },
      },
      orderBy: { meetingDate: 'asc' },
      take: 5,
    });

    const proximasSesiones = proximasSesionesRows.map((s) => ({
      id: s.id,
      folio: s.folio,
      title: s.title,
      meetingDate: s.meetingDate.toISOString().split('T')[0],
      startTime: s.startTime ? s.startTime.toISOString().substring(11, 16) : '00:00',
      location: s.location,
      modality: s.modality,
      categoryName: s.category?.name || 'General',
    }));

    // 4. Asistencia histórica personal
    const participacionesPasadas = await this.prisma.meetingParticipant.findMany({
      where: {
        userId: user.id,
        meeting: {
          deletedAt: null,
          status: { in: [MeetingStatus.FINALIZADA, MeetingStatus.ARCHIVADA] },
        },
      },
      select: { attendanceStatus: true },
    });

    const sesionesConvocado = participacionesPasadas.length;
    const sesionesAsistidas = participacionesPasadas.filter(
      (p) =>
        p.attendanceStatus === AttendanceStatus.PRESENTE ||
        p.attendanceStatus === AttendanceStatus.ASISTIO ||
        p.attendanceStatus === AttendanceStatus.TARDANZA ||
        p.attendanceStatus === AttendanceStatus.PARTICIPACION_REMOTA,
    ).length;

    const tasaAsistenciaPersonal =
      sesionesConvocado > 0 ? Math.round((sesionesAsistidas / sesionesConvocado) * 1000) / 10 : null;

    // 5. Métrica volumétrica de notas personales (ESTRICTAMENTE PRIVADA)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const totalNotas = await this.prisma.personalNote.count({
      where: {
        authorId: user.id,
        deletedAt: null,
      },
    });

    const notasUltimaSemana = await this.prisma.personalNote.count({
      where: {
        authorId: user.id,
        deletedAt: null,
        createdAt: { gte: sevenDaysAgo },
      },
    });

    return {
      user: {
        id: user.id,
        fullName: `${user.firstName} ${user.lastName}`.trim(),
        email: user.email,
        role: user.role,
      },
      acuerdosTitular: {
        total: totalTitularValidos,
        pendientes: titularPendientes,
        enProceso: titularEnProceso,
        cumplidos: titularCumplidos,
        vencidos: titularVencidos,
        suspendidos: titularSuspendidos,
        tasaCumplimiento: tasaCumplimientoTitular,
      },
      acuerdosCoadyuvante: {
        total: colaboraciones.length,
        pendientes: collabPendientes,
        enProceso: collabEnProceso,
        cumplidos: collabCumplidos,
      },
      misAcuerdosPrioritarios: misPrioritarios.slice(0, 6),
      proximasSesiones,
      asistenciaHistorica: {
        sesionesConvocado,
        sesionesAsistidas,
        tasaAsistenciaPersonal,
      },
      notasPrivadas: {
        totalNotas,
        notasUltimaSemana,
        avisoPrivacidad:
          'Métrica volumétrica personal. El contenido de las notas privadas es estrictamente inaccesible.',
      },
    };
  }

  // ==============================================================================
  // EXPORTACIÓN TABULAR CSV (DEC-08-01)
  // ==============================================================================
  async exportReportCsv(user: AuthUser, dto: ExportReportsDto): Promise<string> {
    const isAdmin =
      user.role === 'ROLE_ADMIN' || user.permissions.includes('report:view:executive');
    const todayStr = this.getTodayInMexicoCity();

    if (dto.type === 'agreements') {
      const where: any = {
        deletedAt: null,
        isArchived: false,
      };

      if (!isAdmin) {
        where.OR = [
          { assignedToId: user.id },
          { collaborators: { some: { userId: user.id } } },
        ];
      } else if (dto.assignedToId) {
        where.assignedToId = dto.assignedToId;
      }

      if (dto.categoryId) where.categoryId = dto.categoryId;
      if (dto.status) where.status = dto.status;
      if (dto.priority) where.priority = dto.priority;
      if (dto.from || dto.to) {
        where.approvalDate = {};
        if (dto.from) where.approvalDate.gte = new Date(dto.from + 'T00:00:00.000Z');
        if (dto.to) where.approvalDate.lte = new Date(dto.to + 'T23:59:59.999Z');
      }

      // Validar límite superior de 5,000 registros para evitar DOS o truncamiento silencioso
      const totalCount = await this.prisma.agreement.count({ where });
      if (totalCount > 5000) {
        throw new BadRequestException(
          `El reporte excede el límite de 5,000 registros (encontrados: ${totalCount}). Por favor acote los filtros de búsqueda por rango de fecha o categoría.`,
        );
      }

      const agreements = await this.prisma.agreement.findMany({
        where,
        select: {
          folio: true,
          title: true,
          priority: true,
          status: true,
          dueDate: true,
          approvalDate: true,
          completionDate: true,
          progressPercent: true,
          category: { select: { name: true } },
          assignee: { select: { firstName: true, lastName: true, email: true } },
        },
        orderBy: { dueDate: 'asc' },
      });

      const header = [
        'Folio',
        'Título',
        'Categoría',
        'Prioridad',
        'Estado_Registrado',
        'Estado_Efectivo',
        'Fecha_Aprobación',
        'Fecha_Límite',
        'Fecha_Cumplimiento',
        'Días_Restantes',
        'Progreso_Pct',
        'Responsable_Titular',
        'Email_Responsable',
      ].join(',');

      const lines = [header];

      for (const a of agreements) {
        const dueDateStr = a.dueDate ? a.dueDate.toISOString().split('T')[0] : '';
        const appDateStr = a.approvalDate ? a.approvalDate.toISOString().split('T')[0] : '';
        const compDateStr = a.completionDate ? a.completionDate.toISOString().split('T')[0] : '';
        const effStatus = this.calculateEffectiveStatus(a.status, dueDateStr, todayStr);
        const daysRemaining = dueDateStr ? this.calculateDaysRemaining(dueDateStr, todayStr) : '';

        const row = [
          this.sanitizeCsvField(a.folio),
          this.sanitizeCsvField(a.title),
          this.sanitizeCsvField(a.category?.name || 'Sin Categoría'),
          this.sanitizeCsvField(a.priority),
          this.sanitizeCsvField(a.status),
          this.sanitizeCsvField(effStatus),
          this.sanitizeCsvField(appDateStr),
          this.sanitizeCsvField(dueDateStr),
          this.sanitizeCsvField(compDateStr),
          this.sanitizeCsvField(daysRemaining),
          this.sanitizeCsvField(a.progressPercent),
          this.sanitizeCsvField(`${a.assignee.firstName} ${a.assignee.lastName}`.trim()),
          this.sanitizeCsvField(a.assignee.email),
        ];

        lines.push(row.join(','));
      }

      // Registro inmutable de auditoría (sin almacenar filas exportadas en diffPayload)
      await this.auditService.logEvent({
        actorId: user.id,
        action: 'REPORT_EXPORTED',
        entity: 'reports',
        entityId: 'agreements',
        diffPayload: {
          format: 'CSV',
          rowCount: agreements.length,
          filters: {
            from: dto.from,
            to: dto.to,
            categoryId: dto.categoryId,
            assignedToId: dto.assignedToId,
            status: dto.status,
          },
        },
      });

      return lines.join('\r\n');
    } else {
      // Exportación de reuniones y sesiones
      const where: any = {
        deletedAt: null,
      };

      if (dto.categoryId) where.categoryId = dto.categoryId;
      if (dto.status) where.status = dto.status;
      if (dto.from || dto.to) {
        where.meetingDate = {};
        if (dto.from) where.meetingDate.gte = new Date(dto.from + 'T00:00:00.000Z');
        if (dto.to) where.meetingDate.lte = new Date(dto.to + 'T23:59:59.999Z');
      }

      const totalCount = await this.prisma.meeting.count({ where });
      if (totalCount > 5000) {
        throw new BadRequestException(
          `El reporte excede el límite de 5,000 registros (encontrados: ${totalCount}). Por favor acote los filtros de búsqueda por rango de fecha o categoría.`,
        );
      }

      const meetings = await this.prisma.meeting.findMany({
        where,
        select: {
          folio: true,
          title: true,
          meetingDate: true,
          modality: true,
          status: true,
          category: { select: { name: true } },
          participants: { select: { attendanceStatus: true } },
          minutes: { select: { status: true, approvedAt: true } },
        },
        orderBy: { meetingDate: 'desc' },
      });

      const header = [
        'Folio',
        'Título',
        'Categoría',
        'Fecha',
        'Modalidad',
        'Estado',
        'Convocados',
        'Presentes',
        'Tasa_Asistencia_Pct',
        'Quórum_Legal',
        'Estado_Acta',
        'Fecha_Aprobación_Acta',
      ].join(',');

      const lines = [header];

      for (const m of meetings) {
        const meetingDateStr = m.meetingDate ? m.meetingDate.toISOString().split('T')[0] : '';
        const totalP = m.participants.length;
        const presentes = m.participants.filter(
          (p) =>
            p.attendanceStatus === AttendanceStatus.PRESENTE ||
            p.attendanceStatus === AttendanceStatus.ASISTIO ||
            p.attendanceStatus === AttendanceStatus.TARDANZA ||
            p.attendanceStatus === AttendanceStatus.PARTICIPACION_REMOTA,
        ).length;

        const tasaAsistencia = totalP > 0 ? `${Math.round((presentes / totalP) * 100)}%` : 'Sin datos';
        const tieneQuorum = totalP > 0 && presentes > totalP / 2 ? 'SÍ' : 'NO';
        const estadoActa = m.minutes ? m.minutes.status : 'PENDIENTE';
        const actaAprobadaStr =
          m.minutes?.approvedAt ? m.minutes.approvedAt.toISOString().split('T')[0] : '';

        const row = [
          this.sanitizeCsvField(m.folio),
          this.sanitizeCsvField(m.title),
          this.sanitizeCsvField(m.category?.name || 'General'),
          this.sanitizeCsvField(meetingDateStr),
          this.sanitizeCsvField(m.modality),
          this.sanitizeCsvField(m.status),
          this.sanitizeCsvField(totalP),
          this.sanitizeCsvField(presentes),
          this.sanitizeCsvField(tasaAsistencia),
          this.sanitizeCsvField(tieneQuorum),
          this.sanitizeCsvField(estadoActa),
          this.sanitizeCsvField(actaAprobadaStr),
        ];

        lines.push(row.join(','));
      }

      await this.auditService.logEvent({
        actorId: user.id,
        action: 'REPORT_EXPORTED',
        entity: 'reports',
        entityId: 'meetings',
        diffPayload: {
          format: 'CSV',
          rowCount: meetings.length,
          filters: {
            from: dto.from,
            to: dto.to,
            categoryId: dto.categoryId,
            status: dto.status,
          },
        },
      });

      return lines.join('\r\n');
    }
  }
}

import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';
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
import {
  MeetingModality,
  MeetingStatus,
  AttendanceStatus,
  MeetingListItem,
  MeetingDetailDto,
  AttendanceSummary,
  PaginatedResponse,
  AuthUser,
} from '@mexagenda/shared';
import { AuditOutcome, Prisma } from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class MeetingsService {
  private readonly logger = new Logger(MeetingsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly notificationsService?: NotificationsService,
  ) {}

  // -------------------------------------------------------------
  // 1. REUNIONES: LISTADO Y CONSULTA
  // -------------------------------------------------------------

  async findAll(query: QueryMeetingsDto): Promise<PaginatedResponse<MeetingListItem>> {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 10));
    const skip = (page - 1) * limit;

    const where: Prisma.MeetingWhereInput = {
      deletedAt: null, // No incluir eliminadas lógicamente
    };

    if (query.categoryId) {
      where.categoryId = query.categoryId;
    }

    if (query.status) {
      where.status = query.status;
    }

    if (query.modality) {
      where.modality = query.modality;
    }

    if (query.startDate || query.endDate) {
      where.meetingDate = {};
      if (query.startDate) {
        const startStr = query.startDate.includes('T') ? query.startDate : `${query.startDate}T00:00:00.000Z`;
        where.meetingDate.gte = new Date(startStr);
      }
      if (query.endDate) {
        const endStr = query.endDate.includes('T') ? query.endDate : `${query.endDate}T23:59:59.999Z`;
        where.meetingDate.lte = new Date(endStr);
      }
    }

    if (query.search) {
      const search = query.search.trim();
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { folio: { contains: search, mode: 'insensitive' } },
        { location: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const orderBy: Prisma.MeetingOrderByWithRelationInput = {};
    const sortField = query.sortBy || 'meetingDate';
    const sortOrder = query.sortOrder || 'desc';

    if (sortField === 'meetingDate') {
      orderBy.meetingDate = sortOrder;
    } else if (sortField === 'title') {
      orderBy.title = sortOrder;
    } else if (sortField === 'folio') {
      orderBy.folio = sortOrder;
    } else if (sortField === 'status') {
      orderBy.status = sortOrder;
    } else {
      orderBy.createdAt = sortOrder;
    }

    const [total, items] = await Promise.all([
      this.prisma.meeting.count({ where }),
      this.prisma.meeting.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          category: {
            select: { id: true, name: true, code: true, colorHex: true },
          },
          creator: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
          _count: {
            select: { participants: true },
          },
        },
      }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      items: items.map((m) => ({
        id: m.id,
        folio: m.folio,
        title: m.title,
        categoryId: m.categoryId,
        category: {
          id: m.category.id,
          name: m.category.name,
          code: m.category.code,
          colorHex: m.category.colorHex,
        },
        meetingDate: m.meetingDate.toISOString().split('T')[0],
        startTime: this.formatTime(m.startTime),
        endTime: this.formatTime(m.endTime),
        location: m.location,
        modality: m.modality as unknown as MeetingModality,
        virtualUrl: m.virtualUrl,
        timezone: m.timezone,
        status: m.status as unknown as MeetingStatus,
        participantsCount: m._count.participants,
        creator: {
          id: m.creator.id,
          fullName: `${m.creator.firstName} ${m.creator.lastName}`.trim(),
          email: m.creator.email,
        },
        createdAt: m.createdAt.toISOString(),
        updatedAt: m.updatedAt.toISOString(),
      })),
      meta: {
        total,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    };
  }

  async findById(id: string): Promise<MeetingDetailDto> {
    const meeting = await this.prisma.meeting.findUnique({
      where: { id },
      include: {
        category: true,
        creator: {
          select: { id: true, firstName: true, lastName: true, email: true, position: true },
        },
        updater: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        presidedBy: {
          select: { id: true, firstName: true, lastName: true },
        },
        secretaryBy: {
          select: { id: true, firstName: true, lastName: true },
        },
        convocatoria: {
          include: {
            publishedBy: {
              select: { id: true, firstName: true, lastName: true },
            },
          },
        },
        agendaItems: {
          where: { isDeleted: false },
          orderBy: { orderIndex: 'asc' },
        },
        participants: {
          include: {
            user: {
              select: { id: true, firstName: true, lastName: true, email: true, position: true },
            },
          },
          orderBy: [{ institutionalRole: 'asc' }, { id: 'asc' }],
        },
        minutes: {
          include: {
            approver: {
              select: { id: true, firstName: true, lastName: true },
            },
          },
        },
        sessionLogs: {
          include: {
            registeredBy: {
              select: { id: true, firstName: true, lastName: true },
            },
          },
          orderBy: { timestamp: 'asc' },
        },
      },
    });

    if (!meeting || meeting.deletedAt !== null) {
      throw new NotFoundException(`Reunión institucional con identificador [${id}] no encontrada.`);
    }

    const attendanceSummary = this.calculateAttendanceSummary(meeting.participants);

    return {
      id: meeting.id,
      folio: meeting.folio,
      title: meeting.title,
      description: meeting.description,
      categoryId: meeting.categoryId,
      category: {
        id: meeting.category.id,
        name: meeting.category.name,
        code: meeting.category.code,
        description: meeting.category.description,
        colorHex: meeting.category.colorHex,
        displayOrder: meeting.category.displayOrder,
        isActive: meeting.category.isActive,
        createdAt: meeting.category.createdAt.toISOString(),
        updatedAt: meeting.category.updatedAt.toISOString(),
      },
      meetingDate: meeting.meetingDate.toISOString().split('T')[0],
      startTime: this.formatTime(meeting.startTime),
      endTime: this.formatTime(meeting.endTime),
      realStartTime: meeting.realStartTime ? meeting.realStartTime.toISOString() : null,
      realEndTime: meeting.realEndTime ? meeting.realEndTime.toISOString() : null,
      location: meeting.location,
      modality: meeting.modality as unknown as MeetingModality,
      virtualUrl: meeting.virtualUrl,
      timezone: meeting.timezone,
      status: meeting.status as unknown as MeetingStatus,
      observations: meeting.observations,
      version: meeting.version,
      creator: {
        id: meeting.creator.id,
        fullName: `${meeting.creator.firstName} ${meeting.creator.lastName}`.trim(),
        email: meeting.creator.email,
        position: meeting.creator.position,
      },
      updater: meeting.updater
        ? {
            id: meeting.updater.id,
            fullName: `${meeting.updater.firstName} ${meeting.updater.lastName}`.trim(),
            email: meeting.updater.email,
          }
        : null,
      presidedBy: meeting.presidedBy
        ? {
            id: meeting.presidedBy.id,
            fullName: `${meeting.presidedBy.firstName} ${meeting.presidedBy.lastName}`.trim(),
          }
        : null,
      secretaryBy: meeting.secretaryBy
        ? {
            id: meeting.secretaryBy.id,
            fullName: `${meeting.secretaryBy.firstName} ${meeting.secretaryBy.lastName}`.trim(),
          }
        : null,
      convocatoria: meeting.convocatoria
        ? {
            id: meeting.convocatoria.id,
            meetingId: meeting.convocatoria.meetingId,
            convocatoriaNumber: meeting.convocatoria.convocatoriaNumber,
            issueDate: meeting.convocatoria.issueDate.toISOString(),
            noticeText: meeting.convocatoria.noticeText,
            isPublished: meeting.convocatoria.isPublished,
            publishedAt: meeting.convocatoria.publishedAt ? meeting.convocatoria.publishedAt.toISOString() : null,
            publishedBy: meeting.convocatoria.publishedBy
              ? {
                  id: meeting.convocatoria.publishedBy.id,
                  fullName: `${meeting.convocatoria.publishedBy.firstName} ${meeting.convocatoria.publishedBy.lastName}`.trim(),
                }
              : null,
            recipients: meeting.convocatoria.recipients,
            observations: meeting.convocatoria.observations,
            createdAt: meeting.convocatoria.createdAt.toISOString(),
            updatedAt: meeting.convocatoria.updatedAt.toISOString(),
          }
        : null,
      agendaItems: meeting.agendaItems.map((item) => ({
        id: item.id,
        meetingId: item.meetingId,
        orderIndex: item.orderIndex,
        title: item.title,
        description: item.description,
        responsibleName: item.responsibleName,
        responsibleUserId: item.responsibleUserId,
        estimatedMinutes: item.estimatedMinutes,
        itemType: item.itemType,
        observations: item.observations,
        status: item.status,
        isTreated: item.isTreated,
        treatedAt: item.treatedAt ? item.treatedAt.toISOString() : null,
        createdAt: item.createdAt.toISOString(),
        updatedAt: item.updatedAt.toISOString(),
      })),
      participants: meeting.participants.map((p) => ({
        id: p.id,
        meetingId: p.meetingId,
        userId: p.userId,
        user: p.user
          ? {
              id: p.user.id,
              email: p.user.email,
              firstName: p.user.firstName,
              lastName: p.user.lastName,
              position: p.user.position,
            }
          : null,
        institutionalRole: p.institutionalRole,
        participationCondition: p.participationCondition,
        attendanceStatus: p.attendanceStatus as unknown as AttendanceStatus,
        isExternal: p.isExternal,
        externalName: p.externalName,
        externalEmail: p.externalEmail,
        externalOrganization: p.externalOrganization,
        arrivalTime: p.arrivalTime ? p.arrivalTime.toISOString() : null,
        notes: p.notes,
        confirmedAt: p.confirmedAt ? p.confirmedAt.toISOString() : null,
      })),
      attendanceSummary,
      minutes: meeting.minutes
        ? {
            id: meeting.minutes.id,
            meetingId: meeting.minutes.meetingId,
            minutesNumber: meeting.minutes.minutesNumber,
            elaborationDate: meeting.minutes.elaborationDate.toISOString(),
            realStartTime: meeting.minutes.realStartTime ? meeting.minutes.realStartTime.toISOString() : null,
            realEndTime: meeting.minutes.realEndTime ? meeting.minutes.realEndTime.toISOString() : null,
            locationOrModality: meeting.minutes.locationOrModality,
            presidedByName: meeting.minutes.presidedByName,
            secretaryByName: meeting.minutes.secretaryByName,
            summary: meeting.minutes.summary,
            pointsTreatedSummary: meeting.minutes.pointsTreatedSummary,
            observations: meeting.minutes.observations,
            incidents: meeting.minutes.incidents,
            status: meeting.minutes.status,
            approvedAt: meeting.minutes.approvedAt ? meeting.minutes.approvedAt.toISOString() : null,
            approvedBy: meeting.minutes.approver
              ? {
                  id: meeting.minutes.approver.id,
                  fullName: `${meeting.minutes.approver.firstName} ${meeting.minutes.approver.lastName}`.trim(),
                }
              : null,
            approvalNotes: meeting.minutes.approvalNotes,
            version: meeting.minutes.version,
            createdAt: meeting.minutes.createdAt.toISOString(),
            updatedAt: meeting.minutes.updatedAt.toISOString(),
          }
        : null,
      sessionLogs: meeting.sessionLogs.map((log) => ({
        id: log.id,
        meetingId: log.meetingId,
        entryType: log.entryType,
        description: log.description,
        agendaItemId: log.agendaItemId,
        registeredBy: {
          id: log.registeredBy.id,
          fullName: `${log.registeredBy.firstName} ${log.registeredBy.lastName}`.trim(),
        },
        timestamp: log.timestamp.toISOString(),
      })),
      createdAt: meeting.createdAt.toISOString(),
      updatedAt: meeting.updatedAt.toISOString(),
    };
  }

  // -------------------------------------------------------------
  // 2. CREACIÓN Y EDICIÓN DE REUNIONES
  // -------------------------------------------------------------

  async create(
    dto: CreateMeetingDto,
    userId: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<MeetingDetailDto> {
    if (!dto.title || dto.title.trim().length < 3) {
      throw new BadRequestException('El título de la reunión es obligatorio y debe tener al menos 3 caracteres.');
    }
    if (!dto.meetingDate || isNaN(new Date(dto.meetingDate).getTime())) {
      throw new BadRequestException('La fecha de la reunión es obligatoria y debe tener formato ISO YYYY-MM-DD válido.');
    }

    // 1. Validar que la hora de inicio sea anterior a la de finalización (MEET-004)
    this.validateStartEndTimes(dto.startTime, dto.endTime);

    // 2. Validar que la categoría exista
    const category = await this.prisma.meetingCategory.findUnique({
      where: { id: dto.categoryId },
    });
    if (!category) {
      throw new NotFoundException(`La categoría con ID [${dto.categoryId}] no existe.`);
    }

    // 3. Determinar o generar Folio Institucional Único (MEET-005)
    let folio = dto.folio ? dto.folio.trim().toUpperCase() : '';
    if (folio) {
      const existingFolio = await this.prisma.meeting.findUnique({
        where: { folio },
      });
      if (existingFolio) {
        throw new ConflictException(`El folio institucional [${folio}] ya se encuentra registrado.`);
      }
    } else {
      folio = await this.generateUniqueFolio(category.code, dto.meetingDate);
    }

    // Convertir fecha y horas a tipos PostgreSQL
    const meetingDate = new Date(`${dto.meetingDate}T00:00:00.000Z`);
    const startTimeDate = new Date(`1970-01-01T${dto.startTime}:00.000Z`);
    const endTimeDate = new Date(`1970-01-01T${dto.endTime}:00.000Z`);

    let created: any = null;
    let attempts = 0;
    const maxAttempts = 8;

    while (!created && attempts < maxAttempts) {
      try {
        created = await this.prisma.meeting.create({
          data: {
            folio,
            title: dto.title.trim(),
            categoryId: dto.categoryId,
            meetingDate,
            startTime: startTimeDate,
            endTime: endTimeDate,
            location: dto.location.trim(),
            modality: dto.modality || 'PRESENCIAL',
            virtualUrl: dto.virtualUrl?.trim() || null,
            timezone: dto.timezone?.trim() || 'America/Mexico_City',
            description: dto.description?.trim() || null,
            observations: dto.observations?.trim() || null,
            status: dto.status || 'PROGRAMADA',
            createdById: userId,
          },
        });
      } catch (err: any) {
        if (err.code === 'P2002' && (!dto.folio || attempts > 0)) {
          attempts++;
          await new Promise((r) => setTimeout(r, 15 + Math.floor(Math.random() * 45) * attempts));
          folio = await this.generateUniqueFolio(category.code, dto.meetingDate);
        } else if (err.code === 'P2002') {
          throw new ConflictException(`El folio institucional [${folio}] ya se encuentra registrado.`);
        } else {
          throw err;
        }
      }
    }

    if (!created) {
      throw new ConflictException('No fue posible asignar un folio único debido a alta concurrencia. Por favor reintente.');
    }

    // Auto-registrar al convocador/creador como participante inicial
    await this.prisma.meetingParticipant.create({
      data: {
        meetingId: created.id,
        userId,
        institutionalRole: 'Convocador / Organizador',
        participationCondition: 'TITULAR',
        attendanceStatus: 'CONVOCADO',
      },
    });

    await this.auditService.logEvent({
      actorId: userId,
      action: 'MEETING_CREATED',
      entity: 'meetings',
      entityId: created.id,
      ipAddress,
      userAgent,
      outcome: AuditOutcome.SUCCESS,
      diffPayload: { folio: created.folio, title: created.title, meetingDate: dto.meetingDate },
    });

    return this.findById(created.id);
  }

  async update(
    id: string,
    dto: UpdateMeetingDto,
    userId: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<MeetingDetailDto> {
    const existing = await this.prisma.meeting.findUnique({
      where: { id },
    });

    if (!existing || existing.deletedAt !== null) {
      throw new NotFoundException(`Reunión con ID [${id}] no encontrada.`);
    }

    // Validación de control de concurrencia optimista
    if (dto.expectedVersion !== undefined && existing.version !== dto.expectedVersion) {
      throw new ConflictException(
        `Conflicto de concurrencia optimista: el registro ha sido modificado por otro usuario (versión actual: ${existing.version}, versión esperada: ${dto.expectedVersion}).`,
      );
    }

    // Validar horarios si se actualizan
    const newStartStr = dto.startTime || this.formatTime(existing.startTime);
    const newEndStr = dto.endTime || this.formatTime(existing.endTime);
    this.validateStartEndTimes(newStartStr, newEndStr);

    const data: Prisma.MeetingUpdateInput = {
      version: { increment: 1 },
      updater: { connect: { id: userId } },
    };

    if (dto.title !== undefined) data.title = dto.title.trim();
    if (dto.location !== undefined) data.location = dto.location.trim();
    if (dto.modality !== undefined) data.modality = dto.modality;
    if (dto.virtualUrl !== undefined) data.virtualUrl = dto.virtualUrl?.trim() || null;
    if (dto.description !== undefined) data.description = dto.description?.trim() || null;
    if (dto.observations !== undefined) data.observations = dto.observations?.trim() || null;
    if (dto.timezone !== undefined) data.timezone = dto.timezone.trim();

    if (dto.categoryId !== undefined && dto.categoryId !== existing.categoryId) {
      const category = await this.prisma.meetingCategory.findUnique({
        where: { id: dto.categoryId },
      });
      if (!category) {
        throw new NotFoundException(`La categoría con ID [${dto.categoryId}] no existe.`);
      }
      data.category = { connect: { id: dto.categoryId } };
    }

    if (dto.meetingDate !== undefined) {
      data.meetingDate = new Date(`${dto.meetingDate}T00:00:00.000Z`);
    }

    if (dto.startTime !== undefined) {
      data.startTime = new Date(`1970-01-01T${dto.startTime}:00.000Z`);
    }

    if (dto.endTime !== undefined) {
      data.endTime = new Date(`1970-01-01T${dto.endTime}:00.000Z`);
    }

    if (dto.presidedById !== undefined) {
      data.presidedBy = dto.presidedById ? { connect: { id: dto.presidedById } } : { disconnect: true };
    }

    if (dto.secretaryById !== undefined) {
      data.secretaryBy = dto.secretaryById ? { connect: { id: dto.secretaryById } } : { disconnect: true };
    }

    const updated = await this.prisma.meeting.update({
      where: { id },
      data,
    });

    await this.auditService.logEvent({
      actorId: userId,
      action: 'MEETING_UPDATED',
      entity: 'meetings',
      entityId: id,
      ipAddress,
      userAgent,
      outcome: AuditOutcome.SUCCESS,
      diffPayload: { previous: existing, current: updated },
    });

    if (['CONVOCADA', 'PROGRAMADA'].includes(existing.status) && this.notificationsService) {
      try {
        const changes: string[] = [];
        if (dto.title && dto.title !== existing.title) changes.push(`Título actualizado a "${dto.title}"`);
        if (dto.meetingDate) changes.push(`Nueva fecha programada`);
        if (dto.startTime || dto.endTime) changes.push(`Horario actualizado`);
        if (dto.location && dto.location !== existing.location) changes.push(`Nueva ubicación: ${dto.location}`);
        const changeDetails = changes.length > 0 ? changes.join('. ') : 'Se han actualizado los detalles de la sesión.';
        await this.notificationsService.notifyMeetingUpdate(id, changeDetails);
      } catch (notifErr: any) {
        this.logger.warn(`[Meetings] No se pudieron despachar las notificaciones de actualización para la reunión ${id}: ${notifErr.message}`);
      }
    }

    return this.findById(id);
  }

  // -------------------------------------------------------------
  // 3. CAMBIOS DE ESTADO, CANCELACIÓN Y ARCHIVADO
  // -------------------------------------------------------------

  async changeStatus(
    id: string,
    dto: ChangeMeetingStatusDto,
    userId: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<MeetingDetailDto> {
    const meeting = await this.prisma.meeting.findUnique({
      where: { id },
    });

    if (!meeting || meeting.deletedAt !== null) {
      throw new NotFoundException(`Reunión con ID [${id}] no encontrada.`);
    }

    const currentStatus = meeting.status;
    const targetStatus = dto.status;

    // Validar transiciones de ciclo de vida
    this.validateStatusTransition(currentStatus, targetStatus);

    if (targetStatus === 'CANCELADA' && (!dto.reason || dto.reason.trim().length === 0)) {
      throw new BadRequestException('Para cancelar una reunión es obligatorio indicar el motivo institucional.');
    }

    const updated = await this.prisma.meeting.update({
      where: { id },
      data: {
        status: targetStatus,
        observations: dto.reason ? `${meeting.observations || ''}\n[Motivo de cambio a ${targetStatus}]: ${dto.reason.trim()}`.trim() : meeting.observations,
        updatedById: userId,
      },
    });

    await this.auditService.logEvent({
      actorId: userId,
      action: 'MEETING_STATUS_CHANGED',
      entity: 'meetings',
      entityId: id,
      ipAddress,
      userAgent,
      outcome: AuditOutcome.SUCCESS,
      diffPayload: { from: currentStatus, to: targetStatus, reason: dto.reason },
    });

    if (targetStatus === 'CANCELADA' && this.notificationsService) {
      try {
        await this.notificationsService.notifyMeetingCancelled(id, dto.reason || 'Cancelación institucional programada');
      } catch (notifErr: any) {
        this.logger.warn(`[Meetings] No se pudieron despachar las notificaciones de cancelación para la reunión ${id}: ${notifErr.message}`);
      }
    }

    return this.findById(id);
  }

  async archive(
    id: string,
    userId: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<{ message: string }> {
    const meeting = await this.prisma.meeting.findUnique({
      where: { id },
    });

    if (!meeting || meeting.deletedAt !== null) {
      throw new NotFoundException(`Reunión con ID [${id}] no encontrada.`);
    }

    // Archivado institucional sin borrado físico (MEET-010)
    await this.prisma.meeting.update({
      where: { id },
      data: {
        status: 'ARCHIVADA',
        updatedById: userId,
      },
    });

    await this.auditService.logEvent({
      actorId: userId,
      action: 'MEETING_ARCHIVED',
      entity: 'meetings',
      entityId: id,
      ipAddress,
      userAgent,
      outcome: AuditOutcome.SUCCESS,
      diffPayload: { folio: meeting.folio },
    });

    return { message: `La reunión con folio [${meeting.folio}] ha sido archivada satisfactoriamente.` };
  }

  // -------------------------------------------------------------
  // 4. ORDEN DEL DÍA (AGENDA ITEMS)
  // -------------------------------------------------------------

  async addAgendaItem(
    meetingId: string,
    dto: CreateAgendaItemDto,
    userId: string,
  ) {
    const meeting = await this.prisma.meeting.findUnique({ where: { id: meetingId } });
    if (!meeting) throw new NotFoundException('Reunión no encontrada.');

    // Asignar orderIndex correlativo si no se proveyó
    let orderIndex = dto.orderIndex;
    if (!orderIndex) {
      const lastItem = await this.prisma.meetingAgendaItem.findFirst({
        where: { meetingId, isDeleted: false },
        orderBy: { orderIndex: 'desc' },
      });
      orderIndex = (lastItem?.orderIndex || 0) + 1;
    }

    const created = await this.prisma.meetingAgendaItem.create({
      data: {
        meetingId,
        orderIndex,
        title: dto.title.trim(),
        description: dto.description?.trim() || null,
        responsibleName: dto.responsibleName?.trim() || null,
        responsibleUserId: dto.responsibleUserId || null,
        estimatedMinutes: dto.estimatedMinutes || null,
        itemType: dto.itemType || 'ASUNTOS_ORDINARIOS',
        observations: dto.observations?.trim() || null,
      },
    });

    await this.auditService.logEvent({
      actorId: userId,
      action: 'AGENDA_ITEM_CREATED',
      entity: 'meeting_agenda_items',
      entityId: created.id,
      outcome: AuditOutcome.SUCCESS,
      diffPayload: { meetingId, title: created.title, orderIndex },
    });

    return created;
  }

  async updateAgendaItem(
    meetingId: string,
    itemId: string,
    dto: UpdateAgendaItemDto,
    userId: string,
  ) {
    const item = await this.prisma.meetingAgendaItem.findFirst({
      where: { id: itemId, meetingId, isDeleted: false },
    });
    if (!item) throw new NotFoundException('Punto del orden del día no encontrado.');

    const updated = await this.prisma.meetingAgendaItem.update({
      where: { id: itemId },
      data: {
        title: dto.title !== undefined ? dto.title.trim() : item.title,
        description: dto.description !== undefined ? dto.description?.trim() || null : item.description,
        responsibleName: dto.responsibleName !== undefined ? dto.responsibleName?.trim() || null : item.responsibleName,
        responsibleUserId: dto.responsibleUserId !== undefined ? dto.responsibleUserId || null : item.responsibleUserId,
        estimatedMinutes: dto.estimatedMinutes !== undefined ? dto.estimatedMinutes : item.estimatedMinutes,
        itemType: dto.itemType !== undefined ? dto.itemType : item.itemType,
        observations: dto.observations !== undefined ? dto.observations?.trim() || null : item.observations,
        status: dto.status !== undefined ? dto.status : item.status,
      },
    });

    await this.auditService.logEvent({
      actorId: userId,
      action: 'AGENDA_ITEM_UPDATED',
      entity: 'meeting_agenda_items',
      entityId: itemId,
      outcome: AuditOutcome.SUCCESS,
      diffPayload: { previous: item, current: updated },
    });

    return updated;
  }

  async reorderAgendaItems(
    meetingId: string,
    dto: ReorderAgendaItemsDto,
    userId: string,
  ) {
    const meeting = await this.prisma.meeting.findUnique({ where: { id: meetingId } });
    if (!meeting) throw new NotFoundException('Reunión no encontrada.');

    await this.prisma.$transaction(
      dto.items.map((i) =>
        this.prisma.meetingAgendaItem.update({
          where: { id: i.id },
          data: { orderIndex: i.orderIndex },
        }),
      ),
    );

    await this.auditService.logEvent({
      actorId: userId,
      action: 'AGENDA_ITEMS_REORDERED',
      entity: 'meetings',
      entityId: meetingId,
      outcome: AuditOutcome.SUCCESS,
      diffPayload: { itemsCount: dto.items.length },
    });

    return { message: 'Orden del día reordenado exitosamente.' };
  }

  async markAgendaItemTreated(
    meetingId: string,
    itemId: string,
    dto: MarkItemTreatedDto,
    userId: string,
  ) {
    const item = await this.prisma.meetingAgendaItem.findFirst({
      where: { id: itemId, meetingId, isDeleted: false },
    });
    if (!item) throw new NotFoundException('Punto del orden del día no encontrado.');

    const updated = await this.prisma.meetingAgendaItem.update({
      where: { id: itemId },
      data: {
        isTreated: dto.isTreated,
        status: dto.isTreated ? 'TRATADO' : 'PENDIENTE',
        treatedAt: dto.isTreated ? new Date() : null,
        observations: dto.observations !== undefined ? dto.observations?.trim() || null : item.observations,
      },
    });

    // Agregar registro automático en sessionLogs
    if (dto.isTreated) {
      await this.prisma.meetingSessionLog.create({
        data: {
          meetingId,
          entryType: 'DISCUSION_PUNTO',
          description: `Punto tratado: [${item.orderIndex}] ${item.title}. ${dto.observations || ''}`.trim(),
          agendaItemId: itemId,
          registeredById: userId,
        },
      });
    }

    await this.auditService.logEvent({
      actorId: userId,
      action: 'AGENDA_ITEM_TREATED',
      entity: 'meeting_agenda_items',
      entityId: itemId,
      outcome: AuditOutcome.SUCCESS,
      diffPayload: { isTreated: dto.isTreated, title: item.title },
    });

    return updated;
  }

  async deleteAgendaItem(meetingId: string, itemId: string, userId: string) {
    const item = await this.prisma.meetingAgendaItem.findFirst({
      where: { id: itemId, meetingId, isDeleted: false },
    });
    if (!item) throw new NotFoundException('Punto del orden del día no encontrado.');

    // Borrado lógico (AGENDA-005)
    await this.prisma.meetingAgendaItem.update({
      where: { id: itemId },
      data: { isDeleted: true },
    });

    await this.auditService.logEvent({
      actorId: userId,
      action: 'AGENDA_ITEM_DELETED',
      entity: 'meeting_agenda_items',
      entityId: itemId,
      outcome: AuditOutcome.SUCCESS,
      diffPayload: { title: item.title },
    });

    return { message: 'Punto del orden del día eliminado lógicamente.' };
  }

  // -------------------------------------------------------------
  // 5. PARTICIPANTES Y REGISTRO DE ASISTENCIA
  // -------------------------------------------------------------

  async addParticipant(meetingId: string, dto: AddParticipantDto, userId: string) {
    const meeting = await this.prisma.meeting.findUnique({ where: { id: meetingId } });
    if (!meeting) throw new NotFoundException('Reunión no encontrada.');

    // Si es usuario institucional, evitar duplicidad en la misma reunión (PART-002)
    if (dto.userId) {
      const existing = await this.prisma.meetingParticipant.findUnique({
        where: { meetingId_userId: { meetingId, userId: dto.userId } },
      });
      if (existing) {
        throw new ConflictException('El integrante ya está registrado como participante en esta reunión.');
      }
    }

    const created = await this.prisma.meetingParticipant.create({
      data: {
        meetingId,
        userId: dto.userId || null,
        institutionalRole: dto.institutionalRole || 'Vocal',
        participationCondition: dto.participationCondition || 'TITULAR',
        attendanceStatus: 'CONVOCADO',
        isExternal: dto.isExternal || false,
        externalName: dto.externalName?.trim() || null,
        externalEmail: dto.externalEmail?.trim() || null,
        externalOrganization: dto.externalOrganization?.trim() || null,
        notes: dto.notes?.trim() || null,
      },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true, position: true } },
      },
    });

    await this.auditService.logEvent({
      actorId: userId,
      action: 'PARTICIPANT_ADDED',
      entity: 'meeting_participants',
      entityId: created.id,
      outcome: AuditOutcome.SUCCESS,
      diffPayload: { meetingId, role: created.institutionalRole },
    });

    return created;
  }

  async removeParticipant(meetingId: string, participantId: string, userId: string) {
    const participant = await this.prisma.meetingParticipant.findFirst({
      where: { id: participantId, meetingId },
    });
    if (!participant) throw new NotFoundException('Participante no encontrado.');

    await this.prisma.meetingParticipant.delete({
      where: { id: participantId },
    });

    await this.auditService.logEvent({
      actorId: userId,
      action: 'PARTICIPANT_REMOVED',
      entity: 'meeting_participants',
      entityId: participantId,
      outcome: AuditOutcome.SUCCESS,
      diffPayload: { meetingId },
    });

    return { message: 'Participante removido de la reunión.' };
  }

  async registerSelfAttendance(
    meetingId: string,
    dto: UpdateAttendanceDto,
    user: AuthUser,
  ) {
    const meeting = await this.prisma.meeting.findUnique({
      where: { id: meetingId },
    });
    if (!meeting || meeting.deletedAt !== null) {
      throw new NotFoundException(`Reunión institucional [${meetingId}] no encontrada.`);
    }

    let participant = await this.prisma.meetingParticipant.findFirst({
      where: { meetingId, userId: user.id },
    });

    if (!participant) {
      const dbUser = await this.prisma.user.findUnique({
        where: { id: user.id },
        include: { role: true },
      });

      const arrivalTime = dto.arrivalTime ? new Date(dto.arrivalTime) : new Date();

      participant = await this.prisma.meetingParticipant.create({
        data: {
          meetingId,
          userId: user.id,
          institutionalRole:
            dbUser?.position ||
            dbUser?.role?.name ||
            (user.role === 'ROLE_ADMIN' ? 'Administrador' : 'Participante'),
          participationCondition: 'TITULAR',
          attendanceStatus: dto.attendanceStatus,
          arrivalTime,
          notes: dto.notes?.trim() || null,
          confirmedAt: new Date(),
        },
      });

      await this.prisma.meetingAttendanceHistory.create({
        data: {
          participantId: participant.id,
          previousStatus: AttendanceStatus.CONVOCADO,
          newStatus: dto.attendanceStatus,
          changedById: user.id,
          justification: dto.justification?.trim() || 'Auto-registro de asistencia del usuario',
        },
      });

      await this.auditService.logEvent({
        actorId: user.id,
        action: 'ATTENDANCE_SELF_REGISTERED',
        entity: 'meeting_participants',
        entityId: participant.id,
        outcome: AuditOutcome.SUCCESS,
        diffPayload: { status: dto.attendanceStatus, meetingId },
      });

      return participant;
    }

    return this.updateAttendance(meetingId, participant.id, dto, user.id, user);
  }

  async updateAttendance(
    meetingId: string,
    participantId: string,
    dto: UpdateAttendanceDto,
    userId: string,
    currentUser?: AuthUser,
  ) {
    const participant = await this.prisma.meetingParticipant.findFirst({
      where: { id: participantId, meetingId },
    });
    if (!participant) throw new NotFoundException('Participante no encontrado.');

    if (currentUser) {
      const isAdmin =
        currentUser.role === 'ROLE_ADMIN' ||
        (Array.isArray(currentUser.permissions) &&
          currentUser.permissions.includes('admin:all'));
      const isSelf = participant.userId === currentUser.id;

      if (!isAdmin && !isSelf) {
        throw new ForbiddenException(
          'Solo el administrador o el propio participante pueden registrar esta asistencia.',
        );
      }
    }

    const prevStatus = participant.attendanceStatus;
    const newStatus = dto.attendanceStatus;

    const arrivalTime = dto.arrivalTime ? new Date(dto.arrivalTime) : (participant.arrivalTime || new Date());

    const updated = await this.prisma.meetingParticipant.update({
      where: { id: participantId },
      data: {
        attendanceStatus: newStatus,
        arrivalTime,
        notes: dto.notes !== undefined ? dto.notes?.trim() || null : participant.notes,
        confirmedAt: new Date(),
      },
    });

    // Registrar historial de asistencia (PART-006)
    await this.prisma.meetingAttendanceHistory.create({
      data: {
        participantId,
        previousStatus: prevStatus,
        newStatus,
        changedById: userId,
        justification: dto.justification?.trim() || null,
      },
    });

    await this.auditService.logEvent({
      actorId: userId,
      action: 'ATTENDANCE_UPDATED',
      entity: 'meeting_participants',
      entityId: participantId,
      outcome: AuditOutcome.SUCCESS,
      diffPayload: { from: prevStatus, to: newStatus, justification: dto.justification },
    });

    return updated;
  }

  // -------------------------------------------------------------
  // 6. CONVOCATORIAS
  // -------------------------------------------------------------

  async createOrUpdateConvocatoria(
    meetingId: string,
    dto: CreateOrUpdateConvocatoriaDto,
    userId: string,
  ) {
    const meeting = await this.prisma.meeting.findUnique({
      where: { id: meetingId },
      include: { category: true },
    });
    if (!meeting) throw new NotFoundException('Reunión no encontrada.');

    let convNumber = dto.convocatoriaNumber ? dto.convocatoriaNumber.trim().toUpperCase() : '';
    if (!convNumber) {
      convNumber = `CONV-${meeting.folio}`;
    }

    const convocatoria = await this.prisma.meetingConvocatoria.upsert({
      where: { meetingId },
      create: {
        meetingId,
        convocatoriaNumber: convNumber,
        noticeText: dto.noticeText.trim(),
        observations: dto.observations?.trim() || null,
        isPublished: false,
      },
      update: {
        noticeText: dto.noticeText.trim(),
        observations: dto.observations !== undefined ? dto.observations?.trim() || null : undefined,
      },
    });

    await this.auditService.logEvent({
      actorId: userId,
      action: 'CONVOCATORIA_SAVED',
      entity: 'meeting_convocatorias',
      entityId: convocatoria.id,
      outcome: AuditOutcome.SUCCESS,
      diffPayload: { convocatoriaNumber: convocatoria.convocatoriaNumber },
    });

    return convocatoria;
  }

  async publishConvocatoria(
    meetingId: string,
    dtoOrUserId: PublishConvocatoriaDto | string,
    userIdArg?: string,
  ) {
    let dto: PublishConvocatoriaDto = {};
    let userId = userIdArg || '';

    if (typeof dtoOrUserId === 'string') {
      userId = dtoOrUserId;
      dto = {};
    } else {
      dto = dtoOrUserId || {};
    }
    const meeting = await this.prisma.meeting.findUnique({
      where: { id: meetingId },
      include: {
        convocatoria: true,
        participants: {
          include: {
            user: { select: { id: true, email: true, firstName: true, lastName: true } },
          },
        },
      },
    });

    if (!meeting) throw new NotFoundException('Reunión no encontrada.');
    if (!meeting.convocatoria) {
      throw new BadRequestException('Debe redactar el texto de la convocatoria antes de publicarla.');
    }

    if (['FINALIZADA', 'CANCELADA', 'ARCHIVADA'].includes(meeting.status)) {
      throw new BadRequestException(`No se puede publicar la convocatoria de una reunión en estado ${meeting.status}.`);
    }

    // Almacenar instantánea de destinatarios
    const recipientsSnapshot = meeting.participants.map((p) => ({
      participantId: p.id,
      name: p.isExternal ? p.externalName : `${p.user?.firstName} ${p.user?.lastName}`.trim(),
      email: p.isExternal ? p.externalEmail : p.user?.email,
      role: p.institutionalRole,
    }));

    const published = await this.prisma.meetingConvocatoria.update({
      where: { meetingId },
      data: {
        isPublished: true,
        publishedAt: new Date(),
        publishedById: userId,
        recipients: recipientsSnapshot,
        observations: dto.observations !== undefined ? dto.observations?.trim() || null : meeting.convocatoria.observations,
      },
    });

    // Actualizar estado de la reunión a CONVOCADA si está en PROGRAMADA
    if (meeting.status === 'PROGRAMADA' || meeting.status === 'BORRADOR') {
      await this.prisma.meeting.update({
        where: { id: meetingId },
        data: { status: 'CONVOCADA', updatedById: userId },
      });
    }

    await this.auditService.logEvent({
      actorId: userId,
      action: 'CONVOCATORIA_PUBLISHED',
      entity: 'meeting_convocatorias',
      entityId: published.id,
      outcome: AuditOutcome.SUCCESS,
      diffPayload: { recipientsCount: recipientsSnapshot.length },
    });

    if (this.notificationsService) {
      try {
        await this.notificationsService.notifyMeetingConvocatoria(meetingId);
      } catch (notifErr: any) {
        this.logger.warn(`[Meetings] No se pudieron despachar las notificaciones de convocatoria para la reunión ${meetingId}: ${notifErr.message}`);
      }
    }

    return published;
  }

  // -------------------------------------------------------------
  // 7. DESARROLLO DE LA SESIÓN Y LOGS
  // -------------------------------------------------------------

  async startSession(meetingId: string, dto: StartSessionDto, userId: string) {
    const meeting = await this.prisma.meeting.findUnique({ where: { id: meetingId } });
    if (!meeting) throw new NotFoundException('Reunión no encontrada.');

    const realStartTime = dto.realStartTime ? new Date(dto.realStartTime) : new Date();

    const updated = await this.prisma.meeting.update({
      where: { id: meetingId },
      data: {
        status: 'EN_DESARROLLO',
        realStartTime,
        presidedById: dto.presidedById || meeting.presidedById,
        secretaryById: dto.secretaryById || meeting.secretaryById,
        updatedById: userId,
      },
    });

    await this.prisma.meetingSessionLog.create({
      data: {
        meetingId,
        entryType: 'INICIO',
        description: `Inicio formal de la sesión a las ${realStartTime.toLocaleTimeString('es-MX')}.`,
        registeredById: userId,
      },
    });

    await this.auditService.logEvent({
      actorId: userId,
      action: 'MEETING_SESSION_STARTED',
      entity: 'meetings',
      entityId: meetingId,
      outcome: AuditOutcome.SUCCESS,
      diffPayload: { realStartTime },
    });

    return this.findById(meetingId);
  }

  async endSession(meetingId: string, dto: EndSessionDto, userId: string) {
    const meeting = await this.prisma.meeting.findUnique({ where: { id: meetingId } });
    if (!meeting) throw new NotFoundException('Reunión no encontrada.');

    const realEndTime = dto.realEndTime ? new Date(dto.realEndTime) : new Date();

    const updated = await this.prisma.meeting.update({
      where: { id: meetingId },
      data: {
        status: 'FINALIZADA',
        realEndTime,
        observations: dto.observations ? `${meeting.observations || ''}\n[Cierre de Sesión]: ${dto.observations}`.trim() : meeting.observations,
        updatedById: userId,
      },
    });

    await this.prisma.meetingSessionLog.create({
      data: {
        meetingId,
        entryType: 'CIERRE',
        description: `Clausura formal de la sesión a las ${realEndTime.toLocaleTimeString('es-MX')}. ${dto.observations || ''}`.trim(),
        registeredById: userId,
      },
    });

    await this.auditService.logEvent({
      actorId: userId,
      action: 'MEETING_SESSION_ENDED',
      entity: 'meetings',
      entityId: meetingId,
      outcome: AuditOutcome.SUCCESS,
      diffPayload: { realEndTime },
    });

    return this.findById(meetingId);
  }

  async addSessionLog(meetingId: string, dto: CreateSessionLogDto, userId: string) {
    const meeting = await this.prisma.meeting.findUnique({ where: { id: meetingId } });
    if (!meeting) throw new NotFoundException('Reunión no encontrada.');

    const log = await this.prisma.meetingSessionLog.create({
      data: {
        meetingId,
        entryType: dto.entryType.trim().toUpperCase(),
        description: dto.description.trim(),
        agendaItemId: dto.agendaItemId || null,
        registeredById: userId,
      },
      include: {
        registeredBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    await this.auditService.logEvent({
      actorId: userId,
      action: 'SESSION_LOG_ENTRY_CREATED',
      entity: 'meeting_session_logs',
      entityId: log.id,
      outcome: AuditOutcome.SUCCESS,
      diffPayload: { entryType: log.entryType },
    });

    return log;
  }

  async getSessionLogs(meetingId: string) {
    const meeting = await this.prisma.meeting.findUnique({ where: { id: meetingId } });
    if (!meeting) throw new NotFoundException('Reunión no encontrada.');

    return this.prisma.meetingSessionLog.findMany({
      where: { meetingId },
      include: {
        registeredBy: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { timestamp: 'asc' },
    });
  }

  // -------------------------------------------------------------
  // 8. ACTAS INSTITUCIONALES (MINUTES)
  // -------------------------------------------------------------

  async createOrUpdateMinutes(
    meetingId: string,
    dto: CreateOrUpdateMinutesDto,
    userId: string,
  ) {
    const meeting = await this.prisma.meeting.findUnique({
      where: { id: meetingId },
      include: { minutes: true },
    });
    if (!meeting) throw new NotFoundException('Reunión no encontrada.');

    const existingMinutes = meeting.minutes;

    // Si ya existía un acta APROBADA, crear versión histórica (MIN-005, MIN-006)
    if (existingMinutes && existingMinutes.status === 'APROBADA') {
      if (!dto.changeReason || dto.changeReason.trim().length === 0) {
        throw new BadRequestException(
          'Para modificar un acta formalmente aprobada es obligatorio registrar una justificación institucional (changeReason).',
        );
      }

      await this.prisma.meetingMinutesVersion.create({
        data: {
          minutesId: existingMinutes.id,
          versionNumber: existingMinutes.version,
          summary: existingMinutes.summary,
          pointsTreatedSummary: existingMinutes.pointsTreatedSummary,
          observations: existingMinutes.observations,
          incidents: existingMinutes.incidents,
          status: existingMinutes.status,
          changedById: userId,
          changeReason: dto.changeReason.trim(),
        },
      });

      await this.auditService.logEvent({
        actorId: userId,
        action: 'MINUTES_MODIFIED_AFTER_APPROVAL',
        entity: 'meeting_minutes',
        entityId: existingMinutes.id,
        outcome: AuditOutcome.SUCCESS,
        diffPayload: {
          previousVersion: existingMinutes.version,
          reason: dto.changeReason,
        },
      });
    }

    let minutesNumber = dto.minutesNumber ? dto.minutesNumber.trim().toUpperCase() : '';
    if (!minutesNumber) {
      minutesNumber = existingMinutes?.minutesNumber || `ACTA-${meeting.folio}`;
    }

    const minutes = await this.prisma.meetingMinutes.upsert({
      where: { meetingId },
      create: {
        meetingId,
        minutesNumber,
        summary: dto.summary.trim(),
        pointsTreatedSummary: dto.pointsTreatedSummary?.trim() || null,
        observations: dto.observations?.trim() || null,
        incidents: dto.incidents?.trim() || null,
        locationOrModality: dto.locationOrModality?.trim() || meeting.location,
        presidedByName: dto.presidedByName?.trim() || null,
        secretaryByName: dto.secretaryByName?.trim() || null,
        status: dto.status || 'BORRADOR',
        createdById: userId,
        version: 1,
      },
      update: {
        summary: dto.summary.trim(),
        pointsTreatedSummary: dto.pointsTreatedSummary !== undefined ? dto.pointsTreatedSummary?.trim() || null : undefined,
        observations: dto.observations !== undefined ? dto.observations?.trim() || null : undefined,
        incidents: dto.incidents !== undefined ? dto.incidents?.trim() || null : undefined,
        locationOrModality: dto.locationOrModality !== undefined ? dto.locationOrModality?.trim() || null : undefined,
        presidedByName: dto.presidedByName !== undefined ? dto.presidedByName?.trim() || null : undefined,
        secretaryByName: dto.secretaryByName !== undefined ? dto.secretaryByName?.trim() || null : undefined,
        status: dto.status !== undefined ? dto.status : undefined,
        updatedById: userId,
        version: (existingMinutes && existingMinutes.status === 'APROBADA') ? existingMinutes.version + 1 : (existingMinutes?.version || 1),
      },
    });

    await this.auditService.logEvent({
      actorId: userId,
      action: 'MINUTES_SAVED',
      entity: 'meeting_minutes',
      entityId: minutes.id,
      outcome: AuditOutcome.SUCCESS,
      diffPayload: { minutesNumber: minutes.minutesNumber, version: minutes.version },
    });

    return minutes;
  }

  async sendMinutesToRevision(meetingId: string, userId: string) {
    const minutes = await this.prisma.meetingMinutes.findUnique({ where: { meetingId } });
    if (!minutes) throw new NotFoundException('Acta no encontrada para esta reunión.');

    const updated = await this.prisma.meetingMinutes.update({
      where: { meetingId },
      data: { status: 'EN_REVISION', updatedById: userId },
    });

    await this.auditService.logEvent({
      actorId: userId,
      action: 'MINUTES_SENT_TO_REVISION',
      entity: 'meeting_minutes',
      entityId: minutes.id,
      outcome: AuditOutcome.SUCCESS,
    });

    return updated;
  }

  async approveMinutes(meetingId: string, dto: ApproveMinutesDto, userId: string) {
    const minutes = await this.prisma.meetingMinutes.findUnique({ where: { meetingId } });
    if (!minutes) throw new NotFoundException('Acta no encontrada para esta reunión.');

    const updated = await this.prisma.meetingMinutes.update({
      where: { meetingId },
      data: {
        status: 'APROBADA',
        approvedAt: new Date(),
        approvedById: userId,
        approvalNotes: dto.approvalNotes?.trim() || null,
        updatedById: userId,
      },
    });

    await this.auditService.logEvent({
      actorId: userId,
      action: 'MINUTES_APPROVED',
      entity: 'meeting_minutes',
      entityId: minutes.id,
      outcome: AuditOutcome.SUCCESS,
      diffPayload: { approvedAt: updated.approvedAt, notes: dto.approvalNotes },
    });

    if (this.notificationsService) {
      try {
        await this.notificationsService.notifyMinutesPublished(meetingId, minutes.id);
      } catch (notifErr: any) {
        this.logger.warn(`[Meetings] No se pudieron despachar las notificaciones de acta publicada para la reunión ${meetingId}: ${notifErr.message}`);
      }
    }

    return updated;
  }

  async getMinutesVersions(meetingId: string) {
    const minutes = await this.prisma.meetingMinutes.findUnique({ where: { meetingId } });
    if (!minutes) throw new NotFoundException('Acta no encontrada.');

    return this.prisma.meetingMinutesVersion.findMany({
      where: { minutesId: minutes.id },
      include: {
        changer: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
      orderBy: { versionNumber: 'desc' },
    });
  }

  // -------------------------------------------------------------
  // MÉTODOS AUXILIARES DE NEGOCIO
  // -------------------------------------------------------------

  private validateStartEndTimes(start: string, end: string): void {
    const [startH, startM] = start.split(':').map(Number);
    const [endH, endM] = end.split(':').map(Number);

    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;

    if (endMinutes <= startMinutes) {
      throw new BadRequestException(
        `La hora de finalización (${end}) no puede ser anterior ni igual a la hora de inicio (${start}).`,
      );
    }
  }

  private validateStatusTransition(current: string, target: string): void {
    if (current === target) return;

    const allowedTransitions: Record<string, string[]> = {
      BORRADOR: ['PROGRAMADA', 'CANCELADA'],
      PROGRAMADA: ['CONVOCADA', 'EN_DESARROLLO', 'CANCELADA'],
      CONVOCADA: ['EN_DESARROLLO', 'CANCELADA', 'PROGRAMADA'],
      EN_DESARROLLO: ['FINALIZADA', 'CANCELADA'],
      FINALIZADA: ['ARCHIVADA'],
      CANCELADA: ['ARCHIVADA'],
      ARCHIVADA: [],
    };

    const allowed = allowedTransitions[current] || [];
    if (!allowed.includes(target)) {
      throw new BadRequestException(
        `Transición de estado no permitida: no es posible pasar de [${current}] a [${target}].`,
      );
    }
  }

  private async generateUniqueFolio(categoryCode: string, meetingDateStr: string): Promise<string> {
    const year = meetingDateStr.split('-')[0] || new Date().getFullYear().toString();
    const prefix = categoryCode.substring(0, 3).toUpperCase();

    const count = await this.prisma.meeting.count();
    const sequential = String(count + 1).padStart(3, '0');

    let candidate = `${prefix}-${year}-${sequential}`;
    let exists = await this.prisma.meeting.findUnique({ where: { folio: candidate } });

    let attempt = 1;
    while (exists) {
      candidate = `${prefix}-${year}-${String(count + 1 + attempt).padStart(3, '0')}`;
      exists = await this.prisma.meeting.findUnique({ where: { folio: candidate } });
      attempt++;
    }

    return candidate;
  }

  private calculateAttendanceSummary(participants: any[]): AttendanceSummary {
    const totalConvocados = participants.length;
    let presentes = 0;
    let ausentes = 0;
    let justificados = 0;
    let tardanzas = 0;
    let participacionRemota = 0;

    for (const p of participants) {
      const status = p.attendanceStatus;
      if (status === 'PRESENTE' || status === 'ASISTIO') {
        presentes++;
      } else if (status === 'AUSENTE' || status === 'FALTA_INJUSTIFICADA') {
        ausentes++;
      } else if (status === 'JUSTIFICADO' || status === 'FALTA_JUSTIFICADA') {
        justificados++;
      } else if (status === 'TARDANZA') {
        tardanzas++;
        presentes++; // Una tardanza cuenta como presente
      } else if (status === 'PARTICIPACION_REMOTA') {
        participacionRemota++;
        presentes++; // Participación remota cuenta como asistencia
      }
    }

    const porcentajeAsistencia =
      totalConvocados > 0 ? Math.round((presentes / totalConvocados) * 100) : 0;

    return {
      totalConvocados,
      presentes,
      ausentes,
      justificados,
      tardanzas,
      participacionRemota,
      porcentajeAsistencia,
    };
  }

  private formatTime(timeVal: Date | string): string {
    if (typeof timeVal === 'string') return timeVal.substring(0, 5);
    if (timeVal instanceof Date) {
      return timeVal.toISOString().substring(11, 16);
    }
    return '00:00';
  }
}

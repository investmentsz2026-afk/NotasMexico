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
import { NotificationsService } from '../notifications/notifications.service';
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
import {
  AgreementStatus,
  AgreementPriority,
  AgreementListItem,
  AgreementDetailDto,
  AgreementProgressDto,
  AgreementCollaboratorDto,
  AgreementEvidenceDto,
  AgreementHistoryDto,
  AgreementDashboardDto,
  AgreementReportsDto,
  PaginatedResponse,
  AuditOutcome,
} from '@mexagenda/shared';
import { Prisma, UserStatus } from '@prisma/client';

@Injectable()
export class AgreementsService {
  private readonly logger = new Logger(AgreementsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly notificationsService?: NotificationsService,
  ) {}

  // -------------------------------------------------------------
  // CANDIDATOS ASIGNABLES
  // -------------------------------------------------------------

  async getAssignableUsers(): Promise<
    Array<{ id: string; fullName: string; email: string; position?: string | null }>
  > {
    const users = await this.prisma.user.findMany({
      where: {
        status: UserStatus.ACTIVO,
        deletedAt: null,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        position: true,
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });

    return users.map((u) => ({
      id: u.id,
      fullName: `${u.firstName} ${u.lastName}`.trim(),
      email: u.email,
      position: u.position,
    }));
  }

  // -------------------------------------------------------------
  // 1. CREACIÓN Y GENERACIÓN DE FOLIOS ÚNICOS
  // -------------------------------------------------------------

  async create(
    dto: CreateAgreementDto,
    userId: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<AgreementDetailDto> {
    if (!dto.title || dto.title.trim().length < 3) {
      throw new BadRequestException('El título del acuerdo es obligatorio y debe tener al menos 3 caracteres.');
    }
    if (!dto.description || dto.description.trim().length < 10) {
      throw new BadRequestException('La descripción institucional del acuerdo es obligatoria y debe tener al menos 10 caracteres.');
    }
    if (!dto.dueDate || isNaN(new Date(dto.dueDate).getTime())) {
      throw new BadRequestException('La fecha límite de cumplimiento es obligatoria y debe ser una fecha válida (YYYY-MM-DD).');
    }

    // 1. Validar existencia y vigencia de la reunión de origen
    const meeting = await this.prisma.meeting.findUnique({
      where: { id: dto.meetingId },
      include: { category: true, minutes: true },
    });
    if (!meeting || meeting.deletedAt !== null) {
      throw new NotFoundException(`La reunión institucional de origen con ID [${dto.meetingId}] no existe o fue eliminada.`);
    }

    // 2. Validar responsable asignado
    const assignee = await this.prisma.user.findUnique({
      where: { id: dto.assignedToId },
    });
    if (!assignee || assignee.status !== 'ACTIVO') {
      throw new BadRequestException('El usuario responsable asignado no existe o no tiene estatus ACTIVO.');
    }

    // 3. Validar agendaItemId y minutesId si se proporcionan
    if (dto.agendaItemId) {
      const agendaItem = await this.prisma.meetingAgendaItem.findFirst({
        where: { id: dto.agendaItemId, meetingId: dto.meetingId, isDeleted: false },
      });
      if (!agendaItem) {
        throw new BadRequestException(`El punto de agenda con ID [${dto.agendaItemId}] no pertenece a la reunión indicada.`);
      }
    }

    let minutesVersionNumber = dto.minutesVersionNumber;
    if (dto.minutesId) {
      const minutes = await this.prisma.meetingMinutes.findFirst({
        where: { id: dto.minutesId, meetingId: dto.meetingId },
      });
      if (!minutes) {
        throw new BadRequestException(`El acta con ID [${dto.minutesId}] no corresponde a la reunión indicada.`);
      }
      if (!minutesVersionNumber) {
        minutesVersionNumber = minutes.version;
      }
    } else if (meeting.minutes) {
      // Si la reunión ya tiene acta elaborada, vincularla automáticamente
      dto.minutesId = meeting.minutes.id;
      if (!minutesVersionNumber) {
        minutesVersionNumber = meeting.minutes.version;
      }
    }

    // 4. Determinar categoría (hereda de la reunión si no se especifica)
    const categoryId = dto.categoryId || meeting.categoryId;

    // 5. Determinar fechas institucionales
    const approvalDate = dto.approvalDate ? (this.parseInstitutionalDate(dto.approvalDate) || meeting.meetingDate) : meeting.meetingDate;
    const dueDate = this.parseInstitutionalDate(dto.dueDate);
    if (!dueDate) {
      throw new BadRequestException('La fecha límite de cumplimiento proporcionada no es válida.');
    }
    const startDate = this.parseInstitutionalDate(dto.startDate);

    if (startDate && dueDate < startDate) {
      throw new BadRequestException(`La fecha límite (${dto.dueDate}) no puede ser anterior a la fecha de inicio (${dto.startDate}).`);
    }

    // 6. Generación de folio único con protección contra colisiones concurrentes
    let folio = dto.folio ? dto.folio.trim().toUpperCase() : '';
    if (!folio) {
      folio = await this.generateUniqueFolio(meeting.category.code, dto.dueDate);
    } else {
      const exists = await this.prisma.agreement.findUnique({ where: { folio } });
      if (exists) {
        throw new ConflictException(`El folio institucional [${folio}] ya se encuentra registrado.`);
      }
    }

    let created: any = null;
    let attempts = 0;
    const maxAttempts = 8;

    while (!created && attempts < maxAttempts) {
      try {
        created = await this.prisma.$transaction(async (tx) => {
          const agreement = await tx.agreement.create({
            data: {
              folio,
              title: dto.title.trim(),
              description: dto.description.trim(),
              agreementType: dto.agreementType?.trim() || 'ORDINARIO',
              meetingId: dto.meetingId,
              categoryId,
              agendaItemId: dto.agendaItemId || null,
              minutesId: dto.minutesId || null,
              minutesVersionNumber: minutesVersionNumber || null,
              approvalDate,
              startDate,
              dueDate,
              priority: dto.priority || AgreementPriority.MEDIA,
              status: AgreementStatus.PENDIENTE,
              progressPercent: 0,
              observations: dto.observations?.trim() || null,
              createdById: userId,
              assignedToId: dto.assignedToId,
              version: 1,
            },
          });

          // Registrar colaboradores si fueron indicados
          if (dto.collaboratorUserIds && dto.collaboratorUserIds.length > 0) {
            const uniqueCollabIds = Array.from(new Set(dto.collaboratorUserIds)).filter(
              (id) => id !== dto.assignedToId,
            );
            for (const collabId of uniqueCollabIds) {
              const u = await tx.user.findUnique({ where: { id: collabId } });
              if (u && u.status === 'ACTIVO') {
                await tx.agreementCollaborator.create({
                  data: {
                    agreementId: agreement.id,
                    userId: collabId,
                    assignedById: userId,
                    notes: 'Colaborador inicial asignado en registro',
                  },
                });
              }
            }
          }

          // Historial de creación inicial
          await tx.agreementHistory.create({
            data: {
              agreementId: agreement.id,
              actionType: 'CREATION',
              previousStatus: null,
              newStatus: AgreementStatus.PENDIENTE,
              newAssignedToId: dto.assignedToId,
              newDueDate: dueDate,
              newPercent: 0,
              changeReason: 'Registro institucional formal del acuerdo colegiado',
              changedById: userId,
            },
          });

          return agreement;
        });
      } catch (err: any) {
        if (err.code === 'P2002' && (!dto.folio || attempts > 0)) {
          attempts++;
          await new Promise((r) => setTimeout(r, 15 + Math.floor(Math.random() * 45) * attempts));
          folio = await this.generateUniqueFolio(meeting.category.code, dto.dueDate);
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

    await this.auditService.logEvent({
      actorId: userId,
      action: 'AGREEMENT_CREATED',
      entity: 'agreements',
      entityId: created.id,
      ipAddress,
      userAgent,
      outcome: AuditOutcome.SUCCESS,
      diffPayload: {
        folio: created.folio,
        title: created.title,
        meetingId: created.meetingId,
        assignedToId: created.assignedToId,
        dueDate: dto.dueDate,
      },
    });

    if (this.notificationsService) {
      try {
        await this.notificationsService.notifyAgreementAssigned(created.id);
      } catch (notifErr: any) {
        this.logger.warn(`[Agreements] Error al notificar asignación inicial del acuerdo ${created.id}: ${notifErr.message}`);
      }
    }

    return this.findById(created.id);
  }

  // -------------------------------------------------------------
  // 2. CONSULTA Y LISTADO CON FILTROS Y PAGINACIÓN
  // -------------------------------------------------------------

  async findAll(query: QueryAgreementsDto): Promise<PaginatedResponse<AgreementListItem>> {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 10));
    const skip = (page - 1) * limit;

    const where: Prisma.AgreementWhereInput = {
      isArchived: query.isArchived === 'true' ? true : false,
      deletedAt: null,
    };

    if (query.status) {
      where.status = query.status;
    }
    if (query.priority) {
      where.priority = query.priority;
    }
    if (query.agreementType) {
      where.agreementType = query.agreementType;
    }
    if (query.meetingId) {
      where.meetingId = query.meetingId;
    }
    if (query.categoryId) {
      where.categoryId = query.categoryId;
    }
    if (query.assignedToId) {
      where.assignedToId = query.assignedToId;
    }
    if (query.collaboratorId) {
      where.collaborators = {
        some: { userId: query.collaboratorId },
      };
    }

    if (query.dueBefore || query.dueAfter) {
      where.dueDate = {};
      if (query.dueAfter) {
        const afterStr = query.dueAfter.includes('T') ? query.dueAfter : `${query.dueAfter}T00:00:00.000Z`;
        where.dueDate.gte = new Date(afterStr);
      }
      if (query.dueBefore) {
        const beforeStr = query.dueBefore.includes('T') ? query.dueBefore : `${query.dueBefore}T23:59:59.999Z`;
        where.dueDate.lte = new Date(beforeStr);
      }
    }

    if (query.search) {
      const search = query.search.trim();
      where.OR = [
        { folio: { contains: search, mode: 'insensitive' } },
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const orderBy: Prisma.AgreementOrderByWithRelationInput = {};
    const sortField = query.sortBy || 'dueDate';
    const sortOrder = query.sortOrder || 'asc';

    if (sortField === 'dueDate') {
      orderBy.dueDate = sortOrder;
    } else if (sortField === 'title') {
      orderBy.title = sortOrder;
    } else if (sortField === 'status') {
      orderBy.status = sortOrder;
    } else if (sortField === 'progressPercent') {
      orderBy.progressPercent = sortOrder;
    } else if (sortField === 'folio') {
      orderBy.folio = sortOrder;
    } else {
      orderBy.createdAt = sortOrder;
    }

    const [total, items] = await Promise.all([
      this.prisma.agreement.count({ where }),
      this.prisma.agreement.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          meeting: { select: { id: true, folio: true, title: true } },
          category: { select: { id: true, name: true, code: true, colorHex: true } },
          assignee: { select: { id: true, firstName: true, lastName: true, email: true, position: true } },
          _count: { select: { collaborators: true, evidences: true } },
        },
      }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      items: items.map((a) => ({
        id: a.id,
        folio: a.folio,
        title: a.title,
        agreementType: a.agreementType,
        priority: a.priority as unknown as AgreementPriority,
        status: this.calculateEffectiveStatus(a.status as AgreementStatus, a.dueDate),
        progressPercent: a.progressPercent,
        dueDate: a.dueDate.toISOString().split('T')[0],
        startDate: a.startDate ? a.startDate.toISOString().split('T')[0] : null,
        completionDate: a.completionDate ? a.completionDate.toISOString().split('T')[0] : null,
        meetingId: a.meetingId,
        meetingFolio: a.meeting.folio,
        meetingTitle: a.meeting.title,
        category: a.category
          ? {
              id: a.category.id,
              name: a.category.name,
              code: a.category.code,
              colorHex: a.category.colorHex,
            }
          : null,
        assignee: {
          id: a.assignee.id,
          fullName: `${a.assignee.firstName} ${a.assignee.lastName}`.trim(),
          email: a.assignee.email,
          position: a.assignee.position,
        },
        collaboratorsCount: a._count.collaborators,
        evidencesCount: a._count.evidences,
        isArchived: a.isArchived,
        version: a.version,
        createdAt: a.createdAt.toISOString(),
        updatedAt: a.updatedAt.toISOString(),
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

  // -------------------------------------------------------------
  // 3. CONSULTA PROFUNDA DE EXPEDIENTE DEL ACUERDO
  // -------------------------------------------------------------

  async findById(id: string): Promise<AgreementDetailDto> {
    const agreement = await this.prisma.agreement.findUnique({
      where: { id },
      include: {
        meeting: {
          select: { id: true, folio: true, title: true, meetingDate: true },
        },
        category: {
          select: { id: true, name: true, code: true, colorHex: true },
        },
        agendaItem: {
          select: { id: true, orderIndex: true, title: true },
        },
        minutes: {
          select: { id: true, minutesNumber: true },
        },
        creator: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        assignee: {
          select: { id: true, firstName: true, lastName: true, email: true, position: true },
        },
        completer: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        collaborators: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true, email: true, position: true } },
            assignedBy: { select: { id: true, firstName: true, lastName: true } },
          },
          orderBy: { assignedAt: 'asc' },
        },
        progressReports: {
          include: {
            reportedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
            _count: { select: { evidences: true } },
          },
          orderBy: { reportedAt: 'desc' },
        },
        evidences: {
          include: {
            registeredBy: { select: { id: true, firstName: true, lastName: true, email: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
        history: {
          include: {
            changer: { select: { id: true, firstName: true, lastName: true, email: true } },
            previousAssignee: { select: { id: true, firstName: true, lastName: true } },
            newAssignee: { select: { id: true, firstName: true, lastName: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!agreement || agreement.deletedAt !== null) {
      throw new NotFoundException(`El acuerdo institucional con ID [${id}] no fue encontrado o fue eliminado.`);
    }

    const effectiveStatus = this.calculateEffectiveStatus(
      agreement.status as AgreementStatus,
      agreement.dueDate,
    );

    return {
      id: agreement.id,
      folio: agreement.folio,
      title: agreement.title,
      description: agreement.description,
      agreementType: agreement.agreementType,
      priority: agreement.priority as unknown as AgreementPriority,
      status: effectiveStatus,
      progressPercent: agreement.progressPercent,
      approvalDate: agreement.approvalDate.toISOString().split('T')[0],
      startDate: agreement.startDate ? agreement.startDate.toISOString().split('T')[0] : null,
      dueDate: agreement.dueDate.toISOString().split('T')[0],
      completionDate: agreement.completionDate ? agreement.completionDate.toISOString().split('T')[0] : null,
      observations: agreement.observations,
      changeReason: agreement.changeReason,
      version: agreement.version,
      isArchived: agreement.isArchived,
      meetingId: agreement.meetingId,
      meeting: {
        id: agreement.meeting.id,
        folio: agreement.meeting.folio,
        title: agreement.meeting.title,
        meetingDate: agreement.meeting.meetingDate.toISOString().split('T')[0],
      },
      categoryId: agreement.categoryId,
      category: agreement.category
        ? {
            id: agreement.category.id,
            name: agreement.category.name,
            code: agreement.category.code,
            colorHex: agreement.category.colorHex,
          }
        : null,
      agendaItemId: agreement.agendaItemId,
      agendaItem: agreement.agendaItem
        ? {
            id: agreement.agendaItem.id,
            orderIndex: agreement.agendaItem.orderIndex,
            title: agreement.agendaItem.title,
          }
        : null,
      minutesId: agreement.minutesId,
      minutes: agreement.minutes
        ? {
            id: agreement.minutes.id,
            minutesNumber: agreement.minutes.minutesNumber,
          }
        : null,
      minutesVersionNumber: agreement.minutesVersionNumber,
      creator: {
        id: agreement.creator.id,
        fullName: `${agreement.creator.firstName} ${agreement.creator.lastName}`.trim(),
        email: agreement.creator.email,
      },
      assignee: {
        id: agreement.assignee.id,
        fullName: `${agreement.assignee.firstName} ${agreement.assignee.lastName}`.trim(),
        email: agreement.assignee.email,
        position: agreement.assignee.position,
      },
      completer: agreement.completer
        ? {
            id: agreement.completer.id,
            fullName: `${agreement.completer.firstName} ${agreement.completer.lastName}`.trim(),
            email: agreement.completer.email,
          }
        : null,
      collaborators: agreement.collaborators.map((c) => ({
        id: c.id,
        agreementId: c.agreementId,
        userId: c.userId,
        user: {
          id: c.user.id,
          fullName: `${c.user.firstName} ${c.user.lastName}`.trim(),
          email: c.user.email,
          position: c.user.position,
        },
        assignedAt: c.assignedAt.toISOString(),
        assignedById: c.assignedById,
        assignedBy: {
          id: c.assignedBy.id,
          fullName: `${c.assignedBy.firstName} ${c.assignedBy.lastName}`.trim(),
        },
        notes: c.notes,
      })),
      progressReports: agreement.progressReports.map((p) => ({
        id: p.id,
        agreementId: p.agreementId,
        reportedById: p.reportedById,
        reportedBy: {
          id: p.reportedBy.id,
          fullName: `${p.reportedBy.firstName} ${p.reportedBy.lastName}`.trim(),
          email: p.reportedBy.email,
        },
        reportedAt: p.reportedAt.toISOString(),
        previousPercent: p.previousPercent,
        newPercent: p.newPercent,
        description: p.description,
        observations: p.observations,
        resultingStatus: p.resultingStatus as unknown as AgreementStatus,
        justification: p.justification,
        evidencesCount: p._count.evidences,
      })),
      evidences: agreement.evidences.map((e) => ({
        id: e.id,
        agreementId: e.agreementId,
        progressId: e.progressId,
        title: e.title,
        description: e.description,
        documentReference: e.documentReference,
        registeredById: e.registeredById,
        registeredBy: {
          id: e.registeredBy.id,
          fullName: `${e.registeredBy.firstName} ${e.registeredBy.lastName}`.trim(),
          email: e.registeredBy.email,
        },
        createdAt: e.createdAt.toISOString(),
      })),
      history: agreement.history.map((h) => ({
        id: h.id,
        agreementId: h.agreementId,
        actionType: h.actionType,
        previousStatus: h.previousStatus as unknown as AgreementStatus,
        newStatus: h.newStatus as unknown as AgreementStatus,
        previousAssignedTo: h.previousAssignee
          ? {
              id: h.previousAssignee.id,
              fullName: `${h.previousAssignee.firstName} ${h.previousAssignee.lastName}`.trim(),
            }
          : null,
        newAssignedTo: h.newAssignee
          ? {
              id: h.newAssignee.id,
              fullName: `${h.newAssignee.firstName} ${h.newAssignee.lastName}`.trim(),
            }
          : null,
        previousDueDate: h.previousDueDate ? h.previousDueDate.toISOString().split('T')[0] : null,
        newDueDate: h.newDueDate ? h.newDueDate.toISOString().split('T')[0] : null,
        previousPercent: h.previousPercent,
        newPercent: h.newPercent,
        progressNotes: h.progressNotes,
        changeReason: h.changeReason,
        details: h.details as Record<string, any>,
        changer: {
          id: h.changer.id,
          fullName: `${h.changer.firstName} ${h.changer.lastName}`.trim(),
          email: h.changer.email,
        },
        createdAt: h.createdAt.toISOString(),
      })),
      createdAt: agreement.createdAt.toISOString(),
      updatedAt: agreement.updatedAt.toISOString(),
    };
  }

  // -------------------------------------------------------------
  // 4. ACTUALIZACIÓN GENERAL Y BLOQUEO OPTIMISTA
  // -------------------------------------------------------------

  async update(
    id: string,
    dto: UpdateAgreementDto,
    userId: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<AgreementDetailDto> {
    const existing = await this.prisma.agreement.findUnique({
      where: { id },
    });
    if (!existing || existing.deletedAt !== null) {
      throw new NotFoundException(`Acuerdo institucional con ID [${id}] no encontrado.`);
    }

    // Control de concurrencia optimista
    const expVer = dto.expectedVersion !== undefined ? dto.expectedVersion : (dto as any).version;
    if (expVer !== undefined && existing.version !== expVer) {
      throw new ConflictException(
        `Conflicto de concurrencia optimista: el acuerdo ha sido modificado por otro usuario (versión actual: ${existing.version}, versión esperada: ${expVer}).`,
      );
    }

    const data: Prisma.AgreementUpdateInput = {
      version: { increment: 1 },
    };

    let deadlineChanged = false;
    let oldDueDate = existing.dueDate;
    let newDueDate = existing.dueDate;

    if (dto.title !== undefined) data.title = dto.title.trim();
    if (dto.description !== undefined) data.description = dto.description.trim();
    if (dto.agreementType !== undefined) data.agreementType = dto.agreementType.trim();
    if (dto.priority !== undefined) data.priority = dto.priority;
    if (dto.observations !== undefined) data.observations = dto.observations?.trim() || null;
    if (dto.changeReason !== undefined) data.changeReason = dto.changeReason?.trim() || null;

    if (dto.startDate !== undefined) {
      data.startDate = this.parseInstitutionalDate(dto.startDate);
    }

    if (dto.dueDate !== undefined) {
      const parsedDue = this.parseInstitutionalDate(dto.dueDate);
      if (parsedDue) {
        newDueDate = parsedDue;
        if (newDueDate.getTime() !== oldDueDate.getTime()) {
          deadlineChanged = true;
          data.dueDate = newDueDate;
        }
      }
    }

    if (dto.categoryId !== undefined) {
      if (dto.categoryId) {
        const cat = await this.prisma.meetingCategory.findUnique({ where: { id: dto.categoryId } });
        if (!cat) throw new NotFoundException('Categoría no encontrada.');
        data.category = { connect: { id: dto.categoryId } };
      } else {
        data.category = { disconnect: true };
      }
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.agreement.update({
        where: { id },
        data,
      });

      if (deadlineChanged) {
        await tx.agreementHistory.create({
          data: {
            agreementId: id,
            actionType: 'DEADLINE_CHANGE',
            previousDueDate: oldDueDate,
            newDueDate,
            changeReason: dto.changeReason?.trim() || 'Ajuste de plazo institucional',
            changedById: userId,
          },
        });
      } else {
        await tx.agreementHistory.create({
          data: {
            agreementId: id,
            actionType: 'METADATA_UPDATE',
            changeReason: dto.changeReason?.trim() || 'Modificación general de datos del acuerdo',
            changedById: userId,
          },
        });
      }
    });

    await this.auditService.logEvent({
      actorId: userId,
      action: 'AGREEMENT_UPDATED',
      entity: 'agreements',
      entityId: id,
      ipAddress,
      userAgent,
      outcome: AuditOutcome.SUCCESS,
      diffPayload: { changeReason: dto.changeReason, deadlineChanged },
    });

    return this.findById(id);
  }

  // -------------------------------------------------------------
  // 5. ASIGNACIÓN Y COLABORADORES
  // -------------------------------------------------------------

  async assign(
    id: string,
    dto: AssignAgreementDto,
    userId: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<AgreementDetailDto> {
    const existing = await this.prisma.agreement.findUnique({ where: { id } });
    if (!existing || existing.deletedAt !== null) {
      throw new NotFoundException(`Acuerdo institucional [${id}] no encontrado.`);
    }

    const newAssignee = await this.prisma.user.findUnique({ where: { id: dto.assignedToId } });
    if (!newAssignee || newAssignee.status !== 'ACTIVO') {
      throw new BadRequestException('El nuevo usuario responsable no existe o no se encuentra ACTIVO.');
    }

    if (existing.assignedToId === dto.assignedToId) {
      throw new BadRequestException('El usuario especificado ya es el responsable principal del acuerdo.');
    }

    const previousAssignedToId = existing.assignedToId;
    const justification = (dto.justification || (dto as any).changeReason || '').trim();
    if (!justification || justification.length < 5) {
      throw new BadRequestException('La justificación o motivo institucional de la reasignación es obligatoria.');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.agreement.update({
        where: { id },
        data: {
          assignedToId: dto.assignedToId,
          version: { increment: 1 },
        },
      });

      await tx.agreementHistory.create({
        data: {
          agreementId: id,
          actionType: 'REASSIGNMENT',
          previousAssignedToId,
          newAssignedToId: dto.assignedToId,
          changeReason: justification,
          progressNotes: dto.notes?.trim() || null,
          changedById: userId,
        },
      });
    });

    await this.auditService.logEvent({
      actorId: userId,
      action: 'AGREEMENT_REASSIGNED',
      entity: 'agreements',
      entityId: id,
      ipAddress,
      userAgent,
      outcome: AuditOutcome.SUCCESS,
      diffPayload: {
        fromUserId: previousAssignedToId,
        toUserId: dto.assignedToId,
        justification: dto.justification,
      },
    });

    if (this.notificationsService) {
      try {
        await this.notificationsService.notifyAgreementAssigned(id);
      } catch (notifErr: any) {
        this.logger.warn(`[Agreements] Error al notificar reasignación del acuerdo ${id}: ${notifErr.message}`);
      }
    }

    return this.findById(id);
  }

  async addCollaborator(
    agreementId: string,
    dto: AddCollaboratorDto,
    userId: string,
  ): Promise<AgreementCollaboratorDto> {
    const agreement = await this.prisma.agreement.findUnique({ where: { id: agreementId } });
    if (!agreement || agreement.deletedAt !== null) {
      throw new NotFoundException('Acuerdo no encontrado.');
    }

    if (agreement.assignedToId === dto.userId) {
      throw new BadRequestException('El usuario ya es el responsable principal del acuerdo y no puede duplicarse como colaborador.');
    }

    const targetUser = await this.prisma.user.findUnique({ where: { id: dto.userId } });
    if (!targetUser || targetUser.status !== 'ACTIVO') {
      throw new BadRequestException('El colaborador especificado no existe o no está ACTIVO.');
    }

    const existing = await this.prisma.agreementCollaborator.findUnique({
      where: { agreementId_userId: { agreementId, userId: dto.userId } },
    });
    if (existing) {
      throw new ConflictException('El usuario ya está registrado como colaborador en este acuerdo.');
    }

    const created = await this.prisma.agreementCollaborator.create({
      data: {
        agreementId,
        userId: dto.userId,
        assignedById: userId,
        notes: dto.notes?.trim() || null,
      },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true, position: true } },
        assignedBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    await this.auditService.logEvent({
      actorId: userId,
      action: 'AGREEMENT_COLLABORATOR_ADDED',
      entity: 'agreement_collaborators',
      entityId: created.id,
      outcome: AuditOutcome.SUCCESS,
      diffPayload: { agreementId, userId: dto.userId },
    });

    if (this.notificationsService) {
      try {
        await this.notificationsService.notifyAgreementAssigned(agreementId);
      } catch (notifErr: any) {
        this.logger.warn(`[Agreements] Error al notificar nuevo colaborador del acuerdo ${agreementId}: ${notifErr.message}`);
      }
    }

    return {
      id: created.id,
      agreementId: created.agreementId,
      userId: created.userId,
      user: {
        id: created.user.id,
        fullName: `${created.user.firstName} ${created.user.lastName}`.trim(),
        email: created.user.email,
        position: created.user.position,
      },
      assignedAt: created.assignedAt.toISOString(),
      assignedById: created.assignedById,
      assignedBy: {
        id: created.assignedBy.id,
        fullName: `${created.assignedBy.firstName} ${created.assignedBy.lastName}`.trim(),
      },
      notes: created.notes,
    };
  }

  async removeCollaborator(
    agreementId: string,
    collaboratorUserId: string,
    userId: string,
  ): Promise<{ message: string }> {
    const collab = await this.prisma.agreementCollaborator.findUnique({
      where: { agreementId_userId: { agreementId, userId: collaboratorUserId } },
    });
    if (!collab) {
      throw new NotFoundException('El usuario no figura como colaborador en este acuerdo.');
    }

    await this.prisma.agreementCollaborator.delete({
      where: { id: collab.id },
    });

    await this.auditService.logEvent({
      actorId: userId,
      action: 'AGREEMENT_COLLABORATOR_REMOVED',
      entity: 'agreement_collaborators',
      entityId: collab.id,
      outcome: AuditOutcome.SUCCESS,
      diffPayload: { agreementId, removedUserId: collaboratorUserId },
    });

    return { message: 'Colaborador removido exitosamente del acuerdo.' };
  }

  // -------------------------------------------------------------
  // 6. SEGUIMIENTO Y REGISTRO DE AVANCES ACUMULATIVOS
  // -------------------------------------------------------------

  async addProgress(
    id: string,
    dto: CreateAgreementProgressDto,
    userId: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<AgreementProgressDto> {
    const agreement = await this.prisma.agreement.findUnique({
      where: { id },
      include: { collaborators: true },
    });
    if (!agreement || agreement.deletedAt !== null) {
      throw new NotFoundException(`Acuerdo institucional [${id}] no encontrado.`);
    }

    if (
      agreement.status === AgreementStatus.CUMPLIDO ||
      agreement.status === AgreementStatus.COMPLETADO ||
      agreement.status === AgreementStatus.CANCELADO ||
      agreement.status === AgreementStatus.SUSPENDIDO
    ) {
      throw new BadRequestException(
        `No es posible asentar avances en un acuerdo en estado [${agreement.status}]. Requiere reactivación previa.`,
      );
    }

    const previousPercent = agreement.progressPercent;
    const newPercent = dto.newPercent !== undefined ? dto.newPercent : (dto as any).progressPercent ?? previousPercent;
    const description = (dto.description || dto.observations || 'Avance reportado').trim();
    const justification = (dto.justification || (dto as any).reason || '').trim();

    if (newPercent < previousPercent && !justification) {
      throw new BadRequestException(
        'Para registrar una reducción en el porcentaje de avance es obligatorio proporcionar una justificación institucional.',
      );
    }

    // Transición automática a EN_PROCESO si estaba en PENDIENTE y registra avance
    let nextStatus: AgreementStatus = agreement.status as AgreementStatus;
    if (agreement.status === AgreementStatus.PENDIENTE && newPercent > 0) {
      nextStatus = AgreementStatus.EN_PROCESO;
    } else if (dto.resultingStatus && dto.resultingStatus !== AgreementStatus.CUMPLIDO) {
      nextStatus = dto.resultingStatus;
    }

    const created = await this.prisma.$transaction(async (tx) => {
      const progress = await tx.agreementProgress.create({
        data: {
          agreementId: id,
          reportedById: userId,
          previousPercent,
          newPercent,
          description,
          observations: dto.observations?.trim() || null,
          resultingStatus: nextStatus,
          justification: justification || null,
        },
        include: {
          reportedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
      });

      await tx.agreement.update({
        where: { id },
        data: {
          progressPercent: newPercent,
          status: nextStatus,
          version: { increment: 1 },
        },
      });

      await tx.agreementHistory.create({
        data: {
          agreementId: id,
          actionType: 'PROGRESS_UPDATE',
          previousPercent,
          newPercent,
          previousStatus: agreement.status as AgreementStatus,
          newStatus: nextStatus,
          progressNotes: description,
          changeReason: justification || null,
          changedById: userId,
        },
      });

      return progress;
    });

    await this.auditService.logEvent({
      actorId: userId,
      action: 'AGREEMENT_PROGRESS_RECORDED',
      entity: 'agreement_progress',
      entityId: created.id,
      ipAddress,
      userAgent,
      outcome: AuditOutcome.SUCCESS,
      diffPayload: {
        previousPercent,
        newPercent,
        resultingStatus: nextStatus,
      },
    });

    if (nextStatus !== agreement.status && this.notificationsService) {
      try {
        await this.notificationsService.notifyAgreementStatusChanged(id, agreement.status, nextStatus);
      } catch (notifErr: any) {
        this.logger.warn(`[Agreements] Error al notificar cambio de estado en addProgress para acuerdo ${id}: ${notifErr.message}`);
      }
    }

    return {
      id: created.id,
      agreementId: created.agreementId,
      reportedById: created.reportedById,
      reportedBy: {
        id: created.reportedBy.id,
        fullName: `${created.reportedBy.firstName} ${created.reportedBy.lastName}`.trim(),
        email: created.reportedBy.email,
      },
      reportedAt: created.reportedAt.toISOString(),
      previousPercent: created.previousPercent,
      newPercent: created.newPercent,
      description: created.description,
      observations: created.observations,
      resultingStatus: created.resultingStatus as unknown as AgreementStatus,
      justification: created.justification,
    };
  }

  // -------------------------------------------------------------
  // 7. MÁQUINA DE ESTADOS Y TRANSICIONES FORMALES
  // -------------------------------------------------------------

  async complete(
    id: string,
    dto: CompleteAgreementDto,
    userId: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<AgreementDetailDto> {
    const agreement = await this.prisma.agreement.findUnique({ where: { id } });
    if (!agreement || agreement.deletedAt !== null) {
      throw new NotFoundException(`Acuerdo institucional [${id}] no encontrado.`);
    }

    if (agreement.status === AgreementStatus.CANCELADO) {
      throw new BadRequestException('No se puede certificar como cumplido un acuerdo que se encuentra CANCELADO.');
    }
    if (agreement.status === AgreementStatus.CUMPLIDO || agreement.status === AgreementStatus.COMPLETADO) {
      throw new BadRequestException('El acuerdo ya ha sido certificado como CUMPLIDO.');
    }

    const completionDate = dto.completionDate ? (this.parseInstitutionalDate(dto.completionDate) || new Date()) : new Date();
    const notes = (dto.completionNotes || (dto as any).observations || 'Cumplimiento institucional formal verificado').trim();

    await this.prisma.$transaction(async (tx) => {
      await tx.agreement.update({
        where: { id },
        data: {
          status: AgreementStatus.CUMPLIDO,
          progressPercent: 100,
          completionDate,
          completedById: userId,
          observations: notes ? `${agreement.observations || ''}\n[Cumplimiento Certificado]: ${notes}`.trim() : agreement.observations,
          version: { increment: 1 },
        },
      });

      await tx.agreementHistory.create({
        data: {
          agreementId: id,
          actionType: 'COMPLETION_CONFIRMED',
          previousStatus: agreement.status as AgreementStatus,
          newStatus: AgreementStatus.CUMPLIDO,
          previousPercent: agreement.progressPercent,
          newPercent: 100,
          changeReason: notes,
          changedById: userId,
        },
      });
    });

    await this.auditService.logEvent({
      actorId: userId,
      action: 'AGREEMENT_COMPLETED',
      entity: 'agreements',
      entityId: id,
      ipAddress,
      userAgent,
      outcome: AuditOutcome.SUCCESS,
      diffPayload: { notes: dto.completionNotes, completionDate },
    });

    if (this.notificationsService) {
      try {
        await this.notificationsService.notifyAgreementStatusChanged(id, agreement.status, AgreementStatus.CUMPLIDO);
      } catch (notifErr: any) {
        this.logger.warn(`[Agreements] Error al notificar cumplimiento de acuerdo ${id}: ${notifErr.message}`);
      }
    }

    return this.findById(id);
  }

  async suspend(
    id: string,
    dto: SuspendAgreementDto,
    userId: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<AgreementDetailDto> {
    const agreement = await this.prisma.agreement.findUnique({ where: { id } });
    if (!agreement || agreement.deletedAt !== null) {
      throw new NotFoundException(`Acuerdo institucional [${id}] no encontrado.`);
    }

    if (agreement.status === AgreementStatus.CUMPLIDO || agreement.status === AgreementStatus.CANCELADO) {
      throw new BadRequestException(`No es posible suspender un acuerdo en estado [${agreement.status}].`);
    }

    const justification = (dto.justification || (dto as any).reason || '').trim();
    if (!justification) {
      throw new BadRequestException('La justificación de la suspensión es obligatoria.');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.agreement.update({
        where: { id },
        data: {
          status: AgreementStatus.SUSPENDIDO,
          changeReason: justification,
          version: { increment: 1 },
        },
      });

      await tx.agreementHistory.create({
        data: {
          agreementId: id,
          actionType: 'SUSPENSION',
          previousStatus: agreement.status as AgreementStatus,
          newStatus: AgreementStatus.SUSPENDIDO,
          changeReason: justification,
          progressNotes: dto.expectedResumeDate ? `Reanudación tentativa: ${dto.expectedResumeDate}` : null,
          changedById: userId,
        },
      });
    });

    await this.auditService.logEvent({
      actorId: userId,
      action: 'AGREEMENT_SUSPENDED',
      entity: 'agreements',
      entityId: id,
      ipAddress,
      userAgent,
      outcome: AuditOutcome.SUCCESS,
      diffPayload: { justification: dto.justification },
    });

    if (this.notificationsService) {
      try {
        await this.notificationsService.notifyAgreementStatusChanged(id, agreement.status, AgreementStatus.SUSPENDIDO);
      } catch (notifErr: any) {
        this.logger.warn(`[Agreements] Error al notificar suspensión de acuerdo ${id}: ${notifErr.message}`);
      }
    }

    return this.findById(id);
  }

  async reactivate(
    id: string,
    dto: ReactivateAgreementDto,
    userId: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<AgreementDetailDto> {
    const agreement = await this.prisma.agreement.findUnique({ where: { id } });
    if (!agreement || agreement.deletedAt !== null) {
      throw new NotFoundException(`Acuerdo institucional [${id}] no encontrado.`);
    }

    const allowedToReactivate = [AgreementStatus.SUSPENDIDO, AgreementStatus.CANCELADO, AgreementStatus.VENCIDO];
    if (!allowedToReactivate.includes(agreement.status as AgreementStatus)) {
      throw new BadRequestException(`El acuerdo no se encuentra en estado suspendido, cancelado o vencido (estado actual: ${agreement.status}).`);
    }

    const nextStatus = agreement.progressPercent > 0 ? AgreementStatus.EN_PROCESO : AgreementStatus.PENDIENTE;
    const newDueDate = dto.newDueDate ? (this.parseInstitutionalDate(dto.newDueDate) || agreement.dueDate) : agreement.dueDate;
    const justification = (dto.justification || (dto as any).reason || 'Reactivación acordada formalmente').trim();

    await this.prisma.$transaction(async (tx) => {
      await tx.agreement.update({
        where: { id },
        data: {
          status: nextStatus,
          dueDate: newDueDate,
          changeReason: justification,
          version: { increment: 1 },
        },
      });

      await tx.agreementHistory.create({
        data: {
          agreementId: id,
          actionType: 'REACTIVATION',
          previousStatus: agreement.status as AgreementStatus,
          newStatus: nextStatus,
          newDueDate: dto.newDueDate ? newDueDate : null,
          changeReason: justification,
          changedById: userId,
        },
      });
    });

    await this.auditService.logEvent({
      actorId: userId,
      action: 'AGREEMENT_REACTIVATED',
      entity: 'agreements',
      entityId: id,
      ipAddress,
      userAgent,
      outcome: AuditOutcome.SUCCESS,
      diffPayload: { justification: dto.justification, nextStatus, newDueDate },
    });

    if (this.notificationsService) {
      try {
        await this.notificationsService.notifyAgreementStatusChanged(id, agreement.status, nextStatus);
      } catch (notifErr: any) {
        this.logger.warn(`[Agreements] Error al notificar reactivación de acuerdo ${id}: ${notifErr.message}`);
      }
    }

    return this.findById(id);
  }

  async cancel(
    id: string,
    dto: CancelAgreementDto,
    userId: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<AgreementDetailDto> {
    const agreement = await this.prisma.agreement.findUnique({ where: { id } });
    if (!agreement || agreement.deletedAt !== null) {
      throw new NotFoundException(`Acuerdo institucional [${id}] no encontrado.`);
    }

    if (agreement.status === AgreementStatus.CUMPLIDO || agreement.status === AgreementStatus.COMPLETADO) {
      throw new BadRequestException('No es posible cancelar un acuerdo que ya fue formalmente certificado como CUMPLIDO.');
    }
    if (agreement.status === AgreementStatus.CANCELADO) {
      throw new BadRequestException('El acuerdo ya se encuentra CANCELADO.');
    }

    const justification = (dto.justification || (dto as any).reason || '').trim();
    if (!justification) {
      throw new BadRequestException('La fundamentación institucional de la cancelación es obligatoria.');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.agreement.update({
        where: { id },
        data: {
          status: AgreementStatus.CANCELADO,
          changeReason: justification,
          version: { increment: 1 },
        },
      });

      await tx.agreementHistory.create({
        data: {
          agreementId: id,
          actionType: 'CANCELLATION',
          previousStatus: agreement.status as AgreementStatus,
          newStatus: AgreementStatus.CANCELADO,
          changeReason: justification,
          changedById: userId,
        },
      });
    });

    await this.auditService.logEvent({
      actorId: userId,
      action: 'AGREEMENT_CANCELLED',
      entity: 'agreements',
      entityId: id,
      ipAddress,
      userAgent,
      outcome: AuditOutcome.SUCCESS,
      diffPayload: { justification: dto.justification },
    });

    if (this.notificationsService) {
      try {
        await this.notificationsService.notifyAgreementStatusChanged(id, agreement.status, AgreementStatus.CANCELADO);
      } catch (notifErr: any) {
        this.logger.warn(`[Agreements] Error al notificar cancelación de acuerdo ${id}: ${notifErr.message}`);
      }
    }

    return this.findById(id);
  }

  // -------------------------------------------------------------
  // 8. EVIDENCIAS Y METADATOS DOCUMENTALES (PREPARACIÓN FASE 6)
  // -------------------------------------------------------------

  async addEvidence(
    agreementId: string,
    dto: CreateEvidenceDto,
    userId: string,
  ): Promise<AgreementEvidenceDto> {
    const agreement = await this.prisma.agreement.findUnique({ where: { id: agreementId } });
    if (!agreement || agreement.deletedAt !== null) {
      throw new NotFoundException('Acuerdo no encontrado.');
    }

    if (dto.progressId) {
      const prog = await this.prisma.agreementProgress.findFirst({
        where: { id: dto.progressId, agreementId },
      });
      if (!prog) throw new BadRequestException('El avance asociado no pertenece a este acuerdo.');
    }

    const created = await this.prisma.agreementEvidence.create({
      data: {
        agreementId,
        progressId: dto.progressId || null,
        title: dto.title.trim(),
        description: dto.description?.trim() || null,
        documentReference: dto.documentReference?.trim() || null,
        registeredById: userId,
      },
      include: {
        registeredBy: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });

    await this.auditService.logEvent({
      actorId: userId,
      action: 'AGREEMENT_EVIDENCE_REGISTERED',
      entity: 'agreement_evidences',
      entityId: created.id,
      outcome: AuditOutcome.SUCCESS,
      diffPayload: { agreementId, title: created.title },
    });

    return {
      id: created.id,
      agreementId: created.agreementId,
      progressId: created.progressId,
      title: created.title,
      description: created.description,
      documentReference: created.documentReference,
      registeredById: created.registeredById,
      registeredBy: {
        id: created.registeredBy.id,
        fullName: `${created.registeredBy.firstName} ${created.registeredBy.lastName}`.trim(),
        email: created.registeredBy.email,
      },
      createdAt: created.createdAt.toISOString(),
    };
  }

  // -------------------------------------------------------------
  // 9. ELIMINACIÓN LÓGICA (ARCHIVADO)
  // -------------------------------------------------------------

  async archive(id: string, userId: string, ipAddress?: string, userAgent?: string): Promise<{ message: string }> {
    const agreement = await this.prisma.agreement.findUnique({ where: { id } });
    if (!agreement || agreement.deletedAt !== null) {
      throw new NotFoundException(`Acuerdo institucional [${id}] no encontrado.`);
    }

    await this.prisma.agreement.update({
      where: { id },
      data: {
        isArchived: true,
        deletedAt: new Date(),
        version: { increment: 1 },
      },
    });

    await this.auditService.logEvent({
      actorId: userId,
      action: 'AGREEMENT_ARCHIVED',
      entity: 'agreements',
      entityId: id,
      ipAddress,
      userAgent,
      outcome: AuditOutcome.SUCCESS,
      diffPayload: { folio: agreement.folio },
    });

    return { message: `Acuerdo institucional [${agreement.folio}] archivado exitosamente.` };
  }

  // -------------------------------------------------------------
  // 10. DASHBOARD EJECUTIVO Y REPORTES
  // -------------------------------------------------------------

  async getDashboardMetrics(): Promise<AgreementDashboardDto> {
    const agreements = await this.prisma.agreement.findMany({
      where: { isArchived: false, deletedAt: null },
      include: {
        assignee: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    let total = agreements.length;
    let pendientes = 0;
    let enProceso = 0;
    let cumplidos = 0;
    let vencidos = 0;
    let suspendidos = 0;
    let cancelados = 0;

    const assigneeMap = new Map<string, { fullName: string; total: number; cumplidos: number; pendientes: number; vencidos: number }>();

    for (const a of agreements) {
      const effStatus = this.calculateEffectiveStatus(a.status as AgreementStatus, a.dueDate);

      if (effStatus === AgreementStatus.PENDIENTE) pendientes++;
      else if (effStatus === AgreementStatus.EN_PROCESO) enProceso++;
      else if (effStatus === AgreementStatus.CUMPLIDO || effStatus === AgreementStatus.COMPLETADO) cumplidos++;
      else if (effStatus === AgreementStatus.VENCIDO) vencidos++;
      else if (effStatus === AgreementStatus.SUSPENDIDO) suspendidos++;
      else if (effStatus === AgreementStatus.CANCELADO) cancelados++;

      const uid = a.assignee.id;
      const uName = `${a.assignee.firstName} ${a.assignee.lastName}`.trim();
      if (!assigneeMap.has(uid)) {
        assigneeMap.set(uid, { fullName: uName, total: 0, cumplidos: 0, pendientes: 0, vencidos: 0 });
      }
      const entry = assigneeMap.get(uid)!;
      entry.total++;
      if (effStatus === AgreementStatus.CUMPLIDO || effStatus === AgreementStatus.COMPLETADO) entry.cumplidos++;
      else if (effStatus === AgreementStatus.VENCIDO) entry.vencidos++;
      else entry.pendientes++;
    }

    const porcentajeCumplimientoGlobal = total > 0 ? Math.round((cumplidos / total) * 100) : 0;

    // Acuerdos urgentes o pendientes próximos
    const urgentPendingQuery = await this.findAll({
      page: 1,
      limit: 5,
      status: AgreementStatus.PENDIENTE,
      sortBy: 'dueDate',
      sortOrder: 'asc',
    });

    // Avances recientes
    const recentProgressEntries = await this.prisma.agreementProgress.findMany({
      take: 5,
      orderBy: { reportedAt: 'desc' },
      include: {
        reportedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });

    return {
      metrics: {
        total,
        pendientes,
        enProceso,
        cumplidos,
        vencidos,
        suspendidos,
        cancelados,
        porcentajeCumplimientoGlobal,
      },
      urgentPending: urgentPendingQuery.items,
      recentProgress: recentProgressEntries.map((p) => ({
        id: p.id,
        agreementId: p.agreementId,
        reportedById: p.reportedById,
        reportedBy: {
          id: p.reportedBy.id,
          fullName: `${p.reportedBy.firstName} ${p.reportedBy.lastName}`.trim(),
          email: p.reportedBy.email,
        },
        reportedAt: p.reportedAt.toISOString(),
        previousPercent: p.previousPercent,
        newPercent: p.newPercent,
        description: p.description,
        observations: p.observations,
        resultingStatus: p.resultingStatus as unknown as AgreementStatus,
        justification: p.justification,
      })),
      byAssignee: Array.from(assigneeMap.entries()).map(([userId, data]) => ({
        userId,
        fullName: data.fullName,
        total: data.total,
        cumplidos: data.cumplidos,
        pendientes: data.pendientes,
        vencidos: data.vencidos,
      })),
    };
  }

  async getReports(): Promise<AgreementReportsDto> {
    const dashboard = await this.getDashboardMetrics();

    // Acuerdos próximos a vencer (en los próximos 15 días)
    const now = new Date();
    const in15Days = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const todayStr = now.toISOString().split('T')[0];

    const upcomingDueQuery = await this.findAll({
      page: 1,
      limit: 10,
      dueAfter: todayStr,
      dueBefore: in15Days,
      sortBy: 'dueDate',
      sortOrder: 'asc',
    });

    // Acuerdos vencidos
    const overdueQuery = await this.findAll({
      page: 1,
      limit: 10,
      dueBefore: todayStr,
      sortBy: 'dueDate',
      sortOrder: 'desc',
    });

    const all = await this.prisma.agreement.findMany({
      where: { isArchived: false, deletedAt: null },
      select: { priority: true, agreementType: true },
    });

    const byPriority: Record<string, number> = {};
    const byType: Record<string, number> = {};

    for (const a of all) {
      byPriority[a.priority] = (byPriority[a.priority] || 0) + 1;
      byType[a.agreementType] = (byType[a.agreementType] || 0) + 1;
    }

    return {
      metrics: dashboard.metrics,
      upcomingDue: upcomingDueQuery.items.filter((it) => it.status !== AgreementStatus.CUMPLIDO),
      overdue: overdueQuery.items.filter((it) => it.status === AgreementStatus.VENCIDO),
      byPriority,
      byType,
    };
  }

  // -------------------------------------------------------------
  // MÉTODOS AUXILIARES Y REGLAS DE NEGOCIO
  // -------------------------------------------------------------

  /**
   * Cálculo coherente y determinista del estado de cumplimiento.
   * Si la fecha límite expiró y el acuerdo no ha sido cumplido ni cancelado, se reporta como VENCIDO.
   */
  public calculateEffectiveStatus(storedStatus: AgreementStatus, dueDate: Date): AgreementStatus {
    if (
      storedStatus === AgreementStatus.CUMPLIDO ||
      storedStatus === AgreementStatus.COMPLETADO ||
      storedStatus === AgreementStatus.CANCELADO ||
      storedStatus === AgreementStatus.SUSPENDIDO
    ) {
      return storedStatus;
    }

    const todayDate = new Date();
    todayDate.setUTCHours(0, 0, 0, 0);

    const due = new Date(dueDate);
    due.setUTCHours(0, 0, 0, 0);

    if (due < todayDate) {
      return AgreementStatus.VENCIDO;
    }

    return storedStatus;
  }

  /**
   * Conversión robusta de cadenas o fechas a objeto Date compatible con Prisma y Neon.
   */
  private parseInstitutionalDate(val: string | Date | undefined | null): Date | null {
    if (!val) return null;
    if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
    const str = String(val).trim();
    if (!str) return null;
    if (str.includes('T')) {
      const d = new Date(str);
      return isNaN(d.getTime()) ? null : d;
    }
    const d = new Date(`${str}T00:00:00.000Z`);
    return isNaN(d.getTime()) ? null : d;
  }

  /**
   * Generación de Folio Institucional Único: ACU-[PREFIJO]-[AÑO]-[SECUENCIAL]
   * Maneja concurrencia y evita duplicidades.
   */
  private async generateUniqueFolio(categoryCode: string, dueDateStr: string): Promise<string> {
    const d = new Date(dueDateStr);
    const year = (!isNaN(d.getTime()) ? d.getFullYear().toString() : dueDateStr.split('-')[0]) || new Date().getFullYear().toString();
    const prefix = (categoryCode || 'ORD').substring(0, 3).toUpperCase();

    const count = await this.prisma.agreement.count();
    const sequential = String(count + 1).padStart(3, '0');

    let candidate = `ACU-${prefix}-${year}-${sequential}`;
    let exists = await this.prisma.agreement.findUnique({ where: { folio: candidate } });

    let attempt = 1;
    while (exists) {
      candidate = `ACU-${prefix}-${year}-${String(count + 1 + attempt).padStart(3, '0')}`;
      exists = await this.prisma.agreement.findUnique({ where: { folio: candidate } });
      attempt++;
    }

    return candidate;
  }
}

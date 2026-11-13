import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateNoteDto } from './dto/create-note.dto';
import { UpdateNoteDto } from './dto/update-note.dto';
import { AdminInterveneNoteDto } from './dto/admin-intervene-note.dto';
import { QueryNotesDto } from './dto/query-notes.dto';
import {
  AuthUser,
  NoteCategory,
  NoteType,
  NoteVisibility,
  PersonalNoteListItem,
  PersonalNoteDetailDto,
  PersonalNoteVersionDto,
  PaginatedResponse,
  AuditOutcome,
} from '../../_shared';
import { Prisma } from '@prisma/client';

@Injectable()
export class NotesService {
  private readonly logger = new Logger(NotesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly notificationsService?: NotificationsService,
  ) {}

  /**
   * Consulta paginada y filtrada del catálogo institucional de notas y anotaciones.
   * Aplica aislamiento de datos por usuario y visibilidad.
   */
  async findAll(
    query: QueryNotesDto,
    user: AuthUser,
  ): Promise<PaginatedResponse<PersonalNoteListItem>> {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 10));
    const skip = (page - 1) * limit;

    const isAdmin =
      user.role === 'ROLE_ADMIN' ||
      user.permissions.includes('note:admin:read');

    const where: Prisma.PersonalNoteWhereInput = {};

    // 1. Filtrado de archivo / papelera
    if (query.isArchived) {
      where.deletedAt = { not: null };
      if (!isAdmin) {
        where.authorId = user.id;
      }
    } else {
      where.deletedAt = null;
    }

    // 2. Control de visibilidad y pertenencia
    if (!isAdmin) {
      where.OR = [
        { authorId: user.id },
        { visibility: NoteVisibility.PUBLICA },
        { visibility: NoteVisibility.REUNION },
      ];
    } else if (query.authorId) {
      where.authorId = query.authorId;
    }

    // 3. Filtros adicionales
    if (query.category) {
      where.category = query.category;
    }
    if (query.noteType) {
      where.noteType = query.noteType;
    }
    if (query.visibility) {
      where.visibility = query.visibility;
    }
    if (query.meetingId) {
      where.meetingId = query.meetingId;
    }
    if (query.agendaItemId) {
      where.agendaItemId = query.agendaItemId;
    }
    if (query.agreementId) {
      where.agreementId = query.agreementId;
    }
    if (query.isFavorite !== undefined) {
      where.isFavorite = query.isFavorite;
    }

    // 4. Búsqueda textual en título, contenido o tags
    if (query.search && query.search.trim().length > 0) {
      const searchTerm = query.search.trim();
      where.AND = [
        {
          OR: [
            { title: { contains: searchTerm, mode: 'insensitive' } },
            { content: { contains: searchTerm, mode: 'insensitive' } },
            { tags: { contains: searchTerm, mode: 'insensitive' } },
          ],
        },
      ];
    }

    const [total, notes] = await Promise.all([
      this.prisma.personalNote.count({ where }),
      this.prisma.personalNote.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ isFavorite: 'desc' }, { updatedAt: 'desc' }],
        include: {
          author: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          meeting: {
            select: {
              id: true,
              folio: true,
              title: true,
            },
          },
          agendaItem: {
            select: {
              id: true,
              title: true,
            },
          },
          agreement: {
            select: {
              id: true,
              folio: true,
            },
          },
        },
      }),
    ]);

    const items: PersonalNoteListItem[] = notes.map((n) => ({
      id: n.id,
      title: n.title,
      content:
        n.authorId === user.id || n.visibility !== NoteVisibility.PRIVADA
          ? n.content
          : undefined,
      category: n.category as NoteCategory,
      noteType: n.noteType as NoteType,
      visibility: n.visibility as NoteVisibility,
      isFavorite: n.isFavorite,
      tags: n.tags,
      version: n.version,
      meetingId: n.meetingId,
      meetingTitle: n.meeting?.title || null,
      meetingFolio: n.meeting?.folio || null,
      agendaItemId: n.agendaItemId,
      agendaItemTitle: n.agendaItem?.title || null,
      agreementId: n.agreementId,
      agreementFolio: n.agreement?.folio || null,
      authorId: n.authorId,
      authorName: `${n.author.firstName} ${n.author.lastName}`.trim(),
      authorEmail: n.author.email,
      isAdminModified: n.isAdminModified,
      createdAt: n.createdAt.toISOString(),
      updatedAt: n.updatedAt.toISOString(),
      deletedAt: n.deletedAt ? n.deletedAt.toISOString() : null,
    }));

    return {
      items,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
        hasNextPage: page * limit < total,
        hasPreviousPage: page > 1,
      },
    };
  }

  /**
   * Consulta el detalle exhaustivo de una anotación por su UUID.
   */
  async findById(id: string, user: AuthUser): Promise<PersonalNoteDetailDto> {
    const note = await this.prisma.personalNote.findUnique({
      where: { id },
      include: {
        author: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            position: true,
          },
        },
        meeting: {
          select: {
            id: true,
            folio: true,
            title: true,
            status: true,
          },
        },
        agendaItem: {
          select: {
            id: true,
            title: true,
            orderIndex: true,
          },
        },
        agreement: {
          select: {
            id: true,
            folio: true,
            title: true,
            status: true,
          },
        },
        lastAdminIntervenor: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        versions: {
          orderBy: { versionNumber: 'desc' },
          include: {
            modifiedBy: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        },
      },
    });

    if (!note) {
      throw new NotFoundException(`Anotación con ID "${id}" no encontrada.`);
    }

    const isAdmin =
      user.role === 'ROLE_ADMIN' ||
      user.permissions.includes('note:admin:read');

    // Validación de visibilidad privada
    if (note.visibility === NoteVisibility.PRIVADA && note.authorId !== user.id && !isAdmin) {
      throw new ForbiddenException(
        'Acceso denegado: Esta anotación es de carácter estrictamente privado para su autor.',
      );
    }

    // Si está archivada/eliminada y no es autor ni admin
    if (note.deletedAt && note.authorId !== user.id && !isAdmin) {
      throw new NotFoundException(`Anotación con ID "${id}" no encontrada.`);
    }

    return {
      id: note.id,
      title: note.title,
      content: note.content,
      category: note.category as NoteCategory,
      noteType: note.noteType as NoteType,
      visibility: note.visibility as NoteVisibility,
      isFavorite: note.isFavorite,
      tags: note.tags,
      version: note.version,
      meetingId: note.meetingId,
      meeting: note.meeting
        ? {
            id: note.meeting.id,
            folio: note.meeting.folio,
            title: note.meeting.title,
            status: note.meeting.status,
          }
        : null,
      agendaItemId: note.agendaItemId,
      agendaItem: note.agendaItem
        ? {
            id: note.agendaItem.id,
            title: note.agendaItem.title,
            orderIndex: note.agendaItem.orderIndex,
          }
        : null,
      agreementId: note.agreementId,
      agreement: note.agreement
        ? {
            id: note.agreement.id,
            folio: note.agreement.folio,
            title: note.agreement.title,
            status: note.agreement.status,
          }
        : null,
      authorId: note.authorId,
      author: {
        id: note.author.id,
        fullName: `${note.author.firstName} ${note.author.lastName}`.trim(),
        email: note.author.email,
        position: note.author.position,
      },
      isAdminModified: note.isAdminModified,
      lastAdminIntervenorId: note.lastAdminIntervenorId,
      lastAdminIntervenor: note.lastAdminIntervenor
        ? {
            id: note.lastAdminIntervenor.id,
            fullName: `${note.lastAdminIntervenor.firstName} ${note.lastAdminIntervenor.lastName}`.trim(),
            email: note.lastAdminIntervenor.email,
          }
        : null,
      adminJustification: note.adminJustification,
      versions: note.versions.map((v) => ({
        id: v.id,
        personalNoteId: v.personalNoteId,
        versionNumber: v.versionNumber,
        titleSnapshot: v.titleSnapshot,
        contentSnapshot: v.contentSnapshot,
        categorySnapshot: v.categorySnapshot,
        modifiedById: v.modifiedById,
        modifiedByName: `${v.modifiedBy.firstName} ${v.modifiedBy.lastName}`.trim(),
        modifiedByEmail: v.modifiedBy.email,
        changeReason: v.changeReason,
        adminJustification: v.adminJustification,
        isAdminIntervention: v.isAdminIntervention,
        createdAt: v.createdAt.toISOString(),
        // Aliases
        noteId: v.personalNoteId,
        editorId: v.modifiedById,
        editorName: `${v.modifiedBy.firstName} ${v.modifiedBy.lastName}`.trim(),
        editorEmail: v.modifiedBy.email,
      })),
      createdAt: note.createdAt.toISOString(),
      updatedAt: note.updatedAt.toISOString(),
      deletedAt: note.deletedAt ? note.deletedAt.toISOString() : null,
    };
  }

  /**
   * Crea una nueva anotación personal o nota de sesión institucional.
   * La autoría se inyecta estrictamente desde la sesión autenticada.
   */
  async create(
    dto: CreateNoteDto,
    user: AuthUser,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<PersonalNoteDetailDto> {
    // 1. Validaciones de relaciones opcionales
    if (dto.meetingId) {
      const meeting = await this.prisma.meeting.findUnique({
        where: { id: dto.meetingId },
      });
      if (!meeting) {
        throw new NotFoundException(`La reunión con ID "${dto.meetingId}" no existe.`);
      }
    }

    if (dto.agendaItemId) {
      const agendaItem = await this.prisma.meetingAgendaItem.findUnique({
        where: { id: dto.agendaItemId },
      });
      if (!agendaItem) {
        throw new NotFoundException(`El punto de orden del día con ID "${dto.agendaItemId}" no existe.`);
      }
      if (dto.meetingId && agendaItem.meetingId !== dto.meetingId) {
        throw new BadRequestException('El punto de orden del día no pertenece a la reunión indicada.');
      }
    }

    if (dto.agreementId) {
      const agreement = await this.prisma.agreement.findUnique({
        where: { id: dto.agreementId },
      });
      if (!agreement) {
        throw new NotFoundException(`El acuerdo institucional con ID "${dto.agreementId}" no existe.`);
      }
    }

    // 2. Persistencia de la anotación
    const note = await this.prisma.personalNote.create({
      data: {
        title: dto.title.trim(),
        content: dto.content.trim(),
        category: dto.category || NoteCategory.GENERAL,
        noteType: dto.noteType || (dto.meetingId ? NoteType.SESION : NoteType.PERSONAL),
        visibility: dto.visibility || NoteVisibility.PRIVADA,
        isFavorite: dto.isFavorite ?? false,
        tags: dto.tags?.trim() || null,
        meetingId: dto.meetingId || null,
        agendaItemId: dto.agendaItemId || null,
        agreementId: dto.agreementId || null,
        authorId: user.id,
        version: 1,
      },
    });

    // 3. Bitácora de auditoría inmutable
    await this.auditService.logEvent({
      actorId: user.id,
      action: 'NOTE_CREATED',
      entity: 'PersonalNote',
      entityId: note.id,
      ipAddress,
      userAgent,
      outcome: AuditOutcome.SUCCESS,
      diffPayload: {
        title: note.title,
        category: note.category,
        noteType: note.noteType,
        visibility: note.visibility,
        meetingId: note.meetingId,
        agendaItemId: note.agendaItemId,
        agreementId: note.agreementId,
      },
    });

    // PRIVACIDAD ESTRICTA: Solo las notas colegiadas asociadas a una reunión
    // emiten notificaciones institucionales. Las notas PRIVADAS jamás alertan.
    if (note.visibility === NoteVisibility.REUNION && note.meetingId && this.notificationsService) {
      try {
        await this.notificationsService.notifyNoteShared(note.id);
      } catch (notifErr: any) {
        this.logger.warn(`[Notes] Error al notificar nota compartida ${note.id}: ${notifErr.message}`);
      }
    }

    return this.findById(note.id, user);
  }

  /**
   * Actualiza los datos de una anotación.
   * Regla de negocio innegociable: Solo el autor institucional puede modificar su nota por esta vía.
   */
  async update(
    id: string,
    dto: UpdateNoteDto,
    user: AuthUser,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<PersonalNoteDetailDto> {
    const note = await this.prisma.personalNote.findUnique({
      where: { id },
    });

    if (!note || note.deletedAt) {
      throw new NotFoundException(`Anotación con ID "${id}" no encontrada.`);
    }

    // Control de propiedad estricto (Anti-IDOR / Anti-BOLA)
    if (note.authorId !== user.id) {
      await this.auditService.logEvent({
        actorId: user.id,
        action: 'UNAUTHORIZED_NOTE_MUTATION_ATTEMPT',
        entity: 'PersonalNote',
        entityId: id,
        ipAddress,
        userAgent,
        outcome: AuditOutcome.DENIED,
        diffPayload: {
          motivo: 'Intento de modificación de nota ajena sin intervención administrativa',
          targetAuthorId: note.authorId,
          attackerId: user.id,
        },
      });

      throw new ForbiddenException(
        'Acceso denegado: Únicamente el autor institucional puede modificar esta anotación.',
      );
    }

    // Validar relaciones opcionales
    if (dto.meetingId !== undefined && dto.meetingId !== null) {
      const meeting = await this.prisma.meeting.findUnique({ where: { id: dto.meetingId } });
      if (!meeting) {
        throw new NotFoundException(`La reunión con ID "${dto.meetingId}" no existe.`);
      }
    }

    if (dto.agendaItemId !== undefined && dto.agendaItemId !== null) {
      const agendaItem = await this.prisma.meetingAgendaItem.findUnique({
        where: { id: dto.agendaItemId },
      });
      if (!agendaItem) {
        throw new NotFoundException(`El punto de orden del día con ID "${dto.agendaItemId}" no existe.`);
      }
    }

    if (dto.agreementId !== undefined && dto.agreementId !== null) {
      const agreement = await this.prisma.agreement.findUnique({
        where: { id: dto.agreementId },
      });
      if (!agreement) {
        throw new NotFoundException(`El acuerdo con ID "${dto.agreementId}" no existe.`);
      }
    }

    // 1. Guardar snapshot inmutable de la versión previa
    await this.prisma.personalNoteVersion.create({
      data: {
        personalNoteId: note.id,
        versionNumber: note.version,
        titleSnapshot: note.title,
        contentSnapshot: note.content,
        categorySnapshot: note.category,
        modifiedById: user.id,
        changeReason: dto.changeReason?.trim() || 'Modificación ordinaria del autor',
        adminJustification: null,
        isAdminIntervention: false,
      },
    });

    // 2. Actualizar registro incrementando versión
    const updatedNote = await this.prisma.personalNote.update({
      where: { id },
      data: {
        title: dto.title !== undefined ? dto.title.trim() : note.title,
        content: dto.content !== undefined ? dto.content.trim() : note.content,
        category: dto.category !== undefined ? dto.category : note.category,
        noteType: dto.noteType !== undefined ? dto.noteType : note.noteType,
        visibility: dto.visibility !== undefined ? dto.visibility : note.visibility,
        isFavorite: dto.isFavorite !== undefined ? dto.isFavorite : note.isFavorite,
        tags: dto.tags !== undefined ? (dto.tags ? dto.tags.trim() : null) : note.tags,
        meetingId: dto.meetingId !== undefined ? dto.meetingId : note.meetingId,
        agendaItemId: dto.agendaItemId !== undefined ? dto.agendaItemId : note.agendaItemId,
        agreementId: dto.agreementId !== undefined ? dto.agreementId : note.agreementId,
        version: { increment: 1 },
      },
    });

    // 3. Auditoría
    await this.auditService.logEvent({
      actorId: user.id,
      action: 'NOTE_UPDATED',
      entity: 'PersonalNote',
      entityId: note.id,
      ipAddress,
      userAgent,
      outcome: AuditOutcome.SUCCESS,
      diffPayload: {
        previousVersion: note.version,
        newVersion: updatedNote.version,
        changeReason: dto.changeReason,
      },
    });

    if (
      updatedNote.visibility === NoteVisibility.REUNION &&
      updatedNote.meetingId &&
      note.visibility !== NoteVisibility.REUNION &&
      this.notificationsService
    ) {
      try {
        await this.notificationsService.notifyNoteShared(updatedNote.id);
      } catch (notifErr: any) {
        this.logger.warn(`[Notes] Error al notificar nota compartida ${updatedNote.id}: ${notifErr.message}`);
      }
    }

    return this.findById(id, user);
  }

  /**
   * Intervención administrativa extraordinaria sobre anotaciones.
   * Requiere permiso explícito `note:override_any`, justificación obligatoria (mínimo 15 caracteres),
   * genera snapshot previo y registra evento de auditoría CRITICAL.
   */
  async adminIntervene(
    id: string,
    dto: AdminInterveneNoteDto,
    user: AuthUser,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<PersonalNoteDetailDto> {
    const hasOverridePermission =
      user.role === 'ROLE_ADMIN' ||
      user.permissions.includes('note:override_any');

    if (!hasOverridePermission) {
      throw new ForbiddenException(
        'Acceso denegado: Se requiere el permiso específico note:override_any para intervención administrativa.',
      );
    }

    if (!dto.adminJustification || dto.adminJustification.trim().length < 15) {
      throw new BadRequestException(
        'La justificación administrativa debe contener al menos 15 caracteres explicativos.',
      );
    }

    const note = await this.prisma.personalNote.findUnique({
      where: { id },
    });

    if (!note) {
      throw new NotFoundException(`Anotación con ID "${id}" no encontrada.`);
    }

    const justification = dto.adminJustification.trim();

    // 1. Guardar snapshot inmutable previo con justificación administrativa
    await this.prisma.personalNoteVersion.create({
      data: {
        personalNoteId: note.id,
        versionNumber: note.version,
        titleSnapshot: note.title,
        contentSnapshot: note.content,
        categorySnapshot: note.category,
        modifiedById: user.id,
        changeReason: 'Intervención administrativa extraordinaria',
        adminJustification: justification,
        isAdminIntervention: true,
      },
    });

    // 2. Actualizar la nota marcando intervención administrativa
    const updated = await this.prisma.personalNote.update({
      where: { id },
      data: {
        title: dto.title !== undefined ? dto.title.trim() : note.title,
        content: dto.content !== undefined ? dto.content.trim() : note.content,
        category: dto.category !== undefined ? dto.category : note.category,
        visibility: dto.visibility !== undefined ? dto.visibility : note.visibility,
        isAdminModified: true,
        lastAdminIntervenorId: user.id,
        adminJustification: justification,
        version: { increment: 1 },
      },
    });

    // 3. Auditoría forense de alta criticidad
    await this.auditService.logEvent({
      actorId: user.id,
      action: 'NOTE_ADMIN_OVERRIDE',
      entity: 'PersonalNote',
      entityId: note.id,
      ipAddress,
      userAgent,
      outcome: AuditOutcome.SUCCESS,
      diffPayload: {
        severidad: 'CRITICAL',
        previousVersion: note.version,
        newVersion: updated.version,
        authorId: note.authorId,
        intervenorId: user.id,
        adminJustification: justification,
        modifiedFields: {
          title: dto.title,
          contentModified: dto.content !== undefined,
          category: dto.category,
          visibility: dto.visibility,
        },
      },
    });

    return this.findById(id, user);
  }

  /**
   * Archiva una anotación (Soft Delete / Papelera).
   */
  async archive(
    id: string,
    user: AuthUser,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<{ message: string; id: string }> {
    const note = await this.prisma.personalNote.findUnique({ where: { id } });
    if (!note || note.deletedAt) {
      throw new NotFoundException(`Anotación con ID "${id}" no encontrada.`);
    }

    const isAdmin =
      user.role === 'ROLE_ADMIN' ||
      user.permissions.includes('note:override_any');

    if (note.authorId !== user.id && !isAdmin) {
      await this.auditService.logEvent({
        actorId: user.id,
        action: 'UNAUTHORIZED_NOTE_DELETION_ATTEMPT',
        entity: 'PersonalNote',
        entityId: id,
        ipAddress,
        userAgent,
        outcome: AuditOutcome.DENIED,
        diffPayload: { authorId: note.authorId, requesterId: user.id },
      });

      throw new ForbiddenException(
        'Acceso denegado: No cuenta con autorización para archivar esta anotación.',
      );
    }

    await this.prisma.personalNote.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await this.auditService.logEvent({
      actorId: user.id,
      action: 'NOTE_ARCHIVED',
      entity: 'PersonalNote',
      entityId: id,
      ipAddress,
      userAgent,
      outcome: AuditOutcome.SUCCESS,
    });

    return { message: 'Anotación archivada correctamente.', id };
  }

  /**
   * Restaura una anotación archivada.
   */
  async restore(
    id: string,
    user: AuthUser,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<{ message: string; id: string }> {
    const note = await this.prisma.personalNote.findUnique({ where: { id } });
    if (!note) {
      throw new NotFoundException(`Anotación con ID "${id}" no encontrada.`);
    }

    if (!note.deletedAt) {
      throw new BadRequestException('La anotación no se encuentra archivada.');
    }

    const isAdmin =
      user.role === 'ROLE_ADMIN' ||
      user.permissions.includes('note:override_any');

    if (note.authorId !== user.id && !isAdmin) {
      throw new ForbiddenException(
        'Acceso denegado: No cuenta con autorización para restaurar esta anotación.',
      );
    }

    await this.prisma.personalNote.update({
      where: { id },
      data: { deletedAt: null },
    });

    await this.auditService.logEvent({
      actorId: user.id,
      action: 'NOTE_RESTORED',
      entity: 'PersonalNote',
      entityId: id,
      ipAddress,
      userAgent,
      outcome: AuditOutcome.SUCCESS,
    });

    return { message: 'Anotación restaurada satisfactoriamente.', id };
  }

  /**
   * Elimina permanentemente una anotación (Hard Delete).
   */
  async deletePermanently(
    id: string,
    user: AuthUser,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<{ message: string; id: string }> {
    const note = await this.prisma.personalNote.findUnique({ where: { id } });
    if (!note) {
      throw new NotFoundException(`Anotación con ID "${id}" no encontrada.`);
    }

    const isAdmin =
      user.role === 'ROLE_ADMIN' ||
      user.permissions.includes('note:override_any');

    if (note.authorId !== user.id && !isAdmin) {
      throw new ForbiddenException(
        'Acceso denegado: No cuenta con autorización para eliminar definitivamente esta anotación.',
      );
    }

    await this.prisma.$transaction([
      this.prisma.personalNoteVersion.deleteMany({ where: { personalNoteId: id } }),
      this.prisma.personalNote.delete({ where: { id } }),
    ]);

    await this.auditService.logEvent({
      actorId: user.id,
      action: 'NOTE_PERMANENTLY_DELETED',
      entity: 'PersonalNote',
      entityId: id,
      ipAddress,
      userAgent,
      outcome: AuditOutcome.SUCCESS,
      diffPayload: { title: note.title, authorId: note.authorId },
    });

    return { message: 'Anotación eliminada definitivamente del sistema.', id };
  }

  /**
   * Consulta el historial inmutable de versiones de una anotación.
   */
  async getVersions(
    id: string,
    user: AuthUser,
  ): Promise<PersonalNoteVersionDto[]> {
    // Validar acceso a la nota
    await this.findById(id, user);

    const versions = await this.prisma.personalNoteVersion.findMany({
      where: { personalNoteId: id },
      orderBy: { versionNumber: 'desc' },
      include: {
        modifiedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    return versions.map((v) => ({
      id: v.id,
      personalNoteId: v.personalNoteId,
      versionNumber: v.versionNumber,
      titleSnapshot: v.titleSnapshot,
      contentSnapshot: v.contentSnapshot,
      categorySnapshot: v.categorySnapshot,
      modifiedById: v.modifiedById,
      modifiedByName: `${v.modifiedBy.firstName} ${v.modifiedBy.lastName}`.trim(),
      modifiedByEmail: v.modifiedBy.email,
      changeReason: v.changeReason,
      adminJustification: v.adminJustification,
      isAdminIntervention: v.isAdminIntervention,
      createdAt: v.createdAt.toISOString(),
      // Aliases
      noteId: v.personalNoteId,
      editorId: v.modifiedById,
      editorName: `${v.modifiedBy.firstName} ${v.modifiedBy.lastName}`.trim(),
      editorEmail: v.modifiedBy.email,
    }));
  }

  /**
   * Consulta notas institucionales asociadas a una reunión específica.
   */
  async findByMeeting(
    meetingId: string,
    user: AuthUser,
  ): Promise<PersonalNoteListItem[]> {
    const meeting = await this.prisma.meeting.findUnique({
      where: { id: meetingId },
    });
    if (!meeting) {
      throw new NotFoundException(`La reunión con ID "${meetingId}" no existe.`);
    }

    const res = await this.findAll({ meetingId, limit: 100 }, user);
    return res.items;
  }
}

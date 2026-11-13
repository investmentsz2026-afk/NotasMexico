import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateMeetingCategoryDto } from './dto/create-meeting-category.dto';
import { UpdateMeetingCategoryDto } from './dto/update-meeting-category.dto';
import { MeetingCategoryDto } from '../../_shared';
import { AuditOutcome } from '@prisma/client';

@Injectable()
export class MeetingCategoriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async findAll(includeInactive = false): Promise<MeetingCategoryDto[]> {
    const categories = await this.prisma.meetingCategory.findMany({
      where: includeInactive ? {} : { isActive: true },
      orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
    });

    return categories.map((c) => ({
      id: c.id,
      name: c.name,
      code: c.code,
      description: c.description,
      colorHex: c.colorHex,
      displayOrder: c.displayOrder,
      isActive: c.isActive,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
    }));
  }

  async findById(id: string): Promise<MeetingCategoryDto> {
    const category = await this.prisma.meetingCategory.findUnique({
      where: { id },
    });

    if (!category) {
      throw new NotFoundException(`Categoría con identificador [${id}] no encontrada.`);
    }

    return {
      id: category.id,
      name: category.name,
      code: category.code,
      description: category.description,
      colorHex: category.colorHex,
      displayOrder: category.displayOrder,
      isActive: category.isActive,
      createdAt: category.createdAt.toISOString(),
      updatedAt: category.updatedAt.toISOString(),
    };
  }

  async create(
    dto: CreateMeetingCategoryDto,
    userId: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<MeetingCategoryDto> {
    const normalizedCode = dto.code.trim().toUpperCase();
    const normalizedName = dto.name.trim();

    // Validar unicidad de código y nombre
    const existing = await this.prisma.meetingCategory.findFirst({
      where: {
        OR: [{ code: normalizedCode }, { name: normalizedName }],
      },
    });

    if (existing) {
      throw new ConflictException(
        existing.code === normalizedCode
          ? `Ya existe una categoría con el código [${normalizedCode}].`
          : `Ya existe una categoría con el nombre [${normalizedName}].`,
      );
    }

    const created = await this.prisma.meetingCategory.create({
      data: {
        name: normalizedName,
        code: normalizedCode,
        description: dto.description?.trim() || null,
        colorHex: dto.colorHex?.toUpperCase() || '#0F172A',
        displayOrder: dto.displayOrder ?? 0,
        isActive: true,
      },
    });

    await this.auditService.logEvent({
      actorId: userId,
      action: 'MEETING_CATEGORY_CREATED',
      entity: 'meeting_categories',
      entityId: created.id,
      ipAddress,
      userAgent,
      outcome: AuditOutcome.SUCCESS,
      diffPayload: { code: created.code, name: created.name },
    });

    return {
      id: created.id,
      name: created.name,
      code: created.code,
      description: created.description,
      colorHex: created.colorHex,
      displayOrder: created.displayOrder,
      isActive: created.isActive,
      createdAt: created.createdAt.toISOString(),
      updatedAt: created.updatedAt.toISOString(),
    };
  }

  async update(
    id: string,
    dto: UpdateMeetingCategoryDto,
    userId: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<MeetingCategoryDto> {
    const existing = await this.prisma.meetingCategory.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`Categoría con identificador [${id}] no encontrada.`);
    }

    if (dto.name && dto.name.trim() !== existing.name) {
      const duplicateName = await this.prisma.meetingCategory.findFirst({
        where: { name: dto.name.trim(), id: { not: id } },
      });
      if (duplicateName) {
        throw new ConflictException(`Ya existe una categoría con el nombre [${dto.name.trim()}].`);
      }
    }

    const updated = await this.prisma.meetingCategory.update({
      where: { id },
      data: {
        name: dto.name?.trim() ?? existing.name,
        description: dto.description !== undefined ? dto.description?.trim() || null : existing.description,
        colorHex: dto.colorHex?.toUpperCase() ?? existing.colorHex,
        displayOrder: dto.displayOrder ?? existing.displayOrder,
        isActive: dto.isActive !== undefined ? dto.isActive : existing.isActive,
      },
    });

    await this.auditService.logEvent({
      actorId: userId,
      action: 'MEETING_CATEGORY_UPDATED',
      entity: 'meeting_categories',
      entityId: id,
      ipAddress,
      userAgent,
      outcome: AuditOutcome.SUCCESS,
      diffPayload: { previous: existing, current: updated },
    });

    return {
      id: updated.id,
      name: updated.name,
      code: updated.code,
      description: updated.description,
      colorHex: updated.colorHex,
      displayOrder: updated.displayOrder,
      isActive: updated.isActive,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    };
  }

  async deactivate(
    id: string,
    userId: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<MeetingCategoryDto> {
    const existing = await this.prisma.meetingCategory.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`Categoría con identificador [${id}] no encontrada.`);
    }

    const updated = await this.prisma.meetingCategory.update({
      where: { id },
      data: { isActive: false },
    });

    await this.auditService.logEvent({
      actorId: userId,
      action: 'MEETING_CATEGORY_DEACTIVATED',
      entity: 'meeting_categories',
      entityId: id,
      ipAddress,
      userAgent,
      outcome: AuditOutcome.SUCCESS,
      diffPayload: { code: existing.code },
    });

    return {
      id: updated.id,
      name: updated.name,
      code: updated.code,
      description: updated.description,
      colorHex: updated.colorHex,
      displayOrder: updated.displayOrder,
      isActive: updated.isActive,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    };
  }

  async delete(
    id: string,
    userId: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<{ message: string; wasDeactivatedOnly: boolean }> {
    const existing = await this.prisma.meetingCategory.findUnique({
      where: { id },
      include: {
        _count: {
          select: { meetings: true },
        },
      },
    });

    if (!existing) {
      throw new NotFoundException(`Categoría con identificador [${id}] no encontrada.`);
    }

    // Regla de Integridad Histórica: Si tiene reuniones vinculadas, NO eliminar físicamente
    if (existing._count.meetings > 0) {
      await this.prisma.meetingCategory.update({
        where: { id },
        data: { isActive: false },
      });

      await this.auditService.logEvent({
        actorId: userId,
        action: 'MEETING_CATEGORY_AUTO_DEACTIVATED',
        entity: 'meeting_categories',
        entityId: id,
        ipAddress,
        userAgent,
        outcome: AuditOutcome.SUCCESS,
        diffPayload: { reason: 'CONTAINS_HISTORICAL_MEETINGS', meetingsCount: existing._count.meetings },
      });

      return {
        message: `La categoría no puede eliminarse físicamente porque tiene ${existing._count.meetings} reuniones vinculadas. Se ha desactivado para proteger el historial institucional.`,
        wasDeactivatedOnly: true,
      };
    }

    await this.prisma.meetingCategory.delete({
      where: { id },
    });

    await this.auditService.logEvent({
      actorId: userId,
      action: 'MEETING_CATEGORY_DELETED',
      entity: 'meeting_categories',
      entityId: id,
      ipAddress,
      userAgent,
      outcome: AuditOutcome.SUCCESS,
      diffPayload: { code: existing.code, name: existing.name },
    });

    return {
      message: 'Categoría eliminada permanentemente de la base de datos.',
      wasDeactivatedOnly: false,
    };
  }
}


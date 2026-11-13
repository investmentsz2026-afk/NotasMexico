import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { Argon2Service } from '../../common/crypto/argon2.service';
import { AuditService } from '../audit/audit.service';
import { SessionsService } from '../sessions/sessions.service';
import { AuditOutcome, UserStatus } from '@prisma/client';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly argon2Service: Argon2Service,
    private readonly auditService: AuditService,
    private readonly sessionsService: SessionsService,
  ) {}

  /**
   * Obtiene la lista completa de roles disponibles en el sistema.
   */
  async getRoles() {
    return this.prisma.role.findMany({
      orderBy: { name: 'asc' },
      select: {
        id: true,
        code: true,
        name: true,
        description: true,
      },
    });
  }

  /**
   * Lista usuarios institucionales con filtros y soporte de búsqueda.
   */
  async findAll(query?: { search?: string; roleId?: string; status?: string }) {
    const where: any = {
      deletedAt: null,
    };

    if (query?.status) {
      where.status = query.status as UserStatus;
    }

    if (query?.roleId) {
      where.roleId = query.roleId;
    }

    if (query?.search) {
      const term = query.search.trim();
      where.OR = [
        { email: { contains: term, mode: 'insensitive' } },
        { firstName: { contains: term, mode: 'insensitive' } },
        { lastName: { contains: term, mode: 'insensitive' } },
        { position: { contains: term, mode: 'insensitive' } },
      ];
    }

    const users = await this.prisma.user.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }],
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        position: true,
        phone: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        role: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
        mfa: {
          select: {
            isEnabled: true,
            enrolledAt: true,
            lastUsedAt: true,
          },
        },
      },
    });

    return users.map((u) => ({
      id: u.id,
      email: u.email,
      firstName: u.firstName,
      lastName: u.lastName,
      fullName: `${u.firstName} ${u.lastName}`.trim(),
      position: u.position,
      phone: u.phone,
      status: u.status,
      createdAt: u.createdAt,
      updatedAt: u.updatedAt,
      role: u.role,
      mfaEnabled: !!u.mfa?.isEnabled,
    }));
  }

  /**
   * Obtiene el detalle de un usuario por su ID.
   */
  async findOne(id: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        position: true,
        phone: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        role: {
          select: {
            id: true,
            code: true,
            name: true,
            description: true,
          },
        },
        mfa: {
          select: {
            isEnabled: true,
            enrolledAt: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('El usuario solicitado no existe o fue desincorporado.');
    }

    return {
      ...user,
      fullName: `${user.firstName} ${user.lastName}`.trim(),
      mfaEnabled: !!user.mfa?.isEnabled,
    };
  }

  /**
   * Crea un nuevo usuario institucional con hashing Argon2id.
   */
  async create(
    dto: CreateUserDto,
    actorId: string,
    ipAddress: string,
    userAgent: string,
  ) {
    const normalizedEmail = dto.email.toLowerCase().trim();

    // 1. Verificar si el correo ya existe
    const existing = await this.prisma.user.findFirst({
      where: { email: normalizedEmail, deletedAt: null },
    });

    if (existing) {
      throw new ConflictException('Ya existe un usuario institucional registrado con este correo.');
    }

    // 2. Verificar existencia del rol
    const role = await this.prisma.role.findUnique({
      where: { id: dto.roleId },
    });

    if (!role) {
      throw new BadRequestException('El rol institucional seleccionado no es válido.');
    }

    // 3. Hashear contraseña con Argon2id
    const passwordHash = await this.argon2Service.hash(dto.password);

    // 4. Crear registro en BD
    const newUser = await this.prisma.user.create({
      data: {
        email: normalizedEmail,
        passwordHash,
        firstName: dto.firstName.trim(),
        lastName: dto.lastName.trim(),
        position: dto.position.trim(),
        phone: dto.phone?.trim() || null,
        status: dto.status || UserStatus.ACTIVO,
        roleId: dto.roleId,
      },
      include: {
        role: true,
      },
    });

    // 5. Registrar auditoría forense
    await this.auditService.logEvent({
      actorId,
      action: 'USER_CREATED',
      entity: 'users',
      entityId: newUser.id,
      ipAddress,
      userAgent,
      outcome: AuditOutcome.SUCCESS,
      diffPayload: {
        email: newUser.email,
        role: role.code,
        status: newUser.status,
      },
    });

    return {
      id: newUser.id,
      email: newUser.email,
      firstName: newUser.firstName,
      lastName: newUser.lastName,
      fullName: `${newUser.firstName} ${newUser.lastName}`.trim(),
      position: newUser.position,
      status: newUser.status,
      role: newUser.role,
      createdAt: newUser.createdAt,
    };
  }

  /**
   * Modifica un usuario existente (datos, rol, estado, contraseña).
   */
  async update(
    id: string,
    dto: UpdateUserDto,
    actorId: string,
    ipAddress: string,
    userAgent: string,
  ) {
    const existing = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
    });

    if (!existing) {
      throw new NotFoundException('El usuario institucional a actualizar no existe.');
    }

    const updateData: any = {};

    if (dto.firstName) updateData.firstName = dto.firstName.trim();
    if (dto.lastName) updateData.lastName = dto.lastName.trim();
    if (dto.position) updateData.position = dto.position.trim();
    if (dto.phone !== undefined) updateData.phone = dto.phone ? dto.phone.trim() : null;
    if (dto.status) updateData.status = dto.status;

    if (dto.email && dto.email.toLowerCase().trim() !== existing.email) {
      const emailTaken = await this.prisma.user.findFirst({
        where: {
          email: dto.email.toLowerCase().trim(),
          id: { not: id },
          deletedAt: null,
        },
      });
      if (emailTaken) {
        throw new ConflictException('El correo proporcionado ya se encuentra en uso por otro servidor.');
      }
      updateData.email = dto.email.toLowerCase().trim();
    }

    if (dto.roleId && dto.roleId !== existing.roleId) {
      const role = await this.prisma.role.findUnique({
        where: { id: dto.roleId },
      });
      if (!role) {
        throw new BadRequestException('El rol asignado no existe.');
      }
      updateData.roleId = dto.roleId;
    }

    if (dto.password && dto.password.length >= 8) {
      updateData.passwordHash = await this.argon2Service.hash(dto.password);
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: updateData,
      include: { role: true },
    });

    // Si fue suspendido o bloqueado, revocar sesiones activas
    if (dto.status && dto.status !== UserStatus.ACTIVO) {
      await this.sessionsService.revokeAllUserSessions(id);
    }

    await this.auditService.logEvent({
      actorId,
      action: 'USER_UPDATED',
      entity: 'users',
      entityId: id,
      ipAddress,
      userAgent,
      outcome: AuditOutcome.SUCCESS,
      diffPayload: {
        fieldsUpdated: Object.keys(updateData).filter((k) => k !== 'passwordHash'),
      },
    });

    return {
      id: updated.id,
      email: updated.email,
      firstName: updated.firstName,
      lastName: updated.lastName,
      fullName: `${updated.firstName} ${updated.lastName}`.trim(),
      position: updated.position,
      status: updated.status,
      role: updated.role,
      updatedAt: updated.updatedAt,
    };
  }

  /**
   * Desactiva / elimina lógicamente un usuario institucional.
   */
  async delete(
    id: string,
    actorId: string,
    ipAddress: string,
    userAgent: string,
  ) {
    const existing = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
    });

    if (!existing) {
      throw new NotFoundException('El usuario ya se encuentra desincorporado o no existe.');
    }

    if (id === actorId) {
      throw new BadRequestException('No puede desactivar su propia cuenta administrativa.');
    }

    await this.prisma.user.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        status: UserStatus.INACTIVO,
      },
    });

    // Revocar todas las sesiones del usuario dado de baja
    await this.sessionsService.revokeAllUserSessions(id);

    await this.auditService.logEvent({
      actorId,
      action: 'USER_DEACTIVATED',
      entity: 'users',
      entityId: id,
      ipAddress,
      userAgent,
      outcome: AuditOutcome.SUCCESS,
    });

    return { success: true, message: 'Usuario institucional desincorporado correctamente.' };
  }
}


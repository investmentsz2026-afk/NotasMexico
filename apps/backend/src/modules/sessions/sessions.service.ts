import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { TokenService } from '../../common/crypto/token.service';
import { UserStatus, UserSession, User, Role, Permission } from '@prisma/client';
import { SessionInfo } from '@mexagenda/shared';

export interface ValidatedSessionResult {
  session: UserSession;
  user: User & {
    role: Role & {
      permissions: {
        permission: Permission;
      }[];
    };
  };
}

@Injectable()
export class SessionsService {
  private readonly logger = new Logger(SessionsService.name);

  // Límites temporales estrictos de sesión
  private readonly IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutos de inactividad
  private readonly MAX_SESSION_LIFETIME_MS = 8 * 60 * 60 * 1000; // 8 horas de vida máxima absoluta
  private readonly ACTIVITY_UPDATE_THROTTLE_MS = 60 * 1000; // 60 segundos de amortiguamiento

  constructor(
    private readonly prisma: PrismaService,
    private readonly tokenService: TokenService,
  ) {}

  /**
   * Crea una nueva sesión en la base de datos Neon PostgreSQL.
   * Retorna el token en texto plano (para la cookie del cliente) y el registro creado.
   */
  async createSession(
    userId: string,
    ipAddress: string,
    userAgent: string,
  ): Promise<{ rawToken: string; session: UserSession }> {
    const rawToken = this.tokenService.generateSessionToken();
    const tokenHash = this.tokenService.hashSessionToken(rawToken);

    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.MAX_SESSION_LIFETIME_MS);

    const session = await this.prisma.userSession.create({
      data: {
        userId,
        sessionTokenHash: tokenHash,
        ipAddress: ipAddress || '127.0.0.1',
        userAgent: (userAgent || 'unknown').substring(0, 300),
        isRevoked: false,
        lastActivityAt: now,
        expiresAt,
        createdAt: now,
      },
    });

    return { rawToken, session };
  }

  /**
   * Valida un token de sesión recibido en la petición HTTP.
   * Verifica expiración por inactividad, expiración absoluta, estado de revocación y estado del usuario.
   */
  async validateSession(rawToken: string): Promise<ValidatedSessionResult | null> {
    if (!rawToken || typeof rawToken !== 'string') {
      return null;
    }

    const tokenHash = this.tokenService.hashSessionToken(rawToken);

    const session = await this.prisma.userSession.findUnique({
      where: { sessionTokenHash: tokenHash },
      include: {
        user: {
          include: {
            role: {
              include: {
                permissions: {
                  include: {
                    permission: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!session) {
      return null;
    }

    // 1. Verificar si fue revocada explícitamente
    if (session.isRevoked) {
      return null;
    }

    // 2. Verificar estado del usuario
    if (!session.user || session.user.status !== UserStatus.ACTIVO || session.user.deletedAt !== null) {
      // Si el usuario no está activo o fue eliminado, revocar la sesión de inmediato
      await this.prisma.userSession.update({
        where: { id: session.id },
        data: { isRevoked: true },
      });
      return null;
    }

    const now = new Date();

    // 3. Verificar expiración máxima absoluta (8 horas)
    if (now > session.expiresAt) {
      await this.prisma.userSession.update({
        where: { id: session.id },
        data: { isRevoked: true },
      });
      return null;
    }

    // 4. Verificar expiración por inactividad (30 minutos)
    const timeSinceLastActivity = now.getTime() - session.lastActivityAt.getTime();
    if (timeSinceLastActivity > this.IDLE_TIMEOUT_MS) {
      await this.prisma.userSession.update({
        where: { id: session.id },
        data: { isRevoked: true },
      });
      return null;
    }

    // 5. Actualización amortiguada de la marca de actividad (cada 60 segundos)
    if (timeSinceLastActivity > this.ACTIVITY_UPDATE_THROTTLE_MS) {
      await this.prisma.userSession.update({
        where: { id: session.id },
        data: { lastActivityAt: now },
      });
      session.lastActivityAt = now;
    }

    return {
      session,
      user: session.user,
    };
  }

  /**
   * Revoca una sesión por su token en texto plano.
   */
  async revokeSession(rawToken: string): Promise<boolean> {
    try {
      const tokenHash = this.tokenService.hashSessionToken(rawToken);
      const res = await this.prisma.userSession.updateMany({
        where: { sessionTokenHash: tokenHash, isRevoked: false },
        data: { isRevoked: true },
      });
      return res.count > 0;
    } catch {
      return false;
    }
  }

  /**
   * Revoca una sesión específica perteneciente a un usuario por su ID de sesión (protección contra IDOR).
   */
  async revokeSessionById(sessionId: string, userId: string): Promise<boolean> {
    try {
      const res = await this.prisma.userSession.updateMany({
        where: { id: sessionId, userId, isRevoked: false },
        data: { isRevoked: true },
      });
      return res.count > 0;
    } catch {
      return false;
    }
  }

  /**
   * Revoca todas las sesiones activas de un usuario (al cambiar contraseña o cierre masivo).
   */
  async revokeAllUserSessions(userId: string): Promise<number> {
    const res = await this.prisma.userSession.updateMany({
      where: { userId, isRevoked: false },
      data: { isRevoked: true },
    });
    return res.count;
  }

  /**
   * Obtiene la lista de sesiones activas del usuario para gestión y auditoría personal.
   */
  async getUserActiveSessions(userId: string, currentRawToken?: string): Promise<SessionInfo[]> {
    const currentTokenHash = currentRawToken
      ? this.tokenService.hashSessionToken(currentRawToken)
      : null;

    const sessions = await this.prisma.userSession.findMany({
      where: {
        userId,
        isRevoked: false,
        expiresAt: { gt: new Date() },
      },
      orderBy: { lastActivityAt: 'desc' },
      take: 20,
    });

    return sessions.map((s) => ({
      id: s.id,
      ipAddress: s.ipAddress,
      userAgent: s.userAgent,
      isRevoked: s.isRevoked,
      lastActivityAt: s.lastActivityAt.toISOString(),
      expiresAt: s.expiresAt.toISOString(),
      createdAt: s.createdAt.toISOString(),
      isCurrent: currentTokenHash ? s.sessionTokenHash === currentTokenHash : false,
    }));
  }
}


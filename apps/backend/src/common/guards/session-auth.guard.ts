import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { SessionsService } from '../../modules/sessions/sessions.service';
import { AuthUser } from '../../_shared';

@Injectable()
export class SessionAuthGuard implements CanActivate {
  constructor(private readonly sessionsService: SessionsService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    // 1. Extraer token de sesión desde Cookie o Bearer Header
    const rawToken = this.extractToken(request);

    if (!rawToken) {
      throw new UnauthorizedException('Sesión no proporcionada o credenciales ausentes.');
    }

    // 2. Validar sesión en la base de datos Neon PostgreSQL
    const result = await this.sessionsService.validateSession(rawToken);

    if (!result) {
      throw new UnauthorizedException('Sesión no válida, expirada o revocada.');
    }

    const { session, user } = result;

    // 3. Estructurar el objeto AuthUser normalizado en la petición
    const permissions = (user.role?.permissions || []).map(
      (rp) => rp.permission?.code || '',
    ).filter(Boolean);

    const authUser: AuthUser = {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      position: user.position,
      role: user.role?.code || '',
      status: user.status,
      mfaEnabled: false, // se actualizará en endpoint me si es necesario
      permissions,
    };

    request.user = authUser;
    request.session = session;
    request.rawSessionToken = rawToken;

    return true;
  }

  private extractToken(request: any): string | null {
    // 1. Cookie blindada oficial (__Host-mexagenda_session) o cookie de desarrollo (mexagenda_session)
    if (request.cookies) {
      if (request.cookies['__Host-mexagenda_session']) {
        return request.cookies['__Host-mexagenda_session'];
      }
      if (request.cookies['mexagenda_session']) {
        return request.cookies['mexagenda_session'];
      }
    }

    // 2. Cabecera Authorization: Bearer <token>
    const authHeader = request.headers?.authorization;
    if (authHeader && typeof authHeader === 'string') {
      const [type, token] = authHeader.split(' ');
      if (type === 'Bearer' && token) {
        return token;
      }
    }

    return null;
  }
}


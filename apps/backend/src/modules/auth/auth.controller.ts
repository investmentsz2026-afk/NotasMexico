import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Req,
  Res,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse as SwaggerApiResponse, ApiCookieAuth } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { MfaService } from '../mfa/mfa.service';
import { SessionsService } from '../sessions/sessions.service';
import { LoginDto } from './dto/login.dto';
import { MfaVerifyDto } from './dto/mfa-verify.dto';
import { MfaConfirmDto } from './dto/mfa-confirm.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import {
  PasswordResetRequestDto,
  PasswordResetConfirmDto,
} from './dto/reset-password.dto';
import { AdminResetUserDto } from './dto/admin-reset-user.dto';
import { SessionAuthGuard } from '../../common/guards/session-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type {
  ApiResponse,
  AuthUser,
  LoginResponse,
  MfaEnrollResponse,
  MfaConfirmResponse,
  SessionInfo,
} from '@mexagenda/shared';

@ApiTags('Autenticación y Control de Acceso')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly mfaService: MfaService,
    private readonly sessionsService: SessionsService,
  ) {}

  private getCookieName(): string {
    return process.env.NODE_ENV === 'production'
      ? '__Host-mexagenda_session'
      : 'mexagenda_session';
  }

  private setSessionCookie(res: Response, rawToken: string): void {
    const isProd = process.env.NODE_ENV === 'production';
    const cookieName = this.getCookieName();

    res.cookie(cookieName, rawToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'strict',
      path: '/',
      maxAge: 8 * 60 * 60 * 1000, // 8 horas
    });
  }

  private clearSessionCookie(res: Response): void {
    res.clearCookie('__Host-mexagenda_session', { path: '/' });
    res.clearCookie('mexagenda_session', { path: '/' });
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Iniciar sesión con credenciales institucionales' })
  @SwaggerApiResponse({ status: 200, description: 'Inicio de sesión exitoso o emisión de desafío MFA' })
  @SwaggerApiResponse({ status: 401, description: 'Credenciales inválidas o cuenta no disponible' })
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<ApiResponse<LoginResponse & { token?: string }>> {
    const ip = req.ip || req.socket.remoteAddress || '127.0.0.1';
    const userAgent = req.headers['user-agent'] || 'unknown';

    const result = await this.authService.login(
      dto.email,
      dto.password,
      ip,
      userAgent,
    );

    if (result.rawSessionToken) {
      this.setSessionCookie(res, result.rawSessionToken);
    }

    return {
      success: true,
      statusCode: HttpStatus.OK,
      data: {
        mfaRequired: result.mfaRequired,
        mfaToken: result.mfaToken,
        user: result.user,
        message: result.message,
        token: result.rawSessionToken, // Retornado para clientes programáticos y CLI
      },
      timestamp: new Date().toISOString(),
    };
  }

  @Post('mfa/verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verificar código TOTP o código de respaldo' })
  @SwaggerApiResponse({ status: 200, description: 'MFA verificado correctamente y sesión creada' })
  @SwaggerApiResponse({ status: 401, description: 'Código inválido o token expirado' })
  async verifyMfa(
    @Body() dto: MfaVerifyDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<ApiResponse<{ user: AuthUser; token?: string }>> {
    const ip = req.ip || req.socket.remoteAddress || '127.0.0.1';
    const userAgent = req.headers['user-agent'] || 'unknown';

    const result = await this.authService.verifyMfa(
      dto.mfaToken,
      dto.code,
      ip,
      userAgent,
    );

    this.setSessionCookie(res, result.rawSessionToken);

    return {
      success: true,
      statusCode: HttpStatus.OK,
      data: {
        user: result.user,
        token: result.rawSessionToken,
      },
      timestamp: new Date().toISOString(),
    };
  }

  @Post('mfa/enroll')
  @UseGuards(SessionAuthGuard)
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Iniciar enrolamiento de MFA (secreto y código QR)' })
  async enrollMfa(@CurrentUser() user: AuthUser): Promise<ApiResponse<MfaEnrollResponse>> {
    const result = await this.mfaService.generateEnrollment({
      id: user.id,
      email: user.email,
    });

    return {
      success: true,
      statusCode: HttpStatus.OK,
      data: result,
      timestamp: new Date().toISOString(),
    };
  }

  @Post('mfa/confirm')
  @UseGuards(SessionAuthGuard)
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Confirmar enrolamiento de MFA con código inicial y obtener 8 códigos de respaldo' })
  async confirmMfa(
    @CurrentUser() user: AuthUser,
    @Body() dto: MfaConfirmDto,
  ): Promise<ApiResponse<MfaConfirmResponse>> {
    const result = await this.mfaService.confirmEnrollment(user.id, dto.code);

    return {
      success: true,
      statusCode: HttpStatus.OK,
      data: result,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('me')
  @UseGuards(SessionAuthGuard)
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Obtener datos del usuario de la sesión activa' })
  async me(@CurrentUser() user: AuthUser): Promise<ApiResponse<AuthUser>> {
    const profile = await this.authService.getProfile(user.id);

    return {
      success: true,
      statusCode: HttpStatus.OK,
      data: profile,
      timestamp: new Date().toISOString(),
    };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(SessionAuthGuard)
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Cerrar la sesión actual' })
  async logout(
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<ApiResponse<{ message: string }>> {
    const rawToken = (req as any).rawSessionToken;
    const ip = req.ip || req.socket.remoteAddress || '127.0.0.1';
    const userAgent = req.headers['user-agent'] || 'unknown';

    if (rawToken) {
      await this.authService.logout(rawToken, user.id, ip, userAgent);
    }

    this.clearSessionCookie(res);

    return {
      success: true,
      statusCode: HttpStatus.OK,
      data: { message: 'Sesión finalizada exitosamente.' },
      timestamp: new Date().toISOString(),
    };
  }

  @Post('logout-all')
  @HttpCode(HttpStatus.OK)
  @UseGuards(SessionAuthGuard)
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Revocar todas las sesiones activas del usuario' })
  async logoutAll(
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<ApiResponse<{ message: string; revokedCount: number }>> {
    const ip = req.ip || req.socket.remoteAddress || '127.0.0.1';
    const userAgent = req.headers['user-agent'] || 'unknown';

    const count = await this.authService.logoutAll(user.id, ip, userAgent);
    this.clearSessionCookie(res);

    return {
      success: true,
      statusCode: HttpStatus.OK,
      data: {
        message: 'Todas las sesiones activas han sido revocadas.',
        revokedCount: count,
      },
      timestamp: new Date().toISOString(),
    };
  }

  @Get('sessions')
  @UseGuards(SessionAuthGuard)
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Listar sesiones activas del usuario' })
  async getSessions(
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ): Promise<ApiResponse<SessionInfo[]>> {
    const rawToken = (req as any).rawSessionToken;
    const sessions = await this.sessionsService.getUserActiveSessions(
      user.id,
      rawToken,
    );

    return {
      success: true,
      statusCode: HttpStatus.OK,
      data: sessions,
      timestamp: new Date().toISOString(),
    };
  }

  @Delete('sessions/:sessionId')
  @UseGuards(SessionAuthGuard)
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Revocar una sesión activa específica' })
  async revokeSession(
    @CurrentUser() user: AuthUser,
    @Param('sessionId') sessionId: string,
  ): Promise<ApiResponse<{ message: string }>> {
    const revoked = await this.sessionsService.revokeSessionById(
      sessionId,
      user.id,
    );

    return {
      success: true,
      statusCode: HttpStatus.OK,
      data: {
        message: revoked
          ? 'Sesión revocada exitosamente.'
          : 'La sesión no existe o ya fue revocada.',
      },
      timestamp: new Date().toISOString(),
    };
  }

  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @UseGuards(SessionAuthGuard)
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Cambio voluntario de contraseña' })
  async changePassword(
    @CurrentUser() user: AuthUser,
    @Body() dto: ChangePasswordDto,
    @Req() req: Request,
  ): Promise<ApiResponse<{ message: string }>> {
    const ip = req.ip || req.socket.remoteAddress || '127.0.0.1';
    const userAgent = req.headers['user-agent'] || 'unknown';

    await this.authService.changePassword(
      user.id,
      dto.currentPassword,
      dto.newPassword,
      ip,
      userAgent,
    );

    return {
      success: true,
      statusCode: HttpStatus.OK,
      data: {
        message:
          'Contraseña actualizada exitosamente. Todas las demás sesiones han sido revocadas.',
      },
      timestamp: new Date().toISOString(),
    };
  }

  @Post('password-reset/request')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Solicitar restablecimiento de contraseña' })
  async requestPasswordReset(
    @Body() dto: PasswordResetRequestDto,
    @Req() req: Request,
  ): Promise<ApiResponse<{ message: string; devToken?: string }>> {
    const ip = req.ip || req.socket.remoteAddress || '127.0.0.1';
    const userAgent = req.headers['user-agent'] || 'unknown';

    const result = await this.authService.requestPasswordReset(
      dto.email,
      ip,
      userAgent,
    );

    return {
      success: true,
      statusCode: HttpStatus.OK,
      data: result,
      timestamp: new Date().toISOString(),
    };
  }

  @Post('password-reset/confirm')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Confirmar restablecimiento de contraseña con token' })
  async confirmPasswordReset(
    @Body() dto: PasswordResetConfirmDto,
    @Req() req: Request,
  ): Promise<ApiResponse<{ message: string }>> {
    const ip = req.ip || req.socket.remoteAddress || '127.0.0.1';
    const userAgent = req.headers['user-agent'] || 'unknown';

    await this.authService.confirmPasswordReset(
      dto.token,
      dto.newPassword,
      ip,
      userAgent,
    );

    return {
      success: true,
      statusCode: HttpStatus.OK,
      data: {
        message: 'Contraseña restablecida exitosamente. Ya puede iniciar sesión.',
      },
      timestamp: new Date().toISOString(),
    };
  }

  @Post('admin-reset')
  @HttpCode(HttpStatus.OK)
  @UseGuards(SessionAuthGuard, RolesGuard)
  @Roles('ROLE_ADMIN')
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Restablecimiento administrativo de credenciales (solo ROLE_ADMIN)' })
  async adminResetUser(
    @CurrentUser() admin: AuthUser,
    @Body() dto: AdminResetUserDto,
    @Req() req: Request,
  ): Promise<ApiResponse<{ message: string }>> {
    const ip = req.ip || req.socket.remoteAddress || '127.0.0.1';
    const userAgent = req.headers['user-agent'] || 'unknown';

    await this.authService.adminResetUserPassword(
      admin.id,
      dto.userId,
      dto.temporaryPassword,
      ip,
      userAgent,
    );

    return {
      success: true,
      statusCode: HttpStatus.OK,
      data: {
        message: 'Credenciales del usuario institucional restablecidas exitosamente.',
      },
      timestamp: new Date().toISOString(),
    };
  }
}


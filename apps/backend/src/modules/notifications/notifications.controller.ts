import {
  Controller,
  Get,
  Patch,
  Delete,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiCookieAuth } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { QueryNotificationsDto } from './dto/query-notifications.dto';
import { UpdateNotificationPreferencesDto } from './dto/update-preferences.dto';
import { SessionAuthGuard } from '../../common/guards/session-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthUser, ApiResponse, PaginatedResponse } from '../../_shared';

@ApiTags('MOD-06 — Notificaciones Institucionales y SMTP')
@Controller('notifications')
@UseGuards(SessionAuthGuard, PermissionsGuard)
@ApiCookieAuth()
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @RequirePermissions('notification:read')
  @ApiOperation({ summary: 'Consultar bandeja de notificaciones del usuario autenticado' })
  async getNotifications(
    @CurrentUser() user: AuthUser,
    @Query() query: QueryNotificationsDto,
  ): Promise<ApiResponse<PaginatedResponse<any>>> {
    const result = await this.notificationsService.findAll(user.id, query);
    return {
      success: true,
      statusCode: HttpStatus.OK,
      data: {
        items: result.data,
        meta: result.meta,
      },
      timestamp: new Date().toISOString(),
    };
  }

  @Get('unread-count')
  @RequirePermissions('notification:read')
  @ApiOperation({ summary: 'Obtener contador de notificaciones no leídas para la campana' })
  async getUnreadCount(@CurrentUser() user: AuthUser): Promise<ApiResponse<{ unreadCount: number }>> {
    const data = await this.notificationsService.getUnreadCount(user.id);
    return {
      success: true,
      statusCode: HttpStatus.OK,
      data,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('preferences')
  @RequirePermissions('notification:read')
  @ApiOperation({ summary: 'Consultar preferencias de notificación del usuario' })
  async getPreferences(@CurrentUser() user: AuthUser): Promise<ApiResponse<any>> {
    const data = await this.notificationsService.getOrCreatePreferences(user.id);
    return {
      success: true,
      statusCode: HttpStatus.OK,
      data,
      timestamp: new Date().toISOString(),
    };
  }

  @Patch('preferences')
  @RequirePermissions('notification:update')
  @ApiOperation({ summary: 'Actualizar preferencias de notificación del usuario' })
  async updatePreferences(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateNotificationPreferencesDto,
  ): Promise<ApiResponse<any>> {
    const data = await this.notificationsService.updatePreferences(user.id, dto);
    return {
      success: true,
      statusCode: HttpStatus.OK,
      data,
      timestamp: new Date().toISOString(),
    };
  }

  @Patch('read-all')
  @RequirePermissions('notification:update')
  @ApiOperation({ summary: 'Marcar todas las notificaciones pendientes como leídas' })
  async markAllAsRead(@CurrentUser() user: AuthUser): Promise<ApiResponse<{ updatedCount: number }>> {
    const data = await this.notificationsService.markAllAsRead(user.id);
    return {
      success: true,
      statusCode: HttpStatus.OK,
      data,
      timestamp: new Date().toISOString(),
    };
  }

  @Patch(':id/read')
  @RequirePermissions('notification:update')
  @ApiOperation({ summary: 'Marcar una notificación específica como leída' })
  async markAsRead(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiResponse<any>> {
    const data = await this.notificationsService.markAsRead(id, user.id);
    return {
      success: true,
      statusCode: HttpStatus.OK,
      data,
      timestamp: new Date().toISOString(),
    };
  }

  @Delete(':id')
  @RequirePermissions('notification:delete')
  @ApiOperation({ summary: 'Descartar o eliminar una notificación propia' })
  async deleteNotification(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiResponse<void>> {
    await this.notificationsService.delete(id, user.id);
    return {
      success: true,
      statusCode: HttpStatus.OK,
      data: undefined as any,
      timestamp: new Date().toISOString(),
    };
  }

  // --- ENDPOINTS ADMINISTRATIVOS EXCLUSIVOS ---

  @Get('admin/deliveries')
  @RequirePermissions('notification:admin:manage')
  @ApiOperation({ summary: 'Consultar cola y bitácora administrativa de entregas outbox' })
  async getAdminDeliveries(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ): Promise<ApiResponse<PaginatedResponse<any>>> {
    const result = await this.notificationsService.getAdminDeliveries(
      page ? Number(page) : 1,
      limit ? Number(limit) : 50,
    );
    return {
      success: true,
      statusCode: HttpStatus.OK,
      data: {
        items: result.data,
        meta: result.meta,
      },
      timestamp: new Date().toISOString(),
    };
  }

  @Post('admin/deliveries/:id/retry')
  @RequirePermissions('notification:admin:manage')
  @ApiOperation({ summary: 'Reintentar manualmente una entrega fallida en la cola outbox' })
  async retryDelivery(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiResponse<any>> {
    const data = await this.notificationsService.retryDelivery(id, user.id);
    return {
      success: true,
      statusCode: HttpStatus.OK,
      data,
      timestamp: new Date().toISOString(),
    };
  }
}

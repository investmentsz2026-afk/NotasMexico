import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiCookieAuth } from '@nestjs/swagger';
import type { Request } from 'express';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { SessionAuthGuard } from '../../common/guards/session-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { ApiResponse, AuthUser } from '../../_shared';

@ApiTags('Directorio y Gestión de Usuarios Institucionales')
@Controller('users')
@UseGuards(SessionAuthGuard, RolesGuard, PermissionsGuard)
@ApiCookieAuth()
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('roles')
  @ApiOperation({ summary: 'Obtener catálogo de roles institucionales' })
  async getRoles(): Promise<ApiResponse<any[]>> {
    const roles = await this.usersService.getRoles();
    return {
      success: true,
      statusCode: HttpStatus.OK,
      data: roles,
      timestamp: new Date().toISOString(),
    };
  }

  @Get()
  @ApiOperation({ summary: 'Listar usuarios institucionales' })
  @RequirePermissions('user:read')
  async findAll(
    @Query('search') search?: string,
    @Query('roleId') roleId?: string,
    @Query('status') status?: string,
  ): Promise<ApiResponse<any[]>> {
    const users = await this.usersService.findAll({ search, roleId, status });
    return {
      success: true,
      statusCode: HttpStatus.OK,
      data: users,
      timestamp: new Date().toISOString(),
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener detalle de un usuario' })
  @RequirePermissions('user:read')
  async findOne(@Param('id') id: string): Promise<ApiResponse<any>> {
    const user = await this.usersService.findOne(id);
    return {
      success: true,
      statusCode: HttpStatus.OK,
      data: user,
      timestamp: new Date().toISOString(),
    };
  }

  @Post()
  @ApiOperation({ summary: 'Registrar nuevo usuario institucional con asignación de rol' })
  @Roles('ROLE_ADMIN')
  @RequirePermissions('user:create')
  async create(
    @Body() dto: CreateUserDto,
    @CurrentUser() actor: AuthUser,
    @Req() req: Request,
  ): Promise<ApiResponse<any>> {
    const ipAddress = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';
    const userAgent = (req.headers['user-agent'] as string) || 'unknown';

    const created = await this.usersService.create(dto, actor.id, ipAddress, userAgent);

    return {
      success: true,
      statusCode: HttpStatus.CREATED,
      data: created,
      timestamp: new Date().toISOString(),
    };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar datos, rol o estado de un usuario institucional' })
  @Roles('ROLE_ADMIN')
  @RequirePermissions('user:update')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() actor: AuthUser,
    @Req() req: Request,
  ): Promise<ApiResponse<any>> {
    const ipAddress = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';
    const userAgent = (req.headers['user-agent'] as string) || 'unknown';

    const updated = await this.usersService.update(id, dto, actor.id, ipAddress, userAgent);

    return {
      success: true,
      statusCode: HttpStatus.OK,
      data: updated,
      timestamp: new Date().toISOString(),
    };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Desincorporar o dar de baja a un usuario institucional' })
  @Roles('ROLE_ADMIN')
  @RequirePermissions('user:delete')
  async delete(
    @Param('id') id: string,
    @CurrentUser() actor: AuthUser,
    @Req() req: Request,
  ): Promise<ApiResponse<any>> {
    const ipAddress = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';
    const userAgent = (req.headers['user-agent'] as string) || 'unknown';

    const result = await this.usersService.delete(id, actor.id, ipAddress, userAgent);

    return {
      success: true,
      statusCode: HttpStatus.OK,
      data: result,
      timestamp: new Date().toISOString(),
    };
  }
}

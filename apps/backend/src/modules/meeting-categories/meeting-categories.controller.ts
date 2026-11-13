import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  HttpStatus,
  ParseBoolPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse as SwaggerApiResponse, ApiCookieAuth } from '@nestjs/swagger';
import type { Request } from 'express';
import { MeetingCategoriesService } from './meeting-categories.service';
import { CreateMeetingCategoryDto } from './dto/create-meeting-category.dto';
import { UpdateMeetingCategoryDto } from './dto/update-meeting-category.dto';
import { SessionAuthGuard } from '../../common/guards/session-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { ApiResponse, MeetingCategoryDto, AuthUser } from '@mexagenda/shared';

@ApiTags('Categorías y Taxonomía de Reuniones')
@Controller('meeting-categories')
@UseGuards(SessionAuthGuard)
@ApiCookieAuth()
export class MeetingCategoriesController {
  constructor(private readonly categoriesService: MeetingCategoriesService) {}

  @Get()
  @ApiOperation({ summary: 'Listar catálogo de categorías institucionales' })
  async findAll(
    @Query('includeInactive') includeInactive?: string,
  ): Promise<ApiResponse<MeetingCategoryDto[]>> {
    const shouldInclude = includeInactive === 'true';
    const categories = await this.categoriesService.findAll(shouldInclude);

    return {
      success: true,
      statusCode: HttpStatus.OK,
      data: categories,
      timestamp: new Date().toISOString(),
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener detalle de una categoría específica' })
  async findById(@Param('id') id: string): Promise<ApiResponse<MeetingCategoryDto>> {
    const category = await this.categoriesService.findById(id);

    return {
      success: true,
      statusCode: HttpStatus.OK,
      data: category,
      timestamp: new Date().toISOString(),
    };
  }

  @Post()
  @UseGuards(PermissionsGuard)
  @RequirePermissions('meeting:category:manage')
  @ApiOperation({ summary: 'Crear nueva categoría institucional (Requiere permiso administrativo)' })
  async create(
    @Body() dto: CreateMeetingCategoryDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ): Promise<ApiResponse<MeetingCategoryDto>> {
    const ip = req.ip || req.socket.remoteAddress || '127.0.0.1';
    const userAgent = req.headers['user-agent'] || 'unknown';

    const created = await this.categoriesService.create(
      dto,
      user.id,
      ip,
      userAgent,
    );

    return {
      success: true,
      statusCode: HttpStatus.CREATED,
      data: created,
      timestamp: new Date().toISOString(),
    };
  }

  @Put(':id')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('meeting:category:manage')
  @ApiOperation({ summary: 'Actualizar datos de una categoría' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateMeetingCategoryDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ): Promise<ApiResponse<MeetingCategoryDto>> {
    const ip = req.ip || req.socket.remoteAddress || '127.0.0.1';
    const userAgent = req.headers['user-agent'] || 'unknown';

    const updated = await this.categoriesService.update(
      id,
      dto,
      user.id,
      ip,
      userAgent,
    );

    return {
      success: true,
      statusCode: HttpStatus.OK,
      data: updated,
      timestamp: new Date().toISOString(),
    };
  }

  @Patch(':id/deactivate')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('meeting:category:manage')
  @ApiOperation({ summary: 'Desactivar categoría institucional sin alterar reuniones históricas' })
  async deactivate(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ): Promise<ApiResponse<MeetingCategoryDto>> {
    const ip = req.ip || req.socket.remoteAddress || '127.0.0.1';
    const userAgent = req.headers['user-agent'] || 'unknown';

    const deactivated = await this.categoriesService.deactivate(
      id,
      user.id,
      ip,
      userAgent,
    );

    return {
      success: true,
      statusCode: HttpStatus.OK,
      data: deactivated,
      timestamp: new Date().toISOString(),
    };
  }

  @Delete(':id')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('meeting:category:manage')
  @ApiOperation({ summary: 'Eliminar o auto-desactivar categoría según integridad de reuniones' })
  async delete(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ): Promise<ApiResponse<{ message: string; wasDeactivatedOnly: boolean }>> {
    const ip = req.ip || req.socket.remoteAddress || '127.0.0.1';
    const userAgent = req.headers['user-agent'] || 'unknown';

    const res = await this.categoriesService.delete(id, user.id, ip, userAgent);

    return {
      success: true,
      statusCode: HttpStatus.OK,
      data: res,
      timestamp: new Date().toISOString(),
    };
  }
}


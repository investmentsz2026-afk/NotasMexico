import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse as SwaggerResponse } from '@nestjs/swagger';
import { HealthService } from './health.service';
import type { HealthCheckResponse } from '@mexagenda/shared';

@ApiTags('Infraestructura y Salud')
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @ApiOperation({
    summary: 'Verificación de salud de la plataforma (Health Check)',
    description:
      'Comprueba la disponibilidad del servidor backend NestJS y la conexión a la base de datos PostgreSQL.',
  })
  @SwaggerResponse({
    status: 200,
    description: 'Estado de salud devuelto satisfactoriamente.',
  })
  async getHealth(): Promise<HealthCheckResponse> {
    return this.healthService.checkHealth();
  }
}

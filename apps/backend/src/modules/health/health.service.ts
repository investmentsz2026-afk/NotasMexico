import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { HealthCheckResponse } from '@mexagenda/shared';

@Injectable()
export class HealthService {
  private readonly startTime = Date.now();

  constructor(private readonly prisma: PrismaService) {}

  async checkHealth(): Promise<HealthCheckResponse> {
    const dbStatus = await this.prisma.checkConnection();
    const uptimeSeconds = Math.floor((Date.now() - this.startTime) / 1000);
    const environment = process.env.NODE_ENV || 'development';

    const isHealthy = dbStatus !== 'disconnected';

    return {
      status: isHealthy ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      uptimeSeconds,
      environment,
      services: {
        api: 'healthy',
        database: dbStatus,
      },
      version: '1.0.0',
    };
  }
}

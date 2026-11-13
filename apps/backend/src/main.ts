import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { loadAndValidateEnv } from './config/env.config';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  // 1. Cargar y validar configuración de entorno estricta
  const env = loadAndValidateEnv();

  const app = await NestFactory.create(AppModule, {
    logger:
      env.NODE_ENV === 'development'
        ? ['log', 'error', 'warn', 'debug', 'verbose']
        : ['log', 'error', 'warn'],
  });

  // 2. Cabeceras de seguridad HTTP con Helmet
  app.use(
    helmet({
      contentSecurityPolicy: env.NODE_ENV === 'production',
      crossOriginEmbedderPolicy: false,
    }),
  );

  // 3. Manejo de cookies firmadas y seguras
  const cookieParserMiddleware =
    typeof cookieParser === 'function'
      ? cookieParser
      : (cookieParser as unknown as { default: typeof cookieParser }).default;
  app.use(cookieParserMiddleware());

  // 4. CORS restrictivo con lista explícita de orígenes autorizados y soporte Vercel
  const allowedOrigins: (string | RegExp)[] = [env.FRONTEND_URL];
  if (process.env.VERCEL_URL) {
    allowedOrigins.push(`https://${process.env.VERCEL_URL}`);
  }
  allowedOrigins.push(/\.vercel\.app$/);

  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
      // Permitir solicitudes sin cabecera origin (llamadas internas, SSR, healthchecks)
      if (!origin) return callback(null, true);
      const isAllowed = allowedOrigins.some((allowed) =>
        typeof allowed === 'string' ? allowed === origin : allowed.test(origin),
      );
      if (isAllowed || env.NODE_ENV !== 'production') {
        callback(null, true);
      } else {
        callback(new Error(`CORS bloqueado para el origen no autorizado: ${origin}`));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Correlation-Id'],
  });

  // 5. Prefijo global de API REST
  app.setGlobalPrefix('api/v1');

  // 6. Filtro global de excepciones (RFC 7807) e Interceptor de logs seguro
  app.useGlobalFilters(new GlobalExceptionFilter());
  app.useGlobalInterceptors(new LoggingInterceptor());

  // 7. Validación global de DTOs
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // 8. Documentación OpenAPI / Swagger
  const swaggerConfig = new DocumentBuilder()
    .setTitle('MexAgenda — API de Gestión Institucional')
    .setDescription(
      'Documentación técnica oficial de los endpoints de la plataforma privada MexAgenda.',
    )
    .setVersion('1.0.0')
    .addBearerAuth()
    .addCookieAuth('__Host-mexagenda_session')
    .addTag('Autenticación y Control de Acceso', 'Inicio de sesión, MFA, sesiones y seguridad de credenciales')
    .addTag('Infraestructura y Salud', 'Verificaciones de estado y diagnóstico')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  // 9. Iniciar escucha en el puerto validado
  await app.listen(env.PORT);
  logger.log(`Servidor Backend NestJS ejecutándose en: http://localhost:${env.PORT}/api/v1`);
  logger.log(`Documentación OpenAPI disponible en: http://localhost:${env.PORT}/api/docs`);
}

bootstrap().catch((err) => {
  const logger = new Logger('FatalBootstrap');
  logger.error('Error fatal al iniciar la aplicación backend:', err);
  process.exit(1);
});

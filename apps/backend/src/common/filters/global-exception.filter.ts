import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import type { ApiErrorResponse } from '@mexagenda/shared';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let title = 'Internal Server Error';
    let detail = 'Ha ocurrido un error inesperado en el servidor.';
    let errorCode = 'INTERNAL_SERVER_ERROR';
    let invalidParams: Array<{ name: string; reason: string }> | undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();

      if (typeof res === 'string') {
        detail = res;
      } else if (typeof res === 'object' && res !== null) {
        const resObj = res as Record<string, any>;
        detail = resObj.message || exception.message;
        errorCode = resObj.error || exception.name;

        // Si son errores de validación de class-validator
        if (Array.isArray(resObj.message)) {
          detail = 'Uno o más parámetros de la solicitud son inválidos.';
          invalidParams = resObj.message.map((msg: string) => {
            const parts = msg.split(' ');
            return {
              name: parts[0] || 'field',
              reason: msg,
            };
          });
        }
      }

      title = exception.name;
    } else if (exception && typeof exception === 'object' && 'code' in exception) {
      // Manejo controlado de excepciones de Prisma ORM
      const prismaErr = exception as { code: string; meta?: Record<string, any>; message?: string };
      if (prismaErr.code === 'P2002') {
        status = HttpStatus.CONFLICT;
        title = 'Conflict';
        detail = 'Conflicto de unicidad en la base de datos (registro duplicado o colisión concurrente).';
        errorCode = 'DUPLICATE_RESOURCE_CONFLICT';
      } else if (prismaErr.code === 'P2025') {
        status = HttpStatus.NOT_FOUND;
        title = 'Not Found';
        detail = 'El registro solicitado no existe en la base de datos o fue eliminado previamente.';
        errorCode = 'RESOURCE_NOT_FOUND';
      } else if (prismaErr.code === 'P2003') {
        status = HttpStatus.BAD_REQUEST;
        title = 'Bad Request';
        detail = 'Violación de restricción de clave foránea o relación institucional inválida.';
        errorCode = 'FOREIGN_KEY_VIOLATION';
      } else {
        this.logger.error(
          `Error de Prisma [${prismaErr.code}] en [${request.method}] ${request.url}: ${prismaErr.message}`,
        );
        const safeMsg = (prismaErr.message || '').replace(/(:\/\/.*?):.*?@/, '$1:***@');
        detail = `Error de base de datos (${prismaErr.code}): ${safeMsg || 'Falla en consulta de base de datos'}`;
      }
    } else if (exception instanceof Error) {
      this.logger.error(
        `Error no controlado en [${request.method}] ${request.url}: ${exception.message}`,
        exception.stack,
      );
      const safeMsg = (exception.message || '').replace(/(:\/\/.*?):.*?@/, '$1:***@');
      detail = safeMsg || 'Ha ocurrido un error inesperado en el servidor.';
    }

    const problemDetails: ApiErrorResponse = {
      type: `https://mexagenda.org/errors/${status}`,
      title,
      status,
      detail: typeof detail === 'string' ? detail : JSON.stringify(detail),
      instance: request.url,
      errorCode,
      timestamp: new Date().toISOString(),
      invalidParams,
    };

    response.status(status).json(problemDetails);
  }
}

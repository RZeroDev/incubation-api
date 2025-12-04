import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
  Inject,
  Optional,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { AuditService } from '../../audit/audit.service';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  constructor(
    @Optional() @Inject(AuditService) private auditService?: AuditService,
  ) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const message =
      exception instanceof HttpException
        ? exception.getResponse()
        : 'Une erreur interne est survenue';

    const errorResponse = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      message:
        typeof message === 'string'
          ? message
          : (message as any).message || 'Une erreur interne est survenue',
      error:
        status === HttpStatus.INTERNAL_SERVER_ERROR
          ? 'Internal Server Error'
          : undefined,
      ...(process.env.NODE_ENV === 'development' && exception instanceof Error
        ? { stack: exception.stack }
        : {}),
    };

    // Logger l'erreur critique
    this.logger.error(
      `${request.method} ${request.url} - ${status} - ${errorResponse.message}`,
      exception instanceof Error ? exception.stack : undefined,
    );

    // Logger dans l'audit pour les erreurs critiques
    if (this.auditService && status >= 500) {
      const user = (request as any).user;
      this.auditService.log({
        userId: user?.id,
        action: 'INTERNAL_SERVER_ERROR',
        entityType: 'Request',
        details: {
          method: request.method,
          path: request.url,
          statusCode: status,
          message: errorResponse.message,
          error: exception instanceof Error ? exception.message : 'Unknown error',
        },
        ipAddress: request.ip || request.connection?.remoteAddress,
        userAgent: request.headers['user-agent'],
      });
    }

    response.status(status).json(errorResponse);
  }
}


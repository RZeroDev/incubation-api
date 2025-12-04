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

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  constructor(
    @Optional() @Inject(AuditService) private auditService?: AuditService,
  ) {}

  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse();

    const errorResponse = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      message:
        typeof exceptionResponse === 'string'
          ? exceptionResponse
          : (exceptionResponse as any).message || exception.message,
      error:
        typeof exceptionResponse === 'object'
          ? (exceptionResponse as any).error || exception.name
          : undefined,
    };

    // Logger l'erreur
    this.logger.error(
      `${request.method} ${request.url} - ${status} - ${errorResponse.message}`,
      exception.stack,
    );

    // Logger dans l'audit si disponible et si c'est une erreur importante
    if (this.auditService && status >= 400 && status < 500) {
      const user = (request as any).user;
      this.auditService.log({
        userId: user?.id,
        action: `HTTP_ERROR_${status}`,
        entityType: 'Request',
        details: {
          method: request.method,
          path: request.url,
          statusCode: status,
          message: errorResponse.message,
        },
        ipAddress: request.ip || request.connection?.remoteAddress,
        userAgent: request.headers['user-agent'],
      });
    }

    response.status(status).json(errorResponse);
  }
}


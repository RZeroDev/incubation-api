import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { throwError } from 'rxjs';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, url, body, query, params } = request;
    const user = request.user;
    const now = Date.now();

    const message = `${method} ${url}${user ? ` - User: ${user.email}` : ''}`;

    this.logger.log(`→ ${message}`);

    return next.handle().pipe(
      tap(() => {
        const response = context.switchToHttp().getResponse();
        const delay = Date.now() - now;
        this.logger.log(
          `← ${message} ${response.statusCode} - ${delay}ms`,
        );
      }),
      catchError((error) => {
        const delay = Date.now() - now;
        this.logger.error(
          `✗ ${message} - ${error.message} - ${delay}ms`,
          error.stack,
        );
        return throwError(() => error);
      }),
    );
  }
}


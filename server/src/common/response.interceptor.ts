import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  RequestTimeoutException,
} from '@nestjs/common';
import { catchError, map, throwError, timeout, TimeoutError } from 'rxjs';
@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler) {
    const req = context.switchToHttp().getRequest();
    if (req.path === '/dashboard/stream' || req.path === '/metrics') return next.handle();
    return next.handle().pipe(
      timeout(10000),
      map((data) => ({ data, meta: { requestId: req.requestId } })),
      catchError((error) =>
        throwError(() =>
          error instanceof TimeoutError
            ? new RequestTimeoutException('Request timed out; check outcome before retrying')
            : error,
        ),
      ),
    );
  }
}

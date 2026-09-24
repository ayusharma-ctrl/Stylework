import { ArgumentsHost, Catch, ExceptionFilter, HttpException } from '@nestjs/common';
import { UniqueConstraintError, ForeignKeyConstraintError, ConnectionError, TimeoutError } from 'sequelize';
import { Telemetry } from './security/telemetry.service';

@Catch()
export class ErrorFilter implements ExceptionFilter {
  constructor(private readonly telemetry: Telemetry) { }

  catch(exception: unknown, host: ArgumentsHost) {
    const req = host.switchToHttp().getRequest();
    let status = 500;
    let code = 'INTERNAL_ERROR';
    let message = 'An unexpected error occurred';
    let details: unknown;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const value = exception.getResponse();

      if (typeof value === 'string') {
        message = value;
      } else {
        const body = value as any;
        message = Array.isArray(body.message) ? body.message.join('; ') : body.message;
        code = body.code || 'HTTP_' + status;
        details = body.details;
      }
    } else if (exception instanceof UniqueConstraintError) {
      status = 409;
      code = 'CONFLICT';
      message = 'This value already exists';
    } else if (exception instanceof ForeignKeyConstraintError) {
      status = 409;
      code = 'REFERENCE_CONFLICT';
      message = 'A related record changed; refresh and retry';
    } else if (exception instanceof ConnectionError || exception instanceof TimeoutError) {
      status = 503;
      code = 'DATABASE_UNAVAILABLE';
      message = 'Database temporarily unavailable';
    } else if (['encoding.unsupported', 'charset.unsupported'].includes((exception as any)?.type)) {
      status = 415;
      code = 'UNSUPPORTED_ENCODING';
      message = 'Send uncompressed UTF-8 JSON';
    } else if ((exception as any)?.type === 'entity.too.large') {
      status = 413;
      code = 'PAYLOAD_TOO_LARGE';
      message = 'Request body exceeds 64 KiB';
    } else if ((exception as any)?.type === 'entity.parse.failed') {
      status = 400;
      code = 'INVALID_JSON';
      message = 'Request body must be valid JSON';
    }

    this.telemetry.log[status >= 500 ? 'error' : 'warn'](
      {
        requestId: req?.requestId,
        code,
        status,
        errorType: exception instanceof Error ? exception.name : 'unknown',
      },
      'request failed',
    );

    const res = host.switchToHttp().getResponse();

    if (res.headersSent) return res.end();
    if (status === 503) res.setHeader('Retry-After', '2');

    res.status(status).json({
      error: { code, message, ...(details ? { details } : {}) },
      meta: { requestId: req?.requestId },
    });
  }
}

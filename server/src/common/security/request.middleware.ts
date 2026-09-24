import {
  ForbiddenException,
  HttpException,
  Injectable,
  ServiceUnavailableException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { NextFunction, Response } from 'express';
import { config } from '../../config/config';
import { ApiRequest } from '../http.types';
import { RateLimiter } from './rate-limiter.service';
import { RuntimeState } from './runtime-state';
import { Telemetry } from './telemetry.service';

@Injectable()
export class RequestMiddleware {
  private inflight = 0;
  private readonly origins = new Set(config.CLIENT_ORIGINS.split(',').map((v) => new URL(v.trim()).origin));
  constructor(
    private readonly limiter: RateLimiter,
    private readonly state: RuntimeState,
    private readonly telemetry: Telemetry,
  ) { }

  use = async (req: ApiRequest, res: Response, next: NextFunction) => {
    req.requestId = randomUUID();
    res.setHeader('X-Request-ID', req.requestId);
    const started = performance.now();

    res.once('finish', () => {
      const route = typeof req.route?.path === 'string' ? req.route.path : 'unmatched';
      this.telemetry.requests.inc({ method: req.method, route, status: String(res.statusCode) });
      this.telemetry.duration.observe({ method: req.method, route }, (performance.now() - started) / 1000);
      if (!req.path.startsWith('/health'))
        this.telemetry.log.info(
          {
            requestId: req.requestId,
            method: req.method,
            route,
            status: res.statusCode,
            durationMs: Math.round(performance.now() - started),
          },
          'request completed',
        );
    });

    try {
      if (req.path === '/health/live' || req.path === '/health/ready') return next();
      if (this.state.draining) throw new ServiceUnavailableException('Server is draining');

      const origin = req.headers.origin;

      if (origin && !this.origins.has(origin)) throw new ForbiddenException('Origin is not allowed');
      if (req.method === 'OPTIONS') return next();

      // Bound queued database work as well as arrival rate. SSE has its own distributed cap.
      if (req.path !== '/dashboard/stream') {
        if (this.inflight >= config.MAX_INFLIGHT_REQUESTS) {
          throw new ServiceUnavailableException({
            code: 'SERVER_BUSY',
            message: 'Server is busy; retry shortly',
          });
        }

        this.inflight++;
        let released = false;

        const release = () => {
          if (!released) {
            released = true;
            this.inflight--;
          }
        };

        res.once('finish', release);
        res.once('close', release);
      }

      if (['POST', 'PATCH', 'PUT', 'DELETE'].includes(req.method) && !req.is('application/json')) {
        throw new UnsupportedMediaTypeException('Content-Type must be application/json');
      }

      const ip = req.ip || req.socket.remoteAddress || 'unknown';
      // Only this exact endpoint gets the webhook policy; headers cannot select a larger quota.
      const webhook = req.path.toLowerCase().replace(/\/+$/, '') === '/webhook/meta-lead';

      await this.limiter.consume(
        webhook ? 'webhook-ip' : 'api-ip',
        ip,
        webhook ? config.WEBHOOK_RATE_LIMIT : config.API_RATE_LIMIT,
        60000,
        res,
      );

      next();
    } catch (error) {
      const status = error instanceof HttpException ? error.getStatus() : 503;
      const detail = error instanceof HttpException ? error.getResponse() : null;
      const body =
        typeof detail === 'object'
          ? (detail as any)
          : { message: typeof detail === 'string' ? detail : 'Service temporarily unavailable' };

      if (status === 503) res.setHeader('Retry-After', '2');

      res.status(status).json({
        error: { code: body.code || 'REQUEST_REJECTED', message: body.message },
        meta: { requestId: req.requestId },
      });
    }
  };
}

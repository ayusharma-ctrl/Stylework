import { Global, Module } from '@nestjs/common';
import { RedisService } from './redis.service';
import { RateLimiter } from './rate-limiter.service';
import { RuntimeState } from './runtime-state';
import { Telemetry } from './telemetry.service';
import { RequestMiddleware } from './request.middleware';
@Global()
@Module({providers:[RedisService,RateLimiter,RuntimeState,Telemetry,RequestMiddleware],exports:[RedisService,RateLimiter,RuntimeState,Telemetry,RequestMiddleware]})
export class SecurityModule {}

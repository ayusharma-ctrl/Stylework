import { HttpException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { Response } from 'express';
import { hash } from '../crypto';
import { RedisService } from './redis.service';

const bucket = `
local time=redis.call('TIME')
local now=time[1]*1000+math.floor(time[2]/1000)
local capacity=tonumber(ARGV[1])
local window=tonumber(ARGV[2])
local values=redis.call('HMGET',KEYS[1],'tokens','time')
local tokens=tonumber(values[1]) or capacity
local last=tonumber(values[2]) or now
tokens=math.min(capacity,tokens+math.max(0,now-last)*tonumber(ARGV[3])/window)
local delay=0
if tokens>=1 then tokens=tokens-1 else delay=math.ceil((1-tokens)*window/tonumber(ARGV[3])) end
redis.call('HSET',KEYS[1],'tokens',tokens,'time',now)
redis.call('PEXPIRE',KEYS[1],math.ceil(window*capacity/tonumber(ARGV[3])*2))
return delay
`;

@Injectable()
export class RateLimiter {
  constructor(private readonly redis: RedisService) { }

  async consume(
    scope: string,
    identity: string,
    capacity: number,
    windowMs: number,
    response?: Response,
    refill = capacity,
  ) {
    let retry: number;
    try {
      retry = Number(
        await this.redis.client.eval(
          bucket,
          1,
          'sw:rate:' + scope + ':' + hash(identity),
          capacity,
          windowMs,
          refill,
        ),
      );
    } catch {
      throw new ServiceUnavailableException({
        code: 'RATE_LIMITER_UNAVAILABLE',
        message: 'Service temporarily unavailable; retry shortly',
      });
    }

    if (retry > 0) {
      response?.setHeader('Retry-After', String(Math.max(1, Math.ceil(retry / 1000))));
      throw new HttpException({ code: 'RATE_LIMITED', message: 'Too many requests; retry later' }, 429);
    }
  }
}

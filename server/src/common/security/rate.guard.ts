import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { config } from '../../config/config';
import { httpContext } from '../../modules/auth/auth.guard';
import { RateLimiter } from './rate-limiter.service';
@Injectable()
export class RateGuard implements CanActivate {
  constructor(private readonly limiter: RateLimiter) {}
  async canActivate(context: ExecutionContext) {
    const { req, res } = httpContext(context);
    return (req.rateCheck ||= this.check(context));
  }
  private async check(context: ExecutionContext) {
    const { req, res } = httpContext(context);
    if (req.path === '/signin' && typeof req.body?.email === 'string') {
      await this.limiter.consume(
        'signin-email',
        req.body.email.trim().toLowerCase().slice(0, 254),
        config.SIGNIN_EMAIL_LIMIT,
        60000,
        res,
      );
    } else if (req.principal) {
      const read = req.method === 'GET' || context.getType<string>() === 'graphql';
      await this.limiter.consume(
        read ? 'read-user' : 'write-user',
        req.principal.id,
        read ? config.READ_USER_LIMIT : config.WRITE_USER_LIMIT,
        60000,
        res,
      );
    }
    return true;
  }
}

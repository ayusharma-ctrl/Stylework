import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Response } from 'express';
import { ApiRequest } from '../../common/http.types';
import { PUBLIC_ROUTE } from '../../common/public.decorator';
import { AuthService } from './auth.service';
export function httpContext(context: ExecutionContext): { req: ApiRequest; res: Response } {
  return { req: context.switchToHttp().getRequest(), res: context.switchToHttp().getResponse() };
}
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly auth: AuthService,
  ) {}
  async canActivate(context: ExecutionContext) {
    if (this.reflector.getAllAndOverride(PUBLIC_ROUTE, [context.getHandler(), context.getClass()]))
      return true;
    const { req, res } = httpContext(context);
    if (req.principal) return true;
    const header = req.headers.authorization,
      refresh = req.headers['x-refresh-token'];
    if (!header?.startsWith('Bearer ') || typeof refresh !== 'string')
      throw new UnauthorizedException('Access and refresh token headers are required');
    req.principal = await this.auth.authenticate(header.slice(7), refresh, res);
    return true;
  }
}

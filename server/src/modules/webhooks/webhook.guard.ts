import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { WebhooksService } from './webhooks.service';
@Injectable()
export class WebhookGuard implements CanActivate {
  constructor(private readonly service: WebhooksService) {}
  async canActivate(context: ExecutionContext) {
    await this.service.verify(context.switchToHttp().getRequest(), context.switchToHttp().getResponse());
    return true;
  }
}

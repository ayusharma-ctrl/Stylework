import { Module } from '@nestjs/common';
import { WebhooksController } from './webhooks.controller';
import { WebhooksRepository } from './webhooks.repository';
import { WebhooksService } from './webhooks.service';
import { WebhookGuard } from './webhook.guard';
@Module({controllers:[WebhooksController],providers:[WebhooksRepository,WebhooksService,WebhookGuard],exports:[WebhooksService]})
export class WebhooksModule {}

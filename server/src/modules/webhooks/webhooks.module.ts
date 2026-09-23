import { Module } from '@nestjs/common';
import { WebhooksController } from './webhooks.controller';
import { WebhooksRepository } from './webhooks.repository';
import { WebhooksService } from './webhooks.service';
import { WebhookGuard } from './webhook.guard';
import { WebhookCredentialsService } from './webhook-credentials.service';
@Module({controllers:[WebhooksController],providers:[WebhooksRepository,WebhooksService,WebhookGuard,WebhookCredentialsService],exports:[WebhooksService,WebhookCredentialsService]})
export class WebhooksModule {}

import {
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { QueryTypes } from 'sequelize';
import { Response } from 'express';
import { config } from '../../config/config';
import { DatabaseService } from '../../database/database.service';
import { Outbox, Receipt, WebhookCredential } from '../../database/models';
import { canonicalJson, hash } from '../../common/crypto';
import { ApiRequest } from '../../common/http.types';
import { RateLimiter } from '../../common/security/rate-limiter.service';
import { WebhooksRepository } from './webhooks.repository';
import { WebhookDto } from './webhook.dto';
import { WebhookCredentialsService } from './webhook-credentials.service';
@Injectable()
export class WebhooksService {
  private backlog = 0;
  private checked = 0;
  private checking?: Promise<void>;
  constructor(
    private readonly db: DatabaseService,
    private readonly repository: WebhooksRepository,
    private readonly limiter: RateLimiter,
    private readonly credentials: WebhookCredentialsService,
  ) {}
  async verify(req: ApiRequest, res: Response) {
    req.webhookCredentialId = (await this.credentials.verify(req.headers['x-webhook-key'])).id;
    await this.limiter.consume(
      'webhook-integration',
      'meta',
      config.WEBHOOK_BURST,
      1000,
      res,
      config.WEBHOOK_RATE,
    );
  }
  private async overloaded() {
    if (Date.now() - this.checked > 1000) {
      this.checking ||= this.db.sequelize
        .query<{ count: number }>(
          "SELECT count(*)::int AS count FROM (SELECT id FROM webhook_receipts WHERE state='pending' LIMIT :limit) q",
          { type: QueryTypes.SELECT, replacements: { limit: config.MAX_PENDING_EVENTS } },
        )
        .then((rows) => {
          this.backlog = rows[0]!.count;
          this.checked = Date.now();
        })
        .finally(() => {
          this.checking = undefined;
        });
      await this.checking;
    }
    return this.backlog >= config.MAX_PENDING_EVENTS;
  }
  async accept(payload: WebhookDto, requestId: string, credentialId: string) {
    const overloaded = await this.overloaded(),
      payloadHash = hash(canonicalJson(payload));
    return this.db.sequelize.transaction(async (transaction) => {
      const credential = await WebhookCredential.findByPk(credentialId, {
        transaction,
        lock: transaction.LOCK.SHARE,
      });
      if (
        !credential ||
        credential.revokedAt ||
        (credential.expiresAt && credential.expiresAt.getTime() <= Date.now())
      )
        throw new UnauthorizedException('Webhook key is no longer active');
      await this.db.sequelize.query('SELECT pg_advisory_xact_lock(hashtextextended(:key,0))', {
        replacements: { key: 'receipt:meta:' + payload.eventId },
        transaction,
      });
      const existing = await this.repository.find(payload.eventId, transaction);
      if (existing) {
        if (existing.payloadHash !== payloadHash)
          throw new ConflictException({
            code: 'EVENT_ID_CONFLICT',
            message: 'This event ID was already used with a different payload',
          });
        return { ...this.repository.safe(existing), duplicate: true };
      }
      if (overloaded)
        throw new ServiceUnavailableException({
          code: 'INTAKE_OVERLOADED',
          message: 'Intake backlog is full; retry this event later',
        });
      const receipt = await Receipt.create(
        { source: 'meta', eventId: payload.eventId, payloadHash, payload, requestId },
        { transaction },
      );
      await Outbox.create(
        { kind: 'process', receiptId: receipt.id, payload: { receiptId: receipt.id, requestId } },
        { transaction },
      );
      return { ...this.repository.safe(receipt), duplicate: false };
    });
  }
  async outcome(eventId: string) {
    const receipt = await this.repository.find(eventId);
    if (!receipt) throw new NotFoundException('Webhook event not found');
    return this.repository.safe(receipt);
  }
}

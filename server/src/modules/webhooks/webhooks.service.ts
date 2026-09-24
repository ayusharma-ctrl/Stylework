import {
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { QueryTypes } from 'sequelize';
import { Response } from 'express';
import { config } from '../../config/config';
import { DatabaseService } from '../../database/database.service';
import { Outbox, Receipt, WebhookCredential } from '../../database/models';
import { canonicalJson, hash } from '../../common/crypto';
import { ApiRequest, Principal } from '../../common/http.types';
import { AuthService } from '../auth/auth.service';
import { z } from 'zod';
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
    private readonly credentials: WebhookCredentialsService,
    private readonly auth: AuthService,
  ) { }

  async verify(req: ApiRequest, res: Response) {
    if (req.headers['x-webhook-key'] === undefined) {
      const access = req.headers.authorization;
      const refresh = req.headers['x-refresh-token'];

      if (!access?.startsWith('Bearer ') || typeof refresh !== 'string') {
        throw new UnauthorizedException('Webhook key or access and refresh tokens are required');
      }

      req.principal = await this.auth.authenticate(access.slice(7), refresh, res);
      return;
    }

    req.webhookCredentialId = (await this.credentials.verify(req.headers['x-webhook-key'])).id;
  }

  private async overloaded() {
    if (Date.now() - this.checked > 1000) {
      // Count only up to the admission threshold in PostgreSQL; Model.count scans the entire backlog.
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

  async accept(payload: WebhookDto, requestId: string, credentialId?: string, principal?: Principal) {
    if (!credentialId && !principal) throw new UnauthorizedException();

    const source = credentialId ? 'meta' : 'manual';

    if (source === 'manual' && (payload.version !== 1 || !z.uuid().safeParse(payload.externalLeadId).success)) {
      throw new BadRequestException('Manual intake requires version 1 and a UUID externalLeadId');
    }

    const overloaded = await this.overloaded();
    const payloadHash = hash(canonicalJson(payload));

    return this.db.sequelize.transaction(async (transaction) => {
      if (credentialId) {
        const credential = await WebhookCredential.findByPk(credentialId, {
          transaction,
          lock: transaction.LOCK.SHARE,
        });

        if (
          !credential ||
          credential.revokedAt ||
          (credential.expiresAt && credential.expiresAt.getTime() <= Date.now())
        ) {
          throw new UnauthorizedException('Webhook key is no longer active');
        }
      }

      await this.db.sequelize.query('SELECT pg_advisory_xact_lock(hashtextextended(:key,0))', {
        replacements: { key: 'receipt:' + source + ':' + payload.eventId },
        transaction,
      });

      const existing = await this.repository.find(payload.eventId, transaction, source);

      if (existing) {
        if (existing.payloadHash !== payloadHash) {
          throw new ConflictException({
            code: 'EVENT_ID_CONFLICT',
            message: 'This event ID was already used with a different payload',
          });
        }

        return { ...this.repository.safe(existing), duplicate: true };
      }

      if (overloaded) {
        throw new ServiceUnavailableException({
          code: 'INTAKE_OVERLOADED',
          message: 'Intake backlog is full; retry this event later',
        });
      }

      const receipt = await Receipt.create(
        {
          source,
          eventId: payload.eventId,
          payloadHash,
          payload,
          requestId,
          actorId: source === 'manual' ? principal!.id : null,
          actor: source === 'manual' ? { kind: 'user', label: principal!.email } : null,
        },
        { transaction },
      );

      await Outbox.create(
        { kind: 'process', receiptId: receipt.id, payload: { receiptId: receipt.id, requestId } },
        { transaction },
      );

      return { ...this.repository.safe(receipt), duplicate: false };
    });
  }

  async outcome(eventId: string, source: 'meta' | 'manual' = 'meta') {
    const receipt = await this.repository.find(eventId, undefined, source);
    if (!receipt) throw new NotFoundException('Webhook event not found');
    return this.repository.safe(receipt);
  }
}

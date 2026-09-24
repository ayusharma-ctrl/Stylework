import { Injectable } from '@nestjs/common';
import { Transaction } from 'sequelize';
import { DatabaseService } from '../../database/database.service';
import { Lead, Receipt, Status, AppSettings } from '../../database/models';
import { canonicalJson, hash } from '../../common/crypto';
import { Telemetry } from '../../common/security/telemetry.service';
import { AuditService } from '../events/audit.service';
import { CountersService } from '../events/counters.service';
import { OutboxService } from '../events/outbox.service';
import { webhookSchema } from '../webhooks/webhook.dto';

@Injectable()
export class LeadProcessor {
  constructor(
    private readonly db: DatabaseService,
    private readonly audit: AuditService,
    private readonly counters: CountersService,
    private readonly outbox: OutboxService,
    private readonly telemetry: Telemetry,
  ) { }

  private async fail(receipt: Receipt, code: string, message: string, transaction: Transaction) {
    await receipt.update(
      { state: 'failed', errorCode: code, errorMessage: message, processedAt: new Date() },
      { transaction },
    );
    this.telemetry.failures.inc({ code });
  }

  async process(receiptId: string) {
    try {
      return await this.db.sequelize.transaction(async (transaction) => {
        const receipt = await Receipt.findByPk(receiptId, { transaction, lock: transaction.LOCK.UPDATE });

        if (!receipt || receipt.state !== 'pending') return;

        await receipt.update({ attempts: receipt.attempts + 1 }, { transaction });

        if (receipt.attempts > 8) {
          await this.fail(
            receipt,
            'RETRY_EXHAUSTED',
            'Retry budget exhausted; operator replay required',
            transaction,
          );
          return;
        }

        const parsed = webhookSchema.safeParse(receipt.payload);

        if (!parsed.success) {
          await this.fail(
            receipt,
            'INVALID_STORED_PAYLOAD',
            'Stored event does not match the supported schema',
            transaction,
          );

          return;
        }

        const event = parsed.data;
        const sourceHash = hash(canonicalJson(event.data));

        await this.db.sequelize.query('SELECT pg_advisory_xact_lock(hashtextextended(:key,0))', {
          replacements: { key: 'lead:' + receipt.source + ':' + event.externalLeadId },
          transaction,
        });

        let lead = await Lead.findOne({
          where: { source: receipt.source, externalId: event.externalLeadId },
          transaction,
          lock: transaction.LOCK.UPDATE,
        });

        if (
          lead &&
          (event.version < lead.sourceVersion ||
            (event.version === lead.sourceVersion && sourceHash === lead.sourceHash))
        ) {
          await receipt.update(
            {
              state: 'ignored',
              leadId: lead.id,
              processedAt: new Date(),
              errorCode: null,
              errorMessage: null,
            },
            { transaction },
          );

          return;
        }

        if (lead && event.version === lead.sourceVersion) {
          await this.fail(
            receipt,
            'SOURCE_VERSION_CONFLICT',
            'Same source version contains different lead data',
            transaction,
          );

          return;
        }

        const actor = receipt.actor || { kind: 'webhook', label: 'Meta webhook' };

        if (!lead) {
          const settings = await AppSettings.findByPk(1, { transaction, lock: transaction.LOCK.SHARE });

          const status = await Status.findByPk(settings!.defaultStatusId, {
            transaction,
            lock: transaction.LOCK.SHARE,
          });

          if (!status || status.archivedAt) throw new Error('Default status unavailable');

          lead = await Lead.create(
            {
              ...event.data,
              source: receipt.source,
              externalId: event.externalLeadId,
              sourceVersion: event.version,
              sourceHash,
              sourceOccurredAt: new Date(event.occurredAt),
              statusId: status.id,
              version: 1,
            },
            { transaction },
          );

          await this.audit.record(transaction, {
            entityId: lead.id,
            leadId: lead.id,
            entityType: 'lead',
            type: 'LEAD_CREATED',
            actor,
            actorId: receipt.actorId || undefined,
            summary: 'Lead created: ' + lead.fullName,
            after: { ...event.data, status: { id: status.id, name: status.name } },
            requestId: receipt.requestId,
          });

          await this.counters.created(transaction, lead.id, status.id, lead.createdAt, settings!.timezone);
        } else {
          const before = {
            fullName: lead.fullName,
            email: lead.email,
            phone: lead.phone,
            company: lead.company,
            campaign: lead.campaign,
            metadata: lead.metadata,
          };

          const changed = sourceHash !== lead.sourceHash;

          await lead.update(
            {
              ...event.data,
              sourceVersion: event.version,
              sourceHash,
              sourceOccurredAt: new Date(event.occurredAt),
              version: lead.version + 1,
            },
            { transaction },
          );

          if (changed)
            await this.audit.record(transaction, {
              entityId: lead.id,
              leadId: lead.id,
              entityType: 'lead',
              type: 'LEAD_UPDATED',
              actor,
              actorId: receipt.actorId || undefined,
              summary: 'Contact information updated: ' + lead.fullName,
              before,
              after: event.data,
              requestId: receipt.requestId,
            });
        }

        await receipt.update(
          {
            state: 'processed',
            leadId: lead.id,
            processedAt: new Date(),
            errorCode: null,
            errorMessage: null,
          },
          { transaction },
        );

        await this.outbox.notify(transaction, {
          kind: 'lead',
          leadId: lead.id,
          requestId: receipt.requestId,
        });
      });
    } catch (error) {
      // The failed business transaction has rolled back. Persist retry state independently.
      const current = await Receipt.findByPk(receiptId).catch(() => null);
      if (current?.state === 'pending') {
        const attempts = current.attempts + 1;
        const exhausted = attempts >= 8;

        await Receipt.update(
          {
            attempts,
            state: exhausted ? 'failed' : 'pending',
            errorCode: exhausted ? 'RETRY_EXHAUSTED' : 'PROCESSING_RETRY',
            errorMessage: exhausted
              ? 'Retry budget exhausted; operator replay required'
              : 'Temporary processing failure; retry scheduled',
            nextAttemptAt: new Date(Date.now() + Math.min(60000, 1000 * 2 ** Math.min(attempts, 6))),
          },
          { where: { id: receiptId, state: 'pending' } },
        );
      }

      this.telemetry.failures.inc({ code: 'PROCESSING_RETRY' });

      this.telemetry.log.error(
        {
          receiptId,
          requestId: current?.requestId,
          errorType: error instanceof Error ? error.name : 'unknown',
        },
        'worker transaction failed',
      );

      throw error;
    }
  }
}

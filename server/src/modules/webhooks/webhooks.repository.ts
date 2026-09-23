import { Injectable } from '@nestjs/common';
import { Transaction } from 'sequelize';
import { Receipt } from '../../database/models';
@Injectable()
export class WebhooksRepository {
  find(eventId: string, transaction?: Transaction, source = 'meta') {
    return Receipt.findOne({
      where: { source, eventId },
      transaction,
      ...(transaction ? { lock: transaction.LOCK.UPDATE } : {}),
    });
  }
  safe(receipt: Receipt) {
    return {
      receiptId: receipt.id,
      eventId: receipt.eventId,
      source: receipt.source,
      state: receipt.state,
      attempts: receipt.attempts,
      leadId: receipt.leadId,
      errorCode: receipt.errorCode,
      errorMessage: receipt.errorMessage,
      createdAt: receipt.createdAt,
      processedAt: receipt.processedAt,
    };
  }
}

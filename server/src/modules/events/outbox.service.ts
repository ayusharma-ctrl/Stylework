import { Injectable } from '@nestjs/common';
import { Transaction } from 'sequelize';
import { Outbox } from '../../database/models';

@Injectable()
export class OutboxService {
  notify(transaction: Transaction, payload: Record<string, unknown>) {
    return Outbox.create({ kind: 'notify', payload }, { transaction });
  }
}

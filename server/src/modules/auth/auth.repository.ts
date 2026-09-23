import { Injectable } from '@nestjs/common';
import { Transaction } from 'sequelize';
import { Session } from '../../database/models';
@Injectable()
export class AuthRepository {
  create(data: Record<string, unknown>) { return Session.create(data); }
  find(id: string, transaction?: Transaction) { return Session.findByPk(id, { transaction, ...(transaction ? { lock: transaction.LOCK.UPDATE } : {}) }); }
  revoke(id: string) { return Session.update({ revokedAt: new Date() }, { where: { id } }); }
}

import { Injectable, NotFoundException } from '@nestjs/common';
import { Transaction } from 'sequelize';
import { Status, AppSettings } from '../../database/models';

@Injectable()
export class StatusesRepository {
  list() {
    return Status.findAll({
      order: [
        ['position', 'ASC'],
        ['id', 'ASC'],
      ],
    });
  }

  async lockSettings(transaction: Transaction) {
    const settings = await AppSettings.findByPk(1, { transaction, lock: transaction.LOCK.UPDATE });
    if (!settings) throw new NotFoundException('Application settings not configured');
    return settings;
  }

  async lock(id: string, transaction: Transaction) {
    const status = await Status.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE });
    if (!status) throw new NotFoundException('Status not found');
    return status;
  }
}

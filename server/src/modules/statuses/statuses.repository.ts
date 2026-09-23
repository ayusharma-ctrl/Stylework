import { Injectable, NotFoundException } from '@nestjs/common';
import { Transaction } from 'sequelize';
import { Status, Workspace } from '../../database/models';
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
  async lockWorkspace(transaction: Transaction) {
    const workspace = await Workspace.findByPk(1, { transaction, lock: transaction.LOCK.UPDATE });
    if (!workspace) throw new NotFoundException('Workspace not configured');
    return workspace;
  }
  async lock(id: string, transaction: Transaction) {
    const status = await Status.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE });
    if (!status) throw new NotFoundException('Status not found');
    return status;
  }
}

import { DataTypes as D, Model, Sequelize } from 'sequelize';
import { id, required } from './attributes';

export class Outbox extends Model {
  declare id: string;
  declare kind: 'process' | 'notify';
  declare receiptId: string | null;
  declare payload: Record<string, unknown>;
  declare publishedAt: Date | null;
  declare createdAt: Date;
  static register(sequelize: Sequelize) {
    this.init(
      {
        id,
        kind: required(D.STRING(16)),
        receiptId: D.UUID,
        payload: required(D.JSONB),
        publishedAt: D.DATE,
      },
      { sequelize, tableName: 'outbox' },
    );
  }
}

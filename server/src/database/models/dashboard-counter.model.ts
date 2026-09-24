import { DataTypes as D, Model, Sequelize } from 'sequelize';
import { required } from './attributes';

export class DashboardCounter extends Model {
  declare key: string;
  declare shard: number;
  declare value: string;
  static register(sequelize: Sequelize) {
    this.init(
      {
        key: { ...required(D.TEXT), primaryKey: true },
        shard: { ...required(D.SMALLINT), primaryKey: true },
        value: { ...required(D.BIGINT), defaultValue: 0 },
      },
      { sequelize, tableName: 'dashboard_counters', createdAt: false },
    );
  }
}

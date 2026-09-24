import { DataTypes as D, Model, Sequelize } from 'sequelize';
import { id, required } from './attributes';

export class Status extends Model {
  declare id: string;
  declare name: string;
  declare color: string;
  declare position: number;
  declare archivedAt: Date | null;
  declare version: number;
  static register(sequelize: Sequelize) {
    this.init(
      {
        id,
        name: required(D.STRING(60)),
        color: required(D.STRING(7)),
        position: required(D.INTEGER),
        archivedAt: D.DATE,
        version: { ...required(D.INTEGER), defaultValue: 1 },
      },
      { sequelize, tableName: 'statuses' },
    );
  }
}

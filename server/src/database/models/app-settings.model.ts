import { DataTypes as D, Model, Sequelize } from 'sequelize';
import { required } from './attributes';
export class AppSettings extends Model {
  declare id: number;
  declare defaultStatusId: string;
  declare timezone: string;
  declare catalogVersion: number;
  static register(sequelize: Sequelize) {
    this.init(
      {
        id: { type: D.INTEGER, primaryKey: true },
        defaultStatusId: required(D.UUID),
        timezone: required(D.STRING(80)),
        catalogVersion: required(D.INTEGER),
      },
      { sequelize, tableName: 'app_settings' },
    );
  }
}

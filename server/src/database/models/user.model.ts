import { DataTypes as D, Model, Sequelize } from 'sequelize';
import { id, required } from './attributes';
export class User extends Model {
  declare id: string;
  declare email: string;
  declare meta: { theme?: 'light' | 'dark' | 'system' };
  declare createdAt: Date;
  declare updatedAt: Date;
  static register(sequelize: Sequelize) {
    this.init(
      { id, email: required(D.STRING(254)), meta: { ...required(D.JSONB), defaultValue: {} } },
      { sequelize, tableName: 'users' },
    );
  }
}

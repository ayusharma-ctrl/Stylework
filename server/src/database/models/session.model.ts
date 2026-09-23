import { DataTypes as D, Model, Sequelize } from 'sequelize';
import { id, required } from './attributes';
export class Session extends Model {
  declare id: string;
  declare userId: string;
  declare accessToken: string;
  declare refreshToken: string;
  declare accessExpiresAt: Date;
  declare refreshExpiresAt: Date;
  declare revokedAt: Date | null;
  static register(sequelize: Sequelize) {
    this.init(
      {
        id,
        userId: required(D.UUID),
        accessToken: required(D.TEXT),
        refreshToken: required(D.TEXT),
        accessExpiresAt: required(D.DATE),
        refreshExpiresAt: required(D.DATE),
        revokedAt: D.DATE,
      },
      { sequelize, tableName: 'sessions' },
    );
  }
}

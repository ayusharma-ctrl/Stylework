import { DataTypes as D, Model, Sequelize } from 'sequelize';
import { id, required } from './attributes';
export class WebhookCredential extends Model {
  declare id: string;
  declare name: string;
  declare keyHash: string;
  declare keyPrefix: string;
  declare revokedAt: Date | null;
  declare expiresAt: Date | null;
  declare createdAt: Date;
  static register(sequelize: Sequelize) {
    this.init(
      {
        id,
        name: required(D.STRING(80)),
        keyHash: required(D.STRING(64)),
        keyPrefix: required(D.STRING(12)),
        revokedAt: D.DATE,
        expiresAt: D.DATE,
      },
      { sequelize, tableName: 'webhook_credentials' },
    );
  }
}

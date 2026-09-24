import { DataTypes as D, Model, Sequelize } from 'sequelize';
import { id, required } from './attributes';

export class Lead extends Model {
  declare id: string;
  declare source: string;
  declare externalId: string;
  declare sourceVersion: number;
  declare sourceHash: string;
  declare sourceOccurredAt: Date;
  declare fullName: string;
  declare email: string | null;
  declare phone: string | null;
  declare company: string | null;
  declare campaign: string | null;
  declare metadata: Record<string, unknown>;
  declare statusId: string;
  declare version: number;
  declare createdAt: Date;
  declare updatedAt: Date;
  static register(sequelize: Sequelize) {
    this.init(
      {
        id,
        source: required(D.STRING(32)),
        externalId: required(D.STRING(128)),
        sourceVersion: required(D.INTEGER),
        sourceHash: required(D.STRING(64)),
        sourceOccurredAt: required(D.DATE),
        fullName: required(D.STRING(160)),
        email: D.STRING(254),
        phone: D.STRING(32),
        company: D.STRING(160),
        campaign: D.STRING(160),
        metadata: { ...required(D.JSONB), defaultValue: {} },
        statusId: required(D.UUID),
        version: { ...required(D.INTEGER), defaultValue: 1 },
      },
      { sequelize, tableName: 'leads' },
    );
  }
}

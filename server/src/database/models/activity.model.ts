import { DataTypes as D, Model, Sequelize } from 'sequelize';
import { id, required } from './attributes';
export class Activity extends Model {
  declare id: string;
  declare leadId: string | null;
  declare entityId: string;
  declare entityType: string;
  declare type: string;
  declare actorId: string | null;
  declare actor: Record<string, unknown>;
  declare summary: string;
  declare before: Record<string, unknown> | null;
  declare after: Record<string, unknown> | null;
  declare requestId: string;
  declare createdAt: Date;
  static register(sequelize: Sequelize) {
    this.init(
      {
        id,
        leadId: D.UUID,
        entityId: required(D.UUID),
        entityType: required(D.STRING(24)),
        type: required(D.STRING(40)),
        actorId: D.UUID,
        actor: required(D.JSONB),
        summary: required(D.TEXT),
        before: D.JSONB,
        after: D.JSONB,
        requestId: required(D.UUID),
        createdAt: required(D.DATE),
      },
      { sequelize, tableName: 'activities', updatedAt: false },
    );
  }
}

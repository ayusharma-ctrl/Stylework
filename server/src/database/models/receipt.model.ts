import { DataTypes as D, Model, Sequelize } from 'sequelize';
import { id, required } from './attributes';

export class Receipt extends Model {
  declare id: string;
  declare source: string;
  declare actorId: string | null;
  declare actor: { kind: string; label: string } | null;
  declare eventId: string;
  declare payloadHash: string;
  declare payload: Record<string, unknown>;
  declare state: 'pending' | 'processed' | 'ignored' | 'failed';
  declare attempts: number;
  declare requestId: string;
  declare leadId: string | null;
  declare errorCode: string | null;
  declare errorMessage: string | null;
  declare lastEnqueuedAt: Date | null;
  declare nextAttemptAt: Date;
  declare processedAt: Date | null;
  declare createdAt: Date;
  static register(sequelize: Sequelize) {
    this.init(
      {
        id,
        source: required(D.STRING(32)),
        actorId: D.UUID,
        actor: D.JSONB,
        eventId: required(D.STRING(128)),
        payloadHash: required(D.STRING(64)),
        payload: required(D.JSONB),
        state: { ...required(D.STRING(16)), defaultValue: 'pending' },
        attempts: { ...required(D.INTEGER), defaultValue: 0 },
        requestId: required(D.UUID),
        leadId: D.UUID,
        errorCode: D.STRING(50),
        errorMessage: D.STRING(300),
        lastEnqueuedAt: D.DATE,
        nextAttemptAt: { ...required(D.DATE), defaultValue: D.NOW },
        processedAt: D.DATE,
      },
      { sequelize, tableName: 'webhook_receipts' },
    );
  }
}

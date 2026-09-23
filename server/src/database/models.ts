import { DataTypes as D, Model, Sequelize } from 'sequelize';
export class User extends Model {
  declare id: string; declare email: string; declare meta: { theme?: 'light' | 'dark' | 'system' };
  declare createdAt: Date; declare updatedAt: Date;
}
export class Session extends Model {
  declare id: string; declare userId: string; declare accessToken: string; declare refreshToken: string;
  declare accessExpiresAt: Date; declare refreshExpiresAt: Date; declare revokedAt: Date | null;
}
export class Status extends Model {
  declare id: string; declare name: string; declare color: string; declare position: number;
  declare archivedAt: Date | null; declare version: number;
}
export class Workspace extends Model {
  declare id: number; declare defaultStatusId: string; declare timezone: string; declare catalogVersion: number;
}
export class Lead extends Model {
  declare id: string; declare source: string; declare externalId: string; declare sourceVersion: number;
  declare sourceHash: string; declare sourceOccurredAt: Date; declare fullName: string;
  declare email: string | null; declare phone: string | null; declare company: string | null;
  declare campaign: string | null; declare metadata: Record<string, unknown>;
  declare statusId: string; declare version: number; declare createdAt: Date; declare updatedAt: Date;
}
export class Activity extends Model {
  declare id: string; declare leadId: string | null; declare entityId: string; declare entityType: string;
  declare type: string; declare actorId: string | null; declare actor: Record<string, unknown>;
  declare summary: string; declare before: Record<string, unknown> | null;
  declare after: Record<string, unknown> | null; declare requestId: string; declare createdAt: Date;
}
export class Receipt extends Model {
  declare id: string; declare source: string; declare eventId: string; declare payloadHash: string;
  declare payload: Record<string, unknown>; declare state: 'pending' | 'processed' | 'ignored' | 'failed';
  declare attempts: number; declare requestId: string; declare leadId: string | null;
  declare errorCode: string | null; declare errorMessage: string | null;
  declare lastEnqueuedAt: Date | null; declare nextAttemptAt: Date; declare processedAt: Date | null;
  declare createdAt: Date;
}
export class Outbox extends Model {
  declare id: string; declare kind: 'process' | 'notify'; declare receiptId: string | null;
  declare payload: Record<string, unknown>; declare publishedAt: Date | null; declare createdAt: Date;
}
const id = { type: D.UUID, primaryKey: true, defaultValue: D.UUIDV4 };
const required = (type: any) => ({ type, allowNull: false });
export function registerModels(sequelize: Sequelize) {
  User.init({ id, email: required(D.STRING(254)), meta: { ...required(D.JSONB), defaultValue: {} } }, { sequelize, tableName: 'users' });
  Session.init({ id, userId: required(D.UUID), accessToken: required(D.TEXT), refreshToken: required(D.TEXT), accessExpiresAt: required(D.DATE), refreshExpiresAt: required(D.DATE), revokedAt: D.DATE }, { sequelize, tableName: 'sessions' });
  Status.init({ id, name: required(D.STRING(60)), color: required(D.STRING(7)), position: required(D.INTEGER), archivedAt: D.DATE, version: { ...required(D.INTEGER), defaultValue: 1 } }, { sequelize, tableName: 'statuses' });
  Workspace.init({ id: { type: D.INTEGER, primaryKey: true }, defaultStatusId: required(D.UUID), timezone: required(D.STRING(80)), catalogVersion: required(D.INTEGER) }, { sequelize, tableName: 'workspace_settings' });
  Lead.init({ id, source: required(D.STRING(32)), externalId: required(D.STRING(128)), sourceVersion: required(D.INTEGER), sourceHash: required(D.STRING(64)), sourceOccurredAt: required(D.DATE), fullName: required(D.STRING(160)), email: D.STRING(254), phone: D.STRING(32), company: D.STRING(160), campaign: D.STRING(160), metadata: { ...required(D.JSONB), defaultValue: {} }, statusId: required(D.UUID), version: { ...required(D.INTEGER), defaultValue: 1 } }, { sequelize, tableName: 'leads' });
  Activity.init({ id, leadId: D.UUID, entityId: required(D.UUID), entityType: required(D.STRING(24)), type: required(D.STRING(40)), actorId: D.UUID, actor: required(D.JSONB), summary: required(D.TEXT), before: D.JSONB, after: D.JSONB, requestId: required(D.UUID), createdAt: required(D.DATE) }, { sequelize, tableName: 'activities', updatedAt: false });
  Receipt.init({ id, source: required(D.STRING(32)), eventId: required(D.STRING(128)), payloadHash: required(D.STRING(64)), payload: required(D.JSONB), state: { ...required(D.STRING(16)), defaultValue: 'pending' }, attempts: { ...required(D.INTEGER), defaultValue: 0 }, requestId: required(D.UUID), leadId: D.UUID, errorCode: D.STRING(50), errorMessage: D.STRING(300), lastEnqueuedAt: D.DATE, nextAttemptAt: { ...required(D.DATE), defaultValue: D.NOW }, processedAt: D.DATE }, { sequelize, tableName: 'webhook_receipts' });
  Outbox.init({ id, kind: required(D.STRING(16)), receiptId: D.UUID, payload: required(D.JSONB), publishedAt: D.DATE }, { sequelize, tableName: 'outbox' });
}

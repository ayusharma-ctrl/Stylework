import { Injectable } from '@nestjs/common';
import { Transaction } from 'sequelize';
import { Activity } from '../../database/models';
import { DatabaseService } from '../../database/database.service';
import { shardFor } from './counters.service';
export interface ActivityInput {
  leadId?: string;
  entityId: string;
  entityType: 'lead' | 'status';
  type: string;
  actorId?: string;
  actor: Record<string, unknown>;
  summary: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  requestId: string;
}
@Injectable()
export class AuditService {
  constructor(private readonly db: DatabaseService) {}
  async record(transaction: Transaction, input: ActivityInput) {
    const record = await Activity.create({ ...input, createdAt: new Date() }, { transaction });
    await this.db.sequelize.query(
      "INSERT INTO dashboard_counters(key,shard,value) VALUES('activity',:shard,1) ON CONFLICT(key,shard) DO UPDATE SET value=dashboard_counters.value+1,updated_at=now()",
      { replacements: { shard: shardFor(input.entityId) }, transaction },
    );
    return record;
  }
}

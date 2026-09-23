import { Injectable } from '@nestjs/common';
import { Transaction } from 'sequelize';
import { DatabaseService } from '../../database/database.service';
export function dateKey(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const part = (type: string) => parts.find((p) => p.type === type)!.value;
  return part('year') + '-' + part('month') + '-' + part('day');
}
export function shardFor(id: string) {
  return parseInt(id.replaceAll('-', '').slice(-2), 16) % 64;
}
@Injectable()
export class CountersService {
  constructor(private readonly db: DatabaseService) {}
  private async apply(transaction: Transaction, id: string, changes: Record<string, number>) {
    for (const key of Object.keys(changes).sort()) {
      if (!changes[key]) continue;
      await this.db.sequelize.query(
        'INSERT INTO dashboard_counters(key,shard,value) VALUES(:key,:shard,0) ON CONFLICT DO NOTHING',
        { replacements: { key, shard: shardFor(id) }, transaction },
      );
      await this.db.sequelize.query(
        'UPDATE dashboard_counters SET value = value + :delta, updated_at=now() WHERE key=:key AND shard=:shard',
        { replacements: { key, shard: shardFor(id), delta: changes[key] }, transaction },
      );
    }
  }
  created(transaction: Transaction, id: string, statusId: string, createdAt: Date, timezone: string) {
    return this.apply(transaction, id, {
      total: 1,
      ['status:' + statusId]: 1,
      ['day:' + dateKey(createdAt, timezone)]: 1,
    });
  }
  moved(transaction: Transaction, id: string, previous: string, next: string) {
    return previous === next
      ? Promise.resolve()
      : this.apply(transaction, id, { ['status:' + previous]: -1, ['status:' + next]: 1 });
  }
}

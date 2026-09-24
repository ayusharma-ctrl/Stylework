import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { QueryTypes, Transaction, fn, col } from 'sequelize';
import Redis from 'ioredis';
import { DatabaseService } from '../../database/database.service';
import { Status, AppSettings, DashboardCounter } from '../../database/models';
import { RedisService } from '../../common/security/redis.service';
import { Telemetry } from '../../common/security/telemetry.service';
import { canonicalJson, hash } from '../../common/crypto';
import { dateKey } from '../events/counters.service';
import { DashboardSnapshot } from './dashboard.types';
@Injectable()
export class DashboardService implements OnModuleInit, OnModuleDestroy {
  private subscriber?: Redis;
  private timer?: NodeJS.Timeout;
  private dirty = true;
  private cache?: DashboardSnapshot;
  private cachedAt = 0;
  private computing?: Promise<DashboardSnapshot>;
  private readonly listeners = new Set<{ next: (value: DashboardSnapshot) => void; close: () => void }>();
  constructor(
    private readonly db: DatabaseService,
    private readonly redis: RedisService,
    private readonly telemetry: Telemetry,
  ) {}
  async onModuleInit() {
    this.subscriber = this.redis.client.duplicate({ lazyConnect: true });
    this.subscriber.on('error', () => {
      this.dirty = true;
    });
    this.subscriber.on('message', () => {
      this.dirty = true;
    });
    await this.subscriber.connect();
    await this.subscriber.subscribe('sw:changes');
    this.timer = setInterval(() => {
      if (this.listeners.size && (this.dirty || Date.now() - this.cachedAt >= 30000)) {
        void this.snapshot()
          .then((value) => {
            for (const listener of this.listeners) listener.next(value);
          })
          .catch(() => this.telemetry.log.warn('Dashboard snapshot temporarily unavailable'));
      }
    }, 1000);
  }
  subscribe(next: (value: DashboardSnapshot) => void, close: () => void) {
    const listener = { next, close };
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  snapshot() {
    if (this.cache && Date.now() - this.cachedAt < 1000) return Promise.resolve(this.cache);
    return (this.computing ||= this.compute()
      .then((value) => {
        this.cache = value;
        this.cachedAt = Date.now();
        return value;
      })
      .finally(() => {
        this.computing = undefined;
      }));
  }
  private async compute(): Promise<DashboardSnapshot> {
    this.dirty = false;
    try {
      return await this.db.sequelize.transaction(
        { isolationLevel: Transaction.ISOLATION_LEVELS.REPEATABLE_READ, readOnly: true },
        async (transaction) => {
          const settings = (await AppSettings.findByPk(1, { transaction }))!;
          const statuses = await Status.findAll({
            order: [
              ['position', 'ASC'],
              ['id', 'ASC'],
            ],
            transaction,
          });

          const rows = await DashboardCounter.findAll({
            attributes: ['key', [fn('sum', col('value')), 'value']], group: ['key'], transaction,
          });

          const values = new Map(rows.map((row) => [row.key, Number(row.value)]));

          // Two independent index-top reads in one round trip; Sequelize cannot express this scalar subquery projection.
          const [latest] = await this.db.sequelize.query<{ revision: string }>(
            `SELECT concat(
    (SELECT concat(updated_at::text,id::text) FROM leads ORDER BY updated_at DESC,id DESC LIMIT 1),':',
    (SELECT concat(created_at::text,id::text) FROM activities ORDER BY created_at DESC,id DESC LIMIT 1)
   ) AS revision`,
            { type: QueryTypes.SELECT, transaction },
          );
          const today = dateKey(new Date(), settings.timezone),
            calendar = new Date(today + 'T00:00:00Z');
          calendar.setUTCDate(calendar.getUTCDate() - 1);
          const yesterday = calendar.toISOString().slice(0, 10);
          const total = values.get('total') || 0,
            todayCount = values.get('day:' + today) || 0,
            yesterdayCount = values.get('day:' + yesterday) || 0;
          const difference = yesterdayCount
            ? Math.round(((todayCount - yesterdayCount) / yesterdayCount) * 1000) / 10
            : null;
          const trend = Array.from({ length: 14 }, (_, i) => {
            const date = new Date(today + 'T00:00:00Z');
            date.setUTCDate(date.getUTCDate() - (13 - i));
            const key = date.toISOString().slice(0, 10);
            return {
              date: key,
              label: date.toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' }),
              value: values.get('day:' + key) || 0,
            };
          });
          return {
            generatedAt: new Date().toISOString(),
            timezone: settings.timezone,
            catalogVersion: settings.catalogVersion,
            revision: hash(
              canonicalJson({
                today,
                catalogVersion: settings.catalogVersion,
                latest: latest?.revision,
                values: Object.fromEntries(values),
              }),
            ),
            metrics: [
              {
                key: 'total',
                label: 'Total leads',
                value: total,
                format: 'number',
                description: 'Across all leads',
              },
              {
                key: 'today',
                label: 'Created today',
                value: todayCount,
                format: 'number',
                description: 'Since midnight in ' + settings.timezone,
              },
              {
                key: 'yesterday',
                label: 'Created yesterday',
                value: yesterdayCount,
                format: 'number',
                description: 'Previous calendar day',
              },
              {
                key: 'difference',
                label: 'Day-over-day',
                value: difference,
                format: 'percent',
                description: difference === null ? 'No previous baseline' : 'Today compared with yesterday',
              },
            ],
            statuses: statuses.map((s) => ({
              id: s.id,
              label: s.name,
              color: s.color,
              value: values.get('status:' + s.id) || 0,
              archived: !!s.archivedAt,
              isDefault: s.id === settings.defaultStatusId,
            })),
            trend,
          };
        },
      );
    } catch (error) {
      this.dirty = true;
      throw error;
    }
  }
  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    for (const listener of this.listeners) listener.close();
    this.listeners.clear();
    this.subscriber?.disconnect();
  }
}

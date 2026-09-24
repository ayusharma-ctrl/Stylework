import { Sequelize, QueryTypes } from 'sequelize';
import { SequelizeStorage } from 'umzug';
import { config } from '../src/config/config';
import { createDatabase } from '../src/database/database.service';
import { migrate, legacyMigrationNames } from '../src/database/migrator';
import * as initial from '../src/database/migrations/20260923000000-initial';
import * as credentials from '../src/database/migrations/20260923010000-webhook-credentials';
import * as intake from '../src/database/migrations/20260924000000-single-tenant-intake';
import { seedReference } from '../src/database/seeders/reference';

let admin: Sequelize, db: Sequelize, name: string;
beforeEach(async () => {
  const url = new URL(config.DATABASE_URL);
  if (!/^\/stylework_test_\d+_\d+$/.test(url.pathname))
    throw new Error('Requires isolated integration runner');
  name = url.pathname.slice(1) + '_migrations';
  admin = createDatabase();
  await admin.getQueryInterface().createDatabase(name);
  url.pathname = '/' + name;
  db = createDatabase(url.toString());
});
afterEach(async () => {
  await db?.close();
  if (admin && /^stylework_test_\d+_\d+_migrations$/.test(name)) {
    await admin.getQueryInterface().dropDatabase(name);
  }
  await admin?.close();
});

test('timestamped migrations create the schema, rerun safely and reverse in order', async () => {
  await migrate(db);
  await migrate(db);
  expect(await new SequelizeStorage({ sequelize: db }).executed()).toEqual(
    Object.values(legacyMigrationNames),
  );
  const qi = db.getQueryInterface();
  expect((await qi.describeTable('webhook_receipts')).actor_id).toBeDefined();
  const indexes = (await qi.showIndex('leads')) as unknown as { name: string }[];
  expect(indexes.map((index) => index.name)).toEqual(
    expect.arrayContaining(['leads_created', 'leads_status_created', 'leads_search']),
  );
  await intake.down(qi);
  expect((await qi.describeTable('webhook_receipts')).actor_id).toBeUndefined();
  await credentials.down(qi);
  await initial.down(qi);
  expect(await qi.showAllTables()).toEqual([new SequelizeStorage({ sequelize: db }).model.getTableName()]);
});

test('legacy history is renamed without rerunning DDL or changing application data', async () => {
  const qi = db.getQueryInterface();
  await initial.up(qi);
  await credentials.up(qi);
  await intake.up(qi);
  await seedReference(db);
  const storage = new SequelizeStorage({ sequelize: db });
  for (const name of Object.keys(legacyMigrationNames)) await storage.logMigration({ name });
  await qi.bulkInsert('users', [{ email: 'migration@example.test' }]);
  await qi.bulkUpdate('app_settings', { timezone: 'UTC', catalog_version: 42 }, { id: 1 });
  const users = await db.query('SELECT * FROM users', { type: QueryTypes.SELECT });
  const settings = await db.query('SELECT * FROM app_settings', { type: QueryTypes.SELECT });
  await migrate(db);
  await migrate(db);
  expect(await storage.executed()).toEqual(Object.values(legacyMigrationNames));
  expect(await db.query('SELECT * FROM users', { type: QueryTypes.SELECT })).toEqual(users);
  expect(await db.query('SELECT * FROM app_settings', { type: QueryTypes.SELECT })).toEqual(settings);
});

test('a partially migrated legacy installation applies only its missing migrations', async () => {
  await initial.up(db.getQueryInterface());
  const storage = new SequelizeStorage({ sequelize: db });
  await storage.logMigration({ name: '001-initial' });
  await migrate(db);
  expect(await storage.executed()).toEqual(Object.values(legacyMigrationNames));
  expect(await db.getQueryInterface().showAllTables()).toContain('app_settings');
  expect(await db.getQueryInterface().showAllTables()).not.toContain('workspace_settings');
});

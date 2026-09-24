import { Sequelize, QueryTypes } from 'sequelize';
import { SequelizeStorage } from 'umzug';
import { config } from '../src/config/config';
import { createDatabase } from '../src/database/database.service';
import { migrate } from '../src/database/migrator';
import { initialMigrationNames, migrationNames } from '../src/database/migration-history';
import { seedReference } from '../src/database/seeders/reference';

async function runMigrations(names: readonly string[], direction: 'up' | 'down') {
  for (const name of names) {
    await require('../src/database/migrations/' + name)[direction](db.getQueryInterface());
  }
}

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
  expect(await new SequelizeStorage({ sequelize: db }).executed()).toEqual(migrationNames);
  const qi = db.getQueryInterface();
  expect((await qi.describeTable('webhook_receipts')).actor_id).toBeDefined();
  const indexes = (await qi.showIndex('leads')) as unknown as { name: string }[];
  expect(indexes.map((index) => index.name)).toEqual(
    expect.arrayContaining(['leads_created', 'leads_status_created', 'leads_search']),
  );
  await runMigrations([...migrationNames].reverse(), 'down');
  expect(await qi.showAllTables()).toEqual([new SequelizeStorage({ sequelize: db }).model.getTableName()]);
});

test.each([
  ['001-initial', '002-webhook-credentials', '003-single-tenant-intake'],
  ['20260923000000-initial', '20260923010000-webhook-credentials', '20260924000000-single-tenant-intake'],
])('bundled history %s expands without rerunning DDL or changing data', async (...history) => {
  const qi = db.getQueryInterface();
  await runMigrations(migrationNames, 'up');
  await seedReference(db);
  const storage = new SequelizeStorage({ sequelize: db });
  for (const name of history) await storage.logMigration({ name });
  await qi.bulkInsert('users', [{ email: 'migration@example.test' }]);
  await qi.bulkUpdate('app_settings', { timezone: 'UTC', catalog_version: 42 }, { id: 1 });
  const users = await db.query('SELECT * FROM users', { type: QueryTypes.SELECT });
  const settings = await db.query('SELECT * FROM app_settings', { type: QueryTypes.SELECT });
  await migrate(db);
  await migrate(db);
  expect(await storage.executed()).toEqual(migrationNames);
  expect(await db.query('SELECT * FROM users', { type: QueryTypes.SELECT })).toEqual(users);
  expect(await db.query('SELECT * FROM app_settings', { type: QueryTypes.SELECT })).toEqual(settings);
});

test('a partially migrated legacy installation applies only its missing migrations', async () => {
  await runMigrations(initialMigrationNames, 'up');
  const storage = new SequelizeStorage({ sequelize: db });
  await storage.logMigration({ name: '001-initial' });
  await migrate(db);
  expect(await storage.executed()).toEqual(migrationNames);
  expect(await db.getQueryInterface().showAllTables()).toContain('app_settings');
  expect(await db.getQueryInterface().showAllTables()).not.toContain('workspace_settings');
});

import { Sequelize } from 'sequelize';
import { SequelizeStorage, Umzug } from 'umzug';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { seedReference } from './seeders/reference';

export const legacyMigrationNames = {
  '001-initial': '20260923000000-initial',
  '002-webhook-credentials': '20260923010000-webhook-credentials',
  '003-single-tenant-intake': '20260924000000-single-tenant-intake',
} as const;

export async function migrate(db: Sequelize) {
  const directory = join(__dirname, 'migrations');
  const files = (await readdir(directory)).filter((file) => /^\d{14}-.+\.(ts|js)$/.test(file)).sort();
  const storage = new SequelizeStorage({ sequelize: db });
  const queryInterface = db.getQueryInterface();
  const runner = new Umzug({
    migrations: files.map((file) => ({
      name: file.replace(/\.(ts|js)$/, ''),
      up: () => require(join(directory, file)).up(queryInterface),
      down: () => require(join(directory, file)).down(queryInterface),
    })),
    context: queryInterface,
    storage,
    logger: console,
  });

  // PostgreSQL session locks have no Sequelize API. Use a dedicated direct connection.
  const connection = (await db.connectionManager.getConnection({ type: 'write' })) as any;
  try {
    await connection.query('SELECT pg_advisory_lock(783442001)');
    const executed = new Set(await storage.executed());
    // Rename only bookkeeping entries, never rerun DDL on an existing installation.
    await db.transaction(async (transaction) => {
      for (const [oldName, newName] of Object.entries(legacyMigrationNames)) {
        if (!executed.has(oldName)) continue;
        if (executed.has(newName)) throw new Error('Ambiguous migration history: ' + oldName);
        await queryInterface.bulkUpdate(
          storage.model.getTableName(),
          { name: newName },
          { name: oldName },
          { transaction },
        );
      }
    });
    await runner.up();
    await seedReference(db);
  } finally {
    try {
      await connection.query('SELECT pg_advisory_unlock(783442001)');
    } finally {
      await db.connectionManager.releaseConnection(connection);
    }
  }
}

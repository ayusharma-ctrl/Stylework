import { Op, Sequelize } from 'sequelize';
import { SequelizeStorage, Umzug } from 'umzug';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { seedReference } from './seeders/reference';

import { planMigrationHistory } from './migration-history';

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
    const history = planMigrationHistory(await storage.executed());
    // Expand bundled history atomically, without executing its schema changes again.
    if (history.remove.length) {
      await db.transaction(async (transaction) => {
        const table = storage.model.getTableName();
        await queryInterface.bulkInsert(
          table,
          history.add.map((name) => ({ name })),
          { transaction },
        );
        await queryInterface.bulkDelete(table, { name: { [Op.in]: history.remove } }, { transaction });
      });
    }
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

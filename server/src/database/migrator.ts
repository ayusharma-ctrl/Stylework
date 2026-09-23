import { Sequelize } from 'sequelize';
import { SequelizeStorage, Umzug } from 'umzug';
import { up } from './migrations/001-initial';
import { up as credentials } from './migrations/002-webhook-credentials';
import { up as singleTenant } from './migrations/003-single-tenant-intake';
import { seedReference } from './seeders/reference';
export async function migrate(db: Sequelize) {
  const runner = new Umzug({
    migrations: [
      { name: '001-initial', up: () => up(db) },
      { name: '002-webhook-credentials', up: () => credentials(db) },
      { name: '003-single-tenant-intake', up: () => singleTenant(db) },
    ],
    context: db,
    storage: new SequelizeStorage({ sequelize: db }),
    logger: console,
  });
  // Session lock uses a dedicated direct connection, never a transaction-pooled runtime connection.
  const connection = (await db.connectionManager.getConnection({ type: 'write' })) as any;
  try {
    await connection.query('SELECT pg_advisory_lock(783442001)');
    await runner.up();
    await seedReference(db);
  } finally {
    await connection.query('SELECT pg_advisory_unlock(783442001)');
    await db.connectionManager.releaseConnection(connection);
  }
}

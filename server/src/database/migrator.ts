import { Sequelize } from 'sequelize';
import { SequelizeStorage, Umzug } from 'umzug';
import { up } from './migrations/001-initial';
import { seedReference } from './seeders/reference';
export async function migrate(db: Sequelize) {
  const runner = new Umzug({ migrations: [{ name: '001-initial', up: () => up(db) }], context: db, storage: new SequelizeStorage({ sequelize: db }), logger: console });
  // Session lock uses a dedicated direct connection, never a transaction-pooled runtime connection.
  const connection = await db.connectionManager.getConnection({ type: 'write' }) as any;
  try {
    await connection.query("SELECT pg_advisory_lock(783442001)");
    await runner.up();
    await seedReference(db);
  } finally {
    await connection.query("SELECT pg_advisory_unlock(783442001)");
    await db.connectionManager.releaseConnection(connection);
  }
}

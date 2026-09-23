import 'reflect-metadata';
import { createDatabase } from './database.service';
import { config } from '../config/config';
import { migrate } from './migrator';
import { rebuildCounters, seedDemo } from './seeders/demo';
async function main() {
  // Migrations reserve a session connection for their advisory lock.
  const db = createDatabase(
    config.DATABASE_DIRECT_URL || config.DATABASE_URL,
    Math.max(2, config.DB_POOL_MAX),
  );
  try {
    const command = process.argv[2];
    if (command === 'migrate') await migrate(db);
    else if (command === 'seed') {
      if (config.NODE_ENV === 'production' && process.env.ALLOW_DEMO_SEED !== 'true')
        throw new Error('Demo seeding requires explicit ALLOW_DEMO_SEED in production');
      await seedDemo(db, Number(process.env.SEED_COUNT || 150));
    } else if (command === 'rebuild-counters') await rebuildCounters(db);
    else throw new Error('Expected migrate, seed, or rebuild-counters');
  } finally {
    await db.close();
  }
}
void main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});

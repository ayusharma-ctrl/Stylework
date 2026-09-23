const { Client } = require('pg');
const { spawn } = require('node:child_process');
(async () => {
  const template = new URL(
    process.env.TEST_DATABASE_URL || 'postgres://stylework:stylework@localhost:5438/postgres',
  );
  const redis = new URL(process.env.TEST_REDIS_URL || 'redis://localhost:6388/15');
  if (redis.pathname !== '/15') throw Error('Integration Redis must use dedicated database 15');
  const name = 'stylework_test_' + process.pid + '_' + Date.now();
  const admin = new Client({ connectionString: template.toString() });
  await admin.connect();
  try {
    await admin.query('CREATE DATABASE "' + name + '"');
    template.pathname = '/' + name;
    const child = spawn(
      process.execPath,
      [require.resolve('jest/bin/jest'), '--config', 'test/jest.integration.json', '--runInBand'],
      {
        stdio: 'inherit',
        env: {
          ...process.env,
          NODE_ENV: 'test',
          DATABASE_URL: template.toString(),
          DATABASE_DIRECT_URL: template.toString(),
          REDIS_URL: redis.toString(),
          PORT: '3012',
          LOG_LEVEL: 'silent',
          SIGNIN_IP_LIMIT: '1000',
          SIGNIN_EMAIL_LIMIT: '1000',
          READ_IP_LIMIT: '10000',
          READ_USER_LIMIT: '10000',
          WRITE_IP_LIMIT: '10000',
          WRITE_USER_LIMIT: '10000',
        },
      },
    );
    process.exitCode = await new Promise((resolve) => child.on('exit', (code) => resolve(code ?? 1)));
  } finally {
    if (!/^stylework_test_\d+_\d+$/.test(name)) throw Error('Unsafe test cleanup target');
    await admin.query('DROP DATABASE IF EXISTS "' + name + '" WITH (FORCE)');
    await admin.end();
  }
})().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});

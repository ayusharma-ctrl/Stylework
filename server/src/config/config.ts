import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().default('postgres://stylework:stylework@localhost:5438/stylework'),
  DATABASE_DIRECT_URL: z.string().optional(),
  REDIS_URL: z.string().default('redis://localhost:6388'),
  ACCESS_TOKEN_SECRET: z.string().min(32).default('local-access-secret-change-before-deploy-123'),
  REFRESH_TOKEN_SECRET: z.string().min(32).default('local-refresh-secret-change-before-deploy-123'),
  METRICS_TOKEN: z.string().min(16).default('local-metrics-secret-123'),
  CLIENT_ORIGINS: z.string().default('http://localhost:5173'),
  TRUST_PROXY: z.string().default(''),
  DB_POOL_MAX: z.coerce.number().int().min(1).max(50).default(4),
  WORKER_CONCURRENCY: z.coerce.number().int().min(1).max(100).default(1),
  MAX_PENDING_EVENTS: z.coerce.number().int().positive().default(5000),
  MAX_INFLIGHT_REQUESTS: z.coerce.number().int().min(4).max(1000).default(16),
  // Shared token buckets: requests per IP per minute, independent of user or REST route.
  API_RATE_LIMIT: z.coerce.number().int().positive().default(120),
  WEBHOOK_RATE_LIMIT: z.coerce.number().int().positive().default(60),
  RUN_WORKER: z.enum(['true', 'false']).default('true').transform(value => value === 'true'),
});
export function parseConfig(env: NodeJS.ProcessEnv) {
  const value = schema.parse(env);
  if (value.ACCESS_TOKEN_SECRET === value.REFRESH_TOKEN_SECRET)
    throw new Error('Access and refresh signing secrets must differ');
  if (value.NODE_ENV === 'production') {
    for (const key of ['ACCESS_TOKEN_SECRET', 'REFRESH_TOKEN_SECRET', 'METRICS_TOKEN'] as const) {
      if (!env[key] || value[key].startsWith('local-')) throw new Error(key + ' must be configured securely');
    }
    if (!env.DATABASE_URL || !env.REDIS_URL || !env.CLIENT_ORIGINS)
      throw new Error('Production connection URLs and origins are required');
  }
  return Object.freeze(value);
}
export const config = parseConfig(process.env);

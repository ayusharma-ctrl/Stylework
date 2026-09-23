import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { NestExpressApplication } from '@nestjs/platform-express';
import { QueryTypes } from 'sequelize';
import { bootstrap } from '../src/main';
import { config } from '../src/config/config';
import { createDatabase, DatabaseService } from '../src/database/database.service';
import { migrate } from '../src/database/migrator';
import {
  Activity,
  Lead,
  Outbox,
  Receipt,
  Session,
  User,
  WebhookCredential,
  Workspace,
} from '../src/database/models';
import { AuditService } from '../src/modules/events/audit.service';
import { CountersService } from '../src/modules/events/counters.service';
import { OutboxService } from '../src/modules/events/outbox.service';
import { LeadProcessor } from '../src/modules/jobs/lead-processor.service';
import { JobsService } from '../src/modules/jobs/jobs.service';
import { RedisService } from '../src/common/security/redis.service';
import { Telemetry } from '../src/common/security/telemetry.service';
import { RateLimiter } from '../src/common/security/rate-limiter.service';
import { WebhookCredentialsService } from '../src/modules/webhooks/webhook-credentials.service';
import { DashboardService } from '../src/modules/dashboard/dashboard.service';
import { AuthService } from '../src/modules/auth/auth.service';
let app: NestExpressApplication,
  db: DatabaseService,
  processor: LeadProcessor,
  redis: RedisService,
  credential: { id: string; key: string },
  profile: any;
const email = 'integration@example.test';
const event = (patch: Record<string, unknown> = {}) => ({
  eventId: randomUUID(),
  externalLeadId: randomUUID(),
  version: 1,
  occurredAt: new Date().toISOString(),
  data: {
    fullName: 'Integration Lead',
    email: 'lead@example.test',
    phone: null,
    company: 'Orbit Labs',
    campaign: 'Test',
    metadata: {},
  },
  ...patch,
});
const headers = () => ({
  Authorization: 'Bearer ' + profile.tokens.accessToken,
  'X-Refresh-Token': profile.tokens.refreshToken,
});
const accept = (payload: any, key = credential.key) =>
  request(app.getHttpServer()).post('/webhook/meta-lead').set('X-Webhook-Key', key).send(payload);
async function intake(payload: any) {
  const response = await accept(payload);
  expect(response.status).toBe(202);
  return Receipt.findOne({ where: { eventId: payload.eventId } }).then((row) => row!);
}
async function counts() {
  return db.sequelize.query<{ key: string; value: string }>(
    'SELECT key,sum(value)::text AS value FROM dashboard_counters GROUP BY key ORDER BY key',
    { type: QueryTypes.SELECT },
  );
}
beforeAll(async () => {
  if (!new URL(config.DATABASE_URL).pathname.startsWith('/stylework_test_'))
    throw Error('Use npm run test:integration to create an isolated database');
  const connection = createDatabase();
  await migrate(connection);
  await connection.close();
  app = await bootstrap();
  db = app.get(DatabaseService);
  redis = app.get(RedisService);
  await redis.client.flushdb();
  processor = new LeadProcessor(
    db,
    app.get(AuditService),
    app.get(CountersService),
    app.get(OutboxService),
    app.get(Telemetry),
  );
  credential = await app.get(WebhookCredentialsService).create('Integration');
  profile = (await request(app.getHttpServer()).post('/signin').send({ email })).body.data;
});
afterAll(async () => {
  if (redis) await redis.client.flushdb();
  if (app) await app.close();
});
describe('identity and request protection', () => {
  test('concurrent email registration creates one user', async () => {
    const same = 'concurrent@example.test';
    const responses = await Promise.all(
      Array.from({ length: 10 }, () => request(app.getHttpServer()).post('/signin').send({ email: same })),
    );
    expect(responses.every((r) => r.status === 200)).toBe(true);
    expect(await User.count({ where: { email: same } })).toBe(1);
  });
  test('requires both tokens, validates signatures, types and matching sessions', async () => {
    const other = await app.get(AuthService).signin('another@example.test');
    for (const pair of [
      { Authorization: headers().Authorization },
      { ...headers(), Authorization: 'Bearer invalid' },
      { ...headers(), 'X-Refresh-Token': other.tokens.refreshToken },
      {
        Authorization: 'Bearer ' + profile.tokens.refreshToken,
        'X-Refresh-Token': profile.tokens.refreshToken,
      },
    ])
      expect((await request(app.getHttpServer()).get('/me').set(pair)).status).toBe(401);
  });
  test('expired access renewal converges across concurrent requests', async () => {
    const signed = await app.get(AuthService).signin('renewal@example.test');
    const decoded = jwt.decode(signed.tokens.accessToken) as jwt.JwtPayload;
    const expired = jwt.sign(
      { ...decoded, exp: Math.floor(Date.now() / 1000) - 2 },
      config.ACCESS_TOKEN_SECRET,
    );
    await Session.update(
      { accessToken: expired, accessExpiresAt: new Date(Date.now() - 2000) },
      { where: { id: decoded.sid } },
    );
    const results = await Promise.all(
      Array.from({ length: 12 }, () =>
        request(app.getHttpServer())
          .get('/me')
          .set({ Authorization: 'Bearer ' + expired, 'X-Refresh-Token': signed.tokens.refreshToken }),
      ),
    );
    expect(results.every((r) => r.status === 200)).toBe(true);
    expect(new Set(results.map((r) => r.headers['x-access-token'])).size).toBe(1);
    expect(results[0]!.headers['x-access-token']).toBeTruthy();
    const session = await Session.findByPk(decoded.sid);
    expect(session!.accessToken).toBe(results[0]!.headers['x-access-token']);
    await app.get(AuthService).signout(decoded.sid);
    expect(
      (
        await request(app.getHttpServer())
          .get('/me')
          .set({ Authorization: 'Bearer ' + expired, 'X-Refresh-Token': signed.tokens.refreshToken })
      ).status,
    ).toBe(401);
  });
  test('expired refresh tokens cannot renew', async () => {
    const signed = await app.get(AuthService).signin('expired@example.test');
    const claims = jwt.decode(signed.tokens.refreshToken) as jwt.JwtPayload;
    const expired = jwt.sign(
      { ...claims, exp: Math.floor(Date.now() / 1000) - 1 },
      config.REFRESH_TOKEN_SECRET,
    );
    await expect(app.get(AuthService).authenticate(signed.tokens.accessToken, expired)).rejects.toThrow();
  });
  test('rejects foreign origins, malformed JSON, wrong media type and oversized bodies', async () => {
    expect(
      (await request(app.getHttpServer()).get('/me').set(headers()).set('Origin', 'https://evil.example'))
        .status,
    ).toBe(403);
    expect(
      (await request(app.getHttpServer()).post('/signin').set('Content-Type', 'application/json').send('{'))
        .status,
    ).toBe(400);
    expect(
      (await request(app.getHttpServer()).post('/signin').set('Content-Type', 'text/plain').send('{}'))
        .status,
    ).toBe(415);
    expect((await accept(event({ data: { fullName: 'x'.repeat(70000) } }))).status).toBe(413);
  });
  test('Redis limit is atomic under concurrency and fails closed', async () => {
    const limiter = app.get(RateLimiter),
      key = randomUUID();
    const results = await Promise.allSettled(
      Array.from({ length: 20 }, () => limiter.consume('integration', key, 3, 600000)),
    );
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(3);
    const isolated = new RedisService();
    await isolated.onModuleInit();
    isolated.client.disconnect();
    await expect(new RateLimiter(isolated).consume('isolated', 'a', 1, 1000)).rejects.toMatchObject({
      status: 503,
    });
  });
});
describe('durability, ordering and retries', () => {
  test('database keys are hashed, revocable and expire', async () => {
    const keys = app.get(WebhookCredentialsService),
      key = await keys.create('Revocable');
    const stored = await WebhookCredential.findByPk(key.id);
    expect(stored!.keyHash).not.toBe(key.key);
    expect((await accept(event(), 'bad-key')).status).toBe(401);
    await keys.revoke(key.id);
    expect((await accept(event(), key.key)).status).toBe(401);
    const expired = await keys.create('Expired');
    await WebhookCredential.update({ expiresAt: new Date(0) }, { where: { id: expired.id } });
    expect((await accept(event(), expired.key)).status).toBe(401);
  });
  test('strict snapshot validation requires valid contact and bounded fields', async () => {
    for (const payload of [
      event({ version: 0 }),
      event({ data: { fullName: 'No contact' } }),
      event({ unexpected: true }),
      event({ data: { fullName: 'Bad email', email: 'invalid' } }),
    ])
      expect((await accept(payload)).status).toBe(400);
  });
  test('concurrent duplicates commit one receipt, one lead and one creation audit', async () => {
    const payload = event(),
      responses = await Promise.all(Array.from({ length: 20 }, () => accept(payload)));
    expect(responses.filter((r) => r.status === 202)).toHaveLength(1);
    expect(responses.filter((r) => r.status === 200)).toHaveLength(19);
    const receipt = (await Receipt.findOne({ where: { eventId: payload.eventId } }))!;
    await Promise.all(Array.from({ length: 20 }, () => processor.process(receipt.id)));
    const lead = (await Lead.findOne({ where: { externalId: payload.externalLeadId } }))!;
    expect(lead).toBeTruthy();
    expect(await Activity.count({ where: { leadId: lead.id, type: 'LEAD_CREATED' } })).toBe(1);
    expect((await receipt.reload()).attempts).toBe(1);
    expect(await Outbox.count({ where: { receiptId: receipt.id, kind: 'process' } })).toBe(1);
    expect((await accept({ ...payload, data: { ...payload.data, fullName: 'Conflict' } })).status).toBe(409);
  });
  test('old versions are ignored; equal conflicting versions visibly fail; no-op updates create no audit', async () => {
    const base = event({ version: 5 });
    const first = await intake(base);
    await processor.process(first.id);
    const old = await intake({ ...base, eventId: randomUUID(), version: 4 });
    await processor.process(old.id);
    expect((await old.reload()).state).toBe('ignored');
    const equal = await intake({ ...base, eventId: randomUUID() });
    await processor.process(equal.id);
    expect((await equal.reload()).state).toBe('ignored');
    const conflict = await intake({
      ...base,
      eventId: randomUUID(),
      data: { ...base.data, fullName: 'Conflict' },
    });
    await processor.process(conflict.id);
    expect((await conflict.reload()).errorCode).toBe('SOURCE_VERSION_CONFLICT');
    const noop = await intake({ ...base, eventId: randomUUID(), version: 6 });
    await processor.process(noop.id);
    expect((await noop.reload()).state).toBe('processed');
    const lead = (await Lead.findOne({ where: { externalId: base.externalLeadId } }))!;
    expect(await Activity.count({ where: { leadId: lead.id } })).toBe(1);
  });
  test('new snapshots update contact but preserve a user-selected status', async () => {
    const base = event(),
      first = await intake(base);
    await processor.process(first.id);
    const lead = (await Lead.findOne({ where: { externalId: base.externalLeadId } }))!;
    const target = profile.statuses.find((s: any) => s.id !== lead.statusId);
    expect(
      (
        await request(app.getHttpServer())
          .patch('/leads/' + lead.id + '/status')
          .set(headers())
          .send({ statusId: target.id, expectedVersion: lead.version })
      ).status,
    ).toBe(200);
    const update = await intake({
      ...base,
      eventId: randomUUID(),
      version: 2,
      data: { ...base.data, fullName: 'Updated' },
    });
    await processor.process(update.id);
    await lead.reload();
    expect(lead.fullName).toBe('Updated');
    expect(lead.statusId).toBe(target.id);
    expect(await Activity.count({ where: { leadId: lead.id, type: 'LEAD_UPDATED' } })).toBe(1);
    await processor.process(update.id);
    expect(await Activity.count({ where: { leadId: lead.id, type: 'LEAD_UPDATED' } })).toBe(1);
  });
  test('database failure before receipt commit never acknowledges intake', async () => {
    await db.sequelize.query(
      "CREATE FUNCTION reject_test_outbox() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'injected storage failure'; END; $$; CREATE TRIGGER reject_test_outbox BEFORE INSERT ON outbox FOR EACH ROW EXECUTE FUNCTION reject_test_outbox()",
    );
    const payload = event();
    try {
      expect((await accept(payload)).status).toBe(500);
      expect(await Receipt.count({ where: { eventId: payload.eventId } })).toBe(0);
    } finally {
      await db.sequelize.query(
        'DROP TRIGGER reject_test_outbox ON outbox; DROP FUNCTION reject_test_outbox()',
      );
    }
  });
  test('crash-equivalent fault rolls back lead, audit, counters and notification, then retry succeeds', async () => {
    const payload = event(),
      receipt = await intake(payload),
      before = await counts();
    await db.sequelize.query(
      "CREATE FUNCTION reject_test_counter() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'injected counter failure'; END; $$; CREATE TRIGGER reject_test_counter BEFORE INSERT OR UPDATE ON dashboard_counters FOR EACH ROW EXECUTE FUNCTION reject_test_counter()",
    );
    try {
      await expect(processor.process(receipt.id)).rejects.toThrow();
      expect(await Lead.count({ where: { externalId: payload.externalLeadId } })).toBe(0);
      expect(await Activity.count({ where: { requestId: receipt.requestId } })).toBe(0);
      expect(await counts()).toEqual(before);
      expect((await receipt.reload()).state).toBe('pending');
    } finally {
      await db.sequelize.query(
        'DROP TRIGGER reject_test_counter ON dashboard_counters; DROP FUNCTION reject_test_counter()',
      );
    }
    await processor.process(receipt.id);
    expect((await receipt.reload()).state).toBe('processed');
    expect(receipt.attempts).toBe(2);
  });
  test('audit rows reject update and delete at the database boundary', async () => {
    const row = (await Activity.findOne())!;
    await expect(row.update({ summary: 'rewrite' })).rejects.toThrow();
    await expect(row.destroy()).rejects.toThrow();
  });
});
describe('queries, configuration and live views', () => {
  test('REST/GraphQL parity, bidirectional pagination and cursor binding', async () => {
    const query =
      'query($input:LeadQueryInput){leads(input:$input){nodes{id fullName}pageInfo{startCursor endCursor hasNextPage hasPreviousPage}}}';
    const gql = (input: any) =>
      request(app.getHttpServer()).post('/graphql').set(headers()).send({ query, variables: { input } });
    const first = await gql({ first: 2 }),
      second = await gql({ first: 2, after: first.body.data.leads.pageInfo.endCursor }),
      back = await gql({ last: 2, before: second.body.data.leads.pageInfo.startCursor });
    expect(back.body.data.leads.nodes).toEqual(first.body.data.leads.nodes);
    const rest = await request(app.getHttpServer()).get('/leads?first=2').set(headers());
    expect(rest.body.data.nodes.map((r: any) => r.id)).toEqual(
      first.body.data.leads.nodes.map((r: any) => r.id),
    );
    expect(
      (await gql({ first: 2, search: 'other', after: first.body.data.leads.pageInfo.endCursor })).body.errors,
    ).toBeTruthy();
    expect((await gql({ first: 101 })).body.errors).toBeTruthy();
  });
  test('GraphQL rejects batches, multiple operations, aliases, complexity and unauthenticated reads', async () => {
    const post = (body: any) => request(app.getHttpServer()).post('/graphql').set(headers()).send(body);
    for (const query of [
      'query A {leads{nodes{id}}} query B {leads{nodes{id}}}',
      '{' +
        Array.from({ length: 21 }, (_, i) => 'a' + i + ':leads(input:{first:1}){nodes{id}}').join(' ') +
        '}',
      '{leads(input:{first:100}){nodes{id fullName metadata}}}',
    ]) {
      const response = await post({ query });
      expect(response.status).toBe(400);
      expect(response.body.errors).toBeTruthy();
    }
    expect((await post([{ query: '{leads{nodes{id}}}' }])).status).toBe(400);
    expect(
      (await request(app.getHttpServer()).post('/graphql').send({ query: '{leads{nodes{id}}}' })).body.errors,
    ).toBeTruthy();
  });
  test('simultaneous status updates reject stale version and archive preserves history', async () => {
    const created = await request(app.getHttpServer())
      .post('/statuses')
      .set(headers())
      .send({ name: 'Integration review', color: '#123456' });
    expect(created.status).toBe(201);
    const status = created.body.data;
    const lead = (await Lead.findOne())!;
    const results = await Promise.all(
      [0, 1].map(() =>
        request(app.getHttpServer())
          .patch('/leads/' + lead.id + '/status')
          .set(headers())
          .send({ statusId: status.id, expectedVersion: lead.version }),
      ),
    );
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    const changed = await request(app.getHttpServer())
      .patch('/statuses/' + status.id)
      .set(headers())
      .send({ expectedVersion: 1, isDefault: true });
    expect(changed.status).toBe(200);
    expect(
      (
        await request(app.getHttpServer())
          .delete('/statuses/' + status.id)
          .set(headers())
          .send({ expectedVersion: 2 })
      ).status,
    ).toBe(409);
    expect(
      (
        await request(app.getHttpServer())
          .delete('/statuses/' + status.id)
          .set(headers())
          .send({ expectedVersion: 2, replacementStatusId: profile.workspace.defaultStatusId })
      ).status,
    ).toBe(200);
    await lead.reload();
    expect(lead.statusId).toBe(status.id);
    const audit = await Activity.findOne({
      where: { leadId: lead.id, type: 'STATUS_CHANGED' },
      order: [['createdAt', 'DESC']],
    });
    expect((audit!.after as any).status.name).toBe('Integration review');
  });
  test('SSE delivers an immediate dynamic snapshot and closes on revoked session', async () => {
    const signed = await app.get(AuthService).signin('stream@example.test'),
      claims = jwt.decode(signed.tokens.accessToken) as jwt.JwtPayload,
      abort = new AbortController();
    try {
      const response = await fetch('http://127.0.0.1:' + config.PORT + '/dashboard/stream', {
        headers: {
          Authorization: 'Bearer ' + signed.tokens.accessToken,
          'X-Refresh-Token': signed.tokens.refreshToken,
        },
        signal: abort.signal,
      });
      expect(response.status).toBe(200);
      const reader = response.body!.getReader(),
        chunk = await reader.read(),
        text = new TextDecoder().decode(chunk.value);
      expect(text).toContain('"metrics"');
      expect(text).toContain('Integration review');
      await app.get(AuthService).signout(claims.sid);
      const deadline = setTimeout(() => abort.abort(), 20000);
      try {
        for (;;) {
          if ((await reader.read()).done) break;
        }
      } finally {
        clearTimeout(deadline);
      }
    } finally {
      abort.abort();
    }
  });
  test('dashboard counters match authoritative rows and zero denominator is unavailable', async () => {
    const snapshot = await app.get(DashboardService).snapshot();
    expect(snapshot.metrics.find((m) => m.key === 'total')!.value).toBe(await Lead.count());
    expect(snapshot.statuses.reduce((sum, s) => sum + s.value, 0)).toBe(await Lead.count());
    expect(snapshot.metrics.find((m) => m.key === 'difference')!.value).toBeNull();
  });
  test('reconciles previously dispatched receipts after Redis data loss', async () => {
    const payload = event(),
      receipt = await intake(payload);
    await receipt.update({ lastEnqueuedAt: new Date(Date.now() - 120000) });
    await Outbox.update({ publishedAt: new Date() }, { where: { receiptId: receipt.id } });
    await redis.client.flushdb();
    const jobs = new JobsService(db, redis, processor, app.get(Telemetry));
    await jobs.onModuleInit();
    try {
      const until = Date.now() + 12000;
      while (Date.now() < until) {
        await receipt.reload();
        if (receipt.state !== 'pending') break;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      expect(receipt.state).toBe('processed');
      expect(await Lead.count({ where: { externalId: payload.externalLeadId } })).toBe(1);
    } finally {
      await jobs.stop();
    }
  });
});

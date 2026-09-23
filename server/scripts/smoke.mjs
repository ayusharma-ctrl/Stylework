import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
const base = (process.env.API_URL || 'http://localhost:3000').replace(/\/$/, ''),
  require = createRequire(import.meta.url);
let database, credentials, temporaryKey, headers;
const abort = new AbortController();
async function call(path, method = 'GET', body) {
  const response = await fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  });
  const value = await response.json();
  assert.ok(response.ok, `${method} ${path} returned ${response.status}: ${value.error?.message}`);
  return value.data;
}
try {
  let key = process.env.WEBHOOK_KEY;
  if (!key) {
    const { DatabaseService } = require('../dist/database/database.service');
    const { WebhookCredentialsService } = require('../dist/modules/webhooks/webhook-credentials.service');
    database = new DatabaseService();
    credentials = new WebhookCredentialsService();
    temporaryKey = await credentials.create('Smoke ' + randomUUID());
    key = temporaryKey.key;
  }
  const profile = await call('/signin', 'POST', { email: 'smoke-' + randomUUID() + '@example.test' });
  headers = {
    Authorization: 'Bearer ' + profile.tokens.accessToken,
    'X-Refresh-Token': profile.tokens.refreshToken,
  };
  const stream = await fetch(base + '/dashboard/stream', { headers, signal: abort.signal });
  assert.equal(stream.status, 200);
  const reader = stream.body.getReader();
  let buffer = '';
  async function snapshot() {
    for (;;) {
      const end = buffer.indexOf('\n\n');
      if (end >= 0) {
        const frame = buffer.slice(0, end);
        buffer = buffer.slice(end + 2);
        const data = frame.split('\n').find((line) => line.startsWith('data: '));
        if (data) return JSON.parse(data.slice(6));
      } else {
        const { done, value } = await reader.read();
        assert.ok(!done, 'Stream closed unexpectedly');
        buffer += new TextDecoder().decode(value);
      }
    }
  }
  const deadline = setTimeout(() => abort.abort(), 30000),
    initial = await snapshot();
  const payload = {
    eventId: randomUUID(),
    externalLeadId: 'smoke-' + randomUUID(),
    version: 1,
    occurredAt: new Date().toISOString(),
    data: {
      fullName: 'Smoke Journey',
      email: 'smoke-lead@example.test',
      company: 'Stylework',
      campaign: 'Verification',
      metadata: { smoke: true },
    },
  };
  const accepted = await fetch(base + '/webhook/meta-lead', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Webhook-Key': key },
    body: JSON.stringify(payload),
  });
  assert.equal(accepted.status, 202);
  let receipt;
  const until = Date.now() + 20000;
  do {
    receipt = await call('/webhook-events/' + payload.eventId);
    if (receipt.state !== 'pending') break;
    await new Promise((resolve) => setTimeout(resolve, 200));
  } while (Date.now() < until);
  assert.equal(receipt.state, 'processed');
  const lead = await call('/leads/' + receipt.leadId);
  const status = profile.statuses.find((s) => !s.archivedAt && s.id !== lead.status.id);
  await call('/leads/' + lead.id + '/status', 'PATCH', {
    statusId: status.id,
    expectedVersion: lead.version,
  });
  const gql = await fetch(base + '/graphql', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify({
      query:
        'query($id:ID!){lead(id:$id){id status{id}} activities(input:{leadId:$id,first:10}){nodes{type}}}',
      variables: { id: lead.id },
    }),
  });
  const result = await gql.json();
  assert.ok(!result.errors);
  assert.equal(result.data.lead.status.id, status.id);
  assert.deepEqual(result.data.activities.nodes.map((a) => a.type).sort(), [
    'LEAD_CREATED',
    'STATUS_CHANGED',
  ]);
  let latest = await snapshot();
  while (
    latest.statuses.find((s) => s.id === status.id).value <=
    initial.statuses.find((s) => s.id === status.id).value
  )
    latest = await snapshot();
  clearTimeout(deadline);
  abort.abort();
  await reader.cancel().catch(() => {});
  console.log('PASS smoke: sign-in → durable webhook → worker → lead → status → audit → live dashboard');
} finally {
  abort.abort();
  if (headers) await call('/signout', 'POST', {}).catch(() => {});
  if (temporaryKey) await credentials.revoke(temporaryKey.id);
  if (database) await database.sequelize.close();
}

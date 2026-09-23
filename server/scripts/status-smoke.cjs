const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { bootstrap } = require('../dist/main');
(async () => {
  const app = await bootstrap();
  try {
    const base = 'http://127.0.0.1:' + (process.env.PORT || 3000);
    const signed = await (
      await fetch(base + '/signin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'status-smoke@example.test' }),
      })
    ).json();
    const profile = signed.data;
    assert.ok(profile);
    const headers = {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + profile.tokens.accessToken,
      'X-Refresh-Token': profile.tokens.refreshToken,
    };
    async function request(path, method = 'GET', body) {
      const response = await fetch(base + path, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });
      return { status: response.status, ...(await response.json()) };
    }
    const created = await request('/statuses', 'POST', {
      name: 'Review ' + randomUUID().slice(0, 8),
      color: '#2563eb',
    });
    assert.equal(created.status, 201);
    const status = created.data;
    const list = await request('/leads?first=1');
    const lead = list.data.nodes[0];
    const changes = await Promise.all(
      [0, 1].map(() =>
        request('/leads/' + lead.id + '/status', 'PATCH', {
          statusId: status.id,
          expectedVersion: lead.version,
        }),
      ),
    );
    assert.deepEqual(changes.map((r) => r.status).sort(), [200, 409]);
    const current = await request('/leads/' + lead.id);
    assert.equal(current.data.status.id, status.id);
    const selected = await request('/statuses/' + status.id, 'PATCH', {
      expectedVersion: 1,
      isDefault: true,
    });
    assert.equal(selected.status, 200);
    const rejected = await request('/statuses/' + status.id, 'DELETE', {
      expectedVersion: selected.data.version,
    });
    assert.equal(rejected.status, 409);
    const archived = await request('/statuses/' + status.id, 'DELETE', {
      expectedVersion: selected.data.version,
      replacementStatusId: profile.workspace.defaultStatusId,
    });
    assert.equal(archived.status, 200);
    const retained = await request('/leads/' + lead.id);
    assert.equal(retained.data.status.id, status.id);
    assert.ok(retained.data.status.archivedAt);
    const restored = await request('/leads/' + lead.id + '/status', 'PATCH', {
      statusId: lead.status.id,
      expectedVersion: current.data.version,
    });
    assert.equal(restored.status, 200);
    const catalog = await request('/statuses');
    const items = catalog.data.statuses
      .filter((s) => !s.archivedAt)
      .map((s) => ({ id: s.id, expectedVersion: s.version }));
    const ordered = await request('/statuses/order', 'PATCH', { items });
    assert.equal(ordered.status, 200);
    await request('/signout', 'POST', {});
    console.log(
      'PASS status smoke: concurrent optimistic conflict, default protection, archival without data loss, reorder',
    );
  } finally {
    await app.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

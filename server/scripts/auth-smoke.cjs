const { bootstrap } = require('../dist/main');
(async () => {
  const app = await bootstrap();
  try {
    const base = 'http://127.0.0.1:' + (process.env.PORT || 3000);
    const signin = await fetch(base + '/signin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'smoke@example.test' }),
    });
    if (!signin.ok) throw new Error('Sign-in failed: ' + signin.status);
    const envelope = await signin.json();
    const profile = envelope.data || envelope;
    const headers = {
      Authorization: 'Bearer ' + profile.tokens.accessToken,
      'X-Refresh-Token': profile.tokens.refreshToken,
      'Content-Type': 'application/json',
    };
    const me = await fetch(base + '/me', { headers });
    if (!me.ok) throw new Error('Me failed');
    const out = await fetch(base + '/signout', { method: 'POST', headers, body: '{}' });
    if (!out.ok) throw new Error('Sign-out failed');
    if ((await fetch(base + '/me', { headers })).status !== 401) throw new Error('Revocation failed');
    console.log('PASS auth smoke: signin, profile, signout, revocation');
  } finally {
    await app.close();
  }
})().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});

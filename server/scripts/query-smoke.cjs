const { bootstrap } = require('../dist/main');
(async () => {
  const app = await bootstrap();
  try {
    const base = 'http://127.0.0.1:' + (process.env.PORT || 3000);
    const signed = await fetch(base + '/signin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'query-smoke@example.test' }),
    });
    const { data: profile } = await signed.json();
    if (!profile) throw Error('Sign-in failed');
    const headers = {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + profile.tokens.accessToken,
      'X-Refresh-Token': profile.tokens.refreshToken,
    };
    const query =
      'query Leads($input: LeadQueryInput) { leads(input:$input) { nodes { id fullName status { id name } } pageInfo { startCursor endCursor hasNextPage hasPreviousPage } } }';
    async function gql(document, variables = {}) {
      const r = await fetch(base + '/graphql', {
        method: 'POST',
        headers,
        body: JSON.stringify({ query: document, variables }),
      });
      return r.json();
    }
    const first = await gql(query, { input: { first: 3 } });
    if (first.errors) throw Error(first.errors[0].message);
    const second = await gql(query, { input: { first: 3, after: first.data.leads.pageInfo.endCursor } });
    if (second.errors) throw Error(second.errors[0].message);
    const previous = await gql(query, { input: { last: 3, before: second.data.leads.pageInfo.startCursor } });
    if (previous.errors) throw Error(previous.errors[0].message);
    const ids = (value) => value.data.leads.nodes.map((n) => n.id).join(',');
    if (ids(first) !== ids(previous)) throw Error('Backward pagination mismatch');
    const rest = await (await fetch(base + '/leads?first=3', { headers })).json();
    if (rest.data.nodes.map((n) => n.id).join(',') !== ids(first)) throw Error('REST/GraphQL mismatch');
    const searched = await gql(query, { input: { first: 3, search: 'Orbit' } });
    if (searched.errors || !searched.data.leads.nodes.length) throw Error('Indexed search failed');
    const tooMany = await gql(
      '{' +
        Array.from({ length: 21 }, (_, i) => 'a' + i + ': leads(input:{first:1}) { nodes { id } }').join(
          ' ',
        ) +
        '}',
    );
    if (!tooMany.errors) throw Error('Alias limit not enforced');
    await fetch(base + '/signout', { method: 'POST', headers, body: '{}' });
    console.log('PASS query smoke: REST/GraphQL parity, forward/backward cursors, search, query bounds');
  } finally {
    await app.close();
  }
})().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});

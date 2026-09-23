import { parse } from 'graphql';
import { inspectDocument } from './query-protection';
describe('GraphQL bounds', () => {
  it('rejects multiple operations', () =>
    expect(() => inspectDocument(parse('query A { x } query B { x }'))).toThrow('one operation'));
  it('counts aliases expanded through fragments', () =>
    expect(() =>
      inspectDocument(
        parse(
          'query { ...Many } fragment Many on Query {' +
            Array.from({ length: 21 }, (_, i) => 'a' + i + ':x').join(' ') +
            '}',
        ),
      ),
    ).toThrow('selection limit'));
  it('rejects deeply nested documents', () =>
    expect(() => inspectDocument(parse('{ a { b { c { d { e { f { g { h { i } } } } } } } } }'))).toThrow(
      'depth',
    ));
});

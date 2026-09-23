import { encodeCursor, decodeCursor, paging, validPaging } from './pagination';
describe('pagination cursors', () => {
  const value = {
    v: 1 as const,
    fingerprint: 'test',
    asOf: '2026-09-23T00:00:00.000Z',
    value: 'Alice',
    id: '20000000-0000-4000-8000-000000000001',
  };
  it('roundtrips an authenticated cursor', () => expect(decodeCursor(encodeCursor(value))).toEqual(value));
  it('rejects cursor tampering', () => expect(() => decodeCursor(encodeCursor(value) + 'x')).toThrow());
  it('binds cursors to filters', () =>
    expect(() => paging({ after: encodeCursor(value), search: 'other' })).toThrow('filters'));
});

describe('date range instants', () => {
  it('compares offsets as instants instead of strings', () =>
    expect(validPaging({ createdFrom: '2026-09-24T00:00:00+05:30', createdTo: '2026-09-23T20:00:00Z' })).toBe(
      true,
    ));
  it('rejects an empty or inverted interval', () =>
    expect(validPaging({ createdFrom: '2026-09-24T00:00:00Z', createdTo: '2026-09-24T05:30:00+05:30' })).toBe(
      false,
    ));
});

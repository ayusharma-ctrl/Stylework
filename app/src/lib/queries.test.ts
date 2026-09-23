import { describe, it, expect } from 'vitest';
import { leadsOptions, queryString } from './queries';
describe('lead cache identity', () => {
  it('reuses the sign-in prefetch for the default lead route', () => {
    expect(leadsOptions().queryKey).toEqual(
      leadsOptions({ search: '', sort: 'CREATED_AT', direction: 'DESC' }).queryKey,
    );
  });
});

it('encodes REST ranges, commas and cursor characters without nested query objects', () => {
  const query = new URLSearchParams(
    queryString({
      createdFrom: '2026-09-01T00:00:00+05:30',
      types: ['LEAD_CREATED', 'STATUS_CHANGED'],
      after: 'a+b/c=',
      absent: undefined,
    }),
  );
  expect(query.get('createdFrom')).toBe('2026-09-01T00:00:00+05:30');
  expect(query.get('types')).toBe('LEAD_CREATED,STATUS_CHANGED');
  expect(query.get('after')).toBe('a+b/c=');
  expect(query.has('absent')).toBe(false);
});

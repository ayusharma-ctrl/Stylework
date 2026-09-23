import { describe, it, expect } from 'vitest';
import { leadsOptions } from './queries';
describe('lead cache identity', () => {
  it('reuses the sign-in prefetch for the default lead route', () => {
    expect(leadsOptions().queryKey).toEqual(
      leadsOptions({ search: '', sort: 'CREATED_AT', direction: 'DESC' }).queryKey,
    );
  });
});

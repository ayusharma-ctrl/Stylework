import { dateKey, shardFor } from './counters.service';
describe('dashboard accounting keys', () => {
  it('uses settings calendar boundaries', () => {
    expect(dateKey(new Date('2026-09-22T18:30:00Z'), 'Asia/Kolkata')).toBe('2026-09-23');
    expect(dateKey(new Date('2026-09-22T18:29:59Z'), 'Asia/Kolkata')).toBe('2026-09-22');
  });
  it('matches the SQL last-byte shard expression', () =>
    expect(shardFor('20000000-0000-4000-8000-000000000099')).toBe(25));
});

import { parseConfig } from './config';
describe('configuration', () => {
  it('rejects unsafe production defaults', () =>
    expect(() => parseConfig({ NODE_ENV: 'production' })).toThrow());
  it('bounds database pools', () => expect(() => parseConfig({ DB_POOL_MAX: '10000' })).toThrow());
  it('defaults to a bounded development pool', () => expect(parseConfig({}).DB_POOL_MAX).toBe(10));
});

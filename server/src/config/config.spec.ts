import { parseConfig } from './config';
describe('configuration', () => {
  it('rejects unsafe production defaults', () =>
    expect(() => parseConfig({ NODE_ENV: 'production' })).toThrow());
  it('runs background processing in the API by default', () => expect(parseConfig({}).RUN_WORKER).toBe(true));
  it('allows a separate worker without coercing false to true', () =>
    expect(parseConfig({ RUN_WORKER: 'false' }).RUN_WORKER).toBe(false));
  it('uses two positive IP quotas', () => {
    expect(parseConfig({}).API_RATE_LIMIT).toBe(120);
    expect(parseConfig({}).WEBHOOK_RATE_LIMIT).toBe(60);
    expect(() => parseConfig({ API_RATE_LIMIT: '0' })).toThrow();
  });
  it('bounds database pools', () => expect(() => parseConfig({ DB_POOL_MAX: '10000' })).toThrow());
  it('defaults to a bounded development pool', () => expect(parseConfig({}).DB_POOL_MAX).toBe(4));
});

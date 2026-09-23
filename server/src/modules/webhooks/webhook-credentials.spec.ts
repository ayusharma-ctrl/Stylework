import { WebhookCredentialsService } from './webhook-credentials.service';
import { WebhookCredential } from '../../database/models';
import { hash } from '../../common/crypto';
describe('database webhook credentials', () => {
  const service = new WebhookCredentialsService(),
    key = 'swk_' + 'a'.repeat(43);
  afterEach(() => jest.restoreAllMocks());
  it('requires the explicit key header', async () =>
    expect(service.verify(undefined)).rejects.toThrow('X-Webhook-Key'));
  it('looks up a hash instead of the clear credential', async () => {
    const lookup = jest
      .spyOn(WebhookCredential, 'findOne')
      .mockResolvedValue({ id: 'id', revokedAt: null, expiresAt: null } as any);
    expect((await service.verify(key)).id).toBe('id');
    expect(lookup).toHaveBeenCalledWith({ where: { keyHash: hash(key) } });
  });
  it('rejects revoked keys', async () => {
    jest.spyOn(WebhookCredential, 'findOne').mockResolvedValue({ revokedAt: new Date() } as any);
    await expect(service.verify(key)).rejects.toThrow('inactive');
  });
  it('rejects expired keys', async () => {
    jest.spyOn(WebhookCredential, 'findOne').mockResolvedValue({ expiresAt: new Date(0) } as any);
    await expect(service.verify(key)).rejects.toThrow('inactive');
  });
});

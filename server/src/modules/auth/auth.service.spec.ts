import jwt from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';
import { AuthService } from './auth.service';
import { config } from '../../config/config';
describe('session authentication', () => {
  const uid = randomUUID(),
    sid = randomUUID();
  function token(kind: string, secret: string, session = sid) {
    return jwt.sign({ sub: uid, sid: session, type: kind }, secret, {
      issuer: 'stylework',
      audience: 'stylework-app',
      expiresIn: 60,
    });
  }
  const access = token('access', config.ACCESS_TOKEN_SECRET);
  const refresh = token('refresh', config.REFRESH_TOKEN_SECRET);
  const repository = { find: jest.fn() };
  const users = { find: jest.fn().mockResolvedValue({ id: uid, email: 'person@example.test' }) };
  const service = new AuthService({} as any, repository as any, users as any);
  beforeEach(() =>
    repository.find.mockResolvedValue({
      id: sid,
      userId: uid,
      refreshToken: refresh,
      refreshExpiresAt: new Date(Date.now() + 60000),
      revokedAt: null,
    }),
  );
  it('accepts matching active credentials', async () =>
    expect(await service.authenticate(access, refresh)).toEqual({
      id: uid,
      email: 'person@example.test',
      sessionId: sid,
    }));
  it('rejects tokens from different sessions', async () =>
    expect(
      service.authenticate(access, token('refresh', config.REFRESH_TOKEN_SECRET, randomUUID())),
    ).rejects.toThrow('same session'));
  it('rejects revoked sessions', async () => {
    repository.find.mockResolvedValue({ id: sid, userId: uid, revokedAt: new Date() });
    await expect(service.authenticate(access, refresh)).rejects.toThrow('Please sign in');
  });
  it('rejects an access token in the refresh header', async () =>
    expect(service.authenticate(access, access)).rejects.toThrow('Please sign in'));
  it('rejects validly signed tokens with the wrong type', async () =>
    expect(service.authenticate(token('refresh', config.ACCESS_TOKEN_SECRET), refresh)).rejects.toThrow(
      'Please sign in',
    ));
});

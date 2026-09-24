import { Injectable, UnauthorizedException } from '@nestjs/common';
import { randomUUID, timingSafeEqual } from 'node:crypto';
import jwt, { JwtPayload } from 'jsonwebtoken';
import { Response } from 'express';
import { config } from '../../config/config';
import { DatabaseService } from '../../database/database.service';
import { Session } from '../../database/models';
import { UsersService } from '../users/users.service';
import { AuthRepository } from './auth.repository';
import { Principal } from '../../common/http.types';

const issuer = 'stylework';
const audience = 'stylework-app';

function equal(a: string, b: string) {
  const aa = Buffer.from(a),
    bb = Buffer.from(b);
  return aa.length === bb.length && timingSafeEqual(aa, bb);
}

@Injectable()
export class AuthService {
  constructor(
    private readonly db: DatabaseService,
    private readonly repository: AuthRepository,
    private readonly users: UsersService,
  ) { }

  private token(userId: string, sessionId: string, kind: 'access' | 'refresh', expiresAt: Date) {
    return jwt.sign(
      {
        sub: userId,
        sid: sessionId,
        type: kind,
        jti: randomUUID(),
        exp: Math.floor(expiresAt.getTime() / 1000),
      },
      kind === 'access' ? config.ACCESS_TOKEN_SECRET : config.REFRESH_TOKEN_SECRET,
      { algorithm: 'HS256', issuer, audience },
    );
  }

  async signin(email: string) {
    const user = await this.users.findOrCreate(email);
    const id = randomUUID();
    const now = Date.now();
    const accessExpiresAt = new Date(now + 15 * 60000);
    const refreshExpiresAt = new Date(now + 7 * 86400000);
    const accessToken = this.token(user.id, id, 'access', accessExpiresAt);
    const refreshToken = this.token(user.id, id, 'refresh', refreshExpiresAt);

    await this.repository.create({
      id,
      userId: user.id,
      accessToken,
      refreshToken,
      accessExpiresAt,
      refreshExpiresAt,
    });

    return {
      ...(await this.users.profile(user.id)),
      tokens: { accessToken, refreshToken, accessExpiresAt, refreshExpiresAt },
    };
  }

  private verify(token: string, kind: 'access' | 'refresh') {
    try {
      const value = jwt.verify(
        token,
        kind === 'access' ? config.ACCESS_TOKEN_SECRET : config.REFRESH_TOKEN_SECRET,
        { algorithms: ['HS256'], issuer, audience, ignoreExpiration: kind === 'access' },
      ) as JwtPayload;

      if (
        value.type !== kind ||
        typeof value.sub !== 'string' ||
        typeof value.sid !== 'string' ||
        !Number.isFinite(value.exp) ||
        !Number.isFinite(value.iat)
      ) {
        throw new Error('Invalid claims');
      }

      return value as JwtPayload & { sub: string; sid: string; exp: number };
    } catch {
      throw new UnauthorizedException({ code: 'INVALID_SESSION', message: 'Please sign in again' });
    }
  }

  private valid(session: Session | null, userId: string, refresh: string): asserts session is Session {
    if (
      !session ||
      session.userId !== userId ||
      session.revokedAt ||
      session.refreshExpiresAt.getTime() <= Date.now() ||
      !equal(session.refreshToken, refresh)
    ) {
      throw new UnauthorizedException({ code: 'INVALID_SESSION', message: 'Please sign in again' });
    }
  }

  async authenticate(accessToken: string, refreshToken: string, response?: Response): Promise<Principal> {
    const access = this.verify(accessToken, 'access');
    const refresh = this.verify(refreshToken, 'refresh');

    if (access.sub !== refresh.sub || access.sid !== refresh.sid) {
      throw new UnauthorizedException('Tokens must belong to the same session');
    }

    let session = await this.repository.find(access.sid);
    this.valid(session, access.sub, refreshToken);

    if (access.exp * 1000 <= Date.now()) {
      session = await this.db.sequelize.transaction(async (transaction) => {
        const locked = await this.repository.find(access.sid, transaction);

        this.valid(locked, access.sub, refreshToken);

        if (locked.accessExpiresAt.getTime() <= Date.now() + 1000) {
          const expiry = new Date(Math.min(Date.now() + 15 * 60000, locked.refreshExpiresAt.getTime()));

          await locked.update(
            { accessToken: this.token(locked.userId, locked.id, 'access', expiry), accessExpiresAt: expiry },
            { transaction },
          );
        }

        return locked;
      });

      response?.setHeader('X-Access-Token', session.accessToken);
      response?.setHeader('X-Access-Token-Expires-At', session.accessExpiresAt.toISOString());
    }

    const user = await this.users.find(access.sub);
    return { id: user.id, email: user.email, sessionId: session.id };
  }

  async isActive(sessionId: string) {
    const session = await this.repository.find(sessionId);
    return !!session && !session.revokedAt && session.refreshExpiresAt.getTime() > Date.now();
  }

  async signout(sessionId: string) {
    await this.repository.revoke(sessionId);
    return { signedOut: true };
  }
}

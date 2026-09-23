import { Injectable, UnauthorizedException } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { hash } from '../../common/crypto';
import { WebhookCredential } from '../../database/models';
@Injectable()
export class WebhookCredentialsService {
  async create(name: string, suppliedKey?: string) {
    if (!name.trim() || name.length > 80) throw new Error('Key name must be 1..80 characters');
    const key = suppliedKey || 'swk_' + randomBytes(32).toString('base64url');
    if (key.length < 32 || key.length > 256) throw new Error('Webhook keys must contain 32..256 characters');
    const record = await WebhookCredential.create({
      name: name.trim(),
      keyHash: hash(key),
      keyPrefix: key.slice(0, 12),
    });
    return { id: record.id, name: record.name, key };
  }
  async verify(value: unknown) {
    if (typeof value !== 'string' || value.length < 32 || value.length > 256)
      throw new UnauthorizedException('A valid X-Webhook-Key header is required');
    const record = await WebhookCredential.findOne({ where: { keyHash: hash(value) } });
    if (!record || record.revokedAt || (record.expiresAt && record.expiresAt.getTime() <= Date.now()))
      throw new UnauthorizedException('Invalid or inactive webhook key');
    return record;
  }
  async revoke(id: string) {
    await WebhookCredential.update({ revokedAt: new Date() }, { where: { id } });
  }
  list() {
    return WebhookCredential.findAll({
      attributes: ['id', 'name', 'keyPrefix', 'createdAt', 'expiresAt', 'revokedAt'],
      order: [['createdAt', 'DESC']],
    });
  }
}

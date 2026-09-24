import { Injectable, OnApplicationShutdown, OnModuleInit } from '@nestjs/common';
import Redis from 'ioredis';
import { config } from '../../config/config';

@Injectable()
export class RedisService implements OnModuleInit, OnApplicationShutdown {
  readonly client = new Redis(config.REDIS_URL, {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    commandTimeout: 2000,
    enableOfflineQueue: false,
    retryStrategy: (n) => Math.min(n * 200, 2000),
  });

  constructor() {
    this.client.on('error', () => { });
  }

  async onModuleInit() {
    await this.client.connect();
  }

  async onApplicationShutdown() {
    this.client.disconnect();
  }
}

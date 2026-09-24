import { Injectable, OnApplicationShutdown, OnModuleInit } from '@nestjs/common';
import { Sequelize } from 'sequelize';
import { config } from '../config/config';
import { registerModels } from './models';

export function createDatabase(url = config.DATABASE_URL, poolMax = config.DB_POOL_MAX) {
  return new Sequelize(url, {
    dialect: 'postgres',
    logging: false,
    pool: { min: 0, max: poolMax, idle: 10000, acquire: 5000 },
    retry: { max: 0 },
    dialectOptions: { application_name: 'stylework', statement_timeout: 10000 },
    define: { underscored: true, timestamps: true },
  });
}

@Injectable()
export class DatabaseService implements OnModuleInit, OnApplicationShutdown {
  readonly sequelize = createDatabase();
  constructor() {
    registerModels(this.sequelize);
  }

  async onModuleInit() {
    await this.sequelize.authenticate();
  }

  async onApplicationShutdown() {
    await this.sequelize.close();
  }
}

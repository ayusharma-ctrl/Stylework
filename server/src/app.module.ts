import { Module } from '@nestjs/common';
import { HealthModule } from './modules/health/health.module';
import { APP_GUARD } from '@nestjs/core';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { AuthGuard } from './modules/auth/auth.guard';
@Module({ imports: [DatabaseModule, AuthModule, UsersModule, HealthModule], providers: [{ provide: APP_GUARD, useClass: AuthGuard }] })
export class AppModule {}

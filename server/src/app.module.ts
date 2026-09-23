import { Module } from '@nestjs/common';
import { HealthModule } from './modules/health/health.module';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { AuthGuard } from './modules/auth/auth.guard';
import { SecurityModule } from './common/security/security.module';
import { RateGuard } from './common/security/rate.guard';
import { ResponseInterceptor } from './common/response.interceptor';
import { ErrorFilter } from './common/error.filter';
import { WebhooksModule } from './modules/webhooks/webhooks.module';
import { QueriesModule } from './modules/queries/queries.module';
import { StatusesModule } from './modules/statuses/statuses.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
@Module({
 imports: [DatabaseModule, SecurityModule, AuthModule, UsersModule, HealthModule, WebhooksModule, QueriesModule, StatusesModule, DashboardModule],
 providers: [{ provide: APP_GUARD, useClass: AuthGuard }, { provide: APP_GUARD, useClass: RateGuard }, { provide: APP_INTERCEPTOR, useClass: ResponseInterceptor }, { provide: APP_FILTER, useClass: ErrorFilter }]
})
export class AppModule {}

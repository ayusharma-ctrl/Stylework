import { Module } from '@nestjs/common';
import { HealthModule } from './modules/health/health.module';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { AuthGuard } from './modules/auth/auth.guard';
import { SecurityModule } from './common/security/security.module';
import { config } from './config/config';
import { JobsModule } from './modules/jobs/jobs.module';
import { ResponseInterceptor } from './common/response.interceptor';
import { ErrorFilter } from './common/error.filter';
import { WebhooksModule } from './modules/webhooks/webhooks.module';
import { LeadsModule } from './modules/leads/leads.module';
import { ActivitiesModule } from './modules/activities/activities.module';
import { StatusesModule } from './modules/statuses/statuses.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
@Module({
  imports: [
    DatabaseModule,
    SecurityModule,
    AuthModule,
    UsersModule,
    HealthModule,
    WebhooksModule,
    LeadsModule,
    ActivitiesModule,
    StatusesModule,
    DashboardModule,
    ...(config.RUN_WORKER ? [JobsModule] : []),
  ],
  providers: [
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_INTERCEPTOR, useClass: ResponseInterceptor },
    { provide: APP_FILTER, useClass: ErrorFilter },
  ],
})
export class AppModule {}

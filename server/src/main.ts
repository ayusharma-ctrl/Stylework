import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { config } from './config/config';
import helmet from 'helmet';
import { RequestMiddleware } from './common/security/request.middleware';
import { RuntimeState } from './common/security/runtime-state';

export async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { rawBody: true });
  app.set('trust proxy', config.TRUST_PROXY ? config.TRUST_PROXY.split(',').map(s=>s.trim()) : false);
  app.use(app.get(RequestMiddleware).use);
  app.use(helmet());
  app.enableCors({ origin: config.CLIENT_ORIGINS.split(',').map(s=>new URL(s.trim()).origin), methods: ['GET','POST','PATCH','DELETE','OPTIONS'], allowedHeaders:['Content-Type','Authorization','X-Refresh-Token','X-Webhook-Key-Id','X-Webhook-Timestamp','X-Webhook-Signature'], exposedHeaders:['X-Request-ID','X-Access-Token','X-Access-Token-Expires-At','Retry-After'], credentials:false });
  app.useBodyParser('json', { limit: '64kb', inflate: false });
  const server=app.getHttpServer();
  server.requestTimeout=15000;
  server.headersTimeout=10000;
  server.keepAliveTimeout=5000;
  for(const signal of ['SIGTERM','SIGINT'] as const)process.prependOnceListener(signal,()=>{app.get(RuntimeState).draining=true;});
  app.enableShutdownHooks();
  await app.listen(config.PORT, '0.0.0.0');
  return app;
}
if (require.main === module) void bootstrap();

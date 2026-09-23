import 'reflect-metadata';
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DatabaseModule } from './database/database.module';
import { SecurityModule } from './common/security/security.module';
import { JobsModule } from './modules/jobs/jobs.module';
import { JobsService } from './modules/jobs/jobs.service';
@Module({imports:[DatabaseModule,SecurityModule,JobsModule]})
export class WorkerModule {}
export async function bootstrapWorker() {
 const app=await NestFactory.createApplicationContext(WorkerModule);
 let closing=false;
 const shutdown=async()=>{if(closing)return;closing=true;await app.get(JobsService).stop();await app.close();};
 process.once('SIGINT',()=>void shutdown());process.once('SIGTERM',()=>void shutdown());
 return app;
}
if(require.main===module)void bootstrapWorker();

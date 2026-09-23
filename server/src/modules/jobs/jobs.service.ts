import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Queue, Worker } from 'bullmq';
import Redis from 'ioredis';
import { Op, QueryTypes } from 'sequelize';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { config } from '../../config/config';
import { DatabaseService } from '../../database/database.service';
import { Outbox, Receipt } from '../../database/models';
import { RedisService } from '../../common/security/redis.service';
import { Telemetry } from '../../common/security/telemetry.service';
import { LeadProcessor } from './lead-processor.service';
export const QUEUE_NAME='stylework-leads';
@Injectable()
export class JobsService implements OnModuleInit,OnModuleDestroy {
 private queue!:Queue;private worker!:Worker;private workerRedis!:Redis;
 private timer?:NodeJS.Timeout;private running?:Promise<void>;private lastRecovery=0;private stopping=false;private stopped?:Promise<void>;
 constructor(private readonly db:DatabaseService,private readonly redis:RedisService,private readonly processor:LeadProcessor,private readonly telemetry:Telemetry) {}
 async onModuleInit() {
  this.queue=new Queue(QUEUE_NAME,{connection:this.redis.client as any});
  this.workerRedis=new Redis(config.REDIS_URL,{maxRetriesPerRequest:null});
  this.workerRedis.on('error',()=>{});
  this.worker=new Worker(QUEUE_NAME,job=>this.processor.process(job.data.receiptId),{connection:this.workerRedis as any,concurrency:config.WORKER_CONCURRENCY,lockDuration:30000});
  this.worker.on('error',error=>this.telemetry.log.warn({errorType:error.name},'queue connection or lease error'));
  this.worker.on('failed',job=>this.telemetry.log.warn({receiptId:job?.data.receiptId,attempt:job?.attemptsMade},'queue job failed'));
  await this.queue.waitUntilReady();
  this.timer=setInterval(()=>this.tick(),100);
  this.tick();
 }
 private options(id:string) {return {jobId:id,attempts:8,backoff:{type:'exponential',delay:1000,jitter:0.25},removeOnComplete:{age:3600,count:10000},removeOnFail:{age:604800,count:10000}};}
 private async enqueue(receiptId:string,recovery=false) {
  if(recovery) {
   const existing=await this.queue.getJob(receiptId);
   if(existing) {const state=await existing.getState();if(state==='failed'||state==='completed')await existing.remove();else return;}
  }
  await this.queue.add('lead-upsert',{receiptId},this.options(receiptId));
 }
 private tick() {
  if(this.stopping||this.running)return;
  this.running=this.dispatch().then(async()=>{
   if(Date.now()-this.lastRecovery>5000) {this.lastRecovery=Date.now();await this.reconcile();await this.observe();}
  }).catch(error=>this.telemetry.log.warn({errorType:error instanceof Error?error.name:'unknown'},'outbox cycle will retry')).finally(()=>{this.running=undefined;});
 }
 async dispatch() {
  await this.db.sequelize.transaction(async transaction=>{
   const rows=await Outbox.findAll({where:{publishedAt:null},order:[['createdAt','ASC']],limit:100,transaction,lock:transaction.LOCK.UPDATE,skipLocked:true});
   for(const row of rows) {
    if(row.kind==='process') {
     await this.enqueue(row.receiptId!);
     await Receipt.update({lastEnqueuedAt:new Date()},{where:{id:row.receiptId!,state:'pending'},transaction});
    } else await this.redis.client.publish('sw:changes',JSON.stringify({id:row.id,...row.payload}));
    await row.update({publishedAt:new Date()},{transaction});
   }
  });
 }
 async reconcile() {
  await this.db.sequelize.transaction(async transaction=>{
   const receipts=await Receipt.findAll({where:{state:'pending',nextAttemptAt:{[Op.lte]:new Date()},[Op.or]:[{lastEnqueuedAt:null},{lastEnqueuedAt:{[Op.lt]:new Date(Date.now()-60000)}}]},order:[['createdAt','ASC']],limit:100,transaction,lock:transaction.LOCK.UPDATE,skipLocked:true});
   for(const receipt of receipts) {await this.enqueue(receipt.id,true);await receipt.update({lastEnqueuedAt:new Date()},{transaction});}
  });
 }
 private async observe() {
  const [row]=await this.db.sequelize.query<{count:string;age:string}>("SELECT count(*) AS count,coalesce(extract(epoch FROM now()-min(created_at)),0) AS age FROM webhook_receipts WHERE state='pending'",{type:QueryTypes.SELECT});
  this.telemetry.pending.set(Number(row!.count));this.telemetry.queueAge.set(Number(row!.age));
  await this.redis.client.ping();
  await writeFile(join(tmpdir(),'stylework-worker'),String(Date.now()));
 }
 stop() {
  return this.stopped ||= (async()=>{
   this.stopping=true;if(this.timer)clearInterval(this.timer);
   await this.running;
   if(this.worker) {
    let timer:NodeJS.Timeout|undefined;
    try {await Promise.race([this.worker.close(),new Promise<void>(resolve=>{timer=setTimeout(()=>{void this.worker.close(true).then(resolve);},30000);})]);}
    finally {if(timer)clearTimeout(timer);}
   }
   if(this.queue)await this.queue.close();
   this.workerRedis?.disconnect();
  })();
 }
 onModuleDestroy() {return this.stop();}
}

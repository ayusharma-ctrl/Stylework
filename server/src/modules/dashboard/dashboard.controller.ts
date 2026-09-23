import { Controller,Get,HttpException,Req,Res,ServiceUnavailableException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Response } from 'express';
import { config } from '../../config/config';
import { ApiRequest } from '../../common/http.types';
import { RedisService } from '../../common/security/redis.service';
import { Telemetry } from '../../common/security/telemetry.service';
import { AuthService } from '../auth/auth.service';
import { DashboardService } from './dashboard.service';
const acquire=`
local t=redis.call('TIME');local now=t[1]*1000+math.floor(t[2]/1000)
redis.call('ZREMRANGEBYSCORE',KEYS[1],'-inf',now)
if redis.call('ZCARD',KEYS[1])>=tonumber(ARGV[2]) then return 0 end
redis.call('ZADD',KEYS[1],now+30000,ARGV[1]);redis.call('PEXPIRE',KEYS[1],60000);return 1
`;
const renew=`
local t=redis.call('TIME');local now=t[1]*1000+math.floor(t[2]/1000)
if not redis.call('ZSCORE',KEYS[1],ARGV[1]) then return 0 end
redis.call('ZADD',KEYS[1],now+30000,ARGV[1]);redis.call('PEXPIRE',KEYS[1],60000);return 1
`;
@Controller('dashboard')
export class DashboardController {
 constructor(private readonly dashboard:DashboardService,private readonly redis:RedisService,private readonly auth:AuthService,private readonly telemetry:Telemetry){}
 @Get('stream')
 async stream(@Req() req:ApiRequest,@Res() res:Response){
  const key='sw:sse:'+req.principal!.id,token=randomUUID();
  let granted:unknown;
  try{granted=await this.redis.client.eval(acquire,1,key,token,config.SSE_USER_LIMIT);}catch{throw new ServiceUnavailableException('Stream coordination unavailable');}
  if(!granted){res.setHeader('Retry-After','15');throw new HttpException('Too many active streams',429);}
  let closed=false,heartbeat:NodeJS.Timeout|undefined,lifetime:NodeJS.Timeout|undefined,unsubscribe:()=>unknown=()=>{},counted=false,lastRevision='';
  const close=()=>{
   if(closed)return;closed=true;if(heartbeat)clearInterval(heartbeat);if(lifetime)clearTimeout(lifetime);unsubscribe();
   if(counted)this.telemetry.streams.dec();
   void this.redis.client.zrem(key,token).catch(()=>{});
   if(res.headersSent)res.end();
  };
  res.once('close',close);
  const write=(text:string)=>{if(!closed&&!res.write(text)){close();res.destroy();}};
  try{
   const initial=await this.dashboard.snapshot();
   if(closed)return;
   res.setHeader('Content-Type','text/event-stream');res.setHeader('Cache-Control','no-cache, no-transform');
   res.setHeader('Connection','keep-alive');res.setHeader('X-Accel-Buffering','no');res.flushHeaders();
   this.telemetry.streams.inc();counted=true;
   const send=(snapshot:typeof initial)=>{if(snapshot.revision!==lastRevision){lastRevision=snapshot.revision;write('id: '+snapshot.revision+'\ndata: '+JSON.stringify(snapshot)+'\n\n');}};
   send(initial);unsubscribe=this.dashboard.subscribe(send,close);
   let checking=false;
   heartbeat=setInterval(()=>{
    if(checking)return;checking=true;
    void Promise.all([this.auth.isActive(req.principal!.sessionId),this.redis.client.eval(renew,1,key,token)]).then(([active,lease])=>{if(!active||!lease)close();else write(': heartbeat\n\n');}).catch(close).finally(()=>{checking=false;});
   },15000);
   lifetime=setTimeout(close,5*60000);
  }catch(error){close();throw error;}
 }
}

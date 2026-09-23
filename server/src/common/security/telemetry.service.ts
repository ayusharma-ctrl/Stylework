import { Injectable } from '@nestjs/common';
import { collectDefaultMetrics, Counter, Gauge, Histogram, Registry } from 'prom-client';
import pino from 'pino';
@Injectable()
export class Telemetry {
  readonly log=pino({level:process.env.LOG_LEVEL||'info',redact:['accessToken','refreshToken','authorization','password','payload','email','phone']});
  readonly registry=new Registry();
  readonly requests=new Counter({name:'stylework_http_requests_total',help:'HTTP requests',labelNames:['method','route','status'],registers:[this.registry]});
  readonly duration=new Histogram({name:'stylework_http_duration_seconds',help:'HTTP latency',labelNames:['method','route'],buckets:[.01,.05,.1,.25,.5,1,2,5,10],registers:[this.registry]});
  readonly pending=new Gauge({name:'stylework_pending_events',help:'Durable pending webhook receipts',registers:[this.registry]});
  readonly queueAge=new Gauge({name:'stylework_oldest_event_seconds',help:'Oldest pending receipt age',registers:[this.registry]});
  readonly failures=new Counter({name:'stylework_worker_failures_total',help:'Worker failures',labelNames:['code'],registers:[this.registry]});
  readonly streams=new Gauge({name:'stylework_sse_connections',help:'Local SSE connections',registers:[this.registry]});
  constructor() { collectDefaultMetrics({register:this.registry}); }
}

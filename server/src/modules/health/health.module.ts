import {
  Controller,
  Get,
  Module,
  Req,
  Res,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Public } from '../../common/public.decorator';
import { DatabaseService } from '../../database/database.service';
import { RedisService } from '../../common/security/redis.service';
import { RuntimeState } from '../../common/security/runtime-state';
import { Telemetry } from '../../common/security/telemetry.service';
import { config } from '../../config/config';
import { secureEqual } from '../../common/crypto';
import { QueryTypes } from 'sequelize';
@Public()
@Controller()
class HealthController {
  constructor(
    private readonly db: DatabaseService,
    private readonly redis: RedisService,
    private readonly state: RuntimeState,
    private readonly telemetry: Telemetry,
  ) {}
  @Get('health/live') live() {
    return { status: 'ok' };
  }
  @Get('health/ready') async ready() {
    try {
      if (this.state.draining) throw new Error('draining');
      await Promise.all([this.db.sequelize.authenticate(), this.redis.client.ping()]);
      return { status: 'ready' };
    } catch {
      throw new ServiceUnavailableException('Dependencies unavailable or server draining');
    }
  }
  @Get('metrics') async metrics(@Req() req: Request, @Res() res: Response) {
    if (!secureEqual(req.headers.authorization || '', 'Bearer ' + config.METRICS_TOKEN))
      throw new UnauthorizedException();
    const rows = await this.db.sequelize.query<{
      state: string;
      count: string;
      age: string;
      retries: string;
    }>(
      'SELECT state,count(*) AS count,coalesce(extract(epoch FROM now()-min(created_at)),0) AS age,count(*) FILTER(WHERE attempts>1) AS retries FROM webhook_receipts GROUP BY state',
      { type: QueryTypes.SELECT },
    );
    this.telemetry.pending.set(0);
    this.telemetry.queueAge.set(0);
    let retries = 0;
    for (const state of ['pending', 'processed', 'ignored', 'failed'])
      this.telemetry.receiptStates.set({ state }, 0);
    for (const row of rows) {
      this.telemetry.receiptStates.set({ state: row.state }, Number(row.count));
      retries += Number(row.retries);
      if (row.state === 'pending') {
        this.telemetry.pending.set(Number(row.count));
        this.telemetry.queueAge.set(Number(row.age));
      }
    }
    this.telemetry.retries.set(retries);
    const pool = (this.db.sequelize.connectionManager as any).pool;
    for (const state of ['size', 'available', 'using', 'waiting'])
      this.telemetry.pool.set({ state }, Number(pool?.[state] || 0));
    res.type(this.telemetry.registry.contentType).send(await this.telemetry.registry.metrics());
  }
}
@Module({ controllers: [HealthController] })
export class HealthModule {}

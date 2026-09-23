import { Controller, Get, Module, Req, Res, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { Request, Response } from 'express';
import { Public } from '../../common/public.decorator';
import { DatabaseService } from '../../database/database.service';
import { RedisService } from '../../common/security/redis.service';
import { RuntimeState } from '../../common/security/runtime-state';
import { Telemetry } from '../../common/security/telemetry.service';
import { config } from '../../config/config';
import { secureEqual } from '../../common/crypto';
@Public()
@Controller()
class HealthController {
  constructor(private readonly db:DatabaseService,private readonly redis:RedisService,private readonly state:RuntimeState,private readonly telemetry:Telemetry) {}
  @Get('health/live') live() { return {status:'ok'}; }
  @Get('health/ready') async ready() {
    try {
      if(this.state.draining)throw new Error('draining');
      await Promise.all([this.db.sequelize.authenticate(),this.redis.client.ping()]);
      return {status:'ready'};
    } catch {throw new ServiceUnavailableException('Dependencies unavailable or server draining');}
  }
  @Get('metrics') async metrics(@Req() req:Request,@Res() res:Response) {
    if(!secureEqual(req.headers.authorization||'','Bearer '+config.METRICS_TOKEN))throw new UnauthorizedException();
    res.type(this.telemetry.registry.contentType).send(await this.telemetry.registry.metrics());
  }
}
@Module({ controllers: [HealthController] })
export class HealthModule {}

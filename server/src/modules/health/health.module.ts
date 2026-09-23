import { Controller, Get, Module } from '@nestjs/common';
import { Public } from '../../common/public.decorator';
@Public()
@Controller('health')
class HealthController {
  @Get('live') live() { return { status: 'ok' }; }
}
@Module({ controllers: [HealthController] })
export class HealthModule {}

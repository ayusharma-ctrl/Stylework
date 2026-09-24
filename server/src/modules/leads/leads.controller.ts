import { Controller, Get, Param, Query, Patch, Body, Req } from '@nestjs/common';
import { ZodPipe, uuidSchema } from '../../common/zod.pipe';
import { LeadsService } from './leads.service';
import { LeadStatusService } from './lead-status.service';
import { ApiRequest } from '../../common/http.types';
import { ChangeLeadStatus, changeLeadStatusSchema } from '../statuses/statuses.dto';

@Controller('leads')
export class LeadsController {
  constructor(
    private readonly leads: LeadsService,
    private readonly statuses: LeadStatusService,
  ) { }

  @Get() list(@Query() query: Record<string, unknown>) {
    return this.leads.list(query);
  }

  @Get(':id') find(@Param('id', new ZodPipe(uuidSchema)) id: string) {
    return this.leads.find(id);
  }

  @Patch(':id/status') change(
    @Param('id', new ZodPipe(uuidSchema)) id: string,
    @Body(new ZodPipe(changeLeadStatusSchema)) body: ChangeLeadStatus,
    @Req() req: ApiRequest,
  ) {
    return this.statuses.change(id, body, req.principal!, req.requestId);
  }
}

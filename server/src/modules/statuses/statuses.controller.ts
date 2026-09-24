import { Body, Controller, Delete, Get, Param, Patch, Post, Req } from '@nestjs/common';
import { ApiRequest } from '../../common/http.types';
import { ZodPipe, uuidSchema } from '../../common/zod.pipe';
import { StatusesService } from './statuses.service';
import {
  ArchiveStatus,
  archiveStatusSchema,
  CreateStatus,
  createStatusSchema,
  UpdateStatus,
  updateStatusSchema,
  ReorderStatuses,
  reorderStatusesSchema,
} from './statuses.dto';

@Controller('statuses')
export class StatusesController {
  constructor(private readonly service: StatusesService) { }

  @Get() list() {
    return this.service.list();
  }

  @Post() create(@Body(new ZodPipe(createStatusSchema)) body: CreateStatus, @Req() req: ApiRequest) {
    return this.service.create(body, req.principal!, req.requestId);
  }

  @Patch('order') reorder(
    @Body(new ZodPipe(reorderStatusesSchema)) body: ReorderStatuses,
    @Req() req: ApiRequest,
  ) {
    return this.service.reorder(body, req.principal!, req.requestId);
  }

  @Patch(':id') update(
    @Param('id', new ZodPipe(uuidSchema)) id: string,
    @Body(new ZodPipe(updateStatusSchema)) body: UpdateStatus,
    @Req() req: ApiRequest,
  ) {
    return this.service.update(id, body, req.principal!, req.requestId);
  }

  @Delete(':id') archive(
    @Param('id', new ZodPipe(uuidSchema)) id: string,
    @Body(new ZodPipe(archiveStatusSchema)) body: ArchiveStatus,
    @Req() req: ApiRequest,
  ) {
    return this.service.archive(id, body, req.principal!, req.requestId);
  }
}

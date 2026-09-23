import { Body, Controller, Get, Param, Post, Req, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { Public } from '../../common/public.decorator';
import { ApiRequest } from '../../common/http.types';
import { ZodPipe } from '../../common/zod.pipe';
import { eventIdSchema, webhookSchema, WebhookDto } from './webhook.dto';
import { WebhooksService } from './webhooks.service';
import { WebhookGuard } from './webhook.guard';
@Controller()
export class WebhooksController {
 constructor(private readonly service:WebhooksService) {}
 @Public() @UseGuards(WebhookGuard) @Post('webhook/meta-lead')
 async accept(@Req() req:ApiRequest,@Res({passthrough:true}) res:Response,@Body(new ZodPipe(webhookSchema)) body:WebhookDto) {
  const result=await this.service.accept(body,req.requestId);
  res.status(result.duplicate?200:202);
  return result;
 }
 @Get('webhook-events/:eventId')
 outcome(@Param('eventId',new ZodPipe(eventIdSchema)) eventId:string) {return this.service.outcome(eventId);}
}

import { Controller,Get,Param,Query } from '@nestjs/common';
import { ZodPipe,uuidSchema } from '../../common/zod.pipe';
import { LeadsService } from './leads.service';
@Controller('leads')
export class LeadsController {
 constructor(private readonly leads:LeadsService) {}
 @Get() list(@Query() query:Record<string,unknown>) {return this.leads.list(query);}
 @Get(':id') find(@Param('id',new ZodPipe(uuidSchema)) id:string) {return this.leads.find(id);}
}

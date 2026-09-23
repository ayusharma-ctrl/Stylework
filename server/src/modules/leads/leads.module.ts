import { Module } from '@nestjs/common';
import { LeadsRepository } from './leads.repository';
import { LeadsService } from './leads.service';
import { LeadsController } from './leads.controller';
@Module({controllers:[LeadsController],providers:[LeadsRepository,LeadsService],exports:[LeadsService]})
export class LeadsModule {}

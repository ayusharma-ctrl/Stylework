import { Module } from '@nestjs/common';
import { LeadsRepository } from './leads.repository';
import { LeadsService } from './leads.service';
import { LeadsController } from './leads.controller';
import { LeadStatusService } from './lead-status.service';
import { EventsModule } from '../events/events.module';
@Module({imports:[EventsModule],controllers:[LeadsController],providers:[LeadsRepository,LeadsService,LeadStatusService],exports:[LeadsService]})
export class LeadsModule {}

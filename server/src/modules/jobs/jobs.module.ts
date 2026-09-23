import { Module } from '@nestjs/common';
import { EventsModule } from '../events/events.module';
import { LeadProcessor } from './lead-processor.service';
import { JobsService } from './jobs.service';
@Module({
  imports: [EventsModule],
  providers: [LeadProcessor, JobsService],
  exports: [LeadProcessor, JobsService],
})
export class JobsModule {}

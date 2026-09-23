import { Module } from '@nestjs/common';
import { AuditService } from './audit.service';
import { CountersService } from './counters.service';
import { OutboxService } from './outbox.service';
@Module({
  providers: [AuditService, CountersService, OutboxService],
  exports: [AuditService, CountersService, OutboxService],
})
export class EventsModule {}

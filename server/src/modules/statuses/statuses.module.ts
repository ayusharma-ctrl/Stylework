import { Module } from '@nestjs/common';
import { EventsModule } from '../events/events.module';
import { StatusesController } from './statuses.controller';
import { StatusesRepository } from './statuses.repository';
import { StatusesService } from './statuses.service';

@Module({
  imports: [EventsModule],
  controllers: [StatusesController],
  providers: [StatusesRepository, StatusesService],
  exports: [StatusesService],
})

export class StatusesModule {}

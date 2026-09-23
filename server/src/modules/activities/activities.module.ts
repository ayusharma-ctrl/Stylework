import { ActivitiesController } from './activities.controller';
import { Module } from '@nestjs/common';
import { ActivitiesRepository } from './activities.repository';
import { ActivitiesService } from './activities.service';
@Module({
  controllers: [ActivitiesController],
  providers: [ActivitiesRepository, ActivitiesService],
  exports: [ActivitiesService],
})
export class ActivitiesModule {}

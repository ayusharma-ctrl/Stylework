import { Module } from '@nestjs/common';
import { ActivitiesRepository } from './activities.repository';
import { ActivitiesService } from './activities.service';
@Module({providers:[ActivitiesRepository,ActivitiesService],exports:[ActivitiesService]})
export class ActivitiesModule {}

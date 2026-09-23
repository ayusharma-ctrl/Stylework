import { Controller, Get, Query } from '@nestjs/common';
import { ActivitiesService } from './activities.service';

@Controller('activities')
export class ActivitiesController {
  constructor(private readonly activities: ActivitiesService) {}

  @Get()
  list(@Query() query: Record<string, unknown>) {
    return this.activities.list(query);
  }
}

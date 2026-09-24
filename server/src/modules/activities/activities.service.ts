import { Injectable } from '@nestjs/common';
import { ZodPipe } from '../../common/zod.pipe';
import { activityQuerySchema } from './activities.dto';
import { ActivitiesRepository } from './activities.repository';

@Injectable()
export class ActivitiesService {
  constructor(private readonly repository: ActivitiesRepository) { }

  list(input: unknown) {
    return this.repository.list(new ZodPipe(activityQuerySchema).transform(input));
  }
}

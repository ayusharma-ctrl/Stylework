import { Args, ID, Query, Resolver } from '@nestjs/graphql';
import { LeadsService } from '../leads/leads.service';
import { ActivitiesService } from '../activities/activities.service';
import { ZodPipe, uuidSchema } from '../../common/zod.pipe';
import {
  ActivityConnection,
  ActivityQueryInput,
  LeadConnection,
  LeadQueryInput,
  LeadType,
} from './query.types';
const complexity = ({ args, childComplexity }: any) =>
  Math.min(100, Math.max(1, args.input?.first || args.input?.last || 50)) * childComplexity;
@Resolver()
export class QueriesResolver {
  constructor(
    private readonly leadsService: LeadsService,
    private readonly activitiesService: ActivitiesService,
  ) {}
  @Query(() => LeadConnection, { complexity })
  leads(@Args('input', { type: () => LeadQueryInput, nullable: true }) input?: LeadQueryInput) {
    return this.leadsService.list(input || {});
  }
  @Query(() => LeadType)
  lead(@Args('id', { type: () => ID }, new ZodPipe(uuidSchema)) id: string) {
    return this.leadsService.find(id);
  }
  @Query(() => ActivityConnection, { complexity })
  activities(@Args('input', { type: () => ActivityQueryInput, nullable: true }) input?: ActivityQueryInput) {
    return this.activitiesService.list(input || {});
  }
}

import { z } from 'zod';
import { paginationShape, validPaging } from '../../common/pagination';
export const activityTypes = [
  'LEAD_CREATED',
  'LEAD_UPDATED',
  'STATUS_CHANGED',
  'STATUS_CREATED',
  'STATUS_UPDATED',
  'STATUS_ARCHIVED',
  'DEFAULT_STATUS_CHANGED',
] as const;
export const activityQuerySchema = z
  .object({
    ...paginationShape,
    leadId: z.uuid().optional(),
    actorId: z.uuid().optional(),
    types: z.array(z.enum(activityTypes)).max(10).optional(),
  })
  .strict()
  .refine(validPaging, 'Invalid pagination or date range');
export type ActivityQuery = z.infer<typeof activityQuerySchema>;
export interface ActivityView {
  id: string;
  leadId: string | null;
  entityId: string;
  entityType: string;
  type: string;
  actorId: string | null;
  actor: Record<string, unknown>;
  summary: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  createdAt: string;
  requestId: string;
}

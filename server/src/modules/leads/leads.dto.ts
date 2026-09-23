import { z } from 'zod';
import { paginationShape,validPaging } from '../../common/pagination';
const ids=z.preprocess(v=>typeof v==='string'?v.split(','):v,z.array(z.uuid()).max(50).optional());
export const leadQuerySchema=z.object({...paginationShape,sort:z.enum(['CREATED_AT','UPDATED_AT','NAME']).default('CREATED_AT'),statusIds:ids,source:z.enum(['meta','seed']).optional()}).strict().refine(validPaging,'Invalid pagination or date range');
export type LeadQuery=z.infer<typeof leadQuerySchema>;
export interface LeadView {
 id:string;source:string;externalId:string;sourceVersion:number;fullName:string;email:string|null;phone:string|null;company:string|null;campaign:string|null;metadata:Record<string,unknown>;version:number;createdAt:string;updatedAt:string;
 status:{id:string;name:string;color:string;position:number;archivedAt:string|null;version:number};
}

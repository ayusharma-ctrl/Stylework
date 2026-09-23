import { Injectable, NotFoundException } from '@nestjs/common';
import { QueryTypes } from 'sequelize';
import { DatabaseService } from '../../database/database.service';
import { connection,escapeLike,paging } from '../../common/pagination';
import { LeadQuery,LeadView } from './leads.dto';
const columns=`l.id,l.source,l.external_id AS "externalId",l.source_version AS "sourceVersion",l.full_name AS "fullName",l.email,l.phone,l.company,l.campaign,l.metadata,l.version,l.created_at AS "createdAt",l.updated_at AS "updatedAt",
jsonb_build_object('id',s.id,'name',s.name,'color',s.color,'position',s.position,'archivedAt',s.archived_at,'version',s.version) AS status`;
const sortColumns={CREATED_AT:'l.created_at',UPDATED_AT:'l.updated_at',NAME:'l.full_name'} as const;
function serialize(row:LeadView):LeadView {return {...row,createdAt:new Date(row.createdAt).toISOString(),updatedAt:new Date(row.updatedAt).toISOString()};}
@Injectable()
export class LeadsRepository {
 constructor(private readonly db:DatabaseService) {}
 async find(id:string) {
  const rows=await this.db.sequelize.query<LeadView>('SELECT '+columns+' FROM leads l JOIN statuses s ON s.id=l.status_id WHERE l.id=:id',{type:QueryTypes.SELECT,replacements:{id}});
  if(!rows[0])throw new NotFoundException('Lead not found');
  return serialize(rows[0]);
 }
 async list(input:LeadQuery) {
  const page=paging(input),column=sortColumns[input.sort];
  const where=['l.created_at<=:asOf'],replacements:Record<string,any>={asOf:page.asOf,limit:page.limit+1};
  if(input.search){where.push("l.search_text LIKE :search ESCAPE '\\'");replacements.search='%'+escapeLike(input.search.toLowerCase())+'%';}
  if(input.statusIds?.length){where.push('l.status_id IN (:statusIds)');replacements.statusIds=input.statusIds;}
  if(input.source){where.push('l.source=:source');replacements.source=input.source;}
  if(input.createdFrom){where.push('l.created_at>=:from');replacements.from=input.createdFrom;}
  if(input.createdTo){where.push('l.created_at<:to');replacements.to=input.createdTo;}
  const asc=(input.direction==='ASC')!==page.backward;
  if(page.cursor){where.push('('+column+',l.id) '+(asc?'>':'<')+' (:value,:id)');replacements.value=page.cursor.value;replacements.id=page.cursor.id;}
  const order=asc?'ASC':'DESC';
  const rows=await this.db.sequelize.query<LeadView & {cursorValue:string}>('SELECT '+columns+', '+column+'::text AS "cursorValue" FROM leads l JOIN statuses s ON s.id=l.status_id WHERE '+where.join(' AND ')+' ORDER BY '+column+' '+order+',l.id '+order+' LIMIT :limit',{type:QueryTypes.SELECT,replacements});
  const cursorValues=new Map(rows.map(row=>[row.id,row.cursorValue]));
  return connection(rows.map(({cursorValue,...row})=>serialize(row)),page,row=>cursorValues.get(row.id)!);
 }
}

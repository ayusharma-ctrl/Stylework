import { Injectable } from '@nestjs/common';
import { QueryTypes } from 'sequelize';
import { DatabaseService } from '../../database/database.service';
import { connection, escapeLike, paging } from '../../common/pagination';
import { ActivityQuery, ActivityView } from './activities.dto';
@Injectable()
export class ActivitiesRepository {
  constructor(private readonly db: DatabaseService) {}
  async list(input: ActivityQuery) {
    const page = paging(input),
      where = ['created_at<=:asOf'],
      replacements: Record<string, any> = { asOf: page.asOf, limit: page.limit + 1 };
    if (input.search) {
      where.push("lower(summary) LIKE :search ESCAPE '\\'");
      replacements.search = '%' + escapeLike(input.search.toLowerCase()) + '%';
    }
    if (input.leadId) {
      where.push('lead_id=:leadId');
      replacements.leadId = input.leadId;
    }
    if (input.actorId) {
      where.push('actor_id=:actorId');
      replacements.actorId = input.actorId;
    }
    if (input.types?.length) {
      where.push('type IN (:types)');
      replacements.types = input.types;
    }
    if (input.createdFrom) {
      where.push('created_at>=:from');
      replacements.from = input.createdFrom;
    }
    if (input.createdTo) {
      where.push('created_at<:to');
      replacements.to = input.createdTo;
    }
    const asc = (input.direction === 'ASC') !== page.backward,
      order = asc ? 'ASC' : 'DESC';
    if (page.cursor) {
      where.push('(created_at,id) ' + (asc ? '>' : '<') + ' (:value,:id)');
      replacements.value = page.cursor.value;
      replacements.id = page.cursor.id;
    }
    const rows = await this.db.sequelize.query<ActivityView & { cursorValue: string }>(
      'SELECT id,lead_id AS "leadId",entity_id AS "entityId",entity_type AS "entityType",type,actor_id AS "actorId",actor,summary,before,after,request_id AS "requestId",created_at AS "createdAt",created_at::text AS "cursorValue" FROM activities WHERE ' +
        where.join(' AND ') +
        ' ORDER BY created_at ' +
        order +
        ',id ' +
        order +
        ' LIMIT :limit',
      { type: QueryTypes.SELECT, replacements },
    );
    const cursorValues = new Map(rows.map((row) => [row.id, row.cursorValue]));
    return connection(
      rows.map(({ cursorValue, ...row }) => ({ ...row, createdAt: new Date(row.createdAt).toISOString() })),
      page,
      (row) => cursorValues.get(row.id)!,
    );
  }
}

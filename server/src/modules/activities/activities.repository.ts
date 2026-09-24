import { Injectable } from '@nestjs/common';
import { Op, cast, col, fn, literal, where, WhereOptions, Attributes } from 'sequelize';
import { DatabaseService } from '../../database/database.service';
import { Activity } from '../../database/models';
import { connection, escapeLike, paging } from '../../common/pagination';
import { ActivityQuery, ActivityView } from './activities.dto';
@Injectable()
export class ActivitiesRepository {
  constructor(private readonly db: DatabaseService) {}

  async list(input: ActivityQuery) {
    const page = paging(input);
    const filters: WhereOptions<Attributes<Activity>>[] = [{ createdAt: { [Op.lte]: page.asOf } }];
    if (input.search)
      filters.push(
        where(fn('lower', col('summary')), { [Op.like]: '%' + escapeLike(input.search.toLowerCase()) + '%' }),
      );
    if (input.leadId) filters.push({ leadId: input.leadId });
    if (input.actorId) filters.push({ actorId: input.actorId });
    if (input.types?.length) filters.push({ type: { [Op.in]: input.types } });
    if (input.createdFrom) filters.push({ createdAt: { [Op.gte]: input.createdFrom } });
    if (input.createdTo) filters.push({ createdAt: { [Op.lt]: input.createdTo } });
    const asc = (input.direction === 'ASC') !== page.backward;
    const order = asc ? 'ASC' : 'DESC';
    if (page.cursor) {
      // Tuple range seeks preserve index efficiency and PostgreSQL timestamp precision.
      const escape = (value: string) => this.db.sequelize.escape(value);
      filters.push(
        literal(
          '(created_at,id) ' +
            (asc ? '>' : '<') +
            ' (' +
            escape(page.cursor.value) +
            ',' +
            escape(page.cursor.id) +
            ')',
        ),
      );
    }
    const rows = await Activity.findAll({
      attributes: { include: [[cast(col('created_at'), 'text'), 'cursorValue']] },
      where: { [Op.and]: filters },
      order: [
        ['createdAt', order],
        ['id', order],
      ],
      limit: page.limit + 1,
    });
    const cursors = new Map(rows.map((row) => [row.id, row.get('cursorValue') as string]));
    const nodes = rows.map((row) => {
      const { cursorValue, ...value } = row.get({ plain: true });
      return { ...value, createdAt: row.createdAt.toISOString() } as ActivityView;
    });
    return connection(nodes, page, (row) => cursors.get(row.id)!);
  }
}

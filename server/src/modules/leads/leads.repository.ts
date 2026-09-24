import { Injectable, NotFoundException } from '@nestjs/common';
import { Op, cast, col, literal, WhereOptions, Attributes } from 'sequelize';
import { DatabaseService } from '../../database/database.service';
import { Lead, Status } from '../../database/models';
import { connection, escapeLike, paging } from '../../common/pagination';
import { LeadQuery, LeadView } from './leads.dto';

const attributes = [
  'id',
  'source',
  'externalId',
  'sourceVersion',
  'fullName',
  'email',
  'phone',
  'company',
  'campaign',
  'metadata',
  'version',
  'createdAt',
  'updatedAt',
];

const include = [
  {
    model: Status,
    as: 'status',
    required: true,
    attributes: ['id', 'name', 'color', 'position', 'archivedAt', 'version'],
  },
];

const sortColumns = { CREATED_AT: 'created_at', UPDATED_AT: 'updated_at', NAME: 'full_name' } as const;

function serialize(model: Lead): LeadView {
  const row = model.get({ plain: true }) as any;
  delete row.cursorValue;
  return {
    ...row,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    status: { ...row.status, archivedAt: row.status.archivedAt?.toISOString() ?? null },
  };
}

@Injectable()
export class LeadsRepository {
  constructor(private readonly db: DatabaseService) { }

  async find(id: string) {
    const lead = await Lead.findByPk(id, { attributes, include });
    if (!lead) throw new NotFoundException('Lead not found');
    return serialize(lead);
  }

  async list(input: LeadQuery) {
    const page = paging(input);
    const column = sortColumns[input.sort];
    const filters: WhereOptions<Attributes<Lead>>[] = [{ createdAt: { [Op.lte]: page.asOf } }];

    if (input.search) {
      filters.push({ search_text: { [Op.like]: '%' + escapeLike(input.search.toLowerCase()) + '%' } });
    }

    if (input.statusIds?.length) filters.push({ statusId: { [Op.in]: input.statusIds } });
    if (input.source) filters.push({ source: input.source });
    if (input.createdFrom) filters.push({ createdAt: { [Op.gte]: input.createdFrom } });
    if (input.createdTo) filters.push({ createdAt: { [Op.lt]: input.createdTo } });

    const asc = (input.direction === 'ASC') !== page.backward;

    if (page.cursor) {
      // Sequelize 6 has no tuple-comparison operator. Keep a single index range seek;
      // comparing via JS Date would also truncate PostgreSQL microseconds.
      const escape = (value: string) => this.db.sequelize.escape(value);
      filters.push(
        literal(
          '("Lead"."' +
          column +
          '","Lead"."id") ' +
          (asc ? '>' : '<') +
          ' (' +
          escape(page.cursor.value) +
          ',' +
          escape(page.cursor.id) +
          ')',
        ),
      );
    }

    const order = asc ? 'ASC' : 'DESC';

    const rows = await Lead.findAll({
      attributes: [...attributes, [cast(col('Lead.' + column), 'text'), 'cursorValue']],
      include,
      where: { [Op.and]: filters },
      order: [
        [col('Lead.' + column), order],
        ['id', order],
      ],
      limit: page.limit + 1,
    });

    const cursors = new Map(rows.map((row) => [row.id, row.get('cursorValue') as string]));

    return connection(rows.map(serialize), page, (row) => cursors.get(row.id)!);
  }
}

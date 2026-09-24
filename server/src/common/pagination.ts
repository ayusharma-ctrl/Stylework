import { BadRequestException } from '@nestjs/common';
import { createHmac } from 'node:crypto';
import { z } from 'zod';
import { config } from '../config/config';
import { canonicalJson, hash, secureEqual } from './crypto';

export const paginationShape = {
  first: z.coerce.number().int().min(1).max(100).optional(),
  last: z.coerce.number().int().min(1).max(100).optional(),
  after: z.string().max(2048).optional(),
  before: z.string().max(2048).optional(),
  search: z.string().trim().max(100).default(''),
  direction: z.enum(['ASC', 'DESC']).default('DESC'),
  createdFrom: z.iso
    .datetime({ offset: true })
    .transform((value) => new Date(value).toISOString())
    .optional(),
  createdTo: z.iso
    .datetime({ offset: true })
    .transform((value) => new Date(value).toISOString())
    .optional(),
};

export function validPaging(v: {
  first?: number;
  last?: number;
  after?: string;
  before?: string;
  createdFrom?: string;
  createdTo?: string;
}) {
  return (
    !(v.first && v.last) &&
    !(v.after && v.before) &&
    !(v.first && v.before) &&
    !(v.last && v.after) &&
    !(v.createdFrom && v.createdTo && Date.parse(v.createdFrom) >= Date.parse(v.createdTo))
  );
}

const cursorSchema = z
  .object({
    v: z.literal(1),
    fingerprint: z.string(),
    asOf: z.iso.datetime(),
    value: z.string(),
    id: z.uuid(),
  })
  .strict();

type Cursor = z.infer<typeof cursorSchema>;

export interface PageInfo {
  startCursor: string | null;
  endCursor: string | null;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface Connection<T> {
  nodes: T[];
  pageInfo: PageInfo;
}

const signature = (body: string) =>
  createHmac('sha256', config.ACCESS_TOKEN_SECRET)
    .update('cursor.v1.' + body)
    .digest('base64url');

export function encodeCursor(value: Cursor) {
  const body = Buffer.from(JSON.stringify(value)).toString('base64url');
  return body + '.' + signature(body);
}

export function decodeCursor(token: string) {
  try {
    const [body, sig, ...extra] = token.split('.');
    if (!body || !sig || extra.length || !secureEqual(signature(body), sig)) throw Error();
    return cursorSchema.parse(JSON.parse(Buffer.from(body, 'base64url').toString()));
  } catch {
    throw new BadRequestException({
      code: 'INVALID_CURSOR',
      message: 'This pagination cursor is invalid; refresh the list',
    });
  }
}

export function paging(input: Record<string, any>) {
  const { first, last, after, before, ...filter } = input;
  const fingerprint = hash(canonicalJson(filter));
  const cursor = after || before ? decodeCursor(after || before) : undefined;

  if (cursor && cursor.fingerprint !== fingerprint)
    throw new BadRequestException('Cursor does not match the current filters');

  return {
    limit: (last || first || 50) as number,
    backward: !!(last || before),
    cursor,
    asOf: cursor?.asOf || new Date().toISOString(),
    fingerprint,
  };
}

export function connection<T extends { id: string }>(
  rows: T[],
  page: ReturnType<typeof paging>,
  value: (row: T) => string,
): Connection<T> {
  const extra = rows.length > page.limit;

  let nodes = rows.slice(0, page.limit);

  if (page.backward) nodes = nodes.reverse();

  const make = (row: T) =>
    encodeCursor({ v: 1, fingerprint: page.fingerprint, asOf: page.asOf, value: value(row), id: row.id });

  return {
    nodes,
    pageInfo: {
      startCursor: nodes[0] ? make(nodes[0]) : null,
      endCursor: nodes.at(-1) ? make(nodes.at(-1)!) : null,
      hasNextPage: page.backward ? !!page.cursor : extra,
      hasPreviousPage: page.backward ? extra : !!page.cursor,
    },
  };
}

export function escapeLike(value: string) {
  return value.replace(/[\\%_]/g, '\\$&');
}

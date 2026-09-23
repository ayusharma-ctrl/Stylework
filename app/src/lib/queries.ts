import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query';
import { api } from './api';
import type { Activity, Connection, Lead, Profile } from './types';
export const meOptions = queryOptions({
  queryKey: ['me'],
  queryFn: ({ signal }) => api<Profile>('/me', { signal }),
});
export function queryString(values: Record<string, unknown>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined || value === null || (Array.isArray(value) && !value.length)) continue;
    params.set(key, Array.isArray(value) ? value.join(',') : String(value));
  }
  return params.toString();
}
type Cursor = { after?: string; before?: string };
export function leadsOptions(filters: Record<string, unknown> = {}) {
  const normalized = { search: '', sort: 'CREATED_AT', direction: 'DESC', ...filters };
  return infiniteQueryOptions({
    queryKey: ['leads', normalized],
    initialPageParam: {} as Cursor,
    maxPages: 20,
    staleTime: Infinity,
    queryFn: ({ pageParam, signal }) =>
      api<Connection<Lead>>(
        '/leads?' +
          queryString({ ...normalized, ...pageParam, ...(pageParam.before ? { last: 50 } : { first: 50 }) }),
        { signal },
      ),
    getNextPageParam: (last): Cursor | undefined =>
      last.pageInfo.hasNextPage ? { after: last.pageInfo.endCursor! } : undefined,
    getPreviousPageParam: (first): Cursor | undefined =>
      first.pageInfo.hasPreviousPage ? { before: first.pageInfo.startCursor! } : undefined,
  });
}
export const leadOptions = (id: string) =>
  queryOptions({
    queryKey: ['lead', id],
    queryFn: ({ signal }) => api<Lead>('/leads/' + encodeURIComponent(id), { signal }),
  });
export function activitiesOptions(filters: Record<string, unknown> = {}) {
  return infiniteQueryOptions({
    queryKey: ['activities', filters],
    initialPageParam: {} as Cursor,
    maxPages: 20,
    staleTime: Infinity,
    queryFn: ({ pageParam, signal }) =>
      api<Connection<Activity>>(
        '/activities?' +
          queryString({ ...filters, ...pageParam, ...(pageParam.before ? { last: 25 } : { first: 25 }) }),
        { signal },
      ),
    getNextPageParam: (last): Cursor | undefined =>
      last.pageInfo.hasNextPage ? { after: last.pageInfo.endCursor! } : undefined,
    getPreviousPageParam: (first): Cursor | undefined =>
      first.pageInfo.hasPreviousPage ? { before: first.pageInfo.startCursor! } : undefined,
  });
}

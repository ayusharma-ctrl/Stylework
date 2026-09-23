import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { ArrowUpRight, ListFilter, Plus } from 'lucide-react';
import { leadsOptions, meOptions } from '../lib/queries';
import { usePreferences } from '../lib/store';
import { date, initials } from '../lib/utils';
import { FilterBar, dateFilters } from '../components/filters';
import { VirtualList } from '../components/virtual-list';
import { Empty, ErrorState, Loading } from '../components/feedback';
import { RefreshNotice } from '../components/refresh-notice';
import { Button } from '../components/ui/button';
import { AddLeadDialog } from '../components/add-lead-dialog';
export default function LeadsPage() {
  const [adding, setAdding] = useState(false);
  const [params] = useSearchParams(),
    { data: profile } = useQuery(meOptions);
  const compact = usePreferences((s) => s.users[profile?.user.id || '']?.compact || false),
    setCompact = usePreferences((s) => s.setCompact);
  const filters = useMemo(
    () => ({
      ...dateFilters(params),
      search: params.get('q') || '',
      sort:
        params.get('sort') === 'name'
          ? 'NAME'
          : params.get('sort') === 'updated'
            ? 'UPDATED_AT'
            : 'CREATED_AT',
      direction: ['oldest', 'name'].includes(params.get('sort') || '') ? 'ASC' : 'DESC',
      ...(params.get('status') ? { statusIds: [params.get('status')] } : {}),
    }),
    [params],
  );
  const query = useInfiniteQuery(leadsOptions(filters)),
    rows = useMemo(
      () =>
        Array.from(
          new Map(query.data?.pages.flatMap((page) => page.nodes).map((row) => [row.id, row])).values(),
        ),
      [query.data],
    );
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">YOUR NEXT OPPORTUNITY</span>
          <h1>All leads</h1>
          <p>People, possibilities, and the next step forward.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setAdding(true)}>
            <Plus size={16} />
            Add lead
          </Button>
          <Button
            variant="outline"
            onClick={() => profile && setCompact(profile.user.id, !compact)}
            aria-pressed={compact}
          >
            <ListFilter size={16} />
            {compact ? 'Comfortable view' : 'Compact view'}
          </Button>
        </div>
      </div>
      <AddLeadDialog open={adding} onOpenChange={setAdding} />
      <section className="panel">
        <FilterBar statuses={profile?.statuses} />
        <RefreshNotice refresh={() => query.refetch()} />
        <div className="lead-grid lead-table-heading">
          <span>NAME / CONTACT</span>
          <span className="lead-company">COMPANY</span>
          <span>STATUS</span>
          <span className="lead-campaign">CAMPAIGN</span>
          <span className="lead-date">CREATED</span>
          <span />
        </div>
        {query.isPending ? (
          <Loading />
        ) : query.error ? (
          <ErrorState error={query.error} retry={() => void query.refetch()} />
        ) : !rows.length ? (
          <Empty />
        ) : (
          <VirtualList
            key={JSON.stringify(filters)}
            rows={rows}
            rowHeight={compact ? 60 : 76}
            label="Lead list"
            hasNext={query.hasNextPage}
            hasPrevious={query.hasPreviousPage}
            fetching={query.isFetching}
            next={() => query.fetchNextPage()}
            previous={() => query.fetchPreviousPage()}
            renderRow={(lead) => (
              <Link to={'/leads/' + lead.id} className="lead-grid lead-row">
                <span className="flex min-w-0 items-center gap-3">
                  <span className="avatar">{initials(lead.fullName)}</span>
                  <span className="min-w-0">
                    <strong className="block truncate">{lead.fullName}</strong>
                    <small className="block truncate">{lead.email || lead.phone}</small>
                  </span>
                </span>
                <span className="lead-company truncate">{lead.company || '—'}</span>
                <span>
                  <span className="status-badge">
                    <span style={{ background: lead.status.color }} />
                    {lead.status.name}
                  </span>
                </span>
                <span className="lead-campaign truncate">{lead.campaign || '—'}</span>
                <span className="lead-date">{date(lead.createdAt)}</span>
                <ArrowUpRight size={16} />
              </Link>
            )}
          />
        )}
      </section>
    </>
  );
}

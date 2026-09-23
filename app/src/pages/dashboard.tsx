import {
  ArrowRight,
  ArrowUpRight,
  ChartNoAxesCombined,
  Clock3,
  UsersRound,
  CalendarDays,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useDashboard } from '../lib/dashboard';
import { leadsOptions } from '../lib/queries';
import { date, initials, number } from '../lib/utils';
import { Button } from '../components/ui/button';
import { Loading, Empty, ErrorState } from '../components/feedback';
const icons = [UsersRound, ChartNoAxesCombined, CalendarDays, ArrowUpRight];
export default function DashboardPage() {
  const { data } = useDashboard(),
    leads = useInfiniteQuery(leadsOptions());
  const now = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }).format(
    new Date(),
  );
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">A LITTLE CLARITY FOR YOUR DAY</span>
          <h1>Overview</h1>
          <p>Your pipeline at a glance. Every opportunity accounted for.</p>
        </div>
        <span className="date-pill">
          <CalendarDays size={16} />
          {now}
        </span>
      </div>
      {!data ? (
        <Loading />
      ) : (
        <>
          <div className="metrics-grid">
            {data.metrics.map((metric, i) => {
              const Icon = icons[i % icons.length];
              return (
                <section key={metric.key} className="metric-card">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-muted-foreground">{metric.label}</span>
                    <span className={'metric-icon tone-' + i}>
                      <Icon size={19} />
                    </span>
                  </div>
                  <div className="metric-value">
                    {metric.value === null
                      ? '—'
                      : number(metric.value) + (metric.format === 'percent' ? '%' : '')}
                  </div>
                  <p>{metric.description}</p>
                </section>
              );
            })}
          </div>
          <div className="dashboard-grid">
            <section className="panel">
              <div className="panel-heading">
                <div>
                  <h2>Lead momentum</h2>
                  <p>A look at the last 14 days</p>
                </div>
                <span className="subtle-pill">
                  <span className="h-2 w-2 rounded-full bg-primary" />
                  New leads
                </span>
              </div>
              <div
                className="chart"
                role="img"
                aria-label={'Daily leads: ' + data.trend.map((d) => d.label + ' ' + d.value).join(', ')}
              >
                {[0, 1, 2, 3].map((i) => (
                  <div className="chart-gridline" key={i} style={{ bottom: i * 30 + 9 + '%' }} />
                ))}
                <div className="chart-bars">
                  {data.trend.map((point, index) => (
                    <div className="chart-column" key={point.date}>
                      <span
                        className="chart-bar"
                        title={point.label + ': ' + number(point.value)}
                        style={{
                          height:
                            Math.max(2, (point.value / Math.max(1, ...data.trend.map((p) => p.value))) * 90) +
                            '%',
                          opacity: index === data.trend.length - 1 ? 1 : 0.35 + index / 30,
                        }}
                      />
                      <small>{index % 3 === 0 || index === 13 ? point.label : ''}</small>
                    </div>
                  ))}
                </div>
              </div>
              <div className="panel-foot">
                <Clock3 size={13} />
                Calendar days in {data.timezone}
              </div>
            </section>
            <section className="panel">
              <div className="panel-heading">
                <div>
                  <h2>Pipeline breakdown</h2>
                  <p>Every lead has a place</p>
                </div>
                <Link className="icon-link" to="/settings" aria-label="Manage statuses">
                  <ArrowUpRight size={19} />
                </Link>
              </div>
              <div className="pipeline-list">
                {data.statuses
                  .filter((s) => !s.archived || s.value > 0)
                  .map((status) => (
                    <Link key={status.id} to={'/leads?status=' + status.id} className="pipeline-item">
                      <div className="flex items-center justify-between gap-3">
                        <span className="flex min-w-0 items-center gap-2 text-sm">
                          <span className="status-dot" style={{ background: status.color }} />
                          <span className="truncate">
                            {status.label}
                            {status.archived ? ' · archived' : ''}
                          </span>
                        </span>
                        <strong className="text-sm">{number(status.value)}</strong>
                      </div>
                      <div className="progress-track">
                        <span
                          style={{
                            background: status.color,
                            width:
                              Math.max(
                                0,
                                (status.value /
                                  Math.max(
                                    1,
                                    data.statuses.reduce((sum, s) => sum + s.value, 0),
                                  )) *
                                  100,
                              ) + '%',
                          }}
                        />
                      </div>
                    </Link>
                  ))}
              </div>
            </section>
          </div>
        </>
      )}
      <section className="panel mt-6">
        <div className="panel-heading">
          <div>
            <h2>Fresh opportunities</h2>
            <p>The latest arrivals in your pipeline</p>
          </div>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/leads">
              View all leads
              <ArrowRight size={15} />
            </Link>
          </Button>
        </div>
        {leads.isPending ? (
          <Loading />
        ) : leads.error ? (
          <ErrorState error={leads.error} retry={() => void leads.refetch()} />
        ) : !leads.data.pages[0].nodes.length ? (
          <Empty
            title="Your next opportunity is on its way"
            description="Leads will appear here as they arrive."
          />
        ) : (
          <div className="recent-list">
            {leads.data.pages[0].nodes.slice(0, 5).map((lead) => (
              <Link to={'/leads/' + lead.id} key={lead.id} className="recent-row">
                <span className="avatar">{initials(lead.fullName)}</span>
                <div className="min-w-0 flex-1">
                  <strong>{lead.fullName}</strong>
                  <p>{lead.company || lead.email || lead.phone}</p>
                </div>
                <span className="status-badge">
                  <span style={{ background: lead.status.color }} />
                  {lead.status.name}
                </span>
                <span className="recent-date">{date(lead.createdAt)}</span>
                <ArrowUpRight size={17} className="text-muted-foreground" />
              </Link>
            ))}
          </div>
        )}
      </section>
    </>
  );
}

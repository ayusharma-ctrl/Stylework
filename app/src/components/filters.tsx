import { useEffect, useState } from 'react';
import { Search, X } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { Input, Select } from './ui/input';
import { Button } from './ui/button';
import type { Status } from '../lib/types';
export function useFilters() {
  const [params, setParams] = useSearchParams();
  const update = (key: string, value: string) =>
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        if (value) next.set(key, value);
        else next.delete(key);
        return next;
      },
      { replace: true },
    );
  return { params, update, clear: () => setParams({}) };
}
export function dateFilters(params: URLSearchParams) {
  const from = params.get('from'),
    to = params.get('to');
  const valid = (value: string | null) =>
    value && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(new Date(value).getTime());
  return {
    ...(valid(from) ? { createdFrom: new Date(from + 'T00:00:00+05:30').toISOString() } : {}),
    ...(valid(to)
      ? { createdTo: new Date(new Date(to + 'T00:00:00+05:30').getTime() + 86400000).toISOString() }
      : {}),
  };
}
export function SearchBox({
  value,
  onChange,
  placeholder = 'Search names, email, company…',
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  useEffect(() => {
    if (text === value) return;
    const timer = setTimeout(() => onChange(text), 350);
    return () => clearTimeout(timer);
  }, [text, value, onChange]);
  return (
    <div className="search-box">
      <Search size={17} />
      <Input
        type="search"
        aria-label="Search"
        placeholder={placeholder}
        maxLength={100}
        value={text}
        onChange={(event) => setText(event.target.value)}
      />
    </div>
  );
}
export function FilterBar({ statuses, activity = false }: { statuses?: Status[]; activity?: boolean }) {
  const { params, update, clear } = useFilters();
  return (
    <div className="filter-bar">
      <SearchBox
        value={params.get('q') || ''}
        onChange={(value) => update('q', value)}
        placeholder={activity ? 'Search activity…' : undefined}
      />
      {statuses && (
        <Select
          aria-label="Filter by status"
          value={params.get('status') || ''}
          onChange={(e) => update('status', e.target.value)}
        >
          <option value="">All statuses</option>
          {statuses.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
              {s.archivedAt ? ' (archived)' : ''}
            </option>
          ))}
        </Select>
      )}
      {activity && (
        <Select
          aria-label="Filter by activity type"
          value={params.get('type') || ''}
          onChange={(e) => update('type', e.target.value)}
        >
          <option value="">All activity</option>
          {[
            'LEAD_CREATED',
            'LEAD_UPDATED',
            'STATUS_CHANGED',
            'STATUS_CREATED',
            'STATUS_UPDATED',
            'STATUS_ARCHIVED',
            'DEFAULT_STATUS_CHANGED',
          ].map((type) => (
            <option key={type} value={type}>
              {type.toLowerCase().replaceAll('_', ' ')}
            </option>
          ))}
        </Select>
      )}
      <Select
        aria-label="Sort results"
        value={params.get('sort') || 'newest'}
        onChange={(e) => update('sort', e.target.value)}
      >
        <option value="newest">Newest first</option>
        <option value="oldest">Oldest first</option>
        {!activity && (
          <>
            <option value="name">Name A–Z</option>
            <option value="updated">Recently updated</option>
          </>
        )}
      </Select>
      <label className="date-filter">
        From
        <Input
          type="date"
          aria-label="Created from"
          value={params.get('from') || ''}
          onChange={(e) => update('from', e.target.value)}
        />
      </label>
      <label className="date-filter">
        To
        <Input
          type="date"
          aria-label="Created through"
          value={params.get('to') || ''}
          onChange={(e) => update('to', e.target.value)}
        />
      </label>
      {params.size > 0 && (
        <Button variant="ghost" size="icon" aria-label="Clear filters" onClick={clear}>
          <X size={16} />
        </Button>
      )}
    </div>
  );
}

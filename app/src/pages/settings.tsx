import { useState, type FormEvent } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, Archive, Check, Monitor, Moon, Pencil, Plus, Sun } from 'lucide-react';
import { api, json, queryClient } from '../lib/api';
import { meOptions } from '../lib/queries';
import { usePreferences } from '../lib/store';
import type { Status, Theme } from '../lib/types';
import { Button } from '../components/ui/button';
import { Input, Select } from '../components/ui/input';
import { Modal } from '../components/ui/dialog';
import { ErrorState, Loading } from '../components/feedback';
import '../styles/settings.css';
type Edit = { status?: Status; name: string; color: string };
export default function SettingsPage() {
  const profile = useQuery(meOptions),
    { theme, setTheme } = usePreferences();
  const [edit, setEdit] = useState<Edit | null>(null),
    [archive, setArchive] = useState<Status | null>(null);
  const [replacement, setReplacement] = useState(''),
    [showArchived, setShowArchived] = useState(false);
  const mutation = useMutation({
    mutationFn: ({ path, method, body }: { path: string; method: string; body: unknown }) =>
      api(path, { method, body: json(body) }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['me'] });
      await queryClient.invalidateQueries({ queryKey: ['activities'] });
      setEdit(null);
      setArchive(null);
    },
    onError: () => {
      void queryClient.invalidateQueries({ queryKey: ['me'] });
    },
  });
  if (profile.isPending) return <Loading />;
  if (profile.error) return <ErrorState error={profile.error} retry={() => void profile.refetch()} />;
  const { statuses, workspace } = profile.data,
    active = statuses.filter((s) => !s.archivedAt);
  function save(event: FormEvent) {
    event.preventDefault();
    if (!edit) return;
    mutation.mutate({
      path: '/statuses' + (edit.status ? '/' + edit.status.id : ''),
      method: edit.status ? 'PATCH' : 'POST',
      body: {
        name: edit.name.trim(),
        color: edit.color,
        ...(edit.status ? { expectedVersion: edit.status.version } : {}),
      },
    });
  }
  function reorder(index: number, step: number) {
    const sorted = [...active];
    [sorted[index], sorted[index + step]] = [sorted[index + step], sorted[index]];
    mutation.mutate({
      path: '/statuses/order',
      method: 'PATCH',
      body: { items: sorted.map((s) => ({ id: s.id, expectedVersion: s.version })) },
    });
  }
  function chooseTheme(next: Theme) {
    setTheme(next);
    void api('/me', { method: 'PATCH', body: json({ theme: next }) }).catch(() => {});
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">MAKE ROOM FOR YOUR WORKFLOW</span>
          <h1>Workspace settings</h1>
          <p>A pipeline that works the way your team does.</p>
        </div>
      </div>
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Lead statuses</h2>
            <p>New leads start in the default status.</p>
          </div>
          <Button
            onClick={() => {
              mutation.reset();
              setEdit({ name: '', color: '#3765e5' });
            }}
          >
            <Plus size={16} />
            Add status
          </Button>
        </div>
        {mutation.error && !edit && !archive && (
          <div className="px-5 pb-4">
            <ErrorState error={mutation.error} />
          </div>
        )}
        <div>
          {active.map((status, index) => (
            <div key={status.id} className="status-setting-row">
              <span className="status-swatch" style={{ background: status.color }} />
              <div className="min-w-0 flex-1">
                <strong>{status.name}</strong>
                {workspace.defaultStatusId === status.id && (
                  <span className="default-badge">
                    <Check size={11} />
                    Default
                  </span>
                )}
              </div>
              <div className="status-actions">
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={index === 0 || mutation.isPending}
                  aria-label={'Move ' + status.name + ' up'}
                  onClick={() => reorder(index, -1)}
                >
                  <ArrowUp size={14} />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={index === active.length - 1 || mutation.isPending}
                  aria-label={'Move ' + status.name + ' down'}
                  onClick={() => reorder(index, 1)}
                >
                  <ArrowDown size={14} />
                </Button>
                {workspace.defaultStatusId !== status.id && (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={mutation.isPending}
                    onClick={() =>
                      mutation.mutate({
                        path: '/statuses/' + status.id,
                        method: 'PATCH',
                        body: { expectedVersion: status.version, isDefault: true },
                      })
                    }
                  >
                    Set default
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={mutation.isPending}
                  aria-label={'Edit ' + status.name}
                  onClick={() => {
                    mutation.reset();
                    setEdit({ status, name: status.name, color: status.color });
                  }}
                >
                  <Pencil size={15} />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={mutation.isPending || active.length === 1}
                  aria-label={'Archive ' + status.name}
                  onClick={() => {
                    mutation.reset();
                    setReplacement(active.find((s) => s.id !== status.id)?.id || '');
                    setArchive(status);
                  }}
                >
                  <Archive size={15} />
                </Button>
              </div>
            </div>
          ))}
        </div>
        <div className="settings-note">
          <p>
            Archiving keeps existing leads and their history intact, and removes the status from new
            assignments.
          </p>
          <Button variant="ghost" size="sm" onClick={() => setShowArchived(!showArchived)}>
            {showArchived ? 'Hide' : 'Show'} archived statuses ({statuses.length - active.length})
          </Button>
        </div>
        {showArchived && (
          <div className="px-6 pb-5">
            {statuses
              .filter((s) => s.archivedAt)
              .map((status) => (
                <div
                  key={status.id}
                  className="flex items-center gap-3 border-t border-border py-3 text-sm text-muted-foreground"
                >
                  <span className="status-dot" style={{ background: status.color }} />
                  {status.name}
                  <span className="ml-auto text-xs">Archived</span>
                </div>
              ))}
            {statuses.length === active.length && (
              <p className="text-sm text-muted-foreground">No archived statuses.</p>
            )}
          </div>
        )}
      </section>
      <section className="panel mt-6">
        <div className="panel-heading">
          <div>
            <h2>Appearance</h2>
            <p>Settle into a workspace that feels right.</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-3 px-6 pb-6">
          {(
            [
              { key: 'light', label: 'Light', icon: Sun },
              { key: 'dark', label: 'Dark', icon: Moon },
              { key: 'system', label: 'System', icon: Monitor },
            ] as const
          ).map(({ key, label, icon: Icon }) => (
            <Button
              key={key}
              variant={theme === key ? 'default' : 'outline'}
              onClick={() => chooseTheme(key)}
              aria-pressed={theme === key}
            >
              <Icon size={17} />
              {label}
            </Button>
          ))}
        </div>
      </section>
      <Modal
        open={!!edit}
        onOpenChange={(open) => {
          if (!open) setEdit(null);
        }}
        title={edit?.status ? 'Edit status' : 'Create a status'}
        description="Give this stage a clear name and a recognizable color."
      >
        {edit && (
          <form className="space-y-5" onSubmit={save}>
            <label className="block text-sm font-medium">
              Status name
              <Input
                className="mt-2"
                required
                maxLength={60}
                value={edit.name}
                onChange={(e) => setEdit({ ...edit, name: e.target.value })}
                placeholder="e.g. In conversation"
              />
            </label>
            <label className="flex items-center gap-4 text-sm font-medium">
              Color
              <input
                type="color"
                aria-label="Status color"
                className="h-10 w-14 rounded border border-border bg-card p-1"
                value={edit.color}
                onChange={(e) => setEdit({ ...edit, color: e.target.value })}
              />
              <span className="text-xs text-muted-foreground">{edit.color}</span>
            </label>
            {mutation.error && <ErrorState error={mutation.error} />}
            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => setEdit(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? 'Saving…' : 'Save status'}
              </Button>
            </div>
          </form>
        )}
      </Modal>
      <Modal
        open={!!archive}
        onOpenChange={(open) => {
          if (!open) setArchive(null);
        }}
        title={'Archive ' + (archive?.name || 'status') + '?'}
        description="Existing leads, dashboard counts and history are preserved. This status will no longer be available for new assignments."
      >
        {archive && (
          <div className="space-y-5">
            {archive.id === workspace.defaultStatusId && (
              <label className="block text-sm font-medium">
                New default status
                <Select
                  className="mt-2 w-full"
                  value={replacement}
                  onChange={(e) => setReplacement(e.target.value)}
                >
                  {active
                    .filter((s) => s.id !== archive.id)
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                </Select>
              </label>
            )}
            {mutation.error && <ErrorState error={mutation.error} />}
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setArchive(null)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                disabled={mutation.isPending}
                onClick={() =>
                  mutation.mutate({
                    path: '/statuses/' + archive.id,
                    method: 'DELETE',
                    body: {
                      expectedVersion: archive.version,
                      ...(archive.id === workspace.defaultStatusId
                        ? { replacementStatusId: replacement }
                        : {}),
                    },
                  })
                }
              >
                Archive status
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}

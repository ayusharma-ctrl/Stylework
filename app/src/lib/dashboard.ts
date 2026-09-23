import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchEventSource } from '@microsoft/fetch-event-source';
import { z } from 'zod';
import { API, authHeaders, clearSession, queryClient, renew } from './api';
import { useSession } from './store';
import type { Dashboard, Profile } from './types';
const snapshotSchema = z.object({
  revision: z.string(),
  generatedAt: z.string(),
  timezone: z.string(),
  catalogVersion: z.number(),
  metrics: z.array(
    z.object({
      key: z.string(),
      label: z.string(),
      value: z.number().nullable(),
      format: z.enum(['number', 'percent']),
      description: z.string(),
    }),
  ),
  statuses: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      color: z.string().regex(/^#[\da-fA-F]{6}$/),
      value: z.number(),
      archived: z.boolean(),
      isDefault: z.boolean(),
    }),
  ),
  trend: z.array(z.object({ date: z.string(), label: z.string(), value: z.number() })),
});
export function useDashboard() {
  return useQuery<Dashboard>({
    queryKey: ['dashboard'],
    queryFn: () => Promise.reject(new Error('Waiting for live connection')),
    enabled: false,
    staleTime: Infinity,
  });
}
export function useDashboardStream() {
  const connectedSession = useSession((state) => state.tokens?.refreshToken);
  const [state, setState] = useState<'connecting' | 'live' | 'reconnecting'>('connecting');
  useEffect(() => {
    if (!connectedSession) return;
    const abort = new AbortController();
    let attempts = 0,
      timer: ReturnType<typeof setTimeout>;
    async function connect() {
      if (abort.signal.aborted) return;
      try {
        await fetchEventSource(API + '/dashboard/stream', {
          headers: authHeaders() as Record<string, string>,
          signal: abort.signal,
          openWhenHidden: false,
          async onopen(response) {
            renew(response);
            if (response.status === 401) {
              clearSession();
              abort.abort();
              throw Error('Session expired');
            }
            if (!response.ok || !response.headers.get('content-type')?.includes('text/event-stream'))
              throw Error('Connection unavailable');
            attempts = 0;
            setState('live');
          },
          onmessage(event) {
            if (!event.data) return;
            const parsed = snapshotSchema.safeParse(JSON.parse(event.data));
            if (!parsed.success) throw Error('Invalid dashboard snapshot');
            queryClient.setQueryData(['dashboard'], parsed.data);
            const profile = queryClient.getQueryData<Profile>(['me']);
            if (profile && profile.settings.catalogVersion !== parsed.data.catalogVersion)
              void queryClient.invalidateQueries({ queryKey: ['me'] });
          },
          onclose() {
            throw Error('Stream closed');
          },
          onerror(error) {
            throw error;
          },
        });
      } catch {
        if (!abort.signal.aborted) {
          setState('reconnecting');
          timer = setTimeout(
            () => void connect(),
            Math.min(30000, 1000 * 2 ** Math.min(attempts++, 5)) + Math.random() * 500,
          );
        }
      }
    }
    void connect();
    return () => {
      abort.abort();
      clearTimeout(timer);
    };
  }, [connectedSession]);
  return state;
}
